# Test reports (Part 3: testing)

Team 15 · Online Bookstore (BookNest) · UE24CS341A Software Engineering · consolidated 16 November 2026, updated 17 November 2026 for DEF-04, on `main` at `adec1d9` plus the DEF-04 fix

The five project-wide deliverables are in this folder. Each member's own test cases are in `docs/` (see the Test Case Document, section 2).

| Deliverable | File |
|---|---|
| Updated Test Case Document (105 cases, all modules, defect log) | [Test_Case_Document.md](Test_Case_Document.md) |
| Unit Test Report (241 tests, 100% pass) | [Unit_Test_Report.md](Unit_Test_Report.md) |
| System Validation Report | [System_Validation_Report.md](System_Validation_Report.md) |
| Code Coverage Report (service layer 95.59% lines, target 70%) | [Code_Coverage_Report.md](Code_Coverage_Report.md) |
| Branch Coverage Report | [Branch_Coverage_Report.md](Branch_Coverage_Report.md) |

Other files:

| Folder or file | What it holds |
|---|---|
| [cart-checkout/](cart-checkout/) | The cart, checkout and order tracking versions of the five reports (module owner: B S Keertana), with the full 36-case document |
| `evidence/project-wide/` | Output of the 16 and 17 November runs: unit tests, coverage (text and JSON), live system validation results |
| `evidence/` | Earlier evidence: 5 November runs, browser screenshots, Bhagath's and Bhuvan's run logs |
| [Repository_Validation_Report.md](Repository_Validation_Report.md) | Fresh-clone checks by Bhuvan Raj H |

## Summary

| Measure | Result |
|---|---|
| Unit tests | 241 run, 241 passed (backend 174, client 59, server 8) |
| System validation, cart/checkout/orders | 33 live API checks passed on real MongoDB (17 Nov) and 5 browser checks passed (17 Nov) |
| Test cases across all modules | 105 listed: 98 pass, 4 partial, 3 not run |
| Service-layer line coverage | 95.59% (target 70%) |
| Backend lines / branches | 90.31% / 77.37% |
| Client lines / branches | 50.56% / 42.42% (shop screens 93.12% / 80.36%) |
| Defects | 4 found, 4 fixed (DEF-04: book routes needed no login, fixed 17 Nov with regression case TC-SEC-08) |
| Not done | UAT and five-user usability test (TC-USA-01), Docker build, freeze record, live auth tests |

Raw evidence and the scripts that produced the system results (`backend/tests/system/`) are in the repository.
