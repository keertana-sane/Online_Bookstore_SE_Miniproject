# Admin module documentation

## Purpose

The Admin module lets an authenticated bookstore administrator view orders, filter incoming orders by status, and advance an order through the permitted fulfillment lifecycle. Administrators do not manage catalog or customer data through this module.

The React UI is exposed only to users whose stored session role is `ADMIN_STAFF`. Frontend role checks improve navigation and access, but every protected API request is also enforced by the Express authentication and role middleware.

## Authentication and authorization

Send the JWT returned by `POST /api/v1/auth/login` as a bearer token:

```http
Authorization: Bearer <jwt>
```

Both Admin order endpoints require:

1. a valid JWT;
2. the authenticated JWT role `ADMIN_STAFF`; and
3. a valid request payload.

An unauthenticated request receives `401`. An authenticated customer or other non-admin role receives `403`. The authenticated JWT subject supplies the status-history actor; clients must not send and cannot override an `actor` value.

Environment secrets, including `JWT_SECRET`, must be configured outside source control. Copy the safe examples in `.env.example` and `server/.env.example` rather than committing real credentials.

## Order-status lifecycle

| Current status | Allowed next status |
| --- | --- |
| `PLACED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED` | None |
| `CANCELLED` | None |

The state machine accepts only `PLACED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, and `CANCELLED`. Invalid or stale transitions are rejected rather than silently overwriting another status. Successful updates add status history containing the previous status, new status, authenticated actor, and timestamp. API detail responses expose those fields as `previousStatus`, `newStatus`, `at`, and a privacy-safe `by` label.

## Admin API

All paths below are relative to the Express base URL `http://localhost:5000/api/v1` in local development.

### List orders

```http
GET /api/v1/admin/orders
GET /api/v1/admin/orders?status=PROCESSING
Authorization: Bearer <jwt>
```

The optional query parameter `status` must be one of the five allowed statuses. Omitting it lists all confirmed orders.

Example response:

```json
{
  "orders": [
    {
      "orderId": "507f1f77bcf86cd799439011",
      "orderNumber": "ORD-20261029-00000001",
      "orderStatus": "PLACED",
      "paymentStatus": "SUCCESS",
      "total": 499,
      "itemCount": 1,
      "createdAt": "2026-10-29T09:30:00.000Z"
    }
  ]
}
```

Money is represented according to the existing API convention in the response implementation. The list UI formats the stored amount for display.

### Update order status

```http
PATCH /api/v1/admin/orders/:orderId/status
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "status": "PROCESSING"
}
```

`orderId` must be a 24-character hexadecimal MongoDB ObjectId. `status` is required and must be one of the allowed order statuses. The response is the updated order detail, including status history.

Example response behavior:

```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "orderStatus": "PROCESSING",
  "statusHistory": [
    {
      "status": "PROCESSING",
      "previousStatus": "PLACED",
      "newStatus": "PROCESSING",
      "at": "2026-10-29T09:35:00.000Z",
      "by": "staff"
    }
  ]
}
```

### Relevant errors

API errors use the standard envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Missing, malformed, or invalid JWT |
| `403` | `FORBIDDEN` | JWT is valid but role is not `ADMIN_STAFF` |
| `422` | `VALIDATION_ERROR` | Invalid/missing status, malformed/missing JSON field, or invalid order ID |
| `404` | `ORDER_NOT_FOUND` | The referenced order does not exist |
| `409` | `INVALID_ORDER_STATUS_TRANSITION` | Requested status is not permitted from the current status |
| `500` | `INTERNAL_ERROR` | Unexpected server failure |

## Frontend Admin UI

With an `ADMIN_STAFF` account, use the **Orders** item in the application header. The screen:

- lists orders returned by the Admin API;
- can filter orders using the Status selector;
- offers only the legal next statuses for the current order;
- displays terminal statuses without update controls;
- reloads the list after a successful update;
- displays loading, empty, network, authorization, and API error states.

Frontend role checks are only a user-interface guard. Backend authentication and role enforcement remain mandatory.

## Environment setup

### Server

Copy `server/.env.example` to `server/.env`, then set local development values:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/bookstore
PORT=5000
JWT_SECRET=<long-random-local-development-secret>
```

`JWT_SECRET` must not be checked into source control.

### Frontend

Copy `client/.env.example` to `client/.env` if a non-default API location is required:

```dotenv
VITE_AUTH_API_URL=http://localhost:5000/api/v1
```

The frontend API client also expects `/api/v1` for order requests. Use relative or local development URLs appropriate to the deployment; never place credentials in Vite environment variables.

### Docker Compose

The repository root `.env.example` documents:

```dotenv
MONGO_ROOT_USERNAME=bookstore
MONGO_ROOT_PASSWORD=<local-only-password>
MONGO_DATABASE=bookstore
JWT_SECRET=<long-random-local-development-secret>
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

Copy it to `.env` and replace placeholders before starting Docker Compose. Docker containers have not been executed successfully in every development environment, so Docker configuration should be validated on the target Docker host with `docker compose config` before deployment.

## Test commands

Run each suite from its package directory:

```powershell
Set-Location backend
npm test
npm run lint

Set-Location ../server
npm test
npm run lint

Set-Location ../client
npm test
npm run lint
npm run build
```

Admin backend tests use mock authentication and an in-memory repository. Admin frontend tests mock API responses. Neither suite requires Docker or production credentials.

## Deviations and known limitations

The following items are genuine implementation deviations or limitations identified from the issue and code review:

1. **Docker runtime validation limitation:** BK-45 Docker configuration was added, but container startup has not been validated on this development host because Docker is unavailable. Run `docker compose config` and `docker compose up --build` on a Docker-equipped host. This is a validation limitation, not a change to application requirements.

2. **Frontend environment values:** Vite variables are browser-visible configuration, not secrets. Authentication and API credentials must remain server-side or in JWTs supplied at runtime.

3. **API detail history privacy:** Internal status history stores the actual actor identifier, while list/detail API responses map it to `staff`, `you`, or `system`; raw internal actor IDs are intentionally not returned.

No other deviation from issue #48 has been identified. Issue #48 is documentation-only and does not specify an exact Admin API route, UI layout, or additional lifecycle rules. This guide follows the routes and lifecycle already implemented by BK-43/BK-44.
