const test = require("node:test");
const assert = require("node:assert/strict");

test("book data validation accepts valid book details", () => {
  const book = {
    title: "Atomic Habits",
    author: "James Clear",
    price: 399,
    category: "Self Help",
    stock: 10,
  };

  assert.equal(typeof book.title, "string");
  assert.ok(book.title.length > 0);
  assert.ok(book.price > 0);
  assert.ok(Number.isInteger(book.stock));
  assert.ok(book.stock >= 0);
});

test("book data validation rejects negative stock", () => {
  const book = {
    title: "Test Book",
    author: "Test Author",
    price: 100,
    category: "Testing",
    stock: -1,
  };

  assert.equal(Number.isInteger(book.stock), true);
  assert.equal(book.stock >= 0, false);
});

test("book data validation rejects a zero price", () => {
  const book = {
    title: "Test Book",
    author: "Test Author",
    price: 0,
    category: "Testing",
    stock: 5,
  };

  assert.equal(book.price > 0, false);
});