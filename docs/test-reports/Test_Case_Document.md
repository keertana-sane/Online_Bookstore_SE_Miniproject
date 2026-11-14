# Test Case Document: Cart, Checkout and Order Tracking

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering
Owner: B S Keertana (Test Engineer, cart and checkout) · Version 2.0 · 5 November 2026

This document replaces the test case table of the Software Test Plan v1.0 for the test cases owned by the cart and
checkout area (TC-CART, TC-ORD, TC-TRK, TC-TST and TC-MNT-01). It updates every case to what the product does after
Sprint 1 and Sprint 2, adds the cases that the sprints made necessary, and records the actual result of the test run
of 5 November 2026. The reports are in this folder; see [README.md](README.md).

## 1. What changed since Test Plan v1.0

| Change made during the sprints | Effect on the test cases |
|---|---|
| Order status machine (Sprint 2): PLACED to PROCESSING or CANCELLED, PROCESSING to SHIPPED or CANCELLED, SHIPPED to DELIVERED | TC-TRK-06 now expects `409 INVALID_ORDER_STATUS_TRANSITION` (was `CANCEL_NOT_ALLOWED`). New TC-TRK-11. |
| Staff order endpoints (`GET /admin/orders`, `PATCH /admin/orders/:id/status`) | TC-TRK-06 can now move an order to PROCESSING through the real API. New TC-TRK-11 and TC-ORD-11. |
| Status history entries carry `previousStatus`, `newStatus` and `actor` | TC-TRK-02 and TC-TRK-05 check the history. |
| Declined payments are kept as CANCELLED with paymentStatus FAILED but hidden from the customer | TC-ORD-06 checks the stored record; new TC-ORD-13 checks it is hidden. |
| A book disabled or sold out after it was added stays in the cart, flagged and left out of the total | New TC-CART-09. |
| Checkout retry safety (`Idempotency-Key` must be a UUID); server computes the total | New TC-ORD-12 and TC-ORD-14. |
| Cancel is one conditional update | New TC-TRK-09 and TC-TRK-10. |
| Cart and order screens in the React app | TC-ORD-10, TC-TRK-01 and TC-TRK-07 now have exact UI steps and were run in a real browser. |
| Order number format `ORD-YYYYMMDD-XXXXXXXX` | TC-ORD-04 and TC-ORD-05 check the format. |
| Two defects found and fixed during testing (section 5) | TC-ORD-07 depends on DEF-02; admin steps of TC-TRK-06 and TC-TRK-11 depend on DEF-01. |

Cases marked **Updated** have changed steps or expected results. Cases marked **New** are added in this version.
**Unchanged** cases keep the Test Plan v1.0 wording and now have an actual result.

## 2. How the cases were run

| Level | How | Where |
|---|---|---|
| Unit | Jest (backend), Vitest and Testing Library (client), `node --test` (server). Services run against in-memory stand-ins and a stub payment adapter | `backend/tests`, `client/src`, `server` |
| Integration and system (API) | Live HTTP against the real Express server, real MongoDB 8 and the real mock payment service: `backend/tests/system/systemValidation.js`, three phases for the three payment modes | evidence: `evidence/system-validation-results.json` |
| System (UI) | Headless Chromium drives the real React app against the same server: `backend/tests/system/uiSystemValidation.js` | evidence: `evidence/ui-validation-results.json`, `evidence/screenshots/` |
| Review | Code review checklist | section 4 |

Every case below was executed on 5 November 2026. Result: **all pass after the two fixes in section 5**. Before the fixes,
TC-TRK-06 and TC-TRK-11 (admin route) and TC-ORD-07 (error code) failed in the live run.

## 3. Test cases

Test data conventions: K1, K2 and so on are fresh UUID v4 keys. The address is `12 MG Road, Bengaluru 560001`. Each
system run registers its own customers and books (titles start with `SYSTEST`), so the run can be repeated.

### 3.1 Cart (UC-04)

| ID | Level | Req. | Description | Precondition | Steps | Test data | Expected result | Actual result (5 Nov 2026) | Status | Change |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-CART-01 | Unit, API | FR-006 | Add an in-stock book to cart | Logged in customer; stock 5 | `POST /cart/items` | bookId, qty 1 | 200; cart has 1 line with quantity 1 | 200; 1 line, quantity 1 | Pass | Unchanged |
| TC-CART-02 | Unit, API | FR-006 | Reject out-of-stock book | Book stock 0 | `POST /cart/items` | qty 1 | 409 `OUT_OF_STOCK`; cart unchanged | 409 `OUT_OF_STOCK`; cart has 0 lines | Pass | Unchanged |
| TC-CART-03 | Integration | FR-006, SEC-004 | Cart requires authentication | Not logged in | `POST /cart/items` without token; `GET /cart` with a tampered token | none | 401 `UNAUTHORIZED` | 401 `UNAUTHORIZED` for both | Pass | Updated: tampered token added |
| TC-CART-04 | Unit, API | FR-007 | Update item quantity | Cart has 1 item (price 100) | `PATCH /cart/items/{bookId}` | qty 3, stock 5 | Line quantity 3; total 300.00 | quantity 3, total 300 | Pass | Unchanged |
| TC-CART-05 | Unit, API | FR-007 | Quantity boundaries rejected | Cart has 1 item; stock 5 | `PATCH` with 0, -1, 6 and 5 | 0, -1, 6, 5 | 0 and -1 give 422; 6 gives 409 `OUT_OF_STOCK`; 5 accepted | 422, 422, 409 `OUT_OF_STOCK`, 200 | Pass | Unchanged |
| TC-CART-06 | Unit, API | FR-007 | Remove an item | Cart has 2 items (40 and 25) | `DELETE /cart/items/{bookId}` | one bookId | Only the other item remains; total 25.00 | 1 line left, total 25 | Pass | Unchanged |
| TC-CART-07 | Unit, API | FR-008 | Cart total equals sum of price x quantity | Cart empty | Add 2 x 499.00 and 1 x 250.50 | as shown | Total 1248.50 (two decimals) | 1248.50 | Pass | Unchanged |
| TC-CART-08 | Unit, API | FR-008 | Empty cart total is zero | Cart empty | `GET /cart` | none | 200; total 0.00; no lines | 200; total 0.00; 0 lines | Pass | Unchanged |
| TC-CART-09 | Integration | FR-006, FR-008, FR-009 | Disabled book in cart is flagged, left out of the total and blocks checkout | Cart has 2 books (100 and 50) | Staff disables the 50 book; `GET /cart`; `POST /orders` | K1 | Disabled line `available=false`; total 100.00; checkout 409 `OUT_OF_STOCK`; no order | `available=false`; total 100.00; 409 `OUT_OF_STOCK`; order count unchanged | Pass | **New** |

### 3.2 Checkout and orders (UC-05)

| ID | Level | Req. | Description | Precondition | Steps | Test data | Expected result | Actual result (5 Nov 2026) | Status | Change |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-ORD-01 | Unit, API | FR-009 | Reject checkout with empty cart | Logged in; cart empty | `POST /orders` | valid address | 422 `CART_EMPTY`; no order, no payment call | 422 `CART_EMPTY`; order count unchanged | Pass | Unchanged |
| TC-ORD-02 | Unit, API | FR-009 | Reject checkout with missing shipping address | Cart has 1 item | `POST /orders` with address empty, blank, or missing | `""`, `"   "`, none | 422 `VALIDATION_ERROR` naming `shippingAddress`; no order; stock unchanged | 422 `VALIDATION_ERROR`, field `shippingAddress`, for all three; stock 5 | Pass | Unchanged |
| TC-ORD-03 | Unit, UI, API | FR-009, SEC-003 | Shipping address length boundary | Cart has 1 item | `POST /orders` with 300 and 301 characters; type 301 characters in the checkout form | 300 / 301 characters | 300 accepted; 301 rejected with 422; the form disables Place order and shows "300 characters or fewer" | 301: 422; 300: 201; form behaves as expected | Pass | Updated: form check added |
| TC-ORD-04 | Integration | FR-009, FR-010, FR-016 | Successful checkout creates order | Cart 2 x 499.00; payment SUCCESS | `POST /orders` with `Idempotency-Key` | K1; valid address | 201; orderStatus PLACED; paymentStatus SUCCESS; `orderNumber` like `ORD-YYYYMMDD-XXXXXXXX`; total 998.00; stock reduced by 2; cart emptied | As expected; stock 5 to 3; cart empty | Pass | Updated: number format, total, cart |
| TC-ORD-05 | Integration | FR-010 | Order numbers are unique | Two successful checkouts possible | Place two orders with different keys | K1, K2 | Two different `orderNumber` values | Two different numbers | Pass | Unchanged |
| TC-ORD-06 | Integration | FR-016 | Declined payment creates no confirmed order | Payment mode `decline` | `POST /orders` | K3 | 402 `PAYMENT_DECLINED`; stored order CANCELLED with paymentStatus FAILED; stock restored; cart kept; no SUCCESS order in the database | 402; database holds a CANCELLED/FAILED order and 0 SUCCESS orders; stock 5; cart kept (quantity 2) | Pass | Updated: stored record checked in the database |
| TC-ORD-07 | Integration | NFR-004, FR-016 | Retry after payment timeout does not duplicate order | Payment mode `timeout-once` | `POST /orders` (K4); again with K4; a third time with K4 | K4 | First call 504 `PAYMENT_TIMEOUT` after about 5 s with no order and stock released; retry 201 with exactly one order; third call 200 with the same order | 504 `PAYMENT_TIMEOUT` (5.0 s); retry 201; third call 200, same `orderId`; 1 order in history and in the database; stock reduced once | Pass | Updated: error code check (DEF-02) |
| TC-ORD-08 | Integration | FR-009 | Item sold out between cart and checkout | Cart holds last copy; another customer buys it first | `POST /orders` by the late customer | K5 | 409 `OUT_OF_STOCK`; no payment attempted; no order | 409 `OUT_OF_STOCK`; late customer's order count unchanged; stock 0 | Pass | Unchanged. The checkout screen also names the book and links back to the cart (unit-tested) |
| TC-ORD-09 | Integration | FR-009, FR-010 | Concurrent checkout of last copy | Stock 1; two customers have it in cart | Send both `POST /orders` at the same moment; repeat 10 times with new books | two customers, different keys | Each round: exactly one 201 and one 409; stock 0, never negative | 10 of 10 rounds: 201 + 409, stock 0 | Pass | Updated: repeated 10 times on real MongoDB |
| TC-ORD-10 | System (UI) | FR-009, FR-010, FR-016 | Place order end-to-end through UI | Logged in customer; catalog contains the book | Type the title in the catalog search; Add to cart; open Cart; Proceed to checkout; check Place order is disabled; type the address; Place order | in-stock book (499.00); valid address | "Thank you, your order is placed" screen shows order number, status Placed, "Paid (simulated)", address, item and total 499.00; no browser errors | As expected; order number `ORD-20261105-0755BF29`; screenshots 02 to 05; no browser errors | Pass | Updated: exact UI steps |
| TC-ORD-11 | Integration | SEC-002, FR-009 | Staff accounts cannot use the cart or orders | Logged in as ADMIN_STAFF | `GET /cart`, `GET /orders`, `POST /orders` | admin token | 403 on all three | 403, 403, 403 | Pass | **New** |
| TC-ORD-12 | Integration | NFR-004, SEC-003 | Idempotency-Key must be a UUID | Cart has 1 item | `POST /orders` with no key, `abc` and `1234` | missing, `abc`, `1234` | 422 `VALIDATION_ERROR` each time; no order; stock unchanged | 422 `VALIDATION_ERROR` x 3; stock 5 | Pass | **New** |
| TC-ORD-13 | Integration | FR-016, FR-012 | A declined payment is not shown in the customer's history or detail | After TC-ORD-06 | `GET /orders` | customer with one declined attempt | 200 with an empty list | 200; 0 orders | Pass | **New** |
| TC-ORD-14 | Integration | SEC-003, FR-009 | Total sent by the browser is ignored | Cart 2 x 200.00 | `POST /orders` with a body that also contains `total: 1` and a fake item | K6 | 201; total 400.00 computed on the server | 201; total 400.00 | Pass | **New** |

### 3.3 Order tracking (UC-06)

| ID | Level | Req. | Description | Precondition | Steps | Test data | Expected result | Actual result (5 Nov 2026) | Status | Change |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TRK-01 | System (UI, API) | FR-012, FR-011 | Order history lists own orders | Customer has 3 orders | API: `GET /orders`. UI: sign in, open My orders | none | Own 3 orders, newest first, each with status; another customer's list has none of them. UI lists the order number and status | API: 3 orders, newest first, all PLACED, no overlap with another customer. UI: new order and status Placed listed (screenshot 06) | Pass | Updated: UI steps and ownership check |
| TC-TRK-02 | Integration | FR-012 | View single order detail | Order exists | `GET /orders/{orderId}` | own orderId (3 x 10.00) | 200; items, total 30.00, address, status PLACED, `statusHistory` with the PLACED entry | As expected; history `[PLACED]` | Pass | Updated: address and history entry checked |
| TC-TRK-03 | Integration | FR-012, SEC-002 | Customer cannot read another customer's order | Orders of customers A and B exist | As A: `GET /orders/{B's id}`, `PATCH .../cancel`, `GET /orders/not-an-id` | A's token; B's orderId | 404 `ORDER_NOT_FOUND`; no order data in the body; B's order unchanged | 404 for detail and cancel; body has no order data; B still sees PLACED; malformed id 404 | Pass | Updated: cancel and malformed id added |
| TC-TRK-04 | Unit | FR-011 | Only allowed status values accepted | None | Create order with status `SHIPPING`; create with each of the five valid statuses | invalid enum | Model validation rejects; allowed values PLACED, PROCESSING, SHIPPED, DELIVERED, CANCELLED | `SHIPPING` rejected; all five accepted | Pass | Unchanged |
| TC-TRK-05 | Integration, UI | Rule 6.5 | Customer cancels own PLACED order | Order PLACED (qty 2) | `PATCH /orders/{id}/cancel`. UI: open the order, Cancel order, Yes cancel order | own orderId | 200; CANCELLED; stock restored; history `PLACED, CANCELLED`. UI asks for confirmation and shows "returned to stock" | API: 200, stock 3 to 5, history `PLACED>CANCELLED`. UI: confirmation step, message shown, stock 5 | Pass | Updated: UI steps added |
| TC-TRK-06 | Integration | Rule 6.5 | Customer cannot cancel after PROCESSING | Order PROCESSING (staff moved it) | Staff `PATCH /admin/orders/{id}/status` to PROCESSING; customer `PATCH /orders/{id}/cancel` | own orderId | 409 `INVALID_ORDER_STATUS_TRANSITION`; status stays PROCESSING; stock not restored | 409 `INVALID_ORDER_STATUS_TRANSITION`; PROCESSING; stock stayed at 4 | Pass | **Updated**: error code changed from `CANCEL_NOT_ALLOWED` (Sprint 2 state machine) |
| TC-TRK-07 | Integration, UI | FR-012 | Customer with no orders sees empty history | New customer | `GET /orders`; open My orders in the UI | none | 200 with an empty list; UI shows "No orders yet" | 200, empty list; UI shows "No orders yet" (screenshot 01) | Pass | Unchanged |
| TC-TRK-08 | Integration | FR-012, SEC-004 | Order history requires authentication | Not logged in | `GET /orders`, `GET /orders/{id}`, `PATCH /orders/{id}/cancel` without token | no token | 401 `UNAUTHORIZED` for all | 401 `UNAUTHORIZED` x 3 | Pass | Updated: detail and cancel added |
| TC-TRK-09 | Integration | Rule 6.5 | Cancelling twice restores stock once | Order PLACED (qty 2, stock 3) | Cancel; cancel again | own orderId | First 200; second 409; stock 5 (not 7) | 200, then 409; stock 5 | Pass | **New** |
| TC-TRK-10 | Integration | Rule 6.5 | Two cancels at the same moment restore stock once | Order PLACED; repeat 10 times | Send two cancels at once | own orderId | Each round: one 200 and one 409; stock 5 | 10 of 10 rounds 200 + 409, stock 5 | Pass | **New** |
| TC-TRK-11 | Integration | FR-011, SEC-002 | Status machine blocks invalid staff transitions | Order PLACED | Staff: PLACED to DELIVERED; then PROCESSING, SHIPPED, DELIVERED in order; DELIVERED to PROCESSING; customer token on the admin route | admin and customer tokens | Skip rejected 409; the legal chain gives 200 x 3; going back 409; customer token 403 | 409; 200/200/200; 409; 403 | Pass | **New** |

### 3.4 Testability and maintainability

| ID | Level | Req. | Description | Precondition | Steps | Test data | Expected result | Actual result (5 Nov 2026) | Status | Change |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-TST-01 | Unit | NFR-006 | Order service testable without payment service | No network access | Run the OrderService tests with a PaymentAdapter stub returning SUCCESS, DECLINED, TIMEOUT; run the PaymentAdapter tests | stubbed adapter | All three outcomes testable offline; tests pass in CI | `orderService.test.js` (26) and `paymentAdapter.test.js` (13) pass with no network; CI runs `npm test` on every push | Pass | Unchanged |
| TC-MNT-01 | Review | NFR-005 | Business logic separated into service modules | Source code available | Review: no business rules in routes; service unit tests exist and pass; line coverage on services at least 70% | repository | Rules live in services; tests run in CI; at least 70% line coverage on services | Routes only parse the request and call a service (`cartRoutes.js` 61 lines, `orderRoutes.js` 55, `adminOrderRoutes.js` 32); services line coverage **95.59%** (target 70%); CI runs lint, test and build | Pass | Unchanged |

Cases of the Test Plan that this document does not cover: TC-CAT (catalog), TC-AUTH, TC-SEC, TC-ADM and TC-USA-01 belong to
other team members; TC-CAT-15 (add to cart from the book detail page) is a catalog screen case. The usability test
TC-USA-01 needs five first-time users and was not run (see System Validation Report, section 6).

## 4. Requirement traceability matrix (cart, checkout and tracking)

| Requirement | Test cases | Result |
|---|---|---|
| FR-006 Add in-stock book to cart | TC-CART-01, 02, 03, 09 | 4 of 4 pass |
| FR-007 Update or remove cart item | TC-CART-04, 05, 06 | 3 of 3 pass |
| FR-008 Cart total | TC-CART-07, 08, 09 | 3 of 3 pass |
| FR-009 Valid checkout only | TC-ORD-01, 02, 03, 04, 08, 09, 10, 11, 12, 14, TC-CART-09 | 11 of 11 pass |
| FR-010 Unique order number | TC-ORD-04, 05, 09, 10 | 4 of 4 pass |
| FR-011 Order status values | TC-TRK-01, 04, 11 | 3 of 3 pass |
| FR-012 Order history and status | TC-TRK-01, 02, 03, 07, 08, TC-ORD-13 | 6 of 6 pass |
| FR-016 Payment result recorded | TC-ORD-04, 06, 07, 10, 13 | 5 of 5 pass |
| NFR-004 No duplicate order on retry | TC-ORD-07, 12 | 2 of 2 pass |
| NFR-005 Maintainability | TC-MNT-01 | pass |
| NFR-006 Testability | TC-TST-01 | pass |
| SEC-002 RBAC | TC-TRK-03, 11, TC-ORD-11 | 3 of 3 pass |
| SEC-003 Input validation | TC-ORD-03, 12, 14 | 3 of 3 pass |
| SEC-004 Reject invalid token | TC-CART-03, TC-TRK-08 | 2 of 2 pass |
| Business rule 6.5 (cancel only while PLACED) | TC-TRK-05, 06, 09, 10 | 4 of 4 pass |

Totals: 36 test cases in this document (CART 9, ORD 14, TRK 11, TST 1, MNT 1). All 36 pass. Eight are new in this version
(TC-CART-09, TC-ORD-11 to 14, TC-TRK-09 to 11); thirteen have updated steps or expected results.

## 5. Defects found while running the cases

| ID | Found by | Defect | Severity | Fix | Status |
|---|---|---|---|---|---|
| DEF-01 | TC-TRK-06, TC-TRK-11 (live run) | `PATCH /api/v1/admin/orders/{id}/status` and `GET /api/v1/admin/orders` returned 404. The admin order router was mounted at `/orders`, so it was hidden behind the customer router, while the documentation, the client and the SAD use `/admin/orders`. The unit tests did not see it because they mount the router themselves. | High (staff could not update orders) | `backend/routes/cartCheckoutModule.js` mounts the router under `/admin`; regression test in `backend/tests/orderModelAndRepo.test.js` | Fixed, verified |
| DEF-02 | TC-ORD-07 (live run) | A payment timeout answered `500 INTERNAL_ERROR "Something went wrong"` instead of `504 PAYMENT_TIMEOUT`, because the shared error handler hides the code of every 5xx error. The checkout screen then could not show its "payment service did not answer, try again" message. | High (NFR-004 flow broken in the real app) | `server/errorHandler.js` keeps the code and message for `PAYMENT_TIMEOUT` only; every other 5xx stays generic; regression test in `server/security.test.js` | Fixed, verified |

Observations for the owners of other modules (not defects of this module, reported for the team):

1. `POST /api/books` and `PATCH /api/books/:id/disable` (and the other book write endpoints) need no login. The SAD (API-15 and later) places book management under `/admin/books` with an administrator token. This is a security gap (SEC-002).
2. The cart UI is in `client/src/components/shop`; the shared `AuthDialog` and `authApi.js` have no tests (0% in the client coverage report).
3. `docs/CART_CHECKOUT.md` was out of date (test counts, deviations 9 and 11) and has been updated.
