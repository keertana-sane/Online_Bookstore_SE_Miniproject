# Unit Test Report

Team 15 · Online Bookstore (BookNest) · Executed 5 November 2026 by B S Keertana (Test Engineer, cart and checkout)
Build tested: branch `main` at merge of PR #61 plus the two fixes in the Test Case Document, section 5.

## 1. Result

| Package | Runner | Test files | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|---|---|
| `backend/` | Jest 30.5.2 | 14 | 168 | 168 | 0 | 0 |
| `client/` | Vitest 5 and Testing Library (jsdom) | 5 | 59 | 59 | 0 | 0 |
| `server/` | Node test runner (`node --test`) | 2 | 7 | 7 | 0 | 0 |
| **Total** | | **21** | **234** | **234** | **0** | **0** |

Pass rate: **100%**. Environment: Node 22.22, Linux. No database and no network are needed: repositories are replaced by
in-memory stand-ins and the payment service by a stub (TC-TST-01). Raw output: `../evidence/unit-backend.txt`,
`../evidence/unit-client.txt`, `../evidence/unit-server.txt`.

Reproduce: `cd backend && npm test`, `cd client && npm test`, `cd server && npm test`.

## 2. Results by test file

### backend (Jest)

| File | Tests | Passed | What it checks | Test plan IDs |
|---|---|---|---|---|
| `cartService.test.js` | 22 | 22 | add, update, remove, totals in integer cents, stock limits, disabled book flagged and left out of the total | TC-CART-01, 02, 04 to 09 |
| `cartRoutes.test.js` | 4 | 4 | 401 on every cart endpoint, full cart with total, 422 envelope, 409 and 404 | TC-CART-03, 05 |
| `orderService.test.js` | 26 | 26 | checkout, payment outcomes (success, decline, timeout, unexpected answer), idempotent retry and replay, simultaneous same-key requests, stock hold and release | TC-ORD-01, 03, 04, 05, 06, 07, 08, TC-TST-01 |
| `orderRoutes.test.js` | 6 | 6 | checkout endpoint: 401, 201 body with client total ignored, 200 replay, 422 for missing key, address and empty cart, 402, 504, 409 | TC-ORD-02, 04, 06, 07, 08, 12, 14, TC-TRK-08 |
| `paymentAdapter.test.js` | 13 | 13 | SUCCESS, DECLINED, TIMEOUT mapping and the 5 s timeout | TC-TST-01, TC-ORD-06, 07 |
| `orderHistory.test.js` | 20 | 20 | own orders only, newest first, detail, cancel rules, declined orders hidden | TC-TRK-01, 02, 03, 05, 06, 07, 09 |
| `orderModelAndRepo.test.js` | 18 | 18 | order model enum and limits, unique indexes, conditional updates, router mounting (new regression test for DEF-01) | TC-TRK-04, TC-ORD-03, 05, TC-TRK-10 |
| `orderStatusMachine.test.js` | 4 | 4 | the approved lifecycle, allowed and refused transitions, machine-readable error | TC-TRK-11 |
| `adminOrderRoutes.test.js` | 12 | 12 | staff list and status update, history fields, 401, 403, 404, 409, 422 | TC-ORD-11, TC-TRK-06, 11 |
| `authenticate.test.js` | 5 | 5 | bearer token check | TC-CART-03, TC-TRK-08 |
| `requireRole.test.js` | 6 | 6 | customer-only and staff-only guards | TC-ORD-11 |
| `authRoutes.test.js` | 17 | 17 | register, login, validation (auth module, not owned by this role) | TC-AUTH |
| `serverAuthApi.test.js` | 5 | 5 | auth API wired on the server | TC-AUTH |
| `catalog.test.js` | 10 | 10 | catalog browse, search and limits (catalog module) | TC-CAT-01 to 10 |

### client (Vitest)

| File | Tests | Passed | What it checks | Test plan IDs |
|---|---|---|---|---|
| `shopApi.test.js` | 12 | 12 | methods, paths, bearer token, `Idempotency-Key`, error mapping | TC-CART-03, TC-ORD-02 |
| `CartPage.test.jsx` | 15 | 15 | cart screen, quantity and removal, totals | TC-CART-01, 04 to 08 |
| `CheckoutPage.test.jsx` | 13 | 13 | address limit, same key after timeout, new key after decline, out-of-stock message, confirmation | TC-ORD-03, 04, 06, 07, 08, 10 |
| `OrdersPage.test.jsx` | 12 | 12 | history, "No orders yet", detail, cancel with confirmation, login prompt on 401 | TC-TRK-01, 02, 05, 07, 08 |
| `AdminOrdersPage.test.jsx` | 7 | 7 | staff order list and status change (admin module) | TC-ADM |

### server (node --test)

| File | Tests | Passed | What it checks |
|---|---|---|---|
| `basic.test.js` | 3 | 3 | book data validation |
| `security.test.js` | 4 | 4 | Mongo operator stripping, Helmet headers, error envelope, **new:** `PAYMENT_TIMEOUT` keeps its code while other 5xx stay generic (DEF-02) |

## 3. Tests added in this testing phase

| Test | File | Purpose |
|---|---|---|
| mounts the administrator order routes under /admin and the customer routes under /orders | `backend/tests/orderModelAndRepo.test.js` | Regression test for DEF-01. It fails without the fix. |
| a payment timeout keeps its SAD code PAYMENT_TIMEOUT (API-09) but other 5xx stay generic | `server/security.test.js` | Regression test for DEF-02. It fails without the fix. |

## 4. Limits of the unit tests

Unit tests use stand-ins for MongoDB. They cannot prove that concurrent checkouts or cancels are safe on a real
database; that is covered by the live system tests (System Validation Report, TC-ORD-09 and TC-TRK-10). Lint
(`npm run lint`) reports no errors; the warnings it prints are in code written by other modules.
