# Online Bookstore

## Docker quick start

Prerequisites: Docker Desktop or Docker Engine with Docker Compose.

1. Copy the environment template and replace the placeholder values:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start MongoDB, the Express API, and the React frontend:

   ```powershell
   docker compose up --build
   ```

   Open the frontend at `http://localhost:3000`. The API is available at `http://localhost:5000`, including `http://localhost:5000/api/health`.

3. Start in the background with:

   ```powershell
   docker compose up -d --build
   ```

4. Stop and preserve MongoDB data:

   ```powershell
   docker compose down
   ```

5. Stop and remove the MongoDB volume (destructive):

   ```powershell
   docker compose down -v
   ```

Docker Compose supplies the backend with MongoDB at the Compose service hostname `mongo`; the backend does not use `localhost` for the database. Frontend API requests are proxied by nginx to the backend service.

### Environment variables

Configure these values in `.env`; never commit a populated `.env` file.

- `MONGO_ROOT_USERNAME`: MongoDB administrator username (default: `bookstore`).
- `MONGO_ROOT_PASSWORD`: MongoDB administrator password (required).
- `MONGO_DATABASE`: application database (default: `bookstore`).
- `JWT_SECRET`: private JWT signing secret (required, use a long random value).
- `BACKEND_PORT`: host port for the API (default: `5000`).
- `FRONTEND_PORT`: host port for the UI (default: `3000`).

Generate a local JWT secret with PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Troubleshooting Docker

Validate the Compose configuration without starting containers:

```powershell
 docker compose config
```

Inspect service health and startup state:

```powershell
 docker compose ps
 docker compose logs -f mongo backend frontend
```

Rebuild after dependency or Dockerfile changes:

```powershell
 docker compose build --no-cache
 docker compose up -d
```

Reset an unhealthy or stale local deployment (data in the MongoDB volume is removed):

```powershell
 docker compose down -v
 docker compose up --build
```

If Docker is unavailable, syntax can be checked with `docker compose config` on a machine with Docker Compose installed. Application tests still run directly with `npm test` in `server`, `backend`, and `client`.

## Local development

See [SETUP.md](SETUP.md) for registration, authentication, database seeding, and local non-Docker setup.
