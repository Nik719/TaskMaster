# Requirements checklist

Status of every requirement in [`requirements.md`](requirements.md), with where it is
implemented and the test that proves it. Updated at the end of each phase.

Legend: ✅ done · 🟡 partly done · ⬜ not started

## User stories

| #    | Story                                        | Status | Endpoint(s)                                                                        | Code                                                  | Tests                                |
| ---- | -------------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| US1  | Create an account                            | ✅     | `POST /auth/register`                                                              | `src/modules/auth/`                                   | `tests/integration/auth.test.js`     |
| US2  | Log in securely                              | ✅     | `POST /auth/login`, `POST /auth/refresh`                                           | `src/modules/auth/`                                   | `tests/integration/auth.test.js`     |
| US3  | View and update my profile                   | ✅     | `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`                     | `src/modules/users/`                                  | `tests/integration/users.test.js`    |
| US4  | Create a task (title, description, due date) | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US5  | See tasks assigned to me                     | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US6  | Mark a task completed                        | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US7  | Assign a task to a team member               | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US8  | Filter tasks by status                       | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US9  | Search tasks by title or description         | ⬜     | Phase 5                                                                            |                                                       |                                      |
| US10 | Comments and attachments on tasks            | ⬜     | Phase 6                                                                            |                                                       |                                      |
| US11 | Create a team/project and invite members     | ✅     | `POST /projects`, `POST /projects/:id/invitations`, `POST /invitations/:id/accept` | `src/modules/projects/`, `src/modules/invitations/`   | `tests/integration/projects.test.js` |
| US12 | Log out securely                             | ✅     | `POST /auth/logout`, `POST /auth/logout-all`                                       | `src/modules/auth/`, `src/middleware/authenticate.js` | `tests/integration/auth.test.js`     |
| US13 | Real-time notifications                      | ⬜     | Phase 7                                                                            |                                                       |                                      |
| US14 | AI task descriptions / summaries             | ⬜     | Phase 8                                                                            |                                                       |                                      |

## Functional requirements

| ID  | Requirement                             | Status | Where                                                              |
| --- | --------------------------------------- | ------ | ------------------------------------------------------------------ |
| F1  | Node.js + Express, npm, a database      | ✅     | `package.json`, `src/app.js`, PostgreSQL via `docker-compose.yml`  |
| F2  | Secure authentication and authorisation | ✅     | `src/middleware/authenticate.js`, `src/modules/projects/access.js` |
| F3  | Register, login, profile endpoints      | ✅     | `src/modules/auth/`, `src/modules/users/`                          |
| F4  | Password hashing + JWT sessions         | ✅     | bcrypt in `auth.service.js`; JWT in `token.service.js`             |
| F5  | Task data model                         | ⬜     | Phase 5                                                            |
| F6  | Task CRUD                               | ⬜     | Phase 5                                                            |
| F7  | Filter, sort, search tasks              | ⬜     | Phase 5                                                            |
| F8  | Create or join teams/projects           | ✅     | `src/modules/projects/`, `src/modules/invitations/`                |
| F9  | Assign tasks within a project           | ⬜     | Phase 5                                                            |
| F10 | Comments and attachments                | ⬜     | Phase 6                                                            |
| F11 | Real-time updates and notifications     | ⬜     | Phase 7                                                            |
| F12 | RESTful endpoints                       | 🟡     | Resource-oriented routes under `/api/v1`; grows each phase         |
| F13 | Validation and error handling           | ✅     | Zod + `validate()`, `ApiError`, `errorHandler.js` (applies to all) |

## Submission guidelines

| Item                          | Status | Where                                                     |
| ----------------------------- | ------ | --------------------------------------------------------- |
| Clear and concise README      | 🟡     | `README.md` (completed in Phase 9)                        |
| Code organisation and styling | ✅     | module-per-feature layout, ESLint + Prettier, `CLAUDE.md` |
| Comments and documentation    | ✅     | why-comments in code, `docs/`, Swagger UI at `/api/docs`  |
| Clean, maintainable code      | ✅     | layered routes → controller → service, integration tests  |
