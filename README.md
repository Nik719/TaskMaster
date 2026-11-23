# TaskMaster – Collaborative Task Tracking API

A REST API for team task management: projects, role-based membership, tasks, comments,
attachments and real-time notifications. Built for the Airtribe Backend & System Design course.

> **Status:** complete. All 13 user stories are built and checked end to end
> (see [`docs/requirements-checklist.md`](docs/requirements-checklist.md)). The optional generative
> AI story (US14) was skipped by decision.

## Features

- **Accounts:** register, log in, profile and password change, secure logout (single device or all).
  Passwords hashed with bcrypt; short-lived JWT access tokens plus rotating refresh tokens.
- **Tasks:** title, description, due date, priority, status. Create, view, edit, delete, assign,
  complete. Filter by status, priority, assignee, project and due date; search title and description;
  sort and paginate.
- **Teams:** projects with Owner / Admin / Member roles, email invitations, accept or decline.
- **Collaboration:** comments and file attachments on tasks.
- **Real-time notifications** over WebSockets (Socket.IO), plus a stored notifications inbox.
- **Quality:** input validation on every endpoint, consistent error responses, OpenAPI docs
  (Swagger UI), 74 automated tests and an end-to-end user-story check.

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

## Quick start with Docker (everything in containers)

Needs only Docker Desktop.

```bash
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d --build  # builds the API image, starts PostgreSQL + the API
docker compose ps             # both should show "healthy" after ~20 seconds
```

The API is on <http://localhost:4000> (Swagger UI at <http://localhost:4000/api/docs>). It applies
database migrations by itself on start. Uploaded files are kept in the `uploads` Docker volume.

Check every user story end to end against it (needs `npm install` once on your machine):

```bash
npm run smoke
```

Useful commands: `docker compose logs -f api`, `docker compose down` (stop; data is kept),
`docker compose down -v` (stop and delete the database and uploads).

> Set a long random `JWT_ACCESS_SECRET` in `.env` before deploying anywhere real. The container
> runs with `NODE_ENV=production`, so the refresh cookie is marked `Secure` (HTTPS only; browsers
> still accept it on `http://localhost`).

## Local development (API on your machine, database in Docker)

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

This creates the tables and regenerates the Prisma client. Run it again whenever
`prisma/schema.prisma` changes (`npm run db:migrate -- --name <change>` for a new migration).

### 5. Run the API

```bash
npm run dev       # restarts automatically when files change
npm start         # plain run, no file watching
```

Then open:

- Health check: <http://localhost:4000/api/v1/health>
- API docs (Swagger UI): <http://localhost:4000/api/docs>

## Environment variables

| Variable                 | Required  | Default                 | Description                                                  |
| ------------------------ | --------- | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`               | no        | `development`           | `development`, `test` or `production`                        |
| `PORT`                   | no        | `4000`                  | HTTP port                                                    |
| `DATABASE_URL`           | **yes**   | –                       | PostgreSQL connection string                                 |
| `TEST_DATABASE_URL`      | for tests | –                       | A **separate** database used by `npm test`                   |
| `CORS_ORIGINS`           | no        | `http://localhost:3000` | Comma-separated list of allowed browser origins              |
| `LOG_LEVEL`              | no        | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `TRUST_PROXY`            | no        | `0`                     | Number of reverse proxies in front of the API                |
| `JWT_ACCESS_SECRET`      | **yes**   | –                       | Signs access tokens; at least 32 random characters           |
| `JWT_ACCESS_EXPIRES_IN`  | no        | `15m`                   | Access token lifetime                                        |
| `REFRESH_TOKEN_TTL_DAYS` | no        | `7`                     | How long a login lasts without use                           |
| `BCRYPT_SALT_ROUNDS`     | no        | `12`                    | bcrypt cost factor (tests use 4)                             |
| `UPLOAD_DIR`             | no        | `uploads`               | Folder for uploaded attachments                              |
| `MAX_UPLOAD_MB`          | no        | `10`                    | Largest accepted upload (MB)                                 |
| `API_PORT`               | no        | `4000`                  | Docker Compose only: host port for the API container         |

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
| `npm run smoke`                   | Check every user story against a running API |

## Project structure

```
src/
  config/        env validation, logger, Prisma client, OpenAPI spec
  middleware/    auth, validation, rate limiting, uploads, request logging, errors, 404
  modules/       one folder per feature (auth, users, projects, invitations, tasks,
                 comments, attachments, notifications, health):
                 routes → schemas → controller → service → docs
  realtime/      Socket.IO server (per-user rooms, token auth)
  storage/       attachment files on disk
  utils/         ApiError, response helpers, pagination, Prisma selects
  routes.js      mounts every module under /api/v1
  app.js         builds the Express app (used by tests; never listens)
  server.js      starts HTTP + Socket.IO, graceful shutdown
prisma/          schema and migrations
scripts/         smoke-test.js: user-story check against a running API
tests/
  unit/          fast tests, no database
  integration/   HTTP and WebSocket tests against the test database
  helpers/       test factories (users, projects)
  setup/         applies migrations to the test DB before the suite
docker/          PostgreSQL init script (creates the test database)
Dockerfile       production image for the API
```

## API overview

| Method           | Path                                                    | Auth | What it does                                     |
| ---------------- | ------------------------------------------------------- | ---- | ------------------------------------------------ |
| GET              | `/api/v1/health`                                        | –    | API + database status                            |
| POST             | `/api/v1/auth/register`                                 | –    | Create an account and sign in                    |
| POST             | `/api/v1/auth/login`                                    | –    | Sign in with email + password                    |
| POST             | `/api/v1/auth/refresh`                                  | –    | New access token from the refresh token          |
| POST             | `/api/v1/auth/logout`                                   | ✔    | End this session immediately                     |
| POST             | `/api/v1/auth/logout-all`                               | ✔    | End every session                                |
| GET / PATCH      | `/api/v1/users/me`                                      | ✔    | View / update my profile                         |
| PATCH            | `/api/v1/users/me/password`                             | ✔    | Change password (signs out other devices)        |
| POST / GET       | `/api/v1/projects`                                      | ✔    | Create a project (team) / list mine              |
| GET/PATCH/DELETE | `/api/v1/projects/:projectId`                           | ✔    | View / edit (owner, admin) / delete (owner)      |
| GET              | `/api/v1/projects/:projectId/members`                   | ✔    | Members and roles                                |
| PATCH / DELETE   | `/api/v1/projects/:projectId/members/:userId`           | ✔    | Change role (owner) / remove, or leave           |
| POST / GET       | `/api/v1/projects/:projectId/invitations`               | ✔    | Invite by email / list invitations               |
| DELETE           | `/api/v1/projects/:projectId/invitations/:invitationId` | ✔    | Revoke a pending invitation                      |
| GET              | `/api/v1/invitations`                                   | ✔    | Invitations addressed to me                      |
| POST             | `/api/v1/invitations/:invitationId/accept`, `/decline`  | ✔    | Join the project / decline                       |
| POST / GET       | `/api/v1/tasks`                                         | ✔    | Create a task / list, filter, search, sort       |
| GET              | `/api/v1/tasks/:taskId`                                 | ✔    | View a task                                      |
| PATCH            | `/api/v1/tasks/:taskId`                                 | ✔    | Edit, assign (`assigneeId`), complete (`status`) |
| DELETE           | `/api/v1/tasks/:taskId`                                 | ✔    | Delete (creator, or project owner/admin)         |
| GET / POST       | `/api/v1/tasks/:taskId/comments`                        | ✔    | List / add comments                              |
| PATCH / DELETE   | `/api/v1/tasks/:taskId/comments/:commentId`             | ✔    | Edit own / delete (author, owner, admin)         |
| GET / POST       | `/api/v1/tasks/:taskId/attachments`                     | ✔    | List / upload (multipart field `file`)           |
| GET              | `/api/v1/tasks/:taskId/attachments/:id/download`        | ✔    | Download a file                                  |
| DELETE           | `/api/v1/tasks/:taskId/attachments/:id`                 | ✔    | Delete (uploader, owner, admin)                  |
| GET              | `/api/v1/notifications`                                 | ✔    | My notifications (`?unread=true`), `meta.unread` |
| PATCH            | `/api/v1/notifications/:notificationId/read`            | ✔    | Mark one as read                                 |
| POST             | `/api/v1/notifications/read-all`                        | ✔    | Mark all as read                                 |

✔ = send `Authorization: Bearer <accessToken>`.

### Authentication flow

1. `POST /auth/register` or `POST /auth/login` returns an `accessToken` (valid 15 minutes) and a
   `refreshToken` (also set as an httpOnly cookie for browsers).
2. Send `Authorization: Bearer <accessToken>` on every request.
3. When it expires (401), call `POST /auth/refresh` to get a new pair. Each refresh token works
   once; reusing an old one signs that device out.
4. `POST /auth/logout` ends the session at once: the access token stops working immediately.

```bash
curl -X POST http://localhost:4000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Asha","email":"asha@example.com","password":"Secret-pass1"}'
curl http://localhost:4000/api/v1/tasks?assigneeId=me -H "Authorization: Bearer <accessToken>"
```

Task list examples:

```
GET /api/v1/tasks?assigneeId=me                     tasks assigned to me
GET /api/v1/tasks?status=OPEN,IN_PROGRESS           not finished yet
GET /api/v1/tasks?status=COMPLETED&projectId=<id>   finished tasks in one project
GET /api/v1/tasks?q=invoice                         search title + description
GET /api/v1/tasks?overdue=true&sortBy=dueDate&order=asc
GET /api/v1/tasks?priority=HIGH,URGENT&page=2&limit=10
```

Filters: `projectId` (or `none`), `status`, `priority`, `assigneeId` (`me`, `none`, or an ID),
`creatorId` (`me` or an ID), `dueFrom`, `dueTo`, `overdue`, `q`. Sorting: `sortBy` =
`createdAt | updatedAt | dueDate | priority | title | status`, `order` = `asc | desc`. Full request/response details are in Swagger UI
at `/api/docs`. How auth works (sessions, refresh rotation, immediate logout) is explained in
[`docs/architecture.md`](docs/architecture.md#4-authentication).

## Real-time notifications

Notifications are saved in the database and pushed live over Socket.IO on the same port as
the API. Connect with the access token you use for HTTP:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { auth: { token: accessToken } });
socket.on('notification', (n) => console.log(n.title)); // e.g. 'Asha assigned you "Fix login bug"'
socket.on('notification:count', ({ unread }) => updateBadge(unread));
socket.on('connect_error', (err) => console.error(err.message)); // bad or expired token
```

You are notified when a task is assigned to you, when a task you created or are assigned to is
updated, completed, commented on or gets a file, and when you are invited to a project. You are
never notified about your own actions. Logging out disconnects that device's socket.

## Testing

```bash
npm test         # 74 unit + integration tests (needs the database from `docker compose up -d db`)
npm run smoke    # every user story end to end against a running API (Docker or `npm run dev`)
```

`npm test` uses the separate `taskmaster_test` database and wipes it between tests, so it never
touches your development data. `npm run smoke` registers fresh users on each run (it uses about
half of the 20-per-15-minutes login/register limit, so run it at most twice in a row).

## Project documents

- [`docs/requirements.md`](docs/requirements.md): the brief, user stories and scope decisions
- [`docs/architecture.md`](docs/architecture.md): design, data model, auth, permissions
- [`docs/requirements-checklist.md`](docs/requirements-checklist.md): status of every requirement and user story
- [`CLAUDE.md`](CLAUDE.md): conventions and commands for AI coding assistants

## API conventions

All endpoints live under `/api/v1`. Every response uses the same shape:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }

// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }
```

Every response carries an `X-Request-Id` header that matches the server's log line for that request.
