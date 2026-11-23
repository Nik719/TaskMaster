# Requirements checklist

Status of every requirement in [`requirements.md`](requirements.md), with where it is
implemented and the test that proves it. Updated at the end of each phase.

Legend: ✅ done · 🟡 partly done · ⬜ not started

## User stories

| #    | Story                                        | Status | Endpoint(s)                                                                        | Code                                                                | Tests                                     |
| ---- | -------------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| US1  | Create an account                            | ✅     | `POST /auth/register`                                                              | `src/modules/auth/`                                                 | `tests/integration/auth.test.js`          |
| US2  | Log in securely                              | ✅     | `POST /auth/login`, `POST /auth/refresh`                                           | `src/modules/auth/`                                                 | `tests/integration/auth.test.js`          |
| US3  | View and update my profile                   | ✅     | `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`                     | `src/modules/users/`                                                | `tests/integration/users.test.js`         |
| US4  | Create a task (title, description, due date) | ✅     | `POST /tasks`                                                                      | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US5  | See tasks assigned to me                     | ✅     | `GET /tasks?assigneeId=me`                                                         | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US6  | Mark a task completed                        | ✅     | `PATCH /tasks/:id` with `status: COMPLETED`                                        | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US7  | Assign a task to a team member               | ✅     | `PATCH /tasks/:id` with `assigneeId` (or on create)                                | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US8  | Filter tasks by status                       | ✅     | `GET /tasks?status=OPEN,COMPLETED`                                                 | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US9  | Search tasks by title or description         | ✅     | `GET /tasks?q=…`                                                                   | `src/modules/tasks/`                                                | `tests/integration/tasks.test.js`         |
| US10 | Comments and attachments on tasks            | ✅     | `/tasks/:id/comments`, `/tasks/:id/attachments` (upload, list, download, delete)   | `src/modules/comments/`, `src/modules/attachments/`, `src/storage/` | `tests/integration/collaboration.test.js` |
| US11 | Create a team/project and invite members     | ✅     | `POST /projects`, `POST /projects/:id/invitations`, `POST /invitations/:id/accept` | `src/modules/projects/`, `src/modules/invitations/`                 | `tests/integration/projects.test.js`      |
| US12 | Log out securely                             | ✅     | `POST /auth/logout`, `POST /auth/logout-all`                                       | `src/modules/auth/`, `src/middleware/authenticate.js`               | `tests/integration/auth.test.js`          |
| US13 | Real-time notifications                      | ⬜     | Phase 7                                                                            |                                                                     |                                           |
| US14 | AI task descriptions / summaries             | ⬜     | Phase 8                                                                            |                                                                     |                                           |

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
| F11 | Real-time updates and notifications     | ⬜     | Phase 7                                                                                              |
| F12 | RESTful endpoints                       | 🟡     | Resource-oriented routes under `/api/v1`; grows each phase                                           |
| F13 | Validation and error handling           | ✅     | Zod + `validate()`, `ApiError`, `errorHandler.js` (applies to all)                                   |

## Submission guidelines

| Item                          | Status | Where                                                     |
| ----------------------------- | ------ | --------------------------------------------------------- |
| Clear and concise README      | 🟡     | `README.md` (completed in Phase 9)                        |
| Code organisation and styling | ✅     | module-per-feature layout, ESLint + Prettier, `CLAUDE.md` |
| Comments and documentation    | ✅     | why-comments in code, `docs/`, Swagger UI at `/api/docs`  |
| Clean, maintainable code      | ✅     | layered routes → controller → service, integration tests  |
