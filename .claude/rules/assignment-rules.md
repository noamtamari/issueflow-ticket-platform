# Assignment Business Rules

These are the hard constraints from the requirements doc. Check every implementation against this list.

## Enums

```
Role:     ADMIN | DEVELOPER
Status:   TODO | IN_PROGRESS | IN_REVIEW | DONE
Priority: LOW | MEDIUM | HIGH | CRITICAL
Type:     BUG | FEATURE | TECHNICAL
```

## Ticket Status Machine
- Allowed forward transitions only: TODO → IN_PROGRESS → IN_REVIEW → DONE
- Backward transitions must return 400.
- A ticket with status DONE cannot be updated at all — return 400.
- A ticket cannot transition to DONE if it has any unresolved (non-DONE) blocker tickets.

## Concurrent Update Protection
- Tickets: use optimistic locking (@VersionColumn). On conflict return 409.
- Comments: use optimistic locking (@VersionColumn). On conflict return 409.

## Soft Delete (Tickets and Projects)
- DELETE endpoints set `deletedAt` timestamp — never hard delete.
- Standard GET responses must exclude soft-deleted records (use TypeORM withDeleted: false default).
- `GET /tickets/deleted?projectId=` and `GET /projects/deleted` — ADMIN role only.
- `POST /tickets/:id/restore` and `POST /projects/:id/restore` — ADMIN role only.

## Authentication
- All endpoints require JWT except: `POST /auth/login`, `POST /users` (registration).
- Logout must invalidate the token server-side (in-memory Set or DB denylist keyed by JTI).
- Tokens must have an expiry (e.g. 1 hour).

## Auto-Assignment (on ticket creation only)
- Triggered when `assigneeId` is absent from the create payload.
- Candidates: users with role DEVELOPER assigned to the same project.
- Workload = count of non-DONE tickets assigned to the user in that project.
- Pick the user with the lowest workload. Tie-break: oldest `createdAt` (registration order).
- If no DEVELOPER in project: `assigneeId = null`, no error.
- Log this action: `actor = SYSTEM`, `action = AUTO_ASSIGN`, `entityType = TICKET`.
- NOT triggered on PATCH /tickets/:id.

## Auto-Escalation (cron job)
- Runs on a schedule (e.g. every minute or every hour — configurable).
- Applies to all non-DONE tickets where `dueDate` is set and `dueDate < now`.
- Escalation: LOW→MEDIUM, MEDIUM→HIGH, HIGH→CRITICAL.
- CRITICAL tickets: set `is_overdue = true`. Never escalate further.
- Escalation is idempotent per cycle — don't double-escalate in one run.
- A manual PATCH on priority clears `is_overdue` and resets escalation state.
- Escalation does NOT change `status`, only `priority` and `is_overdue`.
- Log each escalation: `actor = SYSTEM`, `action = ESCALATE`, `entityType = TICKET`.

## @Mentions in Comments
- Parse `@username` from comment `content` using regex.
- Match usernames case-insensitively.
- On create: extract mentions, validate each username exists, persist `CommentMention` rows.
- On update: re-evaluate the full mention list. Add new ones, remove stale ones.
- Response: every comment includes `mentionedUsers: [{ id, username, fullName }]`.
- `GET /users/:userId/mentions` returns comments mentioning that user, newest first (paginated).

## Ticket Dependencies
- `POST /tickets/:id/dependencies` body: `{ "blockedBy": <ticketId> }`.
- Both tickets must exist and belong to the same project — else 400.
- Prevent self-dependency (ticket blocked by itself) — return 400.
- `GET /tickets/:id/dependencies` returns blocker tickets.
- `DELETE /tickets/:id/dependencies/:blockerId` removes the dependency.
- Dependency check on DONE transition: if any blocker has status != DONE, block the transition.

## Attachments
- `POST /tickets/:id/attachments` — multipart/form-data, field name `file`.
- Max size: 10 MB. Return 400 if exceeded.
- Allowed MIME types: `image/png`, `image/jpeg`, `application/pdf`, `text/plain`. Return 400 otherwise.
- Store files on disk (local `/uploads` folder is fine for this assignment).
- `DELETE /tickets/:id/attachments/:attachmentId` — remove file from disk and DB row.

## CSV Export / Import
- Export: `GET /tickets/export?projectId=` — Content-Type: `text/csv`, filename header.
  Fields: `id, title, description, status, priority, type, assigneeId`.
- Import: `POST /tickets/import` — multipart/form-data: `file` (CSV) + `projectId` (field).
  Response: `{ "created": N, "failed": N, "errors": ["row 3: invalid status", ...] }`.
- CSV must handle quoted fields containing commas and escaped quotes (RFC 4180).

## Audit Log
- Append-only. Never update or delete audit log rows.
- Capture on: user create/update/delete, project create/update/delete, ticket create/update/delete/restore, comment create/update/delete, auto-assign, auto-escalate.
- Fields: `id`, `action`, `entityType`, `entityId`, `performedBy` (userId or null for SYSTEM), `actor` (USER | SYSTEM), `timestamp`.
- `GET /audit-logs` — optional query filters: `entityType`, `entityId`, `action`, `actor`.

## Input Validation (general)
- Reject unknown fields (forbidNonWhitelisted in ValidationPipe).
- Return 400 with descriptive message on invalid enum values, missing required fields, or constraint violations.
- Return 404 when a referenced entity (userId, projectId, ticketId) does not exist.
- Return 409 on optimistic lock conflict.
