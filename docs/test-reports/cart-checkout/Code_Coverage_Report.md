# Code Coverage Report

Team 15 · Online Bookstore (BookNest) · Measured 5 November 2026

Tools: Jest with Istanbul (`jest --coverage`) for `backend/`, Vitest with V8 (`vitest --coverage`) for `client/`.
Raw tables: `../evidence/coverage-backend.txt`, `../evidence/coverage-client.txt`; summaries as JSON:
`../evidence/coverage-backend-summary.json`, `../evidence/coverage-client-summary.json`.

Reproduce (backend): `cd backend && npx jest --coverage --collectCoverageFrom='services/**/*.js' --collectCoverageFrom='routes/**/*.js' --collectCoverageFrom='repositories/**/*.js' --collectCoverageFrom='models/**/*.js' --collectCoverageFrom='utils/**/*.js' --collectCoverageFrom='middleware/**/*.js' --collectCoverageFrom='mock-payment/**/*.js'`
Reproduce (client): `cd client && npm i --no-save @vitest/coverage-v8 && npx vitest run --coverage --coverage.include='src/**/*.{js,jsx}' --coverage.exclude='src/**/*.test.*'`

## 1. Target (TC-MNT-01)

Test Plan target: at least **70% line coverage on the service layer**.
Result: services **95.59% lines**. **Target met.**

## 2. Backend: line coverage

| Scope | Statements | Lines | Functions |
|---|---|---|---|
| **Service layer** (`services/`, 5 files) | 95.16% (236/248) | **95.59% (217/227)** | 98.28% (57/58) |
| Cart, checkout and order module (services, routes, models, money, mock payment) | 97.15% (341/351) | **97.52% (314/322)** | 100% (85/85) |
| Whole measured backend (`services`, `routes`, `repositories`, `models`, `utils`, `middleware`, `mock-payment`) | 88.80% (563/634) | **90.30% (531/588)** | 88.27% (128/145) |

| Directory | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `services/` | 95.16 | 87.58 | 98.27 | 95.59 |
| `routes/` | 100 | 71.42 | 100 | 100 |
| `models/` | 100 | 100 | 100 | 100 |
| `mock-payment/` | 95.83 | 92 | 100 | 95.65 |
| `utils/` | 94.59 | 91.42 | 100 | 97.22 |
| `middleware/` | 87.5 | 82.14 | 90 | 91.3 |
| `repositories/` | 52.52 | 28.3 | 50 | 55.17 |

Per file (cart, checkout and orders):

| File | Statements | Branches | Functions | Lines | Uncovered lines |
|---|---|---|---|---|---|
| `services/cartService.js` | 100 | 94.44 | 100 | 100 | none |
| `services/orderService.js` | 94.53 | 85.48 | 100 | 95.76 | 96, 205, 225, 315-316 |
| `services/orderStatusMachine.js` | 100 | 75 | 100 | 100 | none |
| `services/paymentAdapter.js` | 95.23 | 100 | 100 | 94.44 | 49 (payment status lookup that fails and returns null) |
| `routes/cartRoutes.js` | 100 | 44.44 | 100 | 100 | none |
| `routes/orderRoutes.js` | 100 | 75 | 100 | 100 | none |
| `routes/adminOrderRoutes.js` | 100 | 100 | 100 | 100 | none |
| `routes/cartCheckoutModule.js` | 100 | 80 | 100 | 100 | none |
| `models/Cart.js`, `models/Order.js` | 100 | 100 | 100 | 100 | none |
| `repositories/orderRepository.js` | 63.46 | 30.76 | 63.63 | 63.04 | 7-11, 39-53, 74-75, 96, 117-120 |
| `repositories/cartRepository.js` | 20 | 0 | 16.66 | 22.22 | 2-26 |
| `repositories/bookRepository.js` | 22.22 | 0 | 16.66 | 26.66 | 14-53 |

**Why the repositories are low.** The repositories are the only layer that talks to MongoDB. The unit tests replace them
with in-memory stand-ins (by design, TC-TST-01), so the Jest run does not enter them. They are exercised by the live
system tests against a real MongoDB 8 (every cart, checkout, cancel and staff call of the 32 API cases, including the 10-round
concurrency tests), but that run is not instrumented, so it is not counted in this table. The Jest figure for `repositories/` is
therefore a lower bound and the service-layer figure is the one TC-MNT-01 asks for.

## 3. Client

| Scope | Statements | Lines | Functions |
|---|---|---|---|
| **Shop screens and API client** (`components/shop/`, `api/shopApi.js`) | 89.15% (230/258) | **92.34% (205/222)** | 94.12% (64/68) |
| `components/admin/AdminOrdersPage.jsx` | 97.5 | 100 | 91.66 |
| Whole `src/` (includes `App.jsx`, `AuthDialog.jsx`, `authApi.js`, `main.jsx`) | 51.64% (298/577) | 50.76% (267/526) | 54.96% (83/151) |

Per file:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `shop/CartPage.jsx` | 95.12 | 92.98 | 92.3 | 96.96 |
| `shop/CheckoutPage.jsx` | 96.66 | 86.56 | 100 | 100 |
| `shop/OrderConfirmation.jsx` | 75 | 62.5 | 100 | 100 |
| `shop/OrdersPage.jsx` | 98.27 | 85.71 | 100 | 98.18 |
| `shop/errors.js` | 65.9 | 57.62 | 83.33 | 75 |
| `shop/format.js` | 83.33 | 66.66 | 100 | 100 |
| `api/shopApi.js` | 86.66 | 84.37 | 87.5 | 85.71 |
| `api/authApi.js` | 15.38 | 33.33 | 0 | 15.38 |
| `App.jsx`, `AuthDialog.jsx`, `main.jsx` | 0 | 0 | 0 | 0 |

The whole-client figure is low because the application shell, the login dialog and the auth API client (not part of the
cart and order screens) have no unit tests. `App.jsx` is covered at a higher level by the browser run of TC-ORD-10 and
TC-TRK-01 (System Validation Report, section 4).

## 4. Server (`server/`)

`server/` has 7 tests (`node --test`) and no coverage tool is configured there, so no percentage is reported. Its files
(`index.js`, `errorHandler.js`, `requestLogger.js`) are mostly wiring; `errorHandler.js` is covered by the tests in
`security.test.js` for the 500 and 504 paths.

## 5. Conclusion

* TC-MNT-01 target (at least 70% line coverage on services): **met, 95.59%**.
* Cart, checkout and order module: 97.52% of lines, 100% of functions.
* Gaps are in repositories (needs a real database, covered by system tests), the client app shell and the auth client.
