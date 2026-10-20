const Order = require('../models/Order');

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

module.exports = { create, findByCustomerAndKey };
