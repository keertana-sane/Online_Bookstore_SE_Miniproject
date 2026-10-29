# Authentication and Security (BK-23 to BK-28)

This note records the Sprint 2 implementation and traceability for SEC-001 through
SEC-006. The executable checks are run by GitHub Actions on pushes and pull requests.

## Implementation and traceability

| Requirement | Implementation | Verification |
|---|---|---|
| SEC-001 — password protection | Registration validates passwords and stores only bcrypt hashes; the user schema stores `password_hash`, never the submitted password. | `backend/tests/authRoutes.test.js` checks the saved hash and the response. |
| SEC-002 — role-based access | JWT authentication and the `CUSTOMER` / `ADMIN_STAFF` role middleware gate protected routes. | `backend/tests/authenticate.test.js`, `requireRole.test.js`, and `serverAuthApi.test.js`. |
| SEC-003 — input validation and sanitisation | `express-validator` validates registration; `mongo-sanitize` removes Mongo operator keys from request bodies and query strings. Services validate fields again before use. Text fields reject markup and enforce SRS Appendix B limits. | `backend/tests/authRoutes.test.js`, `orderRoutes.test.js`, and `server/security.test.js`. |
| SEC-004 — JWT validation | Auth middleware verifies signed HS256 tokens, required claims, and expiry. | `backend/tests/authenticate.test.js`. |
| SEC-005 — payment data minimisation | The order schema stores only `paymentStatus` and `paymentRef` as payment-related fields. The adapter sends only the reference and amount; card number, CVV, and expiry are not stored or logged. | `backend/tests/orderModelAndRepo.test.js` and `paymentAdapter.test.js`. |
| SEC-006 — security events | Failed logins, unauthorized/forbidden access, and rate-limited logins are logged with request metadata, not request bodies or credentials. | `backend/tests/authRoutes.test.js`, `authenticate.test.js`, and `requireRole.test.js`. |
| BK-24 — errors and HTTP hardening | Helmet headers, request IDs, request/response timing logs, and a central JSON error envelope are enabled in the Express server. Server errors do not return exception details or stack traces. | `server/security.test.js`. |
| BK-25 — login rate limit | The 11th login request from one IP within 15 minutes returns HTTP 429; the first ten are allowed through normal authentication. | `backend/tests/authRoutes.test.js`. |
| BK-27 — security regression tests | Auth, authorization, input, payment-data, and HTTP security tests are included in both server and backend CI jobs. | Run `npm test` from `server/` and `backend/`. |
| BK-46 — CI scans | CI runs Oxlint and `npm audit --audit-level=high` for the client, server, and backend modules. | `.github/workflows/ci.yml`. |

### Input limits

The implementation applies the SRS Appendix B limits for email (100 characters),
shipping address (300), title (150), author (100), category (50), price
(`99999999.99` maximum and at most two decimal places), and stock quantity
(`999999` maximum). Registration names
are limited to 100 characters. Plaintext passwords are limited to 72 characters so
bcrypt cannot silently truncate longer input; the existing 8-character minimum is
preserved. Search text is limited to 100 characters.

## Deviations to mention at the final demo

1. Login throttling uses an in-memory, per-process IP counter rather than a shared
   store. It meets the single-instance Sprint 2 acceptance criterion; a multi-instance
   deployment would need a shared rate-limit store.
2. Registration rejects markup characters in text fields instead of storing encoded
   markup. The client also renders user-provided text as text, not HTML.
3. The submitted SRS and SAD are PDF deliverables and were not regenerated. This
   implementation note supplies the code-to-requirement trace and records the
   implementation deviations for the demo.
4. The mock payment adapter records status/reference metadata in memory for
   idempotency; the order database schema persists only `paymentStatus` and
   `paymentRef`, and no card data is accepted by the payment adapter.
