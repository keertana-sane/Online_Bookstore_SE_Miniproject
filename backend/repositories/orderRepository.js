const { isObjectId } = require('../utils/validators');
const AppError = require('../utils/AppError');
const { assertOrderStatusTransition } = require('../services/orderStatusMachine');

function toDomain(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    orderNumber: doc.orderNumber,
    customerId: String(doc.customerId),
    items: doc.items.map((i) => ({
      bookId: String(i.bookId),
      title: i.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice
    })),
    total: doc.total,
    shippingAddress: doc.shippingAddress,
    orderStatus: doc.orderStatus,
    paymentStatus: doc.paymentStatus,
    paymentRef: doc.paymentRef,
    idempotencyKey: doc.idempotencyKey,
    statusHistory: doc.statusHistory || [],
    createdAt: doc.createdAt
  };
}

// A declined payment is kept as a CANCELLED order with paymentStatus FAILED for the
// record (SAD 4.4), but it was never a confirmed order, so customers never see it.
const CONFIRMED = { paymentStatus: 'SUCCESS' };

function createOrderRepository(Order) {
  /**
   * Inserts an order. A unique-index violation is reported as an error with
   * `duplicate` set to 'orderNumber' or 'idempotencyKey' so the service can react
   * (pick a new number, or treat the request as a retry).
   */
  async function create(data) {
    try {
      const doc = await Order.create(data);
      return toDomain(doc.toObject());
    } catch (err) {
      if (err && err.code === 11000) {
        const pattern = err.keyPattern || {};
        const duplicate = pattern.orderNumber ? 'orderNumber' : 'idempotencyKey';
        throw Object.assign(new Error('duplicate key'), { duplicate });
      }
      throw err;
    }
  }

  async function findByCustomerAndKey(customerId, idempotencyKey) {
    return toDomain(await Order.findOne({ customerId, idempotencyKey }).lean());
  }

  /** The customer's confirmed orders, newest first (FR-012). */
  async function listByCustomer(customerId) {
    const docs = await Order.find({ customerId, ...CONFIRMED })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return docs.map(toDomain);
  }

  /** Confirmed orders for administrators, optionally filtered by status. */
  async function listAll(status) {
    const filter = { ...CONFIRMED };
    if (status !== undefined) filter.orderStatus = status;
    const docs = await Order.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    return docs.map(toDomain);
  }

  /** One confirmed order for an administrator. */
  async function findById(orderId) {
    if (!isObjectId(orderId)) return null;
    return toDomain(await Order.findOne({ _id: orderId, ...CONFIRMED }).lean());
  }

  /** One confirmed order, only if it belongs to this customer; otherwise null. */
  async function findByIdForCustomer(customerId, orderId) {
    if (!isObjectId(orderId)) return null;
    return toDomain(await Order.findOne({ _id: orderId, customerId, ...CONFIRMED }).lean());
  }

  /**
   * Moves an order from one status to another in a single atomic update and records
   * it in statusHistory. Returns the updated order, or null when the order is not the
   * customer's or is no longer in `fromStatus` (someone else changed it first).
   */
  async function transitionStatus(customerId, orderId, fromStatus, toStatus, historyEntry) {
    try {
      assertOrderStatusTransition(fromStatus, toStatus);
    } catch (err) {
      if (err.code === 'INVALID_ORDER_STATUS_TRANSITION') {
        throw new AppError(409, err.code, err.message);
      }
      throw err;
    }
    if (!isObjectId(orderId)) return null;
    const completeHistoryEntry = {
      ...historyEntry,
      status: toStatus,
      previousStatus: fromStatus,
      newStatus: toStatus
    };
    const doc = await Order.findOneAndUpdate(
      { _id: orderId, customerId, ...CONFIRMED, orderStatus: fromStatus },
      { $set: { orderStatus: toStatus }, $push: { statusHistory: completeHistoryEntry } },
      { new: true }
    ).lean();
    return toDomain(doc);
  }

  async function transitionStatusForAdmin(orderId, fromStatus, toStatus, historyEntry) {
    try {
      assertOrderStatusTransition(fromStatus, toStatus);
    } catch (err) {
      if (err.code === 'INVALID_ORDER_STATUS_TRANSITION') {
        throw new AppError(409, err.code, err.message);
      }
      throw err;
    }
    if (!isObjectId(orderId)) return null;
    const completeHistoryEntry = {
      ...historyEntry,
      status: toStatus,
      previousStatus: fromStatus,
      newStatus: toStatus
    };
    const doc = await Order.findOneAndUpdate(
      { _id: orderId, ...CONFIRMED, orderStatus: fromStatus },
      { $set: { orderStatus: toStatus }, $push: { statusHistory: completeHistoryEntry } },
      { new: true }
    ).lean();
    return toDomain(doc);
  }

  return {
    create,
    findByCustomerAndKey,
    listByCustomer,
    listAll,
    findById,
    findByIdForCustomer,
    transitionStatus,
    transitionStatusForAdmin
  };
}

module.exports = { createOrderRepository };
