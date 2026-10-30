const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { toCents, fromCents } = require('../utils/money');
const { isObjectId, validateText, validationError } = require('../utils/validators');
const { ORDER_STATUSES } = require('../models/Order');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ADDRESS = 300; // SRS Appendix B: shipping_address length 300

function defaultOrderNumber(now = new Date()) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${day}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Shape returned to the client for an order (SAD API-09 201 body). */
function toResponse(order) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    total: order.total,
    items: order.items.map(({ bookId, title, quantity, unitPrice }) => ({
      bookId, title, quantity, unitPrice
    })),
    createdAt: order.createdAt
  };
}

/** One row of the order history list (SAD API-10). */
function toSummary(order) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    total: order.total,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    createdAt: order.createdAt
  };
}

/**
 * Full order for the detail screen (SAD API-11, API-12): items, total, status and
 * statusHistory. The actor id is replaced by a label so no user ids are exposed.
 */
function toDetail(order) {
  return {
    ...toResponse(order),
    shippingAddress: order.shippingAddress,
    statusHistory: order.statusHistory.map((h) => ({
      status: h.status,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      at: h.at,
      by: h.actor === 'system' ? 'system' : h.actor === order.customerId ? 'you' : 'staff'
    }))
  };
}

/**
 * Order module (SAD C-07, sequence SD-1 "Place Order").
 * Checkout covers FR-009 (valid checkout only), FR-010 (unique order number), FR-016
 * (payment result recorded, no confirmed order on failure) and NFR-004 (retry never
 * creates a second order). Order history, detail and cancel cover FR-011, FR-012 and
 * business rule 6.5 (a customer may cancel only while the order is PLACED).
 */
function createOrderService({
  cartRepo,
  bookRepo,
  orderRepo,
  paymentAdapter,
  generateOrderNumber = defaultOrderNumber,
  now = () => new Date()
}) {
  function validateKey(key) {
    if (typeof key !== 'string' || !UUID.test(key)) {
      throw validationError('Idempotency-Key', 'Idempotency-Key header must be a UUID');
    }
    return key;
  }

  function validateAddress(address) {
    return validateText(address, 'shippingAddress', MAX_ADDRESS);
  }

  async function persistOrder(data) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await orderRepo.create({ ...data, orderNumber: generateOrderNumber() });
      } catch (err) {
        if (err.duplicate === 'orderNumber') continue; // FR-010: pick another number
        throw err;
      }
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate an order number');
  }

  /** What to answer when this (customer, key) already produced an order. */
  function outcomeForExisting(order) {
    if (order.paymentStatus === 'FAILED') {
      throw new AppError(402, 'PAYMENT_DECLINED', 'Payment was declined');
    }
    return { order: toResponse(order), replayed: true };
  }

  /**
   * Place an order from the customer's cart.
   * Returns { order, replayed }. replayed=true means the same Idempotency-Key had
   * already produced this order and nothing new was created.
   */
  async function placeOrder(customerId, { shippingAddress, idempotencyKey } = {}) {
    const key = validateKey(idempotencyKey);
    const address = validateAddress(shippingAddress);

    // Retry of an earlier request: answer from the stored order (SAD SD-1 step 5).
    const existing = await orderRepo.findByCustomerAndKey(customerId, key);
    if (existing) return outcomeForExisting(existing);

    const cart = await cartRepo.findByCustomerId(customerId);
    if (!cart || cart.items.length === 0) {
      throw new AppError(422, 'CART_EMPTY', 'Your cart is empty');
    }

    // The server reads cart and prices itself; any total sent by the client is ignored.
    const books = await bookRepo.findByIds(cart.items.map((i) => i.bookId));
    const byId = new Map(books.map((b) => [b.id, b]));

    const unavailable = [];
    for (const item of cart.items) {
      const book = byId.get(item.bookId);
      const available = book && book.isActive ? book.stock : 0;
      if (available < item.quantity) {
        unavailable.push({ bookId: item.bookId, requested: item.quantity, available });
      }
    }
    if (unavailable.length > 0) {
      throw new AppError(409, 'OUT_OF_STOCK', 'Some books are out of stock', unavailable);
    }

    const lines = cart.items.map((item) => {
      const book = byId.get(item.bookId);
      return {
        bookId: item.bookId,
        title: book.title,
        quantity: item.quantity,
        unitPrice: fromCents(toCents(book.price))
      };
    });
    const total = fromCents(
      lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.quantity, 0)
    );

    // Reserve stock atomically before payment; release on any failure below.
    const reserved = [];
    let stockHeld = true;
    const releaseStock = async () => {
      if (!stockHeld) return;
      stockHeld = false;
      for (const item of reserved) {
        await bookRepo.releaseStock(item.bookId, item.quantity);
      }
    };

    try {
      for (const item of cart.items) {
        const ok = await bookRepo.reserveStock(item.bookId, item.quantity);
        if (!ok) {
          // Someone else took the last copies between our check and now.
          throw new AppError(409, 'OUT_OF_STOCK', 'Some books are out of stock', [
            { bookId: item.bookId, requested: item.quantity }
          ]);
        }
        reserved.push(item);
      }

      // The payment reference is the idempotency key, so a retry re-asks the same
      // idempotent payment and can never pay (or create an order) twice.
      const payment = await paymentAdapter.authorize({ paymentRef: key, amount: total });

      if (payment.status === 'TIMEOUT') {
        throw new AppError(504, 'PAYMENT_TIMEOUT', 'The payment service did not answer; please retry');
      }

      const base = {
        customerId,
        items: lines,
        total,
        shippingAddress: address,
        paymentRef: key,
        idempotencyKey: key
      };

      if (payment.status !== 'SUCCESS') {
        // Declined: keep a CANCELLED order with paymentStatus FAILED for the record (SAD 4.4),
        // never a confirmed one. Stock is released and the cart is kept.
        try {
          await persistOrder({
            ...base,
            orderStatus: 'CANCELLED',
            paymentStatus: 'FAILED',
            statusHistory: [{ status: 'CANCELLED', actor: 'system', at: now() }]
          });
        } catch (err) {
          if (err.duplicate !== 'idempotencyKey') throw err;
        }
        throw new AppError(402, 'PAYMENT_DECLINED', 'Payment was declined');
      }

      let order;
      try {
        order = await persistOrder({
          ...base,
          orderStatus: 'PLACED',
          paymentStatus: 'SUCCESS',
          statusHistory: [{ status: 'PLACED', actor: customerId, at: now() }]
        });
      } catch (err) {
        if (err.duplicate === 'idempotencyKey') {
          // A concurrent request with the same key won the race: hand back its order.
          const winner = await orderRepo.findByCustomerAndKey(customerId, key);
          await releaseStock(); // our own reservation is not needed
          return outcomeForExisting(winner);
        }
        throw err;
      }

      stockHeld = false; // stock now belongs to the confirmed order
      await cartRepo.clear(customerId);
      return { order: toResponse(order), replayed: false };
    } catch (err) {
      await releaseStock();
      throw err;
    }
  }

  /** Own orders, newest first (FR-012, TC-TRK-01, TC-TRK-07). An empty list is a normal 200. */
  async function listOrders(customerId) {
    const orders = await orderRepo.listByCustomer(customerId);
    return { orders: orders.map(toSummary) };
  }

  async function findOwnOrder(customerId, orderId) {
    const order = await orderRepo.findByIdForCustomer(customerId, orderId);
    // Someone else's order and a missing order look the same, so nothing leaks (TC-TRK-03).
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return order;
  }

  /** One own order with items, total, status and statusHistory (TC-TRK-02). */
  async function getOrder(customerId, orderId) {
    return toDetail(await findOwnOrder(customerId, orderId));
  }

  /**
   * Customer cancels an order. Allowed only while PLACED (SRS 6.5, TC-TRK-05/06).
   * The status change is one atomic conditional update, so a double click or a
   * staff update at the same moment can never restore the stock twice.
   */
  async function cancelOrder(customerId, orderId) {
    const order = await findOwnOrder(customerId, orderId);
    const invalidTransition = () =>
      new AppError(
        409,
        'INVALID_ORDER_STATUS_TRANSITION',
        `Invalid order status transition: ${order.orderStatus} -> CANCELLED`,
        [{ orderStatus: order.orderStatus }]
      );
    if (order.orderStatus !== 'PLACED') throw invalidTransition();

    const cancelled = await orderRepo.transitionStatus(customerId, orderId, 'PLACED', 'CANCELLED', {
      status: 'CANCELLED',
      actor: customerId,
      at: now()
    });
    if (!cancelled) {
      throw new AppError(
        409,
        'CANCEL_NOT_ALLOWED',
        'Only an order that is still PLACED can be cancelled',
        [{ orderStatus: 'PLACED' }]
      );
    } // lost the race: already cancelled or moved on

    for (const item of order.items) {
      await bookRepo.releaseStock(item.bookId, item.quantity); // restore reserved stock
    }
    return toDetail(cancelled);
  }

  async function listAdminOrders(status) {
    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      throw validationError('status', 'status must be one of ' + ORDER_STATUSES.join(', '));
    }
    const orders = await orderRepo.listAll(status);
    return { orders: orders.map(toSummary) };
  }

  async function updateAdminOrderStatus(actorId, orderId, status) {
    if (!isObjectId(orderId)) {
      throw validationError('orderId', 'orderId must be a valid id');
    }
    if (!ORDER_STATUSES.includes(status)) {
      throw validationError('status', 'status must be one of ' + ORDER_STATUSES.join(', '));
    }

    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');

    const updated = await orderRepo.transitionStatusForAdmin(orderId, order.orderStatus, status, {
      actor: String(actorId),
      at: now()
    });
    if (!updated) {
      const current = await orderRepo.findById(orderId);
      throw new AppError(
        409,
        'INVALID_ORDER_STATUS_TRANSITION',
        `Invalid order status transition: ${current ? current.orderStatus : order.orderStatus} -> ${status}`
      );
    }
    return toDetail(updated);
  }

  return { placeOrder, listOrders, getOrder, cancelOrder, listAdminOrders, updateAdminOrderStatus };
}

module.exports = { createOrderService, toResponse, toSummary, toDetail };
