const AppError = require('../utils/AppError');
const { toCents, fromCents } = require('../utils/money');
const { parseQuantity } = require('../utils/validators');

/**
 * Cart module (SAD C-06): add, update, remove, stock check, cart total.
 * Business rules live here; controllers only translate HTTP <-> service calls.
 * Repositories are injected so the rules can be unit tested without MongoDB (NFR-005/006).
 *
 * Covers FR-006 (add in-stock book), FR-007 (update quantity / remove), FR-008 (total).
 */
function createCartService({ cartRepo, bookRepo }) {
  /**
   * Builds the response shape used by every cart endpoint (SAD "Other contract rules"):
   * full cart with per-line subtotal and the recomputed total.
   * A line whose book was disabled or deleted after being added is returned with
   * available=false and is left out of the total; checkout rejects such carts.
   */
  async function buildView(cart) {
    const items = cart ? cart.items : [];
    const books = await bookRepo.findByIds(items.map((i) => i.bookId));
    const byId = new Map(books.map((b) => [b.id, b]));

    let totalCents = 0;
    const lines = items.map((item) => {
      const book = byId.get(item.bookId);
      const available = Boolean(book && book.isActive);
      const unitCents = book ? toCents(book.price) : 0;
      const subtotalCents = available ? unitCents * item.quantity : 0;
      totalCents += subtotalCents;
      return {
        bookId: item.bookId,
        title: book ? book.title : null,
        unitPrice: fromCents(unitCents),
        quantity: item.quantity,
        subtotal: fromCents(subtotalCents),
        available,
        inStock: available && book.stock >= item.quantity
      };
    });

    return { items: lines, itemCount: lines.length, total: fromCents(totalCents) };
  }

  async function getCart(customerId) {
    return buildView(await cartRepo.findByCustomerId(customerId));
  }

  async function loadActiveBook(bookId) {
    const book = await bookRepo.findById(bookId);
    if (!book || !book.isActive) {
      throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');
    }
    return book;
  }

  function outOfStock(book, requested) {
    return new AppError(409, 'OUT_OF_STOCK', 'Not enough stock for this book', [
      { bookId: book.id, requested, available: book.stock }
    ]);
  }

  /** FR-006: only in-stock books can be added; adding again increases the quantity. */
  async function addItem(customerId, bookId, quantity) {
    const qty = parseQuantity(quantity, 1);
    const book = await loadActiveBook(bookId);

    const cart = await cartRepo.findByCustomerId(customerId);
    const items = cart ? cart.items.map((i) => ({ ...i })) : [];
    const existing = items.find((i) => i.bookId === bookId);
    const newQty = (existing ? existing.quantity : 0) + qty;

    if (book.stock < 1 || newQty > book.stock) {
      throw outOfStock(book, newQty);
    }

    if (existing) {
      existing.quantity = newQty;
    } else {
      items.push({ bookId, quantity: qty });
    }
    return buildView(await cartRepo.saveItems(customerId, items));
  }

  /** FR-007: set a new quantity (>= 1, not above stock). Use removeItem to delete a line. */
  async function updateItem(customerId, bookId, quantity) {
    const qty = parseQuantity(quantity);
    const cart = await cartRepo.findByCustomerId(customerId);
    const items = cart ? cart.items.map((i) => ({ ...i })) : [];
    const line = items.find((i) => i.bookId === bookId);
    if (!line) {
      throw new AppError(404, 'BOOK_NOT_FOUND', 'That book is not in your cart');
    }

    const book = await loadActiveBook(bookId);
    if (qty > book.stock) {
      throw outOfStock(book, qty);
    }

    line.quantity = qty;
    return buildView(await cartRepo.saveItems(customerId, items));
  }

  /** FR-007: remove a line from the cart. */
  async function removeItem(customerId, bookId) {
    const cart = await cartRepo.findByCustomerId(customerId);
    const items = cart ? cart.items : [];
    if (!items.some((i) => i.bookId === bookId)) {
      throw new AppError(404, 'BOOK_NOT_FOUND', 'That book is not in your cart');
    }
    const remaining = items.filter((i) => i.bookId !== bookId);
    return buildView(await cartRepo.saveItems(customerId, remaining));
  }

  return { getCart, addItem, updateItem, removeItem, buildView };
}

module.exports = { createCartService };
