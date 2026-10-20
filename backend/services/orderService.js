const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { toCents, fromCents } = require('../utils/money');
const { validationError } = require('../utils/validators');

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

/**
 * Order module, checkout part (SAD C-07, sequence SD-1 "Place Order").
 * Covers FR-009 (valid checkout only), FR-010 (unique order number), FR-016 (payment
 * result recorded, no confirmed order on failure) and NFR-004 (retry never creates
 * a second order).
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
    const trimmed = typeof address === 'string' ? address.trim() : '';
    if (trimmed.length < 1 || trimmed.length > MAX_ADDRESS) {
      throw validationError(
        'shippingAddress',
        `shippingAddress is required and must be 1 to ${MAX_ADDRESS} characters`
      );
    }
    return trimmed;
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

  return { placeOrder };
}

module.exports = { createOrderService, toResponse };
