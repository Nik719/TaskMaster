# TaskMaster – Requirements

Source: Airtribe "Backend & System Design" project brief. This file restates the brief, records
how each requirement was interpreted, and is the checklist the implementation is measured
against. The traceability table at the end maps every requirement to the code and tests that
satisfy it.

## 1. Goal

A backend for a task tracking and management application that helps teams organise work:
users create, assign and track tasks, and collaborate through comments and attachments.

## 2. Functional requirements (from the brief)

| ID  | Requirement                                                                     |
| --- | ------------------------------------------------------------------------------- |
| F1  | Project set up with Node.js + Express, dependencies managed with npm, a real DB |
| F2  | Secure authentication and authorisation                                         |
| F3  | Endpoints for registration, login and profile management                        |
| F4  | Secure password hashing; JWT for session management                             |
| F5  | Task data model with title, description, due date (and more)                    |
| F6  | CRUD operations for tasks                                                       |
| F7  | Task filtering, sorting and searching                                           |
| F8  | Users can create or join teams/projects                                         |
| F9  | Task assignment within teams/projects                                           |
| F10 | Comments and attachments on tasks                                               |
| F11 | (Optional extension) real-time updates and notifications                        |
| F12 | RESTful endpoints for auth, tasks and collaboration                             |
| F13 | Proper validation and error handling                                            |

## 3. User stories

| #    | As a user, I want to…                                                              |
| ---- | ---------------------------------------------------------------------------------- |
| US1  | create a new account so that I can access the platform                             |
| US2  | log in to my account securely using my credentials                                 |
| US3  | view my profile and update my personal information                                 |
| US4  | create a new task with a title, description and due date                           |
| US5  | view a list of all tasks assigned to me                                            |
| US6  | mark a task as completed when I finish working on it                               |
| US7  | assign a task to another team member                                               |
| US8  | filter tasks by status (e.g. open, completed)                                      |
| US9  | search for tasks by title or description                                           |
| US10 | collaborate with team members by adding comments and attachments to tasks          |
| US11 | create a new team or project and invite team members to join                       |
| US12 | securely log out of my account when I'm done                                       |
| US13 | receive notifications when a task is assigned to me or updated (WebSockets or SSE) |
| US14 | use a generative AI model to write task descriptions or summaries from my input    |

## 4. Submission guidelines

- A clear and concise README.
- Code quality: best-practice organisation and styling, comments and documentation where
  necessary, clean and maintainable code.

## 5. Interpretation and scope decisions

These are choices the brief leaves open. Each is deliberate; see `architecture.md` for the why.

- **Team = Project.** The brief says "teams/projects". TaskMaster has one concept, a
  **project**, which is a team of members working on a shared set of tasks.
- **Roles.** Project members are `OWNER`, `ADMIN` or `MEMBER`. The creator is the owner.
- **Joining.** Owners and admins invite people by email. The invitee accepts (joins) or
  declines. Invitations to emails that have no account yet wait until that person registers.
- **Personal tasks.** A task may belong to no project. Such a task is private to its creator
  and can only be assigned to the creator.
- **Status values.** `OPEN`, `IN_PROGRESS`, `COMPLETED`. "Open" in US8 means `OPEN` (and
  `IN_PROGRESS` can be included with `status=OPEN,IN_PROGRESS`).
- **Logout.** Access tokens are tied to a server-side session, so logout is immediate rather
  than "wait for the JWT to expire". A "log out everywhere" endpoint is included.
- **Notifications.** Stored in the database (so nothing is lost while offline) and pushed live
  over Socket.IO (WebSockets with automatic fallback).
- **AI (US14) is out of scope.** NIK decided on 2026-11-23 to skip the generative AI feature.
  The design notes are kept in `architecture.md` §8 in case it is added later.
- **Attachments** are stored on local disk (`UPLOAD_DIR`) with metadata in the database. The
  storage code is isolated so it can be swapped for S3-compatible storage later.

## 6. Non-functional requirements

| ID   | Requirement                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------- |
| NF1  | Passwords hashed with bcrypt; never returned or logged                                            |
| NF2  | All input validated (Zod); unknown fields stripped (mass-assignment protection)                   |
| NF3  | One consistent JSON envelope for success and error responses                                      |
| NF4  | No internal error details leak to clients; every request has an `X-Request-Id`                    |
| NF5  | Rate limiting on auth endpoints                                                                   |
| NF6  | Security headers (helmet), CORS allowlist, request size limits, upload size/type caps             |
| NF7  | Users can only see data from their own projects (no IDOR); unknown and forbidden look alike (404) |
| NF8  | Automated tests against a real PostgreSQL database                                                |
| NF9  | Configuration only through environment variables, validated at startup                            |
| NF10 | Runs locally with Docker Compose (PostgreSQL), documented in the README                           |
| NF11 | Interactive API documentation (OpenAPI / Swagger UI)                                              |

## 7. Traceability

See [`requirements-checklist.md`](requirements-checklist.md) for the requirement-by-requirement
status, the endpoint that implements each one, and the test that proves it.
