# Unit Test Report (consolidated, project-wide)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering
Run on 16 November 2026 on a fresh clone of `main` at `a779478` (after PR #64). Node 22, Linux. Re-run on 17 November 2026 after the DEF-04 change: backend 174, client 59 and server 8 all passed again (no unit test was added or changed).
Compiled by B S Keertana from the run below and from the members' own unit-test runs (section 4).

## 1. Result

| Package | Runner | Test files | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|---|---|
| `backend/` | Jest 30 (`jest --runInBand`) | 14 | 174 | 174 | 0 | 0 |
| `client/` | Vitest 5 with Testing Library (jsdom) | 5 | 59 | 59 | 0 | 0 |
| `server/` | Node test runner (`node --test`) | 2 | 8 | 8 | 0 | 0 |
| **Total** | | **21** | **241** | **241** | **0** | **0** |

Pass rate **100%**. No database and no network are needed: repositories are in-memory stand-ins and the payment service is a
stub. Raw output: `evidence/project-wide/backend-unit-and-coverage.txt`, `client-unit-and-coverage.txt`, `server-unit.txt`.

Reproduce: `cd backend && npm test`, `cd client && npm test`, `cd server && npm test`.

## 2. Results by module

| Module (owner) | backend | client | server | Total |
|---|---|---|---|---|
| Cart, checkout, orders (B S Keertana) | 109 | 52 | 1 (payment timeout code) | 162 |
| Admin orders and status machine (Bhuvan Raj H) | 16 | 7 | 3 (book data validation) | 26 |
| Authentication and security (Bhagath Naveen Mullakara) | 38 | 0 | 4 (security middleware, error envelope, malformed JSON, security events) | 42 |
| Catalog (Anushka Kumar) | 11 | 0 | 0 | 11 |
| **Total** | **174** | **59** | **8** | **241** |

## 3. Results by test file

### backend (Jest)

| File | Tests | Passed | Module |
|---|---|---|---|
| `cartService.test.js` | 22 | 22 | Cart |
| `cartRoutes.test.js` | 4 | 4 | Cart |
| `orderService.test.js` | 26 | 26 | Checkout |
| `orderRoutes.test.js` | 6 | 6 | Checkout |
| `paymentAdapter.test.js` | 13 | 13 | Checkout |
| `orderHistory.test.js` | 20 | 20 | Order tracking |
| `orderModelAndRepo.test.js` | 18 | 18 | Orders (includes the DEF-01 regression test) |
| `orderStatusMachine.test.js` | 4 | 4 | Admin |
| `adminOrderRoutes.test.js` | 12 | 12 | Admin |
| `authRoutes.test.js` | 17 | 17 | Auth |
| `serverAuthApi.test.js` | 10 | 10 | Auth |
| `authenticate.test.js` | 5 | 5 | Auth |
| `requireRole.test.js` | 6 | 6 | Auth |
| `catalog.test.js` | 11 | 11 | Catalog |

### client (Vitest)

| File | Tests | Passed | Module |
|---|---|---|---|
| `shopApi.test.js` | 12 | 12 | Cart, checkout, orders |
| `CartPage.test.jsx` | 15 | 15 | Cart |
| `CheckoutPage.test.jsx` | 13 | 13 | Checkout |
| `OrdersPage.test.jsx` | 12 | 12 | Order tracking |
| `AdminOrdersPage.test.jsx` | 7 | 7 | Admin |

### server (`node --test`)

| File | Tests | Passed | What it checks |
|---|---|---|---|
| `basic.test.js` | 3 | 3 | book data validation: valid book, negative stock, zero price |
| `security.test.js` | 5 | 5 | Mongo operators stripped and Helmet headers set; error envelope without stack details; `PAYMENT_TIMEOUT` code kept while other 5xx stay generic (DEF-02 regression); malformed JSON envelope; security-event fields |

## 4. Members' own runs

| Member | Run | Result | Evidence |
|---|---|---|---|
| B S Keertana | Full suite, 5 Nov and again 16 Nov | 234 passed (5 Nov, before later merges), 241 passed (16 Nov) | `evidence/unit-*.txt`, `evidence/project-wide/` |
| Bhagath Naveen Mullakara | Focused auth run: `authRoutes`, `authenticate`, `requireRole`, `serverAuthApi`; server package run | 38 of 38; server 8 of 8; full regression 241 of 241 | `evidence/Bhagath_Auth_Security_Backend_Test_Run.txt`, `..._Server_Test_Run.txt` |
| Bhuvan Raj H | Full suites on a fresh clone of the team repository (before and after his fixes) | backend 174, client 59, server 8, all passed | `evidence/bhuvan-*.log` |
| Anushka Kumar | Catalog tests are in `catalog.test.js`; her functional and load runs are in the System Validation Report | 11 of 11 | this report |

The 40 focused auth and security checks that Bhagath reports are inside the 241, not added to it.

## 5. Limits

- The routes in `server/index.js` (catalog, book create/edit/stock/disable) are not loaded by any unit test; only their
  validation helper is. They were checked by live requests instead (System Validation Report), and that is how DEF-04 was found.
- `client/src/App.jsx` and `AuthDialog.jsx` (catalog screens, admin catalog screen, login dialog) have no unit tests.
- Lint warnings (backend 7, client 4) are warnings only; lint passes.
