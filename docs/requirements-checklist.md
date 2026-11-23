# Requirements checklist

Status of every requirement in [`requirements.md`](requirements.md), with where it is
implemented and the test that proves it. Final check: 2026-11-23 (Phase 9).

Legend: ✅ done · 🟡 partly done · ⬜ not started · ⏭️ skipped by decision

## User stories

| #    | Story                                        | Status | Endpoint(s)                                                                                                                                  | Code                                                                | Tests                                     |
| ---- | -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| US1  | Create an account                            | ✅     | `POST /auth/register`                                                                                                                        | `src/modules/auth/`                                                 | `tests/integration/auth.test.js`          |
| US2  | Log in securely                              | ✅     | `POST /auth/login`, `POST /auth/refresh`                                                                                                     | `src/modules/auth/`                                                 | `tests/integration/auth.test.js`          |
| US3  | View and update my profile                   | ✅     | `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`                                                                               | `src/modules/users/`                                                | `tests/integration/users.test.js`         |
| US4  | Create a task (title, description, due date) | ✅     | `POST /tasks`                                                                                                                                | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US5  | See tasks assigned to me                     | ✅     | `GET /tasks?assigneeId=me`                                                                                                                   | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US6  | Mark a task completed                        | ✅     | `PATCH /tasks/:id` with `status: COMPLETED`                                                                                                  | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US7  | Assign a task to a team member               | ✅     | `PATCH /tasks/:id` with `assigneeId` (or on create)                                                                                          | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US8  | Filter tasks by status                       | ✅     | `GET /tasks?status=OPEN,COMPLETED`                                                                                                           | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US9  | Search tasks by title or description         | ✅     | `GET /tasks?q=…`                                                                                                                             | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US10 | Comments and attachments on tasks            | ✅     | `/tasks/:id/comments`, `/tasks/:id/attachments` (upload, list, download, delete)                                                             | `src/modules/comments/`, `src/modules/attachments/`, `src/storage/` | `tests/integration/collaboration.test.js` |
| US11 | Create a team/project and invite members     | ✅     | `POST /projects`, `POST /projects/:id/invitations`, `POST /invitations/:id/accept`                                                           | `src/modules/projects/`, `src/modules/invitations/`                 | `tests/integration/projects.test.js`      |
| US12 | Log out securely                             | ✅     | `POST /auth/logout`, `POST /auth/logout-all`                                                                                                 | `src/modules/auth/`, `src/middleware/authenticate.js`               | `tests/integration/auth.test.js`          |
| US13 | Real-time notifications                      | ✅     | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`; Socket.IO events `notification`, `notification:count` | `src/modules/notifications/`, `src/realtime/socket.js`              | `tests/integration/notifications.test.js` |
| US14 | AI task descriptions / summaries             | ⏭️     | Skipped by decision (2026-11-23)                                                                                                             | –                                                                   | –                                         |

## Functional requirements

| ID  | Requirement                             | Status | Where                                                                                                |
| --- | --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| F1  | Node.js + Express, npm, a database      | ✅     | `package.json`, `src/app.js`, PostgreSQL via `docker-compose.yml`                                    |
| F2  | Secure authentication and authorisation | ✅     | `src/middleware/authenticate.js`, `src/modules/projects/access.js`                                   |
| F3  | Register, login, profile endpoints      | ✅     | `src/modules/auth/`, `src/modules/users/`                                                            |
| F4  | Password hashing + JWT sessions         | ✅     | bcrypt in `auth.service.js`; JWT in `token.service.js`                                               |
| F5  | Task data model                         | ✅     | `Task` model in `prisma/schema.prisma`                                                               |
| F6  | Task CRUD                               | ✅     | `src/modules/tasks/` (POST/GET/PATCH/DELETE `/tasks`)                                                |
| F7  | Filter, sort, search tasks              | ✅     | `GET /tasks`: filters, `q` search, `sortBy`/`order`, pagination                                      |
| F8  | Create or join teams/projects           | ✅     | `src/modules/projects/`, `src/modules/invitations/`                                                  |
| F9  | Assign tasks within a project           | ✅     | `assigneeId` on create/update; assignee must be a project member                                     |
| F10 | Comments and attachments                | ✅     | `src/modules/comments/`, `src/modules/attachments/` (multer upload, type/size limits, safe download) |
| F11 | Real-time updates and notifications     | ✅     | Socket.IO (`src/realtime/socket.js`) + stored notifications (`src/modules/notifications/`)           |
| F12 | RESTful endpoints                       | ✅     | Resource-oriented routes under `/api/v1`, correct verbs and status codes, OpenAPI at `/api/docs`     |
| F13 | Validation and error handling           | ✅     | Zod + `validate()`, `ApiError`, `errorHandler.js` (applies to all)                                   |

## Submission guidelines

| Item                          | Status | Where                                                                                              |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Clear and concise README      | ✅     | `README.md`: features, Docker quick start, local setup, env vars, API overview, auth flow, testing |
| Code organisation and styling | ✅     | module-per-feature layout, ESLint + Prettier, `CLAUDE.md`                                          |
| Comments and documentation    | ✅     | why-comments in code, `docs/`, Swagger UI at `/api/docs`                                           |
| Clean, maintainable code      | ✅     | layered routes → controller → service, integration tests                                           |

## Non-functional and delivery

| Item                        | Status | Where                                                                                   |
| --------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Runs with Docker Compose    | ✅     | `Dockerfile` + `docker-compose.yml` (`db` + `api`); migrations applied on start         |
| Automated tests             | ✅     | 74 tests (`npm test`): unit + integration against PostgreSQL, WebSocket included        |
| End-to-end user-story check | ✅     | `npm run smoke` (`scripts/smoke-test.js`): 52 checks over HTTP + WebSocket, all passing |

## Final end-to-end verification (2026-11-23)

Run against the API **in its Docker container** (`docker compose up -d --build`, `NODE_ENV=production`)
with `npm run smoke`: **52 of 52 checks passed**. Each story was exercised the way a client would,
with two team members (Asha, Ben) and an outsider (Cara):

| Story | What was checked                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| US1   | Register returns 201 and a token; duplicate email (any case) → 409; weak password → 400; no password hash in responses                          |
| US2   | Wrong password → 401; login → 200 with httpOnly refresh cookie; no token → 401; refresh works; reused refresh token rejected                    |
| US3   | View profile; update name and bio; change persists                                                                                              |
| US4   | Create task with title, description, due date → 201; missing title → 400                                                                        |
| US5   | `GET /tasks?assigneeId=me` returns exactly Ben's task, paginated                                                                                |
| US6   | `status: COMPLETED` sets `completedAt`                                                                                                          |
| US7   | Assign to a project member works; assigning to a non-member is rejected                                                                         |
| US8   | `status=OPEN` and `status=COMPLETED` return the right tasks; unknown status → 400                                                               |
| US9   | Search matches title and description (case-insensitive); never returns tasks the user can't see                                                 |
| US10  | Comments by both members; upload, list and download a file (same bytes back); `.exe` → 415; outsider → 404                                      |
| US11  | Create project (creator is owner); invite by email; invitee sees and accepts it; hidden from non-members until then                             |
| US12  | Logout → 204; token stops working immediately; live socket is closed; other users unaffected                                                    |
| US13  | Socket connects with the access token; live notifications for assignment, comment and completion; stored inbox with unread count; mark all read |
