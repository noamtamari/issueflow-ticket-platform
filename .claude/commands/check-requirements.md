# Check Requirements

Cross-check the current implementation against the full requirements document.

## Instructions

Scan the `src/` directory and verify every requirement from the assignment is implemented.

### Section 2 — Core Features
- [ ] 2.1 User CRUD (create with username/email/fullName/role, fetch by id, update fullName/role, delete, list all)
- [ ] 2.2 Auth (POST /auth/login returns JWT, POST /auth/logout invalidates token, GET /auth/me returns current user, all other endpoints protected)
- [ ] 2.3 Project CRUD (create with name/description/ownerId, fetch by id, update name/description, delete, list all)
- [ ] 2.4 Ticket CRUD (create with all required fields, fetch by id, update fields, delete, list by projectId)
- [ ] 2.4 Ticket constraints (status machine, DONE lock, concurrent update protection)
- [ ] 2.5 Comment CRUD (add to ticket, list for ticket, update content, delete)
- [ ] 2.5 Comment constraint (concurrent edit protection)

### Section 3 — Extended Features
- [ ] 3.1 Audit log (all state changes recorded, GET /audit-logs with filters)
- [ ] 3.2 Ticket dependencies (add blocker, list blockers, remove blocker, same-project check, DONE blocked by unresolved)
- [ ] 3.3 Attachments (upload with size+type validation, delete, file stored on disk)
- [ ] 3.4 CSV export (GET /tickets/export?projectId=, correct fields, RFC 4180 format)
- [ ] 3.4 CSV import (POST /tickets/import, bulk create, error summary response)
- [ ] 3.5 Soft delete tickets (DELETE sets deletedAt, GET /tickets/deleted ADMIN only, POST /tickets/:id/restore ADMIN only)
- [ ] 3.5 Soft delete projects (same pattern)
- [ ] 3.6 @Mentions (parse from comment, persist, re-evaluate on update, GET /users/:id/mentions paginated)
- [ ] 3.7 Auto-escalation cron (overdue tickets promoted in priority, is_overdue flag, manual reset, logs to audit)
- [ ] 3.8 Auto-assignment (least-loaded DEVELOPER on create, tie-break, null if none, workload endpoint, audit log)

### Section 4 — Additional
- [ ] 4.1 Input validation on all endpoints (ValidationPipe, enum checks, 400 with description)
- [ ] 4.2 PostgreSQL via TypeORM, compose.yml works
- [ ] 4.3 Tests exist and pass
- [ ] 4.4 run.md complete with install/db/build/run/test steps
- [ ] 4.5 prompts.md with model stated, AI_USAGE.md present

## Output Format
For each unchecked item: state what is missing and which file to create/modify.
For checked items: state which file implements it (e.g. `src/tickets/tickets.service.ts:142`).
