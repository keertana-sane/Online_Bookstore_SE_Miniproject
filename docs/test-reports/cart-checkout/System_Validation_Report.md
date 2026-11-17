# System Validation Report

Team 15 · Online Bookstore (BookNest) · Cart, checkout and order tracking
Executed 5 November 2026 by B S Keertana (Test Engineer, cart and checkout). Testing window: 2 to 6 November.

## 1. Purpose and scope

System validation checks the finished product the way a customer uses it: the real server, a real database, the real
payment stand-in and the real React screens, with no test doubles. It covers the Test Plan cases TC-CART, TC-ORD and
TC-TRK (including the new cases in the [Test Case Document](Test_Case_Document.md)), plus TC-TST-01 and TC-MNT-01.

Not in scope: catalog, authentication, administrator book management and usability (other owners, see section 6).

## 2. Test environment

| Item | Value |
|---|---|
| Server | The real `server/index.js` (Express 5, Mongoose 9), port 5055, Node 22.22 |
| Database | MongoDB 8.3.7, standalone `mongod`, fresh database seeded with `backend/scripts/seed.js` (1,000 books, 3 customers, 1 administrator) |
| Payment | The project's mock payment service with `MOCK_PAYMENT_MODE` set to `success`, `decline`, `timeout-once` for each phase; real 5 s adapter timeout |
| Browser | Headless Chromium through Playwright, 1200 x 800, against the Vite dev server (client) |
| Test data | Every run registers three new customers and creates its own books (titles start with `SYSTEST`), so a run can be repeated on the same database. The seeded administrator is used for staff steps |
| Scripts | `backend/tests/system/systemValidation.js` (API, three phases) and `backend/tests/system/uiSystemValidation.js` (browser) |

Why MongoDB and not an emulator: a first trial used FerretDB (a MongoDB-compatible layer on SQLite). It lost stock updates
under concurrent writes, which made TC-ORD-09 and TC-TRK-10 fail for reasons that have nothing to do with our code. Those
results were discarded and the whole suite was run on a real `mongod`.

## 3. Results

| Phase | Payment mode | Cases | Passed | Failed |
|---|---|---|---|---|
| API: `success` | success | 29 | 29 | 0 |
| API: `decline` | decline | 2 | 2 | 0 |
| API: `timeout-once` | timeout-once | 1 | 1 | 0 |
| Browser | success | 5 | 5 | 0 |
| **Total** | | **37** | **37** | **0** |

Pass rate **100%** after the two fixes (section 5). Durations: the payment-timeout case took 5.1 s (by design, the adapter
waits 5 s); every other API case took under 0.5 s, and the whole API run took 6.9 s in total. The `success` phase was
repeated on the same database and passed again 29 of 29, which shows the run is repeatable.

Full evidence: `../evidence/system-validation-results.json` (every check with its actual value),
`../evidence/ui-validation-results.json`, `../evidence/screenshots/`.

### 3.1 API cases (live HTTP)

| Test case | Result | What was observed |
|---|---|---|
| TC-CART-01 | Pass | 200; 1 line, quantity 1 |
| TC-CART-02 | Pass | 409 `OUT_OF_STOCK`; cart empty |
| TC-CART-03 | Pass | 401 `UNAUTHORIZED` without token and with tampered token |
| TC-CART-04 | Pass | quantity 3, total 300 |
| TC-CART-05 | Pass | 0 and -1 gave 422; 6 gave 409; 5 gave 200 |
| TC-CART-06 | Pass | one line left, total 25 |
| TC-CART-07 | Pass | total 1248.50 |
| TC-CART-08 | Pass | total 0.00 |
| TC-CART-09 (new) | Pass | disabled book flagged and left out of the total; checkout 409; no order |
| TC-ORD-01 | Pass | 422 `CART_EMPTY`; order count unchanged |
| TC-ORD-02 | Pass | 422 `VALIDATION_ERROR` on `shippingAddress` for empty, blank, missing; stock unchanged |
| TC-ORD-03 | Pass | 301 characters 422; 300 characters 201 |
| TC-ORD-04 | Pass | 201, PLACED, SUCCESS, number `ORD-YYYYMMDD-XXXXXXXX`, total 998.00, stock 5 to 3, cart emptied |
| TC-ORD-05 | Pass | two different order numbers |
| TC-ORD-06 | Pass | 402 `PAYMENT_DECLINED`; database holds a CANCELLED order with paymentStatus FAILED and no SUCCESS order; stock restored; cart kept |
| TC-ORD-07 | Pass | first call 504 `PAYMENT_TIMEOUT` after 5,019 ms; no order; stock released; retry 201; third call 200 with the same order id; one order in history and in the database; stock reduced once |
| TC-ORD-08 | Pass | late customer 409 `OUT_OF_STOCK`; no order; stock 0 |
| TC-ORD-09 | Pass | 10 of 10 rounds: one 201, one 409, stock 0 |
| TC-ORD-11 (new) | Pass | administrator gets 403 on cart and orders |
| TC-ORD-12 (new) | Pass | missing, `abc` and `1234` keys give 422; stock unchanged |
| TC-ORD-13 (new) | Pass | history empty after a declined payment |
| TC-ORD-14 (new) | Pass | total 400.00 computed on the server |
| TC-TRK-01 | Pass | 3 own orders, newest first, all PLACED; no overlap with another customer |
| TC-TRK-02 | Pass | items, total 30.00, address, status and history `[PLACED]` |
| TC-TRK-03 | Pass | 404 `ORDER_NOT_FOUND` for detail and cancel; no data leaked; owner's order unchanged |
| TC-TRK-05 | Pass | 200 CANCELLED; stock 3 to 5; history `PLACED>CANCELLED` |
| TC-TRK-06 | Pass | 409 `INVALID_ORDER_STATUS_TRANSITION`; still PROCESSING; stock not restored |
| TC-TRK-07 | Pass | 200 with an empty list |
| TC-TRK-08 | Pass | 401 on list, detail and cancel |
| TC-TRK-09 (new) | Pass | 200 then 409; stock 5, not 7 |
| TC-TRK-10 (new) | Pass | 10 of 10 rounds: one 200, one 409, stock 5 |
| TC-TRK-11 (new) | Pass | skip 409; PROCESSING, SHIPPED, DELIVERED 200 x 3; back 409; customer token 403 |

### 3.2 Browser cases

| Test case | Result | What was observed | Screenshot |
|---|---|---|---|
| TC-TRK-07 (UI) | Pass | new customer opens My orders and sees "No orders yet" | `01-no-orders.png` |
| TC-ORD-10 | Pass | search the book, Add to cart, Cart, Proceed to checkout (Place order disabled until an address is typed), Place order; confirmation shows order number `ORD-20261105-0755BF29`, status Placed, "Paid (simulated)", address and total 499.00 | `02` to `05` |
| TC-TRK-01 (UI) | Pass | View my orders lists the new order number with status Placed | `06-orders.png` |
| TC-TRK-05 (UI) | Pass | open the order, Cancel order, confirm; "returned to stock" shown; stock back to 5 | `07`, `08` |
| No browser errors | Pass | zero console or page errors from the app or its API (requests to Google Fonts are blocked in the test environment and are ignored) | |

### 3.3 Review and non-functional cases

| Test case | Result | Basis |
|---|---|---|
| TC-TST-01 | Pass | Order service and payment adapter tests run offline with stubs for SUCCESS, DECLINED and TIMEOUT (Unit Test Report) |
| TC-MNT-01 | Pass | Routes contain no business rules; services have 95.59% line coverage against a 70% target (Code Coverage Report); CI runs lint, test and build |

## 4. Non-functional observations

| Quality | Observation |
|---|---|
| Duplicate order protection (NFR-004) | After a real 5 s payment timeout, the same key produced exactly one order; a third call returned the same order |
| Overselling | 10 of 10 simultaneous last-copy checkouts gave exactly one order and stock 0 on real MongoDB |
| Cancel correctness | 10 of 10 simultaneous double cancels restored stock once |
| Response time | Every case that places, lists or cancels orders finished in under 0.5 s on the test machine (including the 10-round concurrency cases); the only slow case is the payment timeout, which by design waits 5 s. This is a functional-test timing, not a load test |
| Security | Customer ownership (SEC-002), tokens (SEC-004), role checks and input limits (SEC-003) all behaved as specified |

## 5. Defects found and fixed during validation

| ID | Test case | Defect | Fix | Re-test |
|---|---|---|---|---|
| DEF-01 | TC-TRK-06, TC-TRK-11 | Staff order endpoints returned 404 at `/api/v1/admin/orders` (router mounted at the wrong path) | Mounted under `/admin` in `backend/routes/cartCheckoutModule.js`; regression test added | Pass |
| DEF-02 | TC-ORD-07 | Payment timeout returned `500 INTERNAL_ERROR` instead of `504 PAYMENT_TIMEOUT`; the checkout screen could not show its retry message | `server/errorHandler.js` keeps the code and message for `PAYMENT_TIMEOUT`; regression test added | Pass |

Details are in the Test Case Document, section 5. No defects remain open in the cart, checkout and order module.

## 6. Not done, limits and observations for other owners

* **TC-USA-01** (five first-time users place an order in 5 screens or fewer) needs real people and was not run. The
  browser run completed the task in the five primary screens (catalog, cart, checkout, confirmation, history), which is
  an indication only.
* **Staff-side order screens and book management** were not validated in the browser; only the order endpoints they use
  were tested.
* **Login screen**: the browser run signs in through the API and places the token in the session; the login dialog itself
  belongs to the authentication tests.
* **MongoDB deployment**: tests ran on a standalone `mongod`. A replica set was not used; the module does not use
  transactions (documented deviation 6 in `docs/CART_CHECKOUT.md`).
* **Observation for the catalog and admin owners (security):** `POST /api/books`, `PATCH /api/books/:id/disable` and
  the other book write endpoints work without logging in. The SAD places them under `/admin/books` with an administrator
  token. The system test scripts rely on this to create test books, so when it is fixed they need an admin token.
* **Performance and load** testing (the JMeter plan in `docs/`) belongs to the catalog owner and was not repeated here.

## 7. Conclusion

All 37 system validation checks pass (32 API, 5 browser), with two defects found, fixed and re-tested. The cart,
checkout and order module meets its requirements FR-006 to FR-012, FR-016, NFR-004 to NFR-006 and SEC-002 to SEC-004 as
far as the test plan covers them, and is ready for the final demo.

## 8. How to repeat the run

1. Start MongoDB, seed it (`cd backend && SEED_DEFAULT_PASSWORD='<12+ chars>' MONGODB_URI=<uri> npm run seed`).
2. For each phase, start the server (`cd server`, with `MONGODB_URI`, `JWT_SECRET`, `PORT=5055` and `MOCK_PAYMENT_MODE`
   set to `success`, then `decline`, then `timeout-once`) and run
   `BASE_URL=http://127.0.0.1:5055 SEED_PASSWORD='<same password>' MONGODB_URI=<uri> node backend/tests/system/systemValidation.js <phase>`.
3. For the browser run, start the client (`cd client && VITE_API_URL=http://127.0.0.1:5055/api VITE_AUTH_API_URL=http://127.0.0.1:5055/api/v1 npx vite --port 5173`)
   with the server in `success` mode, install Playwright (`npm i --no-save playwright && npx playwright install chromium`)
   and run `node backend/tests/system/uiSystemValidation.js` (see the header of the script for its variables).
