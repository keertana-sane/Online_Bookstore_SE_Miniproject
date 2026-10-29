# Backlog setup (3 steps)
1. Copy everything in this folder into the repo root (keep the `.github` folder) and push to `main`.
2. GitHub > Actions > "Setup backlog (run once)" > Run workflow. It creates labels, the Sprint 1/2 milestones and 48 issues.
3. Create the Project: Projects > New project > Board. Link it to the repo. Add fields: "Sprint" (Iteration, 1 week) and "Story points" (Number).
   Use "Add item" and `#` to add the issues, or turn on the auto-add workflow. Group the board by Sprint.

## Customer registration API

The Express server mounts the registration and login endpoints at `/api/v1`, and
protects `/api/v1/admin/*` with JWT authentication and the `ADMIN_STAFF` role. Configure
and start the server:

```powershell
Copy-Item server\.env.example server\.env
Set-Location server
npm install
npm start
```

Set `MONGODB_URI` and a private, randomly generated `JWT_SECRET` in `server/.env`.
Install backend dependencies separately (`Set-Location backend; npm install`) before
running the seed script. The seed script accepts `MONGO_URI` or `MONGODB_URI` and
`SEED_DEFAULT_PASSWORD` (minimum 12 characters); it creates customer and admin demo
accounts.

`POST /api/v1/auth/register` accepts `{ "name": "...", "email": "...", "password": "..." }`.
It returns `201` with the created user (never the password hash), `409` with error code
`EMAIL_EXISTS` when the email is already registered, and `422` for invalid input. Passwords
must contain at least 8 characters.

`POST /api/v1/auth/login` accepts `{ "email": "...", "password": "..." }` and returns
`200` with `{ "token": "...", "role": "CUSTOMER", "expiresIn": 3600 }`. The signed JWT
contains the user id in `sub`, the account role, and expires after one hour. Invalid
credentials return `401` with the generic message `Invalid email or password`. Set
`JWT_SECRET` in `server/.env` before starting the server.

The client provides sign-in, registration, and sign-out controls. Copy
`client/.env.example` to `client/.env` and set `VITE_AUTH_API_URL` to the base URL where
the auth module is mounted (default `http://localhost:5000/api/v1`). After a successful
login, the token is stored in browser `sessionStorage` under the `token` key and is
cleared on sign-out.

Sprint 2 auth/security implementation, SRS traceability, validation limits, and demo
deviations are recorded in [docs/AUTH_SECURITY.md](docs/AUTH_SECURITY.md). The CI
workflow runs linting, dependency audits, and the server/backend tests.

## Sprint 1 auth demo video

From the repository root, install the client dependencies, install the Playwright browser,
and record the registration/login/logout walkthrough:

```powershell
Set-Location client
npm install
npx playwright install chromium ffmpeg
npm run record:auth-demo
```

The recording is saved as `docs/issue-demos/BK-09-auth-demo.webm`. The repeatable demo
uses an isolated in-memory account store and the same auth routes/services; it does not
connect to or modify a configured MongoDB database.
