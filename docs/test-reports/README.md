# Test reports (Part 3: testing, 2 to 6 November 2026)

Cart, checkout and order tracking · owner: B S Keertana (Test Engineer)

| Deliverable | File |
|---|---|
| Updated Test Case Document (36 cases, 8 new, results filled in, traceability matrix, defect log) | [Test_Case_Document.md](Test_Case_Document.md) |
| Unit Test Report (234 tests, 100% pass) | [Unit_Test_Report.md](Unit_Test_Report.md) |
| System Validation Report (37 checks, 100% pass after 2 fixes) | [System_Validation_Report.md](System_Validation_Report.md) |
| Code Coverage Report (services 95.59% lines, target 70%) | [Code_Coverage_Report.md](Code_Coverage_Report.md) |
| Branch Coverage Report (module 86.6% backend, 80.4% client screens) | [Branch_Coverage_Report.md](Branch_Coverage_Report.md) |

Raw evidence is in `evidence/`: test and coverage output, the JSON results of the system runs, and browser screenshots.
The scripts that produced the system results are in `backend/tests/system/`.

## Summary

| Measure | Result |
|---|---|
| Unit tests | 234 run, 234 passed (backend 168, client 59, server 7) |
| System validation | 37 run, 37 passed (32 API on real MongoDB, 5 in a real browser) |
| Test cases in the Test Case Document | 36, all pass (8 new, 13 updated) |
| Line coverage, service layer | 95.59% (target 70%) |
| Line coverage, cart/checkout/order module | 97.52% |
| Branch coverage, cart/checkout/order module | 86.6% |
| Defects found / fixed / open | 2 / 2 / 0 (DEF-01 admin order route, DEF-02 payment timeout code) |
| Requirements covered | FR-006 to FR-012, FR-016, NFR-004 to NFR-006, SEC-002 to SEC-004, rule 6.5 |
