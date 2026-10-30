const INPUT_LIMITS = Object.freeze({
  name: 100,
  email: 100,
  password: 72,
  shippingAddress: 300,
  title: 150,
  author: 100,
  category: 50,
  search: 100,
  stock: 999999,
  price: 99999999.99
});

function isValidPrice(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= INPUT_LIMITS.price &&
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value))
  );
}

module.exports = { INPUT_LIMITS, isValidPrice };
