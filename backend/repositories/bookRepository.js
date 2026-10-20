const Book = require('../models/Book');
const { isObjectId } = require('../utils/validators');

/**
 * Cart & checkout only talk to books through this repository.
 *
 * DEVIATION NOTE: the Book model (BK-03) uses snake_case fields (stock_quantity,
 * is_active) and Number prices, while the SAD data model says stockQuantity,
 * isActive and Decimal128. All field names are mapped here and nowhere else, so
 * if the model is aligned with the SAD only FIELD below has to change.
 */
const FIELD = { stock: 'stock_quantity', active: 'is_active' };

function toDomain(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    title: doc.title,
    author: doc.author,
    price: doc.price,
    stock: doc[FIELD.stock] ?? doc.stockQuantity ?? 0,
    isActive: doc[FIELD.active] ?? doc.isActive ?? true
  };
}

async function findById(id) {
  if (!isObjectId(id)) return null;
  return toDomain(await Book.findById(id).lean());
}

async function findByIds(ids) {
  const valid = ids.filter(isObjectId);
  if (valid.length === 0) return [];
  const docs = await Book.find({ _id: { $in: valid } }).lean();
  return docs.map(toDomain);
}

/**
 * Atomically takes `quantity` units out of stock. Returns true on success and
 * false when the book is inactive or has fewer than `quantity` units, so two
 * customers can never both buy the last copy (SAD: stock reserved atomically).
 */
async function reserveStock(id, quantity) {
  const result = await Book.updateOne(
    { _id: id, [FIELD.active]: true, [FIELD.stock]: { $gte: quantity } },
    { $inc: { [FIELD.stock]: -quantity } }
  );
  return result.modifiedCount === 1;
}

/** Puts previously reserved units back (payment declined/timed out, order cancelled). */
async function releaseStock(id, quantity) {
  await Book.updateOne({ _id: id }, { $inc: { [FIELD.stock]: quantity } });
}

module.exports = { findById, findByIds, reserveStock, releaseStock };
