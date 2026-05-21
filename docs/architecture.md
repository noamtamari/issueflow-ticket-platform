# Architecture

## Overview
IssueFlow is a monolithic NestJS REST API backed by a single PostgreSQL database. No microservices, no message broker — straightforward request/response with one background cron job.

## Layer Diagram
```
HTTP Request
    │
    ▼
JwtAuthGuard → RolesGuard
    │
    ▼
Controller (route handler, DTO binding)
    │
    ▼
Service (business logic, throws exceptions)
    │
    ▼
Repository (TypeORM, PostgreSQL)
    │
    └── AuditLogService.record(...) [same transaction]
```

## Key Design Decisions

### Soft Delete
Uses TypeORM's `@DeleteDateColumn()` (`deletedAt` nullable timestamp). TypeORM automatically filters soft-deleted records from `find*` queries unless `withDeleted: true` is specified. The admin restore endpoint calls `restore({ id })`.

### Optimistic Locking
`@VersionColumn() version: number` on `Ticket` and `Comment`. On update, the client must send the current `version`. TypeORM increments on save and throws `OptimisticLockVersionMismatchError` on conflict — caught in the service and re-thrown as `ConflictException`.

### Token Denylist (Logout)
An in-memory `Set<string>` keyed by JWT `jti` claim. Cleared on server restart (acceptable for assignment scope). The `JwtAuthGuard` checks this set after signature verification. Document the stateless limitation in run.md.

### Audit Log
`AuditLogService.record()` is called from every mutating service method. The call is made inside the same `QueryRunner` transaction so audit entries are never written if the main operation rolls back.

### Auto-Escalation
`@nestjs/schedule` cron job running at a configurable interval (default: every minute in dev). Queries all non-DONE tickets with a past `dueDate`. Escalates in a single DB transaction per batch. Idempotent — CRITICAL tickets are skipped.

### Auto-Assignment
Implemented as a private method in `TicketsService`. On ticket create with no `assigneeId`, queries DEVELOPER-role users in the project, counts their non-DONE tickets, picks the minimum, breaks ties by `createdAt ASC`.

### File Storage
Attachments stored on local disk (`/uploads/<ticketId>/<uuid>.<ext>`). For production this would be S3; local disk is acceptable for this assignment.

## Entity Relationship (simplified)
```
User ─────────────────────────────────────────┐
 │ (owner)                                     │ (author)
 ▼                                             ▼
Project ──── Ticket ──── Comment ──── CommentMention ──► User
               │    │
               │    └── Attachment
               │
               └── TicketDependency (self-referential: blocker_id → ticket_id)
               │
               └── AuditLog (entityType=TICKET, entityId=ticketId)
```
