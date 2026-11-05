#!/usr/bin/env node
/**
 * System validation for Cart, Checkout and Orders (Test Plan: TC-CART, TC-ORD, TC-TRK).
 *
 * Sends real HTTP requests to a RUNNING server that is connected to a seeded database, and
 * records what actually came back. It is not a Jest test (the file name does not end in
 * ".test.js"), so `npm test` never runs it by accident.
 *
 * The server must be started with MOCK_PAYMENT_MODE matching the phase you ask for:
 *
 *   phase "success"      MOCK_PAYMENT_MODE=success       (default; most test cases)
 *   phase "decline"      MOCK_PAYMENT_MODE=decline       (TC-ORD-06, TC-ORD-13)
 *   phase "timeout-once" MOCK_PAYMENT_MODE=timeout-once  (TC-ORD-07)
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 SEED_PASSWORD='<seed password>' \
 *   MONGODB_URI=mongodb://127.0.0.1:27017/bookstore \
 *   RESULTS_FILE=docs/test-reports/evidence/system-validation-results.json \
 *   node backend/tests/system/systemValidation.js success
 *
 * Needs the seeded administrator (admin@example.com, see backend/scripts/seed.js). It registers
 * three new customers on every run, so it can be repeated on the same database. It creates its own books (titles start with "SYSTEST") so it
 * does not depend on the 1,000 seeded books. MONGODB_URI is optional; with it, the
 * database is also checked directly (for example that a declined payment left a FAILED order).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const PASSWORD = process.env.SEED_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;
const RESULTS_FILE = process.env.RESULTS_FILE;
const PHASE = process.argv[2] || 'success';
const uuid = () => crypto.randomUUID();
const ADDRESS = '12 MG Road, Bengaluru 560001';

if (!PASSWORD) {
  console.error('Set SEED_PASSWORD to the password used when the database was seeded.');
  process.exit(2);
}

async function api(method, url, { token, body, headers } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const started = Date.now();
  const options = { method, headers: h };
  if (body !== undefined) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${url}`, options);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json, ms: Date.now() - started };
}

const V1 = '/api/v1';
const errCode = (r) => (r.body && r.body.error && r.body.error.code) || '(none)';
const money = (n) => Number(n).toFixed(2);

async function login(email) {
  const r = await api('POST', `${V1}/auth/login`, { body: { email, password: PASSWORD } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  const claims = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
  return { token: r.body.token, id: claims.sub, role: claims.role };
}

let counter = 0;
async function makeBook({ price = 100, stock = 5, title } = {}) {
  counter += 1;
  const r = await api('POST', '/api/books', {
    body: {
      title: title || `SYSTEST ${Date.now()}-${counter}`,
      author: 'System Tester',
      category: 'SystemTest',
      price,
      stock
    }
  });
  if (r.status !== 201) throw new Error(`could not create test book: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.book._id;
}
const stockOf = async (id) => (await api('GET', `/api/books/${id}`)).body.book.stock;
const getCart = (user) => api('GET', `${V1}/cart`, { token: user.token });
const addToCart = (user, bookId, quantity = 1) =>
  api('POST', `${V1}/cart/items`, { token: user.token, body: { bookId, quantity } });
const order = (user, { address = ADDRESS, key = uuid() } = {}) =>
  api('POST', `${V1}/orders`, { token: user.token, body: { shippingAddress: address }, headers: { 'Idempotency-Key': key } });
const emptyCart = async (user) => {
  const c = (await getCart(user)).body;
  for (const item of (c && c.items) || []) await api('DELETE', `${V1}/cart/items/${item.bookId}`, { token: user.token });
};

// ---- tiny test recorder -----------------------------------------------------------------
const results = [];
async function test(id, title, expected, fn) {
  const checks = [];
  const t = {
    check(ok, text) {
      checks.push({ ok: Boolean(ok), text });
    }
  };
  const started = Date.now();
  let error = null;
  try {
    await fn(t);
  } catch (e) {
    error = e;
  }
  const passed = !error && checks.length > 0 && checks.every((c) => c.ok);
  const actual = error ? `Test could not run: ${error.message}` : checks.map((c) => `${c.ok ? '✔' : '✘'} ${c.text}`).join('; ');
  results.push({ id, title, expected, phase: PHASE, result: passed ? 'Pass' : 'Fail', actual, durationMs: Date.now() - started });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id}  ${title}`);
  if (!passed) console.log(`      ${actual}`);
}

async function main() {
  const health = await api('GET', '/api/health');
  if (health.status !== 200) throw new Error(`server not healthy at ${BASE}: ${health.status}`);

  // Each run registers three brand-new customers, so earlier runs (orders, carts) can never
  // change the expected counts. Only the administrator comes from the seed data.
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const fresh = async (label) => {
    const email = `systest.${label}.${runId}@example.com`;
    const reg = await api('POST', `${V1}/auth/register`, { body: { name: `System Tester ${label}`, email, password: PASSWORD } });
    if (reg.status !== 201) throw new Error(`could not register ${email}: ${reg.status} ${JSON.stringify(reg.body)}`);
    return login(email);
  };
  const c1 = await fresh('one');
  const c2 = await fresh('two');
  const c3 = await fresh('three');
  const admin = await login('admin@example.com');

  let mongoose = null;
  if (process.env.MONGODB_URI) {
    mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const dbOrders = (customerId, filter = {}) =>
    mongoose.connection.collection('orders').find({ customerId: new mongoose.Types.ObjectId(customerId), ...filter }).toArray();

  if (PHASE === 'success') {
    // ===================== Cart =====================
    await test('TC-CART-01', 'Add an in-stock book to cart', 'Cart has 1 line with quantity 1', async (t) => {
      const book = await makeBook({ price: 100, stock: 5 });
      const r = await addToCart(c1, book, 1);
      t.check(r.status === 200, `POST /cart/items returned ${r.status}`);
      const line = r.body && r.body.items && r.body.items.find((i) => i.bookId === book);
      t.check(r.body.items.length === 1 && line && line.quantity === 1, `cart has ${r.body.items.length} line, quantity ${line && line.quantity}`);
      await emptyCart(c1);
    });

    await test('TC-CART-02', 'Reject out-of-stock book', '409 OUT_OF_STOCK; cart unchanged', async (t) => {
      const book = await makeBook({ stock: 0 });
      const r = await addToCart(c1, book, 1);
      t.check(r.status === 409 && errCode(r) === 'OUT_OF_STOCK', `returned ${r.status} ${errCode(r)}`);
      const cart = (await getCart(c1)).body;
      t.check(cart.items.length === 0, `cart has ${cart.items.length} lines afterwards`);
    });

    await test('TC-CART-03', 'Cart requires authentication', '401 UNAUTHORIZED', async (t) => {
      const book = await makeBook();
      const r = await api('POST', `${V1}/cart/items`, { body: { bookId: book, quantity: 1 } });
      t.check(r.status === 401 && errCode(r) === 'UNAUTHORIZED', `returned ${r.status} ${errCode(r)}`);
      const r2 = await api('GET', `${V1}/cart`, { token: 'not.a.token' });
      t.check(r2.status === 401, `tampered token on GET /cart returned ${r2.status}`);
    });

    await test('TC-CART-04', 'Update item quantity', 'Line quantity becomes 3; total updated', async (t) => {
      const book = await makeBook({ price: 100, stock: 5 });
      await addToCart(c1, book, 1);
      const r = await api('PATCH', `${V1}/cart/items/${book}`, { token: c1.token, body: { quantity: 3 } });
      t.check(r.status === 200, `PATCH returned ${r.status}`);
      t.check(r.body.items[0].quantity === 3, `quantity is ${r.body.items[0].quantity}`);
      t.check(r.body.total === 300, `total is ${r.body.total}`);
      await emptyCart(c1);
    });

    await test('TC-CART-05', 'Quantity boundaries rejected', '0 and -1 give 422; 6 gives 409; 5 accepted', async (t) => {
      const book = await makeBook({ price: 10, stock: 5 });
      await addToCart(c1, book, 1);
      const patch = (q) => api('PATCH', `${V1}/cart/items/${book}`, { token: c1.token, body: { quantity: q } });
      for (const q of [0, -1]) {
        const r = await patch(q);
        t.check(r.status === 422, `quantity ${q} returned ${r.status} ${errCode(r)}`);
      }
      const over = await patch(6);
      t.check(over.status === 409 && errCode(over) === 'OUT_OF_STOCK', `quantity 6 returned ${over.status} ${errCode(over)}`);
      const edge = await patch(5);
      t.check(edge.status === 200 && edge.body.items[0].quantity === 5, `quantity 5 returned ${edge.status}`);
      await emptyCart(c1);
    });

    await test('TC-CART-06', 'Remove an item', 'Only the other item remains; total recalculated', async (t) => {
      const a = await makeBook({ price: 40, stock: 5 });
      const b = await makeBook({ price: 25, stock: 5 });
      await addToCart(c1, a, 1);
      await addToCart(c1, b, 1);
      const r = await api('DELETE', `${V1}/cart/items/${a}`, { token: c1.token });
      t.check(r.status === 200, `DELETE returned ${r.status}`);
      t.check(r.body.items.length === 1 && r.body.items[0].bookId === b, `${r.body.items.length} line left`);
      t.check(r.body.total === 25, `total is ${r.body.total}`);
      await emptyCart(c1);
    });

    await test('TC-CART-07', 'Cart total equals sum of price x quantity', 'Total = 1248.50 (two decimal places)', async (t) => {
      const a = await makeBook({ price: 499.0, stock: 5 });
      const b = await makeBook({ price: 250.5, stock: 5 });
      await addToCart(c1, a, 2);
      const r = await addToCart(c1, b, 1);
      t.check(r.body.total === 1248.5, `total is ${money(r.body.total)}`);
      await emptyCart(c1);
    });

    await test('TC-CART-08', 'Empty cart total is zero', 'Total = 0.00', async (t) => {
      await emptyCart(c1);
      const r = await getCart(c1);
      t.check(r.status === 200 && r.body.total === 0 && r.body.items.length === 0, `status ${r.status}, total ${money(r.body.total)}, ${r.body.items.length} lines`);
    });

    await test('TC-CART-09', 'Disabled book in the cart is flagged, left out of the total and blocks checkout (new in Part 3)',
      'Line available=false, total excludes it; POST /orders gives 409 OUT_OF_STOCK; no order', async (t) => {
        const keep = await makeBook({ price: 100, stock: 5 });
        const gone = await makeBook({ price: 50, stock: 5 });
        await addToCart(c1, keep, 1);
        await addToCart(c1, gone, 1);
        const dis = await api('PATCH', `/api/books/${gone}/disable`);
        t.check(dis.status === 200, `book disabled (${dis.status})`);
        const cart = (await getCart(c1)).body;
        const line = cart.items.find((i) => i.bookId === gone);
        t.check(line && line.available === false, `disabled line available=${line && line.available}`);
        t.check(cart.total === 100, `total is ${money(cart.total)} (disabled book excluded)`);
        const before = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
        const r = await order(c1);
        t.check(r.status === 409 && errCode(r) === 'OUT_OF_STOCK', `checkout returned ${r.status} ${errCode(r)}`);
        const after = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
        t.check(before === after, `orders before ${before}, after ${after}`);
        await emptyCart(c1);
      });

    // ===================== Checkout =====================
    await test('TC-ORD-01', 'Reject checkout with empty cart', '422 CART_EMPTY; no order', async (t) => {
      await emptyCart(c1);
      const before = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
      const r = await order(c1);
      t.check(r.status === 422 && errCode(r) === 'CART_EMPTY', `returned ${r.status} ${errCode(r)}`);
      const after = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
      t.check(before === after, `orders before ${before}, after ${after}`);
    });

    await test('TC-ORD-02', 'Reject checkout with missing shipping address', '422 VALIDATION_ERROR naming shippingAddress; no order', async (t) => {
      const book = await makeBook({ stock: 5 });
      await addToCart(c1, book, 1);
      for (const address of ['', '   ', undefined]) {
        const r = await api('POST', `${V1}/orders`, {
          token: c1.token,
          body: address === undefined ? {} : { shippingAddress: address },
          headers: { 'Idempotency-Key': uuid() }
        });
        const field = r.body && r.body.error && r.body.error.details && r.body.error.details[0] && r.body.error.details[0].field;
        t.check(r.status === 422 && errCode(r) === 'VALIDATION_ERROR' && field === 'shippingAddress',
          `address ${JSON.stringify(address)} returned ${r.status} ${errCode(r)} field=${field}`);
      }
      t.check((await stockOf(book)) === 5, 'stock unchanged (5)');
      await emptyCart(c1);
    });

    await test('TC-ORD-03', 'Shipping address length boundary', '300 accepted; 301 rejected with 422', async (t) => {
      const book = await makeBook({ stock: 5 });
      await addToCart(c1, book, 1);
      const long = await order(c1, { address: 'x'.repeat(301) });
      t.check(long.status === 422, `301 characters returned ${long.status} ${errCode(long)}`);
      const ok = await order(c1, { address: 'x'.repeat(300) });
      t.check(ok.status === 201, `300 characters returned ${ok.status}`);
    });

    await test('TC-ORD-04', 'Successful checkout creates order', '201; PLACED, SUCCESS, orderNumber present; stock reduced; cart emptied', async (t) => {
      const book = await makeBook({ price: 499, stock: 5 });
      await addToCart(c1, book, 2);
      const r = await order(c1);
      t.check(r.status === 201, `returned ${r.status}`);
      t.check(r.body.orderStatus === 'PLACED' && r.body.paymentStatus === 'SUCCESS', `status ${r.body.orderStatus}, payment ${r.body.paymentStatus}`);
      t.check(/^ORD-\d{8}-[0-9A-F]{8}$/.test(r.body.orderNumber), `orderNumber ${r.body.orderNumber}`);
      t.check(r.body.total === 998, `total ${money(r.body.total)}`);
      t.check((await stockOf(book)) === 3, `stock is ${await stockOf(book)} (5 - 2)`);
      t.check((await getCart(c1)).body.items.length === 0, 'cart emptied');
    });

    await test('TC-ORD-05', 'Order numbers are unique', 'Two different orderNumber values', async (t) => {
      const book = await makeBook({ stock: 10 });
      await addToCart(c1, book, 1);
      const a = await order(c1);
      await addToCart(c1, book, 1);
      const b = await order(c1);
      t.check(a.status === 201 && b.status === 201, `statuses ${a.status}, ${b.status}`);
      t.check(a.body.orderNumber !== b.body.orderNumber, `${a.body.orderNumber} vs ${b.body.orderNumber}`);
    });

    await test('TC-ORD-08', 'Item sold out between cart and checkout', '409 OUT_OF_STOCK; no order for the late customer', async (t) => {
      const book = await makeBook({ price: 20, stock: 1 });
      await addToCart(c1, book, 1);
      await addToCart(c2, book, 1);
      const first = await order(c2);
      t.check(first.status === 201, `first customer returned ${first.status}`);
      const before = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
      const late = await order(c1);
      t.check(late.status === 409 && errCode(late) === 'OUT_OF_STOCK', `second customer returned ${late.status} ${errCode(late)}`);
      const after = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length;
      t.check(before === after, `second customer's orders before ${before}, after ${after}`);
      t.check((await stockOf(book)) === 0, `stock is ${await stockOf(book)}`);
      await emptyCart(c1);
    });

    await test('TC-ORD-09', 'Concurrent checkout of last copy (10 rounds)', 'Exactly one order succeeds, the other gets 409; stock never negative', async (t) => {
      let okRounds = 0;
      const seen = [];
      for (let round = 0; round < 10; round += 1) {
        const book = await makeBook({ price: 15, stock: 1 });
        await addToCart(c1, book, 1);
        await addToCart(c2, book, 1);
        const [a, b] = await Promise.all([order(c1), order(c2)]);
        const codes = [a.status, b.status].sort();
        const stock = await stockOf(book);
        seen.push(`${codes.join('/')} stock ${stock}`);
        if (codes[0] === 201 && codes[1] === 409 && stock === 0) okRounds += 1;
        await emptyCart(c1);
        await emptyCart(c2);
      }
      t.check(okRounds === 10, `${okRounds}/10 rounds gave one 201 and one 409 with stock 0 (${seen.join(' | ')})`);
    });

    await test('TC-ORD-11', 'Staff accounts cannot use the cart or orders (new in Part 3)', '403 FORBIDDEN on cart and orders', async (t) => {
      const checks = [
        ['GET', `${V1}/cart`],
        ['GET', `${V1}/orders`],
        ['POST', `${V1}/orders`]
      ];
      for (const [method, url] of checks) {
        const r = await api(method, url, { token: admin.token, body: method === 'POST' ? { shippingAddress: ADDRESS } : undefined, headers: { 'Idempotency-Key': uuid() } });
        t.check(r.status === 403, `${method} ${url} as ADMIN_STAFF returned ${r.status} ${errCode(r)}`);
      }
    });

    await test('TC-ORD-12', 'Idempotency-Key must be a UUID (new in Part 3)', '422 VALIDATION_ERROR for missing or malformed key; no order', async (t) => {
      const book = await makeBook({ stock: 5 });
      await addToCart(c1, book, 1);
      for (const key of [undefined, 'abc', '1234']) {
        const r = await api('POST', `${V1}/orders`, {
          token: c1.token,
          body: { shippingAddress: ADDRESS },
          headers: key ? { 'Idempotency-Key': key } : {}
        });
        t.check(r.status === 422 && errCode(r) === 'VALIDATION_ERROR', `key ${JSON.stringify(key)} returned ${r.status} ${errCode(r)}`);
      }
      t.check((await stockOf(book)) === 5, 'stock unchanged');
      await emptyCart(c1);
    });

    await test('TC-ORD-14', 'Tampered total in the request body is ignored (new in Part 3)', 'Order total is computed by the server', async (t) => {
      const book = await makeBook({ price: 200, stock: 5 });
      await addToCart(c1, book, 2);
      const r = await api('POST', `${V1}/orders`, {
        token: c1.token,
        body: { shippingAddress: ADDRESS, total: 1, items: [{ bookId: book, quantity: 1, unitPrice: 1 }] },
        headers: { 'Idempotency-Key': uuid() }
      });
      t.check(r.status === 201 && r.body.total === 400, `returned ${r.status}, total ${money(r.body.total)} (cart total 400.00)`);
    });

    // ===================== Tracking =====================
    await test('TC-TRK-07', 'Customer with no orders sees empty history', '200 with empty list', async (t) => {
      const r = await api('GET', `${V1}/orders`, { token: c3.token });
      t.check(r.status === 200 && Array.isArray(r.body.orders) && r.body.orders.length === 0, `returned ${r.status}, ${r.body.orders && r.body.orders.length} orders`);
    });

    await test('TC-TRK-08', 'Order history requires authentication', '401 UNAUTHORIZED', async (t) => {
      for (const [method, url] of [['GET', `${V1}/orders`], ['GET', `${V1}/orders/000000000000000000000000`], ['PATCH', `${V1}/orders/000000000000000000000000/cancel`]]) {
        const r = await api(method, url);
        t.check(r.status === 401 && errCode(r) === 'UNAUTHORIZED', `${method} ${url} returned ${r.status} ${errCode(r)}`);
      }
    });

    let placed;
    await test('TC-TRK-01', 'Order history lists own orders, newest first, with status (API)', 'Own 3 orders, newest first, each with status', async (t) => {
      const book = await makeBook({ price: 10, stock: 10 });
      const ids = [];
      for (let i = 0; i < 3; i += 1) {
        await addToCart(c3, book, i + 1);
        const r = await order(c3);
        ids.push(r.body.orderId);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const r = await api('GET', `${V1}/orders`, { token: c3.token });
      const got = r.body.orders.map((o) => o.orderId);
      t.check(r.status === 200 && got.length === 3, `${got.length} orders returned`);
      t.check(JSON.stringify(got) === JSON.stringify([...ids].reverse()), 'newest first');
      t.check(r.body.orders.every((o) => o.orderStatus === 'PLACED' && o.orderNumber), 'each has a status and number');
      const other = (await api('GET', `${V1}/orders`, { token: c2.token })).body.orders.map((o) => o.orderId);
      t.check(!got.some((id) => other.includes(id)), "another customer's list does not contain them");
      placed = ids[2];
    });

    await test('TC-TRK-02', 'View single order detail', '200; items, total, status and statusHistory shown', async (t) => {
      const r = await api('GET', `${V1}/orders/${placed}`, { token: c3.token });
      t.check(r.status === 200, `returned ${r.status}`);
      t.check(r.body.items.length === 1 && r.body.items[0].quantity === 3 && r.body.total === 30, `items ${r.body.items.length}, total ${money(r.body.total)}`);
      t.check(r.body.orderStatus === 'PLACED' && r.body.shippingAddress === ADDRESS, `status ${r.body.orderStatus}`);
      t.check(r.body.statusHistory.length === 1 && r.body.statusHistory[0].status === 'PLACED', `statusHistory ${JSON.stringify(r.body.statusHistory.map((h) => h.status))}`);
    });

    await test('TC-TRK-03', "Customer cannot read another customer's order", '404 ORDER_NOT_FOUND; no order data leaked', async (t) => {
      const r = await api('GET', `${V1}/orders/${placed}`, { token: c2.token });
      t.check(r.status === 404 && errCode(r) === 'ORDER_NOT_FOUND', `detail returned ${r.status} ${errCode(r)}`);
      t.check(!JSON.stringify(r.body).includes('SYSTEST') && !JSON.stringify(r.body).includes(ADDRESS), 'response has no order data');
      const c = await api('PATCH', `${V1}/orders/${placed}/cancel`, { token: c2.token });
      t.check(c.status === 404, `cancel returned ${c.status}`);
      const still = await api('GET', `${V1}/orders/${placed}`, { token: c3.token });
      t.check(still.body.orderStatus === 'PLACED', 'owner still sees PLACED');
      const bad = await api('GET', `${V1}/orders/not-an-id`, { token: c2.token });
      t.check(bad.status === 404, `malformed id returned ${bad.status}`);
    });

    await test('TC-TRK-05', 'Customer cancels own PLACED order', '200; status CANCELLED; stock restored', async (t) => {
      const book = await makeBook({ price: 10, stock: 5 });
      await addToCart(c1, book, 2);
      const o = await order(c1);
      t.check((await stockOf(book)) === 3, 'stock after order 3');
      const r = await api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token });
      t.check(r.status === 200 && r.body.orderStatus === 'CANCELLED', `returned ${r.status} ${r.body.orderStatus}`);
      t.check((await stockOf(book)) === 5, `stock after cancel ${await stockOf(book)}`);
      t.check(r.body.statusHistory.map((h) => h.status).join('>') === 'PLACED>CANCELLED', `history ${r.body.statusHistory.map((h) => h.status).join('>')}`);
    });

    await test('TC-TRK-06', 'Customer cannot cancel after PROCESSING', '409; status unchanged (code is INVALID_ORDER_STATUS_TRANSITION since the Sprint 2 state machine)', async (t) => {
      const book = await makeBook({ price: 10, stock: 5 });
      await addToCart(c1, book, 1);
      const o = await order(c1);
      const up = await api('PATCH', `${V1}/admin/orders/${o.body.orderId}/status`, { token: admin.token, body: { status: 'PROCESSING' } });
      t.check(up.status === 200 && up.body.orderStatus === 'PROCESSING', `staff moved it to PROCESSING (${up.status})`);
      const r = await api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token });
      t.check(r.status === 409 && errCode(r) === 'INVALID_ORDER_STATUS_TRANSITION', `cancel returned ${r.status} ${errCode(r)}`);
      const d = await api('GET', `${V1}/orders/${o.body.orderId}`, { token: c1.token });
      t.check(d.body.orderStatus === 'PROCESSING', `status still ${d.body.orderStatus}`);
      t.check((await stockOf(book)) === 4, `stock not restored (${await stockOf(book)})`);
    });

    await test('TC-TRK-09', 'Cancelling twice restores stock once (new in Part 3)', 'Second cancel 409; stock back to original exactly once', async (t) => {
      const book = await makeBook({ price: 10, stock: 5 });
      await addToCart(c1, book, 2);
      const o = await order(c1);
      const first = await api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token });
      const second = await api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token });
      t.check(first.status === 200, `first cancel ${first.status}`);
      t.check(second.status === 409, `second cancel ${second.status} ${errCode(second)}`);
      t.check((await stockOf(book)) === 5, `stock ${await stockOf(book)} (not 7)`);
    });

    await test('TC-TRK-10', 'Two cancels at the same moment restore stock once, 10 rounds (new in Part 3)', 'One 200 and one 409 per round; stock restored once', async (t) => {
      let good = 0;
      const seen = [];
      for (let i = 0; i < 10; i += 1) {
        const book = await makeBook({ price: 10, stock: 5 });
        await addToCart(c1, book, 2);
        const o = await order(c1);
        const [a, b] = await Promise.all([
          api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token }),
          api('PATCH', `${V1}/orders/${o.body.orderId}/cancel`, { token: c1.token })
        ]);
        const codes = [a.status, b.status].sort().join('/');
        const stock = await stockOf(book);
        seen.push(`${codes} stock ${stock}`);
        if (codes === '200/409' && stock === 5) good += 1;
      }
      t.check(good === 10, `${good}/10 rounds correct (${seen.join(' | ')})`);
    });

    await test('TC-TRK-11', 'Status machine blocks invalid staff transitions (new in Part 3)', 'PLACED to DELIVERED and CANCELLED to PROCESSING give 409; PLACED to PROCESSING to SHIPPED to DELIVERED works', async (t) => {
      const book = await makeBook({ price: 10, stock: 5 });
      await addToCart(c1, book, 1);
      const o = await order(c1);
      const set = (status) => api('PATCH', `${V1}/admin/orders/${o.body.orderId}/status`, { token: admin.token, body: { status } });
      const skip = await set('DELIVERED');
      t.check(skip.status === 409, `PLACED -> DELIVERED returned ${skip.status} ${errCode(skip)}`);
      const steps = [];
      for (const s of ['PROCESSING', 'SHIPPED', 'DELIVERED']) steps.push((await set(s)).status);
      t.check(steps.every((s) => s === 200), `PROCESSING/SHIPPED/DELIVERED returned ${steps.join('/')}`);
      const back = await set('PROCESSING');
      t.check(back.status === 409, `DELIVERED -> PROCESSING returned ${back.status}`);
      const asCustomer = await api('PATCH', `${V1}/admin/orders/${o.body.orderId}/status`, { token: c1.token, body: { status: 'SHIPPED' } });
      t.check(asCustomer.status === 403, `customer token on admin route returned ${asCustomer.status}`);
    });
  }

  if (PHASE === 'decline') {
    let declinedFor;
    await test('TC-ORD-06', 'Declined payment creates no confirmed order', '402 PAYMENT_DECLINED; order CANCELLED with paymentStatus FAILED; stock restored; cart kept', async (t) => {
      const book = await makeBook({ price: 100, stock: 5 });
      await addToCart(c1, book, 2);
      const r = await order(c1);
      t.check(r.status === 402 && errCode(r) === 'PAYMENT_DECLINED', `returned ${r.status} ${errCode(r)}`);
      t.check((await stockOf(book)) === 5, `stock restored (${await stockOf(book)})`);
      const cart = (await getCart(c1)).body;
      t.check(cart.items.length === 1 && cart.items[0].quantity === 2, `cart kept (${cart.items.length} line, quantity ${cart.items[0] && cart.items[0].quantity})`);
      if (mongoose) {
        const failed = await dbOrders(c1.id, { paymentStatus: 'FAILED' });
        t.check(failed.length >= 1 && failed[failed.length - 1].orderStatus === 'CANCELLED', `database holds ${failed.length} FAILED order(s), status ${failed.length && failed[failed.length - 1].orderStatus}`);
        const confirmed = await dbOrders(c1.id, { paymentStatus: 'SUCCESS' });
        t.check(confirmed.length === 0, `database holds ${confirmed.length} confirmed orders`);
      } else {
        t.check(true, '(database not checked: MONGODB_URI not set)');
      }
      declinedFor = book;
    });

    await test('TC-ORD-13', 'A declined payment is not shown in order history or detail (new in Part 3)', 'History empty; no confirmed order visible', async (t) => {
      const list = await api('GET', `${V1}/orders`, { token: c1.token });
      t.check(list.status === 200 && list.body.orders.length === 0, `history has ${list.body.orders.length} orders`);
      t.check(Boolean(declinedFor), 'a decline happened in TC-ORD-06');
      await emptyCart(c1);
    });
  }

  if (PHASE === 'timeout-once') {
    await test('TC-ORD-07', 'Retry after payment timeout does not duplicate order', 'First call 504 PAYMENT_TIMEOUT with no order; retry gives exactly one order; third call returns the same order (200)', async (t) => {
      const book = await makeBook({ price: 100, stock: 5 });
      await addToCart(c1, book, 1);
      const key = uuid();
      const first = await order(c1, { key });
      t.check(first.status === 504 && errCode(first) === 'PAYMENT_TIMEOUT', `first call returned ${first.status} ${errCode(first)} after ${first.ms} ms`);
      t.check((await api('GET', `${V1}/orders`, { token: c1.token })).body.orders.length === 0, 'no order after the timeout');
      t.check((await stockOf(book)) === 5, `stock released (${await stockOf(book)})`);
      const retry = await order(c1, { key });
      t.check(retry.status === 201, `retry returned ${retry.status}`);
      const third = await order(c1, { key });
      t.check(third.status === 200 && third.body.orderId === retry.body.orderId, `third call returned ${third.status}, same order ${third.body.orderId === retry.body.orderId}`);
      const list = (await api('GET', `${V1}/orders`, { token: c1.token })).body.orders;
      t.check(list.length === 1, `exactly ${list.length} order in history`);
      t.check((await stockOf(book)) === 4, `stock reduced once (${await stockOf(book)})`);
      if (mongoose) {
        const all = await dbOrders(c1.id);
        t.check(all.length === 1, `database holds ${all.length} order(s) for this customer`);
      }
    });
  }

  if (mongoose) await mongoose.disconnect();
}

main()
  .catch((e) => {
    console.error('Aborted:', e.message);
    results.push({ id: 'SETUP', title: 'Test run', expected: 'runs', phase: PHASE, result: 'Fail', actual: e.message });
  })
  .finally(() => {
    const passed = results.filter((r) => r.result === 'Pass').length;
    console.log(`\n${PHASE}: ${passed}/${results.length} passed`);
    if (RESULTS_FILE) {
      fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
      let all = [];
      try {
        all = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      } catch {
        all = [];
      }
      const byId = new Map(all.map((r) => [r.id, r]));
      for (const r of results) byId.set(r.id, { ...r, ranAt: new Date().toISOString() });
      fs.writeFileSync(RESULTS_FILE, `${JSON.stringify([...byId.values()], null, 2)}\n`);
    }
    process.exit(passed === results.length ? 0 : 1);
  });
