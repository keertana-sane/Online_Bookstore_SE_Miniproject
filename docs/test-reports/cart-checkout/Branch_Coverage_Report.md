# Branch Coverage Report

Team 15 · Online Bookstore (BookNest) · Measured 5 November 2026

Same runs as the [Code Coverage Report](Code_Coverage_Report.md). A branch is one outcome of an `if`, a `?:`, a `&&` or
`||`, a default argument or a `switch` case. Raw data: `../evidence/coverage-backend.txt`, `../evidence/coverage-client.txt`
and the two JSON summaries.

## 1. Summary

| Scope | Branches covered | Branch coverage |
|---|---|---|
| Backend service layer | 127 / 145 | **87.6%** |
| Backend cart, checkout and order module (services, routes, models, money, mock payment) | 142 / 164 | **86.6%** |
| Backend cart and order services and routes only | 112 / 131 | **85.5%** |
| Backend whole measured code | 275 / 356 | 77.24% |
| Client shop screens and API client | 221 / 275 | **80.4%** |
| Client whole `src/` | 255 / 598 | 42.64% |

The Test Plan sets a target only for line coverage (70%). No branch target is set; for this report we used 80% as the
goal for our own module and it is met in both backend (86.6%) and client (80.4%).

## 2. Backend branch coverage by file

| File | Branches | Branch % |
|---|---|---|
| `services/cartService.js` | 34/36 | 94.44 |
| `services/orderService.js` | 53/62 | 85.48 |
| `services/orderStatusMachine.js` | 3/4 | 75 |
| `services/paymentAdapter.js` | 9/9 | 100 |
| `services/authService.js` | 28/34 | 82.35 |
| `routes/adminOrderRoutes.js` | 2/2 | 100 |
| `routes/orderRoutes.js` | 3/4 | 75 |
| `routes/cartCheckoutModule.js` | 4/5 | 80 |
| `routes/cartRoutes.js` | 4/9 | 44.44 |
| `models/*` | all | 100 |
| `mock-payment/mockPaymentService.js` | 23/25 | 92 |
| `repositories/*` | 15/53 | 28.3 (see Code Coverage Report, section 2) |

## 3. The branches that are not covered, and why

| Location | Branch | Reason it is not hit by the unit tests | Covered elsewhere? |
|---|---|---|---|
| `orderService.js` 205, 219 | Duplicate-key error while saving an order: a second request with the same `Idempotency-Key` arriving at the same moment as the first | Needs two real concurrent inserts against the unique index; the in-memory stand-in cannot raise a duplicate-key error mid-flight | Sequential same-key replay is tested (TC-ORD-07, 200 with the same order). The unique index is checked in `orderModelAndRepo.test.js` |
| `orderService.js` 314-316 | Staff status update loses a race (the order changed between the read and the conditional update) | Needs two writers at once | The conditional update itself is asserted in `orderModelAndRepo.test.js`; TC-TRK-10 exercises the matching customer-cancel race on real MongoDB (10 of 10 rounds) |
| `orderService.js` 158 | Release of stock when none was held | Defensive guard; no code path reaches it with current callers | No |
| `orderService.js` 56, 112 | Actor label `staff` in the history shown to the customer; default argument `= {}` | The tests that read history use customer and system actors only; the default is never used | No |
| `cartService.js` 28, 33 | Book deleted from the catalog while still in a cart (`book` is null) | Not reproducible through the public API: books are disabled, never deleted | No |
| `orderStatusMachine.js` 10 | Unknown `fromStatus` (`|| []`) | Defensive default | No |
| `cartRoutes.js` 16, 17, 37, 48 and `orderRoutes.js` 23 | `req.user || {}` and `req.body || {}` fallbacks | `authenticate` and `express.json()` always set these; the fallbacks only protect against wiring mistakes | No |
| `cartCheckoutModule.js` 41 | Default value for the mongoose instance | The server always passes its own instance | No |
| `paymentAdapter.js` 49 | Payment status lookup fails and returns null (a line, not a branch) | Needs the stub to throw on lookup | TC-ORD-07 ran the real 5 s timeout (5.0 s measured) |

No uncovered branch hides a business rule. Everything that decides a customer-visible outcome (stock check, payment
SUCCESS, DECLINED and TIMEOUT, idempotent replay, cancel allowed or refused, ownership, role check, validation limits)
has both of its branches covered.

## 3b. Client branches

| File | Branches covered | Branch % |
|---|---|---|
| `shop/CartPage.jsx` | 53/57 | 92.98 |
| `shop/CheckoutPage.jsx` | 58/67 | 86.56 |
| `shop/OrdersPage.jsx` | 42/49 | 85.71 |
| `shop/OrderConfirmation.jsx` | 5/8 | 62.5 |
| `shop/format.js` | 2/3 | 66.66 |
| `shop/errors.js` | 34/59 | 57.62 |
| `api/shopApi.js` | 27/32 | 84.37 |

The weakest file is `errors.js`, which turns server error codes into customer messages. The tests cover the messages the
screens show most (out of stock, declined, timeout, network, login required); the remaining codes fall through to the
generic "Something went wrong" message and are not asserted.

## 4. Conclusion and follow-up

Branch coverage of the cart, checkout and order module is 86.6% (backend) and 80.4% (client screens). The remaining
branches are race conditions (checked on a real database by TC-ORD-09 and TC-TRK-10) and defensive fallbacks. If time
allows in Sprint 3, the two cheapest gains are a unit test for the null-book cart line and for the `errors.js` message
mapping.
