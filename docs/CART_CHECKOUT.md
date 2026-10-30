# Cart, Checkout and Orders (Team 15, Online Bookstore)

Owner: B S Keertana. Covers SAD components C-06 (Cart), C-07 (Orders) and C-08 (Payment adapter),
requirements FR-006 to FR-012, FR-016, NFR-004 and the business rule SRS 6.5.

## What a customer can do

1. **Add to cart** from the catalog (only active, in-stock books; login required).
2. **Cart**: change quantity, remove items, see the total. The total always comes from the server.
3. **Checkout**: enter a shipping address (1 to 300 characters) and place the order. Payment is simulated.
4. **Confirmation**: the unique order number and status PLACED.
5. **My orders**: all own orders, newest first. Open one to see items, total, address and status history.
6. **Cancel**: allowed only while the order is PLACED. The books go back to stock.

Staff accounts cannot use the cart or orders (the API answers 403).

## API (base path `/api/v1`, all need a customer JWT)

| ID | Method and path | Success | Errors |
|---|---|---|---|
| API-05 | `GET /cart` | 200 cart with total | 401 |
| API-06 | `POST /cart/items` `{bookId, quantity?}` | 200 | 401, 404, 409 OUT_OF_STOCK, 422 |
| API-07 | `PATCH /cart/items/:bookId` `{quantity}` | 200 | 401, 404, 409, 422 |
| API-08 | `DELETE /cart/items/:bookId` | 200 | 401, 404 |
| API-09 | `POST /orders` `{shippingAddress}` + header `Idempotency-Key: <UUID>` | 201 (200 on replay) | 401, 402 PAYMENT_DECLINED, 409 OUT_OF_STOCK, 422 CART_EMPTY / VALIDATION_ERROR, 504 PAYMENT_TIMEOUT |
| API-10 | `GET /orders` | 200 `{orders: [...]}` (empty list if none) | 401 |
| API-11 | `GET /orders/:orderId` | 200 order with `items`, `total`, `shippingAddress`, `statusHistory` | 401, 404 ORDER_NOT_FOUND |
| API-12 | `PATCH /orders/:orderId/cancel` | 200 cancelled order | 401, 404 ORDER_NOT_FOUND, 409 INVALID_ORDER_STATUS_TRANSITION |
| API-13 | `GET /admin/orders?status=<status>` | 200 `{orders: [...]}`; status filter is optional | 401, 403, 422 |
| API-14 | `PATCH /admin/orders/:orderId/status` `{status}` | 200 updated order | 401, 403, 404 ORDER_NOT_FOUND, 409 INVALID_ORDER_STATUS_TRANSITION, 422 |

Errors use the SAD envelope `{ "error": { "code", "message", "details" } }`.

### How the important rules are enforced

- **No duplicate order on retry (NFR-004).** A unique index on `(customerId, idempotencyKey)`. The browser makes one
  key per checkout attempt and sends the same key again after a timeout or a lost connection.
  After a decline it makes a new key, because the server keeps a record of the declined attempt.
- **No overselling.** Stock is taken with one conditional update (`stock >= quantity`) before payment and put back if
  payment fails.
- **Unique order number (FR-010).** Unique index on `orderNumber`; a clash picks a new number.
- **Declined payment is never a confirmed order (FR-016).** A CANCELLED order with `paymentStatus FAILED` is kept for the record,
  but it is not shown in the customer's history and cannot be opened.
- **Customers see only their own orders (SEC-002).** Every order query filters by the logged-in customer id,
  so another customer's order is `404 ORDER_NOT_FOUND`, the same as a missing one.
- **Cancel only while PLACED (SRS 6.5).** The status change is one conditional update (`orderStatus = PLACED`), so
  two cancels at the same moment restore the stock once.

## Run it

```bash
cd backend && npm install     # Jest tests and the cart/order modules
cd ../server && npm install   # the Express app (needs MONGODB_URI and JWT_SECRET in server/.env)
cd ../client && npm install   # the React app
```

Start `npm run dev` in `server/` and in `client/`. Sign in as a customer, add a book to the cart, then check out.
The seed script creates the demo customers (`cd backend && npm run seed`).

### Showing every payment result in the demo

Set `MOCK_PAYMENT_MODE` in `server/.env` and restart the server:

| Value | What the customer sees |
|---|---|
| `success` (default) | Order placed |
| `decline` | "Your payment was declined", cart kept |
| `timeout` | "The payment service did not answer", Try again keeps the same key |
| `timeout-once` | First try times out, the retry succeeds with exactly one order |

## Tests (run in CI on every push and pull request)

```bash
cd backend && npm test    # 127 tests: cart, checkout, payment adapter, order history, cancel, auth
cd client && npm test     # 50 tests: API client, cart, checkout, confirmation, order history, cancel
```

| Test plan IDs | Where |
|---|---|
| TC-CART-01 to 08 | `backend/tests/cartService.test.js`, `cartRoutes.test.js`, `client/src/components/shop/CartPage.test.jsx` |
| TC-ORD-01 to 09, TC-TST-01 | `backend/tests/orderService.test.js`, `orderRoutes.test.js`, `paymentAdapter.test.js` |
| TC-ORD-10 (screens) | `client/src/components/shop/CheckoutPage.test.jsx` |
| TC-TRK-01 to 03, 05 to 08 | `backend/tests/orderHistory.test.js`, `client/src/components/shop/OrdersPage.test.jsx` |
| TC-TRK-04 | `backend/tests/orderModelAndRepo.test.js` |

Not covered by automated tests: running against a real MongoDB (the unit tests use in-memory stand-ins and a test
double for the model), and the browser-level system tests TC-ORD-10 / TC-TRK-01, which need a manual run.

## Deviations from the submitted SRS / SAD / Test Plan (explain at the final demo)

1. **Book field names and price type.** The seeded Book model uses `stock_quantity`, `is_active` and a plain `Number`
   price, while the SAD data model says `stockQuantity`, `isActive` and Decimal128. All mapping is in
   `backend/repositories/bookRepository.js`. Money is calculated in integer cents (`backend/utils/money.js`), so there are no rounding errors.
2. **Mock payment runs inside the server**, behind the payment adapter interface, instead of as a separate HTTP service.
   The adapter still enforces the 5 second timeout and maps SUCCESS / DECLINED / TIMEOUT as in the SAD.
3. **Unavailable cart lines.** A book that was disabled or ran out of stock after it was added stays in the cart, is marked,
   is left out of the total, and blocks checkout until the customer removes it or lowers the quantity.
4. **Declined orders are hidden from the customer** (they exist in the database with `paymentStatus FAILED`).
   The SAD only says no confirmed order is created.
5. **Order history response shape** is `{ "orders": [...] }` with a summary per order; the SAD does not fix the body.
6. **Cancel is not in a database transaction.** The status change is atomic, the stock is restored right after it.
   MongoDB transactions need a replica set, which the project does not use. A crash between the two steps
   would leave the order cancelled with stock not restored.
7. **Models built on the server's database connection.** `backend/` and `server/` each have their own `node_modules`, so the
   Cart and Order models and repositories are created from the server's mongoose instance (same pattern as the User model).
8. **Customer-only routes.** `server/index.js` checks the CUSTOMER role on cart and order routes, as the SAD requires, on top of the JWT check.
9. **Error envelope without `requestId`.** The shared error handler (`server/errorHandler.js`) does not add one.
10. **Cart UI location.** The cart screens were first written in a separate `frontend/` folder and moved into the real React app (`client/`).
11. **Staff order updates (FR-011 transitions, TC-ADM) are not part of this module**; cancel by staff of a PROCESSING order is therefore not built.
