# TaskMaster – Collaborative Task Tracking API

A REST API for team task management: projects, role-based membership, tasks, comments,
attachments and real-time notifications. Built for the Airtribe Backend & System Design course.

> **Status:** Phase 2 (project setup) complete. Features are added phase by phase. This README
> grows with them, and becomes the full reference in Phase 9.

## Tech stack

| Concern    | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Runtime    | Node.js ≥ 22.12 (ES Modules)                                |
| Framework  | Express 5                                                   |
| Database   | PostgreSQL 16                                               |
| ORM        | Prisma 7 (`prisma-client-js` generator + `pg` adapter)      |
| Validation | Zod 4                                                       |
| Logging    | pino / pino-http (JSON; prettified in development)          |
| Security   | helmet, CORS allowlist                                      |
| API docs   | OpenAPI 3 + Swagger UI                                      |
| Testing    | Vitest + Supertest, against a real PostgreSQL test database |
| Tooling    | ESLint 9 (flat config), Prettier, Docker Compose            |

## Getting started

### Prerequisites

- Node.js 22.12 or newer (`node -v`)
- Docker Desktop (to run PostgreSQL), or your own PostgreSQL 16 install

### 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate`, which builds the database client.

> Always run Prisma through the npm scripts (or `npx prisma` inside this project). The `prisma`
> package's `latest` npm tag currently points to a Prisma 8 release candidate with breaking changes.
> This project pins Prisma **7.10.1**.

### 2. Configure the environment

```bash
cp .env.example .env          # macOS / Linux / Git Bash
copy .env.example .env        # Windows PowerShell / cmd
```

The defaults match `docker-compose.yml`, so no edits are needed for local development.

### 3. Start PostgreSQL

```bash
docker compose up -d db
docker compose ps             # wait until the db shows "healthy"
```

This creates two databases: `taskmaster` (development) and `taskmaster_test` (used by the tests,
which wipe it).

> Using your own PostgreSQL instead? Create both databases yourself and update the two URLs in `.env`.

### 4. Apply database migrations

```bash
npm run db:migrate
```

(No tables exist yet; the first migration arrives in Phase 3.)

### 5. Run the API

```bash
npm run dev       # restarts automatically when files change
npm start         # plain run, no file watching
```

Then open:

- Health check: <http://localhost:4000/api/v1/health>
- API docs (Swagger UI): <http://localhost:4000/api/docs>

## Environment variables

| Variable            | Required  | Default                 | Description                                                  |
| ------------------- | --------- | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`          | no        | `development`           | `development`, `test` or `production`                        |
| `PORT`              | no        | `4000`                  | HTTP port                                                    |
| `DATABASE_URL`      | **yes**   | –                       | PostgreSQL connection string                                 |
| `TEST_DATABASE_URL` | for tests | –                       | A **separate** database used by `npm test`                   |
| `CORS_ORIGINS`      | no        | `http://localhost:3000` | Comma-separated list of allowed browser origins              |
| `LOG_LEVEL`         | no        | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `TRUST_PROXY`       | no        | `0`                     | Number of reverse proxies in front of the API                |

Variables are validated at startup. If one is missing or malformed, the app exits immediately and
names the problem.

## Scripts

| Command                           | What it does                                 |
| --------------------------------- | -------------------------------------------- |
| `npm run dev`                     | Start with auto-restart on file changes      |
| `npm start`                       | Start normally                               |
| `npm test`                        | Migrate the test DB, then run all tests once |
| `npm run test:watch`              | Re-run tests on file changes                 |
| `npm run lint` / `lint:fix`       | Check / auto-fix code with ESLint            |
| `npm run format` / `format:check` | Format / check formatting with Prettier      |
| `npm run db:migrate`              | Create and apply migrations (development)    |
| `npm run db:deploy`               | Apply existing migrations (production / CI)  |
| `npm run db:studio`               | Browse the database in Prisma Studio         |

## Project structure

```
src/
  config/        env validation, logger, Prisma client, OpenAPI spec
  middleware/    request logging, validation, error handling, 404
  modules/       one folder per feature: routes → controller → service (→ repository)
  utils/         ApiError, response helpers
  routes.js      mounts every module under /api/v1
  app.js         builds the Express app (used by tests; never listens)
  server.js      starts the HTTP server, graceful shutdown
prisma/          schema and migrations
tests/
  unit/          fast tests, no database
  integration/   HTTP tests with Supertest against the test database
  setup/         applies migrations to the test DB before the suite
```

## API conventions

All endpoints live under `/api/v1`. Every response uses the same shape:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }

// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }
```

Every response carries an `X-Request-Id` header that matches the server's log line for that request.
