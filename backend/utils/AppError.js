/**
 * Error with an HTTP status and a stable machine-readable code.
 * Codes follow SAD section 4.4 (OUT_OF_STOCK, BOOK_NOT_FOUND, CART_EMPTY, ...).
 * The central error-handling middleware turns these into the standard envelope:
 *   { error: { code, message, details, requestId } }
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
