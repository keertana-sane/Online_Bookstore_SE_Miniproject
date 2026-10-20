/**
 * Money helpers. All arithmetic is done in integer cents so that totals such as
 * 2 x 499.00 + 1 x 250.50 are exact (no floating point drift). SRS Appendix B
 * stores prices with two decimal places.
 */
function toNumber(value) {
  // Works for Number, numeric strings and Mongoose Decimal128 (via toString()).
  if (value !== null && typeof value === 'object') {
    return Number(value.toString());
  }
  return Number(value);
}

function toCents(value) {
  return Math.round(toNumber(value) * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

module.exports = { toCents, fromCents };
