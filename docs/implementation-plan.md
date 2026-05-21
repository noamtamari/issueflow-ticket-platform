# Implementation Plan

## Phase 1 — Foundation
1. Install missing dependencies (`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@nestjs/schedule`)
2. Configure TypeORM DataSource (connect to PostgreSQL from compose.yml)
3. Set up global `ValidationPipe`, `ClassSerializerInterceptor`, and exception filter in `main.ts`
4. Create `common/` module with `JwtAuthGuard`, `RolesGuard`, `@Public()` decorator, `@Roles()` decorator

## Phase 2 — Users & Auth
5. `users` module: User entity (id, username, email, fullName, role, password, createdAt), CRUD service + controller
6. `auth` module: login (bcrypt compare, sign JWT), logout (JTI denylist), GET /auth/me

## Phase 3 — Projects & Tickets (core)
7. `projects` module: Project entity (id, name, description, ownerId, deletedAt), CRUD + soft delete
8. `tickets` module: Ticket entity (id, title, description, status, priority, type, projectId, assigneeId, dueDate, isOverdue, version, deletedAt), CRUD + status machine + soft delete

## Phase 4 — Comments & Audit Log
9. `audit-log` module: AuditLog entity + service with `record()` method. Wire into users/projects/tickets services.
10. `comments` module: Comment entity (id, ticketId, authorId, content, version), CRUD + concurrent lock

## Phase 5 — Extended Features
11. `dependencies` module: TicketDependency entity, add/list/remove endpoints, DONE transition blocker check
12. `attachments` module: Attachment entity, file upload (multer) with validation, delete
13. CSV export + import endpoints (in tickets module)
14. Soft delete restore endpoints for tickets and projects

## Phase 6 — Automation & Mentions
15. `mentions`: CommentMention entity, parse @username on comment create/update, re-evaluate on update, GET /users/:id/mentions
16. `scheduler` module: Cron job for auto-escalation (priority promotion + is_overdue flag)
17. Auto-assignment logic in tickets service (workload query, tie-break, audit log)

## Phase 7 — Tests & Documentation
18. Unit tests for all service files
19. E2E tests for key flows
20. `run.md` — complete setup/run/test instructions
21. `prompts.md` — AI interaction log
