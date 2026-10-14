# Product Backlog - Team 15 Online Bookstore

Source: SRS FR/NFR/SEC. Points use a 1-2-3-5 scale. Full data: `docs/backlog.csv`, `docs/backlog.xlsx`.


## Sprint 1 (72 points)

| ID | Story | SRS req | Owner | Pts |
|---|---|---|---|---|
| BK-01 | Project scaffold: React (Vite) + Express + Mongoose, ESLint, .env.example, module folders | NFR-005 | Bhuvan Raj H | 3 |
| BK-02 | GitHub Actions CI: lint + tests on every PR | NFR-005 | Bhuvan Raj H | 3 |
| BK-03 | Seed script: 1,000 books, 3 customers, 1 admin | STP 6 | Anushka P | 3 |
| BK-04 | Register API with unique email and bcrypt password hash | FR-001, SEC-001 | Bhagath Naveen Mullakara | 5 |
| BK-05 | Login API issuing JWT (role claim, 1 h expiry) | FR-002 | Bhagath Naveen Mullakara | 3 |
| BK-06 | Register / Login UI | FR-001, FR-002 | Bhagath Naveen Mullakara | 3 |
| BK-07 | JWT verification middleware | SEC-004 | Bhagath Naveen Mullakara | 3 |
| BK-08 | RBAC middleware for /admin routes | SEC-002 | Bhagath Naveen Mullakara | 2 |
| BK-09 | Sprint 1 demo video (1 min) uploaded to repo | Deliverable 2 | Bhagath Naveen Mullakara | 1 |
| BK-10 | Browse catalog API (public, paginated, limit <= 50) | FR-003 | Anushka P | 3 |
| BK-11 | Search by title, author or category | FR-004 | Anushka P | 5 |
| BK-12 | Book detail API and page | FR-005 | Anushka P | 3 |
| BK-13 | Catalog UI: home, search results, book cards, out-of-stock label | FR-003, FR-005 | Anushka P | 5 |
| BK-14 | Add in-stock book to cart (login required) | FR-006 | B S Keertana | 3 |
| BK-15 | Update quantity / remove cart item | FR-007 | B S Keertana | 2 |
| BK-16 | Cart total calculation (price x quantity) | FR-008 | B S Keertana | 2 |
| BK-17 | Cart UI | FR-006, FR-007, FR-008 | B S Keertana | 3 |
| BK-18 | Payment adapter + mock payment service (SUCCESS / DECLINED / TIMEOUT) | FR-016, NFR-006 | B S Keertana | 3 |
| BK-19 | Checkout API: validation, unique order number, stock reservation | FR-009, FR-010 | B S Keertana | 5 |
| BK-20 | Admin: add / edit / disable books API | FR-013 | Bhuvan Raj H | 5 |
| BK-21 | Admin: update stock quantity API | FR-014 | Bhuvan Raj H | 2 |
| BK-22 | Admin catalog management UI | FR-013, FR-014 | Bhuvan Raj H | 5 |

## Sprint 2 (76 points)

| ID | Story | SRS req | Owner | Pts |
|---|---|---|---|---|
| BK-23 | Input validation and sanitisation (express-validator, mongo-sanitize, length limits) | SEC-003 | Bhagath Naveen Mullakara | 5 |
| BK-24 | Central error envelope, helmet headers, request logging | SEC-003, SEC-006 | Bhagath Naveen Mullakara | 3 |
| BK-25 | Security event logging and login rate limit | SEC-006 | Bhagath Naveen Mullakara | 3 |
| BK-26 | Verify no payment card data stored (schema/log review) | SEC-005 | Bhagath Naveen Mullakara | 1 |
| BK-27 | Auth and security tests (TC-AUTH, TC-SEC) | SEC-001..006 | Bhagath Naveen Mullakara | 3 |
| BK-28 | Update SRS/SAD/RTM for Auth module; document deviations | Deliverable 2 | Bhagath Naveen Mullakara | 2 |
| BK-29 | Search performance: indexes + JMeter plan (50 users) | NFR-001 | Anushka P | 5 |
| BK-30 | Catalog tests (TC-CAT) | FR-003..005 | Anushka P | 3 |
| BK-31 | Postman collection run in CI | SAD 3.7 | Anushka P | 3 |
| BK-32 | Health endpoint (/health) and uptime check | NFR-002 | Anushka P | 2 |
| BK-33 | Usability walkthrough: order in <= 5 screens | NFR-003 | Anushka P | 2 |
| BK-34 | Update docs for Catalog module; document deviations | Deliverable 2 | Anushka P | 2 |
| BK-35 | Sprint 2 demo video (2 min) uploaded to repo | Deliverable 2 | Anushka P | 1 |
| BK-36 | Idempotency-Key on POST /orders (retry-safe) | NFR-004 | B S Keertana | 5 |
| BK-37 | Order history and order detail (own orders only) | FR-012 | B S Keertana | 3 |
| BK-38 | Customer cancels own PLACED order (stock restored) | SRS 6.5 | B S Keertana | 2 |
| BK-39 | Checkout, confirmation and order history UI | FR-009, FR-012, NFR-003 | B S Keertana | 5 |
| BK-40 | Cart and order tests (TC-CART, TC-ORD, TC-TRK, TC-TST) | FR-006..012, NFR-004 | B S Keertana | 3 |
| BK-41 | Update docs for Cart & Checkout; document deviations | Deliverable 2 | B S Keertana | 2 |
| BK-42 | Order status state machine (PLACED..CANCELLED) | FR-011 | Bhuvan Raj H | 3 |
| BK-43 | Admin order list and status update API | FR-015 | Bhuvan Raj H | 5 |
| BK-44 | Admin order management UI | FR-015 | Bhuvan Raj H | 3 |
| BK-45 | Dockerfile + docker-compose | STP 6 | Bhuvan Raj H | 3 |
| BK-46 | Static analysis and npm audit in CI | SAD 3.9 | Bhagath Naveen Mullakara | 2 |
| BK-47 | Admin tests (TC-ADM) and development freeze | FR-013..015 | Bhuvan Raj H | 3 |
| BK-48 | Update docs for Admin module; document deviations | Deliverable 2 | Bhuvan Raj H | 2 |

## Points per person

| Person | Sprint 1 | Sprint 2 |
|---|---|---|
| Anushka P | 19 | 18 |
| B S Keertana | 18 | 20 |
| Bhagath Naveen Mullakara | 17 | 19 |
| Bhuvan Raj H | 18 | 19 |
