const Cart = require('../models/Cart');

function toDomain(doc) {
  if (!doc) return null;
  return {
    customerId: String(doc.customerId),
    items: (doc.items || []).map((i) => ({ bookId: String(i.bookId), quantity: i.quantity }))
  };
}

/** Returns the customer's cart, or null if they never added anything. */
async function findByCustomerId(customerId) {
  return toDomain(await Cart.findOne({ customerId }).lean());
}

/** Replaces the cart's items (creates the cart on first use). */
async function saveItems(customerId, items) {
  const doc = await Cart.findOneAndUpdate(
    { customerId },
    { $set: { items } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toDomain(doc);
}

async function clear(customerId) {
  await Cart.updateOne({ customerId }, { $set: { items: [] } });
}

module.exports = { findByCustomerId, saveItems, clear };
