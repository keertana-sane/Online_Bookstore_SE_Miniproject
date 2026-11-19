# Test Case Document (consolidated, project-wide)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering · Part 3 (testing)
Version 3.1 · consolidated 16 November 2026, updated 17 November 2026 for DEF-04 · build tested: `main` at `adec1d9` plus the DEF-04 fix

This is the team's updated Test Case Document. It brings together the test cases that each member updated and ran for
their own part of Sprint 1 and Sprint 2, with the result each member recorded. The full step-by-step cases are in each
member's own document (section 2); this document is the one place that lists every case, its result and the open defects.

## 1. Summary

| Module | Owner | Cases | Pass | Partial | Not run | Source document |
|---|---|---|---|---|---|---|
| Cart, checkout, order tracking | B S Keertana (cart, checkout, tracking, and the DEF-04 regression case) | 37 | 37 | 0 | 0 | [cart-checkout/Test_Case_Document.md](cart-checkout/Test_Case_Document.md) |
| Catalog, search, performance | Anushka Kumar | 18 | 18 | 0 | 0 | [Anushka_Individual_Test_Cases_Sprint_1_and_2.pdf](../Anushka_Individual_Test_Cases_Sprint_1_and_2.pdf) |
| Authentication and security | Bhagath Naveen Mullakara | 18 | 13 | 4 | 1 | [Bhagath_Individual_Test_Cases.docx](../Bhagath_Individual_Test_Cases.docx) |
| Admin, scaffold, CI, Docker | Bhuvan Raj H | 32 | 30 | 0 | 2 | [BhuvanRajH_Individual_Test_Cases_Sprint1_Sprint2_Formatted.docx](../BhuvanRajH_Individual_Test_Cases_Sprint1_Sprint2_Formatted.docx) |
| **Total** | | **105** | **98** | **4** | **3** | |

Pass rate of cases that were run: 98 of 102 (96.1%); 105 listed, 3 not run, 4 partly run. No case was marked Pass without
a recorded result. Cases not run or partly run are listed in section 4 with the reason.

## 2. Who updated which cases

| Member | Sprint tasks | Cases |
|---|---|---|
| B S Keertana | BK-14 to BK-19 (Sprint 1), BK-36 to BK-41 (Sprint 2) | TC-CART-01 to 09, TC-ORD-01 to 14, TC-TRK-01 to 11, TC-TST-01, TC-MNT-01 (8 new, 13 updated; every case has an actual result), plus TC-SEC-08 added on 17 Nov |
| Anushka Kumar | BK-03, BK-10 to BK-13 (Sprint 1); BK-29 to BK-34 (Sprint 2) | TC-CAT-01 to 15 (catalog), TC-PERF-01 to 03 (BK-29) |
| Bhagath Naveen Mullakara | BK-04 to BK-09, BK-23 to BK-28, BK-46 | TC-AUTH-01 to 08, TC-SEC-01 to 07 (updated from Appendix A), plus TC-DEMO-01, TC-DOC-01, TC-CI-01 |
| Bhuvan Raj H | BK-01, BK-02, BK-20 to BK-22 (Sprint 1); BK-42 to BK-45, BK-47, BK-48 (Sprint 2) | TC-BK-01-01 to TC-BK-48-02 |

## 3. All test cases and results

### 3.1 Cart, checkout and order tracking (B S Keertana)

Run on 5 November 2026 and again on 17 November 2026 (API cases, see the System Validation Report). TC-SEC-08 was added on 17 November 2026. Full cases: [cart-checkout/Test_Case_Document.md](cart-checkout/Test_Case_Document.md).

| ID | Scenario | Result |
|---|---|---|
| TC-CART-01 | Add an in-stock book to cart | Pass |
| TC-CART-02 | Reject out-of-stock book | Pass |
| TC-CART-03 | Cart requires authentication | Pass |
| TC-CART-04 | Update item quantity | Pass |
| TC-CART-05 | Quantity boundaries rejected | Pass |
| TC-CART-06 | Remove an item | Pass |
| TC-CART-07 | Cart total equals sum of price x quantity | Pass |
| TC-CART-08 | Empty cart total is zero | Pass |
| TC-CART-09 | Disabled book in cart is flagged, left out of the total and blocks checkout | Pass |
| TC-ORD-01 | Reject checkout with empty cart | Pass |
| TC-ORD-02 | Reject checkout with missing shipping address | Pass |
| TC-ORD-03 | Shipping address length boundary | Pass |
| TC-ORD-04 | Successful checkout creates order | Pass |
| TC-ORD-05 | Order numbers are unique | Pass |
| TC-ORD-06 | Declined payment creates no confirmed order | Pass |
| TC-ORD-07 | Retry after payment timeout does not duplicate order | Pass |
| TC-ORD-08 | Item sold out between cart and checkout | Pass |
| TC-ORD-09 | Concurrent checkout of last copy | Pass |
| TC-ORD-10 | Place order end-to-end through UI | Pass |
| TC-ORD-11 | Staff accounts cannot use the cart or orders | Pass |
| TC-ORD-12 | Idempotency-Key must be a UUID | Pass |
| TC-ORD-13 | A declined payment is not shown in the customer's history or detail | Pass |
| TC-ORD-14 | Total sent by the browser is ignored | Pass |
| TC-TRK-01 | Order history lists own orders | Pass |
| TC-TRK-02 | View single order detail | Pass |
| TC-TRK-03 | Customer cannot read another customer's order | Pass |
| TC-TRK-04 | Only allowed status values accepted | Pass |
| TC-TRK-05 | Customer cancels own PLACED order | Pass |
| TC-TRK-06 | Customer cannot cancel after PROCESSING | Pass |
| TC-TRK-07 | Customer with no orders sees empty history | Pass |
| TC-TRK-08 | Order history requires authentication | Pass |
| TC-TRK-09 | Cancelling twice restores stock once | Pass |
| TC-TRK-10 | Two cancels at the same moment restore stock once | Pass |
| TC-TRK-11 | Status machine blocks invalid staff transitions | Pass |
| TC-TST-01 | Order service testable without payment service | Pass |
| TC-MNT-01 | Business logic separated into service modules | Pass |
| TC-SEC-08 | Book create, edit, restock and disable need a staff login: no token 401, customer 403, staff 200, reads stay public (DEF-04 regression, 17 Nov) | Pass |

### 3.2 Catalog, search and performance (Anushka Kumar)

Executed with Postman, the browser and Apache JMeter (50 users, 10 s ramp-up, 10 loops).

| ID | Scenario | Result |
|---|---|---|
| TC-CAT-01 | Browse catalog without login | Pass |
| TC-CAT-02 | Search by title | Pass |
| TC-CAT-03 | Search by author | Pass |
| TC-CAT-04 | Search by category | Pass |
| TC-CAT-05 | No matching search results | Pass |
| TC-CAT-06 | Regex-like search input treated as literal text | Pass |
| TC-CAT-07 | Page size capped at 50 | Pass |
| TC-CAT-08 | Book details page (see note) | Pass |
| TC-CAT-09 | Unknown book ID returns 404 | Pass |
| TC-CAT-10 | Out-of-stock book shown as Out of stock | Pass |
| TC-CAT-11 | Book detail API | Pass |
| TC-CAT-12 | Invalid book ID returns 400 | Pass |
| TC-CAT-13 | Pagination navigation, page 1 and page 2 | Pass |
| TC-CAT-14 | Invalid page number returns 400 | Pass |
| TC-CAT-15 | Invalid limit returns 400 | Pass |
| TC-PERF-01 | Browse catalog, 50 users (JMeter): avg 6 ms, 0.00% errors | Pass |
| TC-PERF-02 | Search catalog, 50 users (JMeter): avg 8 ms, 0.00% errors | Pass |
| TC-PERF-03 | Combined: 1,000 samples, avg 7 ms, max 53 ms, 0.00% errors | Pass |

Note: TC-CAT-08 (book details page) is recorded as Pass in the member's test summary; the evidence folder has the catalog and
out-of-stock screenshots (TC-CAT-10) but no separate details-page screenshot.

### 3.3 Authentication and security (Bhagath Naveen Mullakara)

Automated integration tests (Supertest, in-memory repositories) plus visual capture of the dialogs. Not a live database run.

| ID | Scenario | Result |
|---|---|---|
| TC-AUTH-01 | Register a customer; password stored as bcrypt hash | Pass |
| TC-AUTH-02 | Duplicate email rejected (case-insensitive) | Pass |
| TC-AUTH-03 | Email and password validation, unsafe input | Pass |
| TC-AUTH-04 | Login returns signed one-hour JWT | Pass |
| TC-AUTH-05 | Three wrong passwords: generic 401, events logged | Pass |
| TC-AUTH-06 | Expired token rejected | Pass |
| TC-AUTH-07 | Register, login, logout in the browser | Not run |
| TC-AUTH-08 | No plaintext passwords in storage, logs or source | Partial |
| TC-SEC-01 | Customer cannot POST admin book route; event logged | Pass |
| TC-SEC-02 | Customer cannot PATCH admin order status; event logged | Pass |
| TC-SEC-03 | Script-like input in address and search | Partial |
| TC-SEC-04 | Tampered role token rejected | Pass |
| TC-SEC-05 | No card data stored or returned | Pass |
| TC-SEC-06 | Security log entries (time, IP, route, user ID) | Pass |
| TC-SEC-07 | Login rate limit (11th attempt gives 429) | Pass |
| TC-DEMO-01 | Sprint 1 demo video present (BK-09) | Partial |
| TC-DOC-01 | Auth traceability and deviations documented (BK-28) | Partial |
| TC-CI-01 | CI has lint and dependency audit steps (BK-46) | Pass |

### 3.4 Admin, project set-up, CI and Docker (Bhuvan Raj H)

Live checks against a local MongoDB, plus regression suites. See the member's document for the procedure of each case.

| ID | Scenario | Result |
|---|---|---|
| TC-BK-01-01 | Package install and scaffold smoke check | Pass |
| TC-BK-01-02 | Frontend build and backend syntax checks | Pass |
| TC-BK-01-03 | Missing configuration fails fast; configured server starts | Pass |
| TC-BK-02-01 | Workflow YAML and job structure | Pass |
| TC-BK-02-02 | Local frontend CI-equivalent | Pass |
| TC-BK-02-03 | Fresh-clone package regression and CI workflow | Pass |
| TC-BK-02-04 | Actual GitHub workflow status for configured remote | Pass |
| TC-BK-20-01 | Create book using valid fields | Pass |
| TC-BK-20-02 | Reject book creation without authentication | Pass |
| TC-BK-20-03 | Reject invalid price and stock | Pass |
| TC-BK-20-04 | Edit and disable a book | Pass |
| TC-BK-21-01 | Set stock to zero and positive quantity | Pass |
| TC-BK-21-02 | Reject negative stock | Pass |
| TC-BK-21-03 | Reject stock update without authentication | Pass |
| TC-BK-22-01 | Catalog management interface renders for admin | Pass |
| TC-BK-22-02 | Catalog management write actions blocked for guests/non-admin users (401/403) | Pass |
| TC-BK-22-03 | Admin creates and edits a book from catalog UI | Pass |
| TC-BK-22-04 | Admin UI stock prompt and disable interaction | Pass |
| TC-BK-42-01 | Allowed and rejected transition matrix | Pass |
| TC-BK-42-02 | Invalid transition error contract | Pass |
| TC-BK-43-01 | Admin list, status filter and invalid filter | Pass |
| TC-BK-43-02 | Require authenticated administrator | Pass |
| TC-BK-43-03 | Update through allowed lifecycle and verify status history | Pass |
| TC-BK-43-04 | Reject malformed ID, missing order and terminal transition | Pass |
| TC-BK-44-01 | Admin orders UI renders live orders and filter | Pass |
| TC-BK-44-02 | UI terminal state and interaction/error states | Pass |
| TC-BK-45-01 | Static Docker and Compose configuration validation | Pass |
| TC-BK-45-02 | Docker build/up/health/persistence integration | Not run |
| TC-BK-47-01 | Full backend and frontend regression suites | Pass |
| TC-BK-47-02 | Verify development-freeze record | Not run |
| TC-BK-48-01 | Verify Admin API/UI documentation against source | Pass |
| TC-BK-48-02 | Verify deviations document captures discovered security issue | Pass |

## 4. Cases not fully run

| Case | Result | Reason |
|---|---|---|
| TC-AUTH-07 (register, login, logout in the browser) | Not run | Dialogs were captured visually; the full browser flow was not executed |
| TC-AUTH-08 (no plaintext passwords) | Partial | Source and unit tests only; live database and log inspection not done |
| TC-SEC-03 (script-like input) | Partial | Server responses checked; no browser execution check |
| TC-DEMO-01 (demo video) | Partial | File presence only; playback and duration not verified |
| TC-DOC-01 (SRS/SAD/RTM update) | Partial | Auth deviations documented; SRS and SAD not regenerated, RTM source not found |
| TC-BK-45-02 (Docker build, up, health) | Not run | Docker is not installed on the machine used |
| TC-BK-47-02 (development freeze record) | Not run | No freeze record or sign-off found in the repository |
| TC-USA-01 (usability, five users) and UAT | Not run by anyone | Needs real participants; only the five-screen walkthrough (`docs/usability_walkthrough.md`) exists |

## 5. Defects

| ID | Module | Defect | Severity | Status |
|---|---|---|---|---|
| DEF-01 | Admin orders | Staff order routes (`/admin/orders`) were not mounted in the cart module, so staff could not list or update orders (found by TC-TRK-06, TC-TRK-11) | High | Fixed, regression test added, merged (PR #62) |
| DEF-02 | Checkout | A payment timeout returned `INTERNAL_ERROR` instead of `PAYMENT_TIMEOUT` (found by TC-ORD-07) | Medium | Fixed, regression test added, merged (PR #62) |
| DEF-03 | Security | Security-event log entries had no timestamp or user ID, although Appendix A TC-SEC-06 expects them | Medium | Fixed and retested by the auth owner (merged, PR #64) |
| DEF-04 | Admin catalog / security | On `main` at `a779478` and `adec1d9`, `POST /api/books`, `PUT /api/books/:id`, `PATCH /api/books/:id/stock` and `PATCH /api/books/:id/disable` had no authentication: on 16 Nov 2026 a `POST /api/books` with no token returned 201 against a live server. This broke SEC-002 for the book routes | High | **Fixed** (17 Nov 2026): the four routes now need an ADMIN_STAFF login (no token 401, customer 403), the admin catalog screen sends the staff token, and regression case TC-SEC-08 passes on a live server. Merged once the fix PR is merged |

DEF-04 note: before the fix, the unit tests did not load the book routes in `server/index.js` (the server package's coverage run never imports
it), and the auth owner's TC-SEC-01 record says the admin handler "was not called", so neither exercised the real book routes.
The gap was found by sending a live request.

## 6. Requirement coverage

| Requirement area | Covered by |
|---|---|
| Catalog: browse, search, details, pagination | TC-CAT-01 to 15 |
| FR-006 to FR-012, FR-016 (cart, checkout, orders, staff order status) | TC-CART, TC-ORD, TC-TRK, TC-BK-42 to 44 |
| FR-001, FR-002 (register, login) | TC-AUTH-01 to 08 |
| SEC-001 to SEC-006 | TC-AUTH, TC-SEC, TC-CART-03, TC-TRK-08, TC-ORD-11; SEC-002 on the book routes: TC-SEC-08 (DEF-04, fixed) |
| Admin books and stock management | TC-BK-20 to 22 (run on a local checkout; the login requirement on `main` is covered by TC-SEC-08, see DEF-04) |
| NFR performance (catalog under 50 users) | TC-PERF-01 to 03 |
| NFR-004 to NFR-006 (retry safety, no duplicate orders, stock) | TC-ORD-07, 08, 09, 12, TC-TRK-09, 10 |
| Usability (order in five screens or fewer) | Walkthrough document only; TC-USA-01 not run |
