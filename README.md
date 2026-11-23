# TaskMaster – Collaborative Task Tracking API

A REST API for team task management: projects, role-based membership, tasks, comments,
attachments and real-time notifications. Built for the Airtribe Backend & System Design course.

> **Status:** Phase 7 (real-time notifications) complete. Features are added phase by phase. This README
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

## Endpoints so far

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
