# Code Coverage Report (consolidated, project-wide)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering
Backend and server measured on 16 November 2026 on a fresh clone of `main` at `a779478`. Client re-measured on 17 November 2026 after the DEF-04 change (`App.jsx` gained 2 lines; no other backend or client code that has unit tests changed). Compiled by B S Keertana.

Tools: Jest with Istanbul (`jest --coverage`) for `backend/`; Vitest with V8 (`vitest --coverage`) for `client/`; Node's built-in
test coverage (`node --test --experimental-test-coverage`) for `server/`.
Raw output: `evidence/project-wide/backend-unit-and-coverage.txt`, `client-unit-and-coverage.txt`, `server-coverage.txt`;
summaries as JSON: `backend-coverage-summary.json`, `client-coverage-summary.json` (same folder).

## 1. Target (TC-MNT-01)

The Test Plan target is at least **70% line coverage on the service layer**.
Result: the backend service layer (`backend/services`, 5 files) has **95.59% line coverage (217 of 227 lines)**. **Target met.**

## 2. Backend (174 tests)

Measured code: `services`, `routes`, `repositories`, `models`, `utils`, `middleware`, `mock-payment` (29 files).

| Scope | Lines | Statements | Functions |
|---|---|---|---|
| **Service layer** (5 files) | **95.59% (217/227)** | 95.16% | 98.28% |
| Whole measured backend | **90.31% (531/588)** | 88.80% (563/634) | 88.28% (128/145) |

By module (owner):

| Module | Files | Lines | Notes |
|---|---|---|---|
| Cart, checkout, orders (B S Keertana): services, routes, models, validators, money, mock payment (no repositories) | 14 | **97.61% (327/335)** | |
| Admin orders (Bhuvan Raj H): `adminOrderRoutes.js`, `orderStatusMachine.js` | 2 | **100% (20/20)** | |
| Authentication and security (Bhagath Naveen Mullakara): auth service and routes, middleware, user model and repository, security events | 10 | **91.41% (149/163)** | Bhagath's focused run alone: 93.28% (125/134) over 7 files |
| Data repositories (book, cart, order) | 3 | 50.00% (35/70) | The unit tests replace repositories with in-memory stand-ins, so these run for real only in the live system runs |
| Catalog (Anushka Kumar) | 0 | not measured | Catalog logic is in `server/index.js`, outside the backend measurement |

Files below 90% lines: `bookRepository.js` 26.67% (4/15), `cartRepository.js` 22.22% (2/9), `orderRepository.js` 63.04% (29/46),
`userRepository.js` 76.47% (13/17), `authenticate.js` 87.5% (21/24), `requireRole.js` 86.67% (13/15), `sanitizeInput.js` 85.71% (6/7),
`authService.js` 87.5% (28/32), `money.js` 83.33% (5/6). The first four are the repository files explained above.

## 3. Client (59 tests)

Measured: all of `client/src`.

| Scope | Lines | Statements |
|---|---|---|
| Whole `src/` | **50.56% (267/528)** | 51.46% (298/579) |
| Shop screens, API client and cart hook (cart, checkout, orders; B S Keertana) | **93.12% (230/247)** | 90.18% (257/285) |
| Admin orders screen (Bhuvan Raj H) | **100% (35/35)** | |
| Auth API client and login dialog (Bhagath Naveen Mullakara) | **4.65% (2/43)** | |
| `App.jsx` and `main.jsx` (catalog screens, admin catalog screen, app shell) | **0% (0/202)** | |

The low whole-`src` figure comes from one large file: `App.jsx` (202 lines) holds the catalog, admin catalog and auth wiring and has
no unit test. The shop and admin order screens, which have unit tests, are covered above 93%.

## 4. Server package (8 tests)

`node --test --experimental-test-coverage`: 98.35% lines overall. This figure is inflated because Node counts the test files
themselves (`basic.test.js`, `security.test.js` at 100%) and `server/index.js` is never loaded by a test, so its routes are not in the
number. `errorHandler.js` 91.67% lines, `requestLogger.js` 100%, `sanitizeInput.js` 100%, `securityEvents.js` 100%.

## 5. What this does not show

- The catalog and book admin routes (`server/index.js`) have no unit coverage; they were checked by live requests only.
- Coverage by unit tests is not coverage by system tests. The live runs add to it (System Validation Report).
- Line coverage says a line ran, not that its result was checked.

## 6. Reproduce

Backend: `cd backend && npx jest --runInBand --coverage --collectCoverageFrom='services/**/*.js' --collectCoverageFrom='routes/**/*.js' --collectCoverageFrom='repositories/**/*.js' --collectCoverageFrom='models/**/*.js' --collectCoverageFrom='utils/**/*.js' --collectCoverageFrom='middleware/**/*.js' --collectCoverageFrom='mock-payment/**/*.js'`
Client: `cd client && npm i --no-save @vitest/coverage-v8 && npx vitest run --coverage --coverage.include='src/**/*.{js,jsx}' --coverage.exclude='src/**/*.test.*'`
Server: `cd server && node --test --experimental-test-coverage`
