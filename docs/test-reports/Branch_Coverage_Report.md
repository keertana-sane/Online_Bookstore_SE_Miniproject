# Branch Coverage Report (consolidated, project-wide)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering
Backend measured on 16 November 2026 on `main` at `a779478`; client re-measured on 17 November 2026 after the DEF-04 change, in the same runs as the
[Code Coverage Report](Code_Coverage_Report.md). Compiled by B S Keertana.

A branch is one outcome of an `if`, a `?:`, a `&&` or `||`, a default argument or a `switch` case. Raw data:
`evidence/project-wide/backend-unit-and-coverage.txt`, `client-unit-and-coverage.txt`, `server-coverage.txt` and the two JSON summaries.

The Test Plan sets a target only for line coverage (70%). It sets none for branches; for this report 80% was used as the goal for
code that has unit tests.

## 1. Summary

| Scope | Branches covered | Branch coverage | 80% goal |
|---|---|---|---|
| Backend service layer (5 files) | 127 / 145 | **87.59%** | Met |
| Backend whole measured code (29 files) | 277 / 358 | 77.37% | Not met (see repositories below) |
| Backend cart, checkout, orders, no repositories (B S Keertana) | 166 / 189 | **87.83%** | Met |
| Backend admin orders (Bhuvan Raj H) | 5 / 6 | 83.33% | Met |
| Backend authentication and security (Bhagath Naveen Mullakara) | 98 / 121 | 80.99% | Met |
| Backend repositories (book, cart, order) | 8 / 42 | 19.05% | Not met: stand-ins replace them in unit tests |
| Client shop screens, API client, cart hook (B S Keertana) | 221 / 275 | **80.36%** | Met |
| Client admin orders screen (Bhuvan Raj H) | 32 / 41 | 78.05% | Just below |
| Client auth API client and dialog (Bhagath Naveen Mullakara) | 2 / 39 | 5.13% | Not met: no unit tests |
| Client `App.jsx`, `main.jsx` | 0 / 246 | 0% | Not met: no unit tests |
| Client whole `src/` | 255 / 601 | 42.42% | Not met |
| Server package (`node --test`) | | 87.72% | Met (includes test files; `index.js` not loaded) |

## 2. Backend branch coverage by file

| File | Branches | Branch % |
|---|---|---|
| `services/cartService.js` | 34/36 | 94.44 |
| `services/orderService.js` | 53/62 | 85.48 |
| `services/orderStatusMachine.js` | 3/4 | 75.00 |
| `services/paymentAdapter.js` | 9/9 | 100 |
| `services/authService.js` | 28/34 | 82.35 |
| `routes/cartRoutes.js` | 4/9 | 44.44 |
| `routes/orderRoutes.js` | 3/4 | 75.00 |
| `routes/cartCheckoutModule.js` | 4/5 | 80.00 |
| `routes/adminOrderRoutes.js` | 2/2 | 100 |
| `routes/authRoutes.js` | 8/9 | 88.89 |
| `routes/authModule.js` | 4/6 | 66.67 |
| `middleware/authenticate.js` | 19/25 | 76.00 |
| `middleware/requireRole.js` | 10/12 | 83.33 |
| `middleware/loginRateLimit.js` | 13/15 | 86.67 |
| `middleware/sanitizeInput.js` | 4/4 | 100 |
| `mock-payment/mockPaymentService.js` | 23/25 | 92.00 |
| `utils/validators.js` | 24/26 | 92.31 |
| `utils/money.js` | 3/4 | 75.00 |
| `repositories/orderRepository.js` | 8/26 | 30.77 |
| `repositories/userRepository.js` | 7/11 | 63.64 |
| `repositories/bookRepository.js` | 0/12 | 0 |
| `repositories/cartRepository.js` | 0/4 | 0 |

(Models, `AppError`, `inputLimits` and `securityEvents` have no branches or are fully covered.)

## 3. Branches not covered, and why

Reasons come from reading the lines that the coverage tool lists.

| Where | What the uncovered branch is |
|---|---|
| `cartRoutes.js` lines 16 to 48 | The fall-back choices for the user id (`user.id`, `user._id`, `user.sub`) and the `req.body \|\| {}` defaults |
| `orderService.js` lines 96, 205, 225, 315-316 | Rare error paths: failure to allocate an order number, re-throwing an error that is not a duplicate key, and a failed lookup after an update |
| `orderStatusMachine.js` line 10 | The `\|\| []` fall-back for a status that is not in the table |
| `authenticate.js` lines 35-36, 49; `requireRole.js` lines 16-17 | Security-log and 401 paths for unusual token cases, and forwarding an unexpected error |
| Repository files | Replaced by in-memory stand-ins in unit tests; these paths run in the live system runs |

## 4. Client branch coverage by file

| File | Branches | Branch % |
|---|---|---|
| `shop/CartPage.jsx` | 53/57 | 92.98 |
| `shop/CheckoutPage.jsx` | 58/67 | 86.57 |
| `shop/OrdersPage.jsx` | 42/49 | 85.71 |
| `api/shopApi.js` | 27/32 | 84.38 |
| `shop/errors.js` | 34/59 | 57.63 |
| `shop/OrderConfirmation.jsx` | 5/8 | 62.50 |
| `admin/AdminOrdersPage.jsx` | 32/41 | 78.05 |
| `api/authApi.js` | 2/6 | 33.33 |
| `AuthDialog.jsx`, `App.jsx` | 0/279 | 0 |

## 5. Conclusion

Every module with unit tests meets the 80% branch goal, or is within two points of it (admin orders screen). The backend total of
77.37% is held down by repository files that the unit tests deliberately stub. The client total of 42.42% is held down by `App.jsx`
and `AuthDialog.jsx`, which have no unit tests. These are the two gaps for any follow-up work.
