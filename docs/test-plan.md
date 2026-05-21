# Test Plan

## Current Coverage Snapshot

- Unit suites: **11** files / **93** tests — all passing (`npm run test`).
- E2E suites: **3** files / **70** tests — all passing (`npm run test:e2e`, requires `docker compose up -d`).
- E2E files: `test/flows.e2e-spec.ts` (broad happy flows), `test/api-contract.e2e-spec.ts` (validation/RBAC/error paths), `test/api-coverage.e2e-spec.ts` (CRUD coverage + audit-log persistence + auth/error envelope).

## Unit Tests (src/**/*.spec.ts)

### AuthService
- login: valid credentials → returns JWT
- login: wrong password → UnauthorizedException
- login: unknown username → UnauthorizedException
- logout: valid token JTI → added to denylist
- validateToken: denylisted JTI → UnauthorizedException

### UsersService
- createUser: valid payload → created user (password excluded from response)
- createUser: duplicate username → ConflictException
- createUser: invalid role → BadRequestException (caught by DTO, but service-level too)
- getUserById: existing id → user
- getUserById: missing id → NotFoundException
- updateUser: valid payload → updated user
- deleteUser: existing id → soft/hard delete succeeds

### ProjectsService
- createProject: valid → project
- createProject: unknown ownerId → NotFoundException
- getProjectById: soft-deleted project → NotFoundException (not found in standard query)
- deleteProject: sets deletedAt
- restoreProject: ADMIN only at controller level; service restores record

### TicketsService
- createTicket: no assigneeId + DEVELOPERs exist → auto-assigned to least loaded
- createTicket: no assigneeId + no DEVELOPERs → assigneeId null
- createTicket: explicit assigneeId → no auto-assignment
- updateTicket: TODO → IN_PROGRESS → OK
- updateTicket: IN_PROGRESS → TODO → BadRequestException
- updateTicket: status DONE ticket → BadRequestException
- updateTicket: version mismatch → ConflictException
- deleteTicket: sets deletedAt
- transitionToDone: unresolved blocker → BadRequestException
- getProjectWorkload: returns sorted list

### CommentsService (covered in `comments.service.spec.ts`)
- create: persists comment, syncs mentions, writes CREATE audit log
- create: throws NotFoundException when ticket or author missing
- update: throws NotFoundException when comment missing
- update: throws ConflictException on version mismatch
- update: re-evaluates mentions and writes UPDATE audit log
- remove: deletes row and writes DELETE audit log
- findAllByTicket: attaches mentionedUsers map (empty array for none)

### TicketDependenciesService (covered in `dependencies.service.spec.ts`)
- add: self-dependency → BadRequestException
- add: missing ticket → NotFoundException
- add: missing blocker → NotFoundException
- add: different project → BadRequestException
- add: duplicate dependency → ConflictException
- add: writes ADD_DEPENDENCY audit log on success
- listBlockers: returns blocker tickets from dependency rows
- remove: writes REMOVE_DEPENDENCY audit log
- remove: missing dependency → NotFoundException
- hasUnresolvedBlockers: true when ≥1 non-DONE blocker; false when none

### AttachmentsService
- upload: file > 10MB → BadRequestException
- upload: invalid MIME type → BadRequestException
- upload: valid file → stored and entity created
- delete: removes file from disk and DB

### SchedulerService (EscalationService)
- runEscalation: LOW overdue ticket → MEDIUM
- runEscalation: CRITICAL overdue ticket → is_overdue set, no further promotion
- runEscalation: non-overdue ticket → unchanged
- runEscalation: DONE ticket → unchanged

## E2E Tests (test/*.e2e-spec.ts)

### Auth flow
- Register user, login, call protected endpoint, logout, call endpoint again → 401

### Ticket lifecycle
- Create project → create ticket (auto-assigned) → update status forward → attempt backward → attempt update on DONE

### Dependency blocker
- Create two tickets → add dependency → try to move blocked ticket to DONE → fail → resolve blocker → try again → succeed

### CSV round-trip
- Export empty project → import CSV → export again → rows match

### Mentions
- Create comment with @username → GET /users/:id/mentions → comment appears
- Update comment removing @username → GET /users/:id/mentions → comment removed

### Soft delete + restore
- Delete ticket → GET /tickets/:id → 404 → GET /tickets/deleted (ADMIN) → found → restore → GET /tickets/:id → 200

## API-Contract E2E (`test/api-contract.e2e-spec.ts`)

These tests exercise the HTTP boundary directly — guards, ValidationPipe, RBAC, and assignment-specific error paths the unit suites can only assert at the service level.

### Authentication errors
- POST /auth/login wrong password → 401
- POST /auth/login unknown username → 401
- Protected route without token → 401
- POST /users (registration) allowed unauthenticated → 201

### DTO validation at the HTTP boundary
- POST /users invalid `role` enum → 400
- POST /users malformed email → 400
- POST /tickets invalid `status` enum → 400
- POST /tickets missing required field → 400
- POST /tickets with unknown field (forbidNonWhitelisted) → 400
- POST /users duplicate username → 409
- GET /tickets/:id unknown id → 404

### Role-based access control
- DEVELOPER hitting GET /projects/deleted → 403
- DEVELOPER hitting GET /tickets/deleted → 403
- DEVELOPER hitting POST /tickets/:id/restore → 403

### Ticket dependency rejections
- POST /tickets/:id/dependencies self-dependency → 400
- POST cross-project blocker → 400
- POST unknown blocker id → 404
- POST duplicate dependency → 409

### Comments — version conflict and mention resync
- PATCH comment with stale version → 409
- PATCH comment with new mention removes the stale one and adds the new one in `mentionedUsers`

### Workload and audit log
- GET /projects/:id/workload returns DEVELOPERs sorted ascending by `openTicketCount`
- GET /audit-logs?action=CREATE&entityType=TICKET filters the response set

### Attachments
- POST attachment with `image/png` → 201 (metadata persisted)
- POST attachment with `application/x-msdownload` → 400

### Manual priority change
- PATCH /tickets/:id priority bump returns `isOverdue: false`

## API-Coverage E2E (`test/api-coverage.e2e-spec.ts`)

CRUD coverage and audit-log persistence the other two e2e files don't exercise. The duplicate `app.e2e-spec.ts` (single 401 test with no `afterEach` close) was removed — its assertion is already in `api-contract.e2e-spec.ts`.

### Users CRUD
- GET /users returns list containing the freshly-created user
- GET /users/:id returns user without `password` field
- GET /users/:id 404 for unknown id
- POST /users/update/:id updates fullName and role
- DELETE /users/:id removes user; follow-up GET returns 404

### Projects CRUD + soft-delete cycle
- GET /projects returns list including the new project
- GET /projects/:id returns the project
- GET /projects/:id 404 for unknown id
- PATCH /projects/:id updates name and description
- ADMIN: DELETE → GET /projects/deleted lists it → POST /restore → GET returns 200

### Tickets — read, scoping, version, DONE lock, assignee override
- GET /tickets/:id returns the ticket
- GET /tickets?projectId returns only tickets in that project
- PATCH with stale version → 409
- PATCH on a DONE ticket → 400
- PATCH with explicit assigneeId overrides the current assignee

### Comments — list, update content, delete, 404s
- GET /tickets/:id/comments returns the list
- PATCH content with matching version → 200
- DELETE removes comment; follow-up PATCH → 404
- PATCH unknown comment id → 404
- POST comment on unknown ticket → 404

### Dependencies — list, delete, delete-missing
- GET /tickets/:id/dependencies returns the blocker
- DELETE removes the dependency; follow-up GET returns empty list
- DELETE non-existing dependency → 404 with a meaningful message

### Attachments — MIME allow-list
- application/pdf accepted (201)
- text/plain accepted (201)
- upload with no `file` field → 400

### CSV import — quoting, partial failure, missing projectId
- RFC-4180 row with commas and escaped quotes round-trips (created=1, export preserves quoting)
- Mixed valid + invalid rows → created=1, failed=2, errors[] with per-row details
- POST /tickets/import without `projectId` → 400

### Audit log persistence
- PATCH ticket → UPDATE log row exists
- DELETE ticket → DELETE log row exists
- POST /restore → RESTORE log row exists
- POST /tickets (no assigneeId) → AUTO_ASSIGN log row with `actor=SYSTEM`, `performedBy=null`

### Auth/security
- Malformed JWT → 401
- POST /auth/logout without Authorization header → 401
- GET /auth/me response does not include `password`

### Error response envelope (AllExceptionsFilter)
- 400 validation error: `statusCode/error/message/path/timestamp` + message mentions the failing field
- 404 not-found: same envelope; message mentions the missing entity type
- 409 conflict (duplicate username): same envelope

### Intentionally NOT added at e2e level
- **>10 MB attachment rejection** — already unit-tested. Generating a real 11 MB buffer per run is unnecessary cost; multer's FileInterceptor `limits.fileSize` enforces the same boundary, and the service has a redundant size check.
- **`GET /tickets/export` with an unknown projectId** — the implementation returns header-only CSV rather than 404 (no project-existence check); asserting 404 would require a source change.
- **Auto-escalation cron at e2e** — e2e suites disable the cron via `ESCALATION_DISABLED=true` to avoid races with assertions; the priority-ladder behavior is unit-tested in `escalation.service.spec.ts`.
- **Auto-assignment "no DEVELOPER → null" and "ADMIN excluded" at e2e** — the query picks DEVELOPERs system-wide (not per-project membership), so prior tests' developers pollute these scenarios. Both are covered at the service-level unit suite.

## Test Infrastructure Notes

- The `tsconfig.json` requires `esModuleInterop: true` for `import request from 'supertest'` to resolve to a callable function under TS+CJS. Without it, every supertest call throws `(0 , supertest_1.default) is not a function`.
- E2E suites set `process.env.ESCALATION_DISABLED = 'true'` at module top so the cron job does not race with assertions during test runs.
- E2E suites require a running Postgres (provided by `compose.yml`). Unit suites do not touch the DB.
