const AppError = require('./AppError');
const { INPUT_LIMITS } = require('./inputLimits');

const OBJECT_ID = /^[a-f\d]{24}$/i;

function isObjectId(value) {
  return typeof value === 'string' && OBJECT_ID.test(value);
}

function validationError(field, message) {
  return new AppError(422, 'VALIDATION_ERROR', message, [{ field, message }]);
}

function validateText(value, field, maxLength, { optional = false } = {}) {
  if (optional && value === undefined) return undefined;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[<>]/.test(text)) {
    throw validationError(field, `${field} must be 1 to ${maxLength} plain-text characters`);
  }
  return text;
}

/** Throws 422 unless value is a valid 24-hex book id. */
function requireBookId(value) {
  if (!isObjectId(value)) {
    throw validationError('bookId', 'bookId must be a valid id');
  }
  return value;
}

/**
 * Quantity must be a whole number >= 1 (SRS cart rules; 0 and -1 are rejected).
 * `fallback` is used when the field is omitted (e.g. add-to-cart defaults to 1).
 */
function parseQuantity(value, fallback) {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw validationError('quantity', 'quantity must be a whole number of at least 1');
  }
  return value;
}

module.exports = {
  isObjectId,
  requireBookId,
  parseQuantity,
  validateText,
  validationError,
  INPUT_LIMITS
};
