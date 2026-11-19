# System Validation Report (consolidated, project-wide)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering
Cart, checkout and orders re-run on 17 November 2026 on `main` at `adec1d9` plus the DEF-04 fix. Other modules: the members' own runs.

System validation means the running application is exercised the way a user or client would: real HTTP to the real Express
server with a real database, or a real browser. It is separate from the unit tests.

## 1. Summary

| Module (owner) | What was run | Cases | Pass | Not pass | Where run |
|---|---|---|---|---|---|
| Cart, checkout, orders (B S Keertana) | Live API, three payment modes | 33 | 33 | 0 | Real MongoDB 8, 17 Nov 2026 (this run) |
| Cart, checkout, orders (B S Keertana) | Real browser (Playwright) | 5 | 5 | 0 | 5 Nov 2026, repeated 17 Nov 2026 after the DEF-04 change: 5 of 5 pass |
| Catalog (Anushka Kumar) | Postman and browser, 15 functional cases; JMeter, 3 load cases | 18 | 18 | 0 | Local, her own run |
| Admin, set-up, CI (Bhuvan Raj H) | Live API and browser on a local MongoDB; static Docker check; regression | 32 | 30 | 2 not run | Local, his own run (Windows) |
| Authentication and security (Bhagath Naveen Mullakara) | Integration tests (Supertest, in-memory) and screenshots of the dialogs | 18 | 13 | 4 partial, 1 not run | Local; no live-database auth run |

Plain reading: cart, checkout and order tracking, the catalog and the admin APIs were exercised against running software.
Authentication and security were validated through integration tests and the code, not through a live database run.

## 2. Cart, checkout and order tracking (this run)

Environment: the project's real server (`server/index.js`, Express 5, Mongoose 9, Node 22) on port 5055; MongoDB 8.3.7 standalone
`mongod`; database freshly seeded with `backend/scripts/seed.js` (1,000 books, 3 customers, 1 administrator); the project's mock
payment service with `MOCK_PAYMENT_MODE` set to `success`, `decline` and `timeout-once`, one server start per phase.
Script: `backend/tests/system/systemValidation.js`. Each run registers its own customers and books (titles start with `SYSTEST`).

| Phase | Payment mode | Cases | Passed | Failed | Time |
|---|---|---|---|---|---|
| `success` | success | 30 | 30 | 0 | 1.7 s |
| `decline` | decline | 2 (TC-ORD-06, TC-ORD-13) | 2 | 0 | 0.06 s |
| `timeout-once` | timeout-once | 1 (TC-ORD-07) | 1 | 0 | 5.1 s (the adapter waits its 5 s limit by design) |
| **Total** | | **33** | **33** | **0** | 6.9 s |

Raw results with every check and the actual value seen: `evidence/project-wide/system-validation-success.json`, `-decline.json`,
`-timeout-once.json` (and the console output in the matching `.txt` files).

First attempt note: an earlier attempt on 16 Nov showed two failures in the `decline` phase and a login failure (429) in
`timeout-once`. Both came from the test harness, not the product. The most likely cause is that the previous phase's server was still answering on the
port (the `decline` calls got a 201, which only `success` mode gives), and the login limiter (10 attempts per 15 minutes) then blocked the
next phase. The whole sequence was re-run from an empty database with each server stopped before the next started; those results are
the ones above.

The browser run (5 checks: TC-ORD-10, TC-TRK-01, TC-TRK-05, TC-TRK-07 and a check for JavaScript errors) was done on 5 November with
screenshots `evidence/screenshots/01` to `08`, and repeated on 17 November 2026 after the DEF-04 change (the client now sends the staff
token on book writes; the script logs in as the administrator to create its test book): 5 of 5 pass, results in
`evidence/project-wide/ui-validation-results.json`. The 5 November report is in
[cart-checkout/System_Validation_Report.md](cart-checkout/System_Validation_Report.md).

## 3. Catalog (Anushka Kumar)

Run with Postman and the browser against the real server, and Apache JMeter (`docs/catalog_performance_test.jmx`).

| Check | Result |
|---|---|
| 15 functional cases TC-CAT-01 to 15 (browse, search by title, author and category, no match, regex-like input, page size cap 50, details, unknown ID 404, invalid ID 400, out of stock, pagination, invalid page and limit 400) | 15 of 15 pass |
| TC-PERF-01 Browse, 50 users, 10 s ramp-up, 10 loops | 500 samples, avg 6 ms, min 4 ms, max 53 ms, 0.00% errors, about 51 requests/s |
| TC-PERF-02 Search, same load | 500 samples, avg 8 ms, 0.00% errors, about 51 requests/s |
| TC-PERF-03 Combined | 1,000 samples, avg 7 ms, max 53 ms, 0.00% errors, about 102 requests/s |

Evidence: `docs/evidence/` (Postman screenshots, catalog and out-of-stock browser screenshots, JMeter summary `docs/Summary_Report.png`).
TC-CAT-08 is recorded as Pass in the member's summary without its own screenshot. The local test environment is not a production
setting.

## 4. Admin, set-up, CI and Docker (Bhuvan Raj H)

Windows, Node 24, local MongoDB, separate test database and disposable accounts; live API and Vite browser.

| Area | Cases | Pass | Not run |
|---|---|---|---|
| BK-01 scaffold, BK-02 CI | 7 | 7 | 0 |
| BK-20 books API, BK-21 stock API, BK-22 admin catalog UI | 11 | 11 | 0 |
| BK-42 status machine, BK-43 admin order API, BK-44 admin orders UI | 8 | 8 | 0 |
| BK-45 Docker (static check passes; build and health check not run) | 2 | 1 | 1 |
| BK-47 regression passes; freeze record not found | 2 | 1 | 1 |
| BK-48 admin documentation | 2 | 2 | 0 |
| **Total** | **32** | **30** | **2** |

Not run: TC-BK-45-02 (Docker is not installed on that machine) and TC-BK-47-02 (no development freeze record in the repository).

Note: this record reports 401 for anonymous and 403 for customer calls to the book routes after a local fix. That fix was not on
`main`; the login requirement on `main` is now covered by TC-SEC-08 (section 2 and DEF-04 in section 6).

## 5. Authentication and security (Bhagath Naveen Mullakara)

Supertest integration tests with in-memory repositories (38 focused tests, 40 with two related security tests) plus screenshots of
the login and registration dialogs (`evidence/screenshots/09`, `10`). Results: 18 cases, 13 pass, 4 partial, 1 not run (see the Test
Case Document, section 4). No live-database auth run and no browser register, login and logout run was done.

## 6. Defects found by system validation

| ID | Defect | Status |
|---|---|---|
| DEF-01 | Staff order routes not mounted (found by TC-TRK-06, TC-TRK-11) | Fixed, passes in this run |
| DEF-02 | Payment timeout returned `INTERNAL_ERROR` (found by TC-ORD-07) | Fixed, passes in this run |
| DEF-04 | On `main`, the four book mutation routes needed no login: `POST /api/books` without a token returned **201** on 16 Nov 2026 | **Fixed** on 17 Nov 2026; TC-SEC-08 passes (no token 401, customer 403, staff 200, `GET /api/books` still public) |

How DEF-04 was checked: the real server was started on the seeded database and `POST /api/books` was sent with no `Authorization`
header and a valid book body. The book was created. After the fix, the same call returns 401, and TC-BK-20-02, TC-BK-21-03 and
TC-BK-22-02 describe the same behaviour on the admin owner's checkout; they were not re-run by him on `main`.

## 7. Not covered

- The admin catalog screen (add, edit, restock, disable a book through the browser) was not driven by a browser test; the server side of those routes is covered by TC-SEC-08.
- Docker build and health check; development freeze record.
- Live-database auth tests and browser logout flow.
- UAT with real users and the five-user usability test (TC-USA-01); only the walkthrough in `docs/usability_walkthrough.md` exists.

## 8. Reproduce (cart, checkout, orders)

1. Start MongoDB and seed it: `cd backend && SEED_DEFAULT_PASSWORD='<12+ chars>' MONGODB_URI=<uri> npm run seed`.
2. For each phase start the server (`cd server`, with `MONGODB_URI`, `JWT_SECRET`, `PORT=5055` and `MOCK_PAYMENT_MODE` set to
   `success`, then `decline`, then `timeout-once`; stop it before starting the next) and run
   `BASE_URL=http://127.0.0.1:5055 SEED_PASSWORD='<same password>' MONGODB_URI=<uri> node backend/tests/system/systemValidation.js <phase>`.
