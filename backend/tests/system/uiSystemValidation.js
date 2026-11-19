#!/usr/bin/env node
/**
 * Browser-level system validation (Test Plan: TC-ORD-10, TC-TRK-01 on screen, TC-TRK-07 on screen).
 *
 * Drives the real React app in headless Chromium against a RUNNING server and database.
 * Needs Playwright (`npm i --no-save playwright && npx playwright install chromium`, not part of
 * the project's dependencies) and the client dev server (`cd client && npm run dev`).
 *
 *   BASE_URL=http://127.0.0.1:5055 CLIENT_URL=http://127.0.0.1:5173 \
 *   SEED_PASSWORD='<seed password>' SHOTS_DIR=docs/test-reports/evidence/screenshots \
 *   RESULTS_FILE=docs/test-reports/evidence/ui-validation-results.json \
 *   node backend/tests/system/uiSystemValidation.js
 *
 * The client must be started with VITE_API_URL=$BASE_URL/api and VITE_AUTH_API_URL=$BASE_URL/api/v1.
 * It registers a new customer and signs in through the API, then places the token in the browser
 * session (the login dialog itself is covered by the auth tests).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:5055').replace(/\/$/, '');
const CLIENT = (process.env.CLIENT_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SEED_PASSWORD;
const SHOTS = process.env.SHOTS_DIR;
const RESULTS_FILE = process.env.RESULTS_FILE;
if (!PASSWORD) {
  console.error('Set SEED_PASSWORD.');
  process.exit(2);
}

const call = async (method, url, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const options = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${url}`, options);
  return { status: res.status, body: await res.json().catch(() => null) };
};

const results = [];
async function test(id, title, expected, fn) {
  const checks = [];
  let error = null;
  try {
    await fn({ check: (ok, text) => checks.push({ ok: Boolean(ok), text }) });
  } catch (e) {
    error = e;
  }
  const passed = !error && checks.length > 0 && checks.every((c) => c.ok);
  const actual = error ? `Test could not run: ${error.message.split('\n')[0]}` : checks.map((c) => `${c.ok ? '✔' : '✘'} ${c.text}`).join('; ');
  results.push({ id, title, expected, phase: 'ui', result: passed ? 'Pass' : 'Fail', actual });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id}  ${title}${passed ? '' : `\n      ${actual}`}`);
}

async function main() {
  const runId = crypto.randomBytes(3).toString('hex');
  const email = `systest.ui.${runId}@example.com`;
  await call('POST', '/api/v1/auth/register', { body: { name: 'UI Tester', email, password: PASSWORD } });
  const login = await call('POST', '/api/v1/auth/login', { body: { email, password: PASSWORD } });
  const { token, role } = login.body;

  const title = `SYSTEST UI Book ${runId}`;
  const adminLogin = await call('POST', '/api/v1/auth/login', { body: { email: 'admin@example.com', password: PASSWORD } });
  const created = await call('POST', '/api/books', { token: adminLogin.body.token, body: { title, author: 'UI Tester', category: 'SystemTest', price: 499, stock: 5 } });
  const bookId = created.body.book._id;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Requests to other websites (Google Fonts) are not the app's own behaviour and can be blocked
  // in a restricted test environment, so only errors from the app or its API are counted.
  const external = (url) => url && !url.startsWith(CLIENT) && !url.startsWith(BASE);
  page.on('console', (m) => m.type() === 'error' && !external(m.location().url) && errors.push(m.text()));
  const shot = async (name) => SHOTS && (fs.mkdirSync(SHOTS, { recursive: true }), page.screenshot({ path: path.join(SHOTS, name), fullPage: true }));
  const signIn = async () => {
    await page.goto(CLIENT);
    await page.evaluate(([t, e, r]) => {
      sessionStorage.setItem('token', t);
      sessionStorage.setItem('userEmail', e);
      sessionStorage.setItem('userRole', r);
    }, [token, email, role || 'CUSTOMER']);
    await page.reload();
  };

  await signIn();

  await test('TC-TRK-07-UI', 'New customer sees "No orders yet" on screen', 'Message "No orders yet" shown', async (t) => {
    await page.getByRole('button', { name: /^(My orders|Orders)$/ }).first().click();
    await page.waitForSelector('text=No orders yet', { timeout: 10000 });
    t.check(true, '"No orders yet" is visible');
    await shot('01-no-orders.png');
    await page.getByRole('button', { name: /^(Catalog|Books|Shop)$/ }).first().click().catch(() => {});
  });

  let orderNumber;
  await test('TC-ORD-10', 'Checkout flow on screen: catalog, cart, checkout, confirmation', 'Confirmation shows unique order number, status Placed and total', async (t) => {
    await page.goto(CLIENT);
    await page.getByLabel('Search books by title, author, or category').fill(title);
    await page.waitForSelector(`text=${title}`, { timeout: 10000 });
    await shot('02-catalog.png');
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await page.waitForSelector('text=Added to your cart.');
    await page.getByRole('button', { name: 'Cart', exact: true }).click();
    await page.waitForSelector('text=Proceed to checkout');
    t.check(await page.locator(`text=${title}`).count() > 0, 'book is in the cart');
    await shot('03-cart.png');
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await page.waitForSelector('text=Order summary');
    const place = page.getByRole('button', { name: 'Place order' });
    t.check(await place.isDisabled(), 'Place order is disabled while the address is empty');
    await page.getByLabel('Shipping address').fill('12 MG Road, Bengaluru 560001');
    await shot('04-checkout.png');
    await place.click();
    await page.waitForSelector('text=Thank you', { timeout: 15000 });
    orderNumber = (await page.getByTestId('order-number').innerText()).trim();
    t.check(/^ORD-\d{8}-[0-9A-F]{8}$/.test(orderNumber), `order number ${orderNumber}`);
    t.check(await page.locator('text=Placed').count() > 0, 'status Placed shown');
    t.check(await page.locator('text=₹499.00').count() > 0, 'total ₹499.00 shown');
    await shot('05-confirmation.png');
  });

  await test('TC-TRK-01-UI', 'Order history on screen lists the order and its status', 'Order number and status appear in My orders', async (t) => {
    await page.getByRole('button', { name: 'View my orders' }).click();
    await page.waitForSelector(`text=${orderNumber}`, { timeout: 10000 });
    t.check(true, `${orderNumber} listed`);
    t.check(await page.locator('text=Placed').count() > 0, 'status Placed shown');
    await shot('06-orders.png');
  });

  await test('TC-TRK-05-UI', 'Cancel a PLACED order on screen', 'Confirmation step, then Cancelled and books returned to stock', async (t) => {
    await page.getByRole('button', { name: /View order/ }).first().click();
    await page.waitForSelector('text=History');
    await shot('07-detail.png');
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('button', { name: 'Yes, cancel order' }).click();
    await page.waitForSelector('text=returned to stock', { timeout: 10000 });
    t.check(true, 'cancelled message shown');
    await shot('08-cancelled.png');
    const book = await call('GET', `/api/books/${bookId}`);
    t.check(book.body.book.stock === 5, `stock back to ${book.body.book.stock}`);
  });

  await test('TC-UI-ERRORS', 'No JavaScript errors in the browser during the run', 'Zero console or page errors', async (t) => {
    t.check(errors.length === 0, errors.length ? errors.join(' | ').slice(0, 300) : 'no console or page errors');
  });

  await browser.close();
}

main()
  .catch((e) => {
    console.error('Aborted:', e.message);
    results.push({ id: 'SETUP-UI', title: 'UI run', expected: 'runs', phase: 'ui', result: 'Fail', actual: e.message });
  })
  .finally(() => {
    const passed = results.filter((r) => r.result === 'Pass').length;
    console.log(`\nui: ${passed}/${results.length} passed`);
    if (RESULTS_FILE) {
      fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
      fs.writeFileSync(RESULTS_FILE, `${JSON.stringify(results.map((r) => ({ ...r, ranAt: new Date().toISOString() })), null, 2)}\n`);
    }
    process.exit(passed === results.length ? 0 : 1);
  });
