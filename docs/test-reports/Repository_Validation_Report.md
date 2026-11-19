# Team Repository Validation

Run against a fresh clone of `https://github.com/keertana-sane/Online_Bookstore_SE_Miniproject.git`
at commit `a001078` on 16 November 2026.

| Test case | Expected evidence | Actual result | Status |
|---|---|---|---|
| TC-BK-45-02 — Docker build and health check | Build the Docker services and confirm the application health endpoint reports a healthy API and connected database. | Docker is not installed on the validation machine (`docker` and `docker compose` are unavailable); no build or health check was run. | Not run |
| TC-BK-47-02 — Development freeze record | Locate the approved Sprint 2 development freeze record in the team repository. | No development freeze record was found in the repository. | Not run |

## CI checks from the fresh clone

The repository dependencies were installed with `npm ci` in each package. The shared backend dependencies were installed before running the server tests, matching the CI workflow.

| Package | Lint | Tests | Build / syntax |
|---|---|---|---|
| `client` | Passed with 4 Oxlint warnings | 59 passed | Production build passed |
| `server` | Passed | 8 passed | `node --check index.js` passed |
| `backend` | Passed with 7 Oxlint warnings | 174 passed | Not applicable |

The Docker build and Postman integration jobs were not run locally because Docker is unavailable. CI's repository checks are defined in [ci.yml](../../.github/workflows/ci.yml).
