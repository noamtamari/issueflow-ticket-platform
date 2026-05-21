---
name: audit-wrap
description: Ensures every state-changing service method in the IssueFlow project writes a corresponding AuditLog entry within the same transaction. TRIGGER when writing or editing any create/update/delete/restore method in a service (UsersService, ProjectsService, TicketsService, CommentsService, etc.), when wiring soft delete or restore, when implementing the auto-assignment or escalation logic, or when the user asks to "add audit logs", "wire up auditing", or "log this action". Requirement source: assignment §3.1 (Audit Log).
---

# Audit Log Wrapping

Use this skill whenever a service method changes persistent state. Every such method MUST write an audit log entry, and the entry MUST live in the same transaction as the main operation.

## When to Inject Audit Logging

| Service operation | Action | Actor | entityType |
|---|---|---|---|
| User created | CREATE | USER | USER |
| User updated | UPDATE | USER | USER |
| User deleted | DELETE | USER | USER |
| Project created/updated/deleted/restored | CREATE/UPDATE/DELETE/RESTORE | USER | PROJECT |
| Ticket created (with explicit assignee) | CREATE | USER | TICKET |
| Ticket created (auto-assigned) | CREATE + AUTO_ASSIGN | USER + SYSTEM | TICKET |
| Ticket updated | UPDATE | USER | TICKET |
| Ticket soft-deleted | DELETE | USER | TICKET |
| Ticket restored | RESTORE | USER | TICKET |
| Ticket escalated by cron | ESCALATE | SYSTEM | TICKET |
| Comment created/updated/deleted | CREATE/UPDATE/DELETE | USER | COMMENT |
| Dependency added/removed | ADD_DEPENDENCY / REMOVE_DEPENDENCY | USER | TICKET |
| Attachment uploaded/deleted | UPLOAD_ATTACHMENT / DELETE_ATTACHMENT | USER | TICKET |

## Required Pattern

Every mutating service method follows this shape:

```typescript
async createTicket(dto: CreateTicketDto, currentUser: UserContext): Promise<Ticket> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const ticket = queryRunner.manager.create(Ticket, dto);
    await queryRunner.manager.save(ticket);

    await this.auditLogService.record(queryRunner.manager, {
      action: 'CREATE',
      entityType: 'TICKET',
      entityId: ticket.id,
      performedBy: currentUser.id,
      actor: 'USER',
    });

    await queryRunner.commitTransaction();
    return ticket;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

## Key Rules

1. **Same transaction.** The `auditLogService.record(...)` call must use the same `queryRunner.manager` as the main operation. Never call it outside the transaction.
2. **System actions.** When the system (not a user) initiates the action — cron escalation, auto-assignment — set `performedBy: null` and `actor: 'SYSTEM'`.
3. **Idempotency for batches.** Cron jobs that process multiple records should write one audit row per record affected, not one summary row.
4. **Don't log reads.** Only state changes (CREATE, UPDATE, DELETE, RESTORE, ESCALATE, AUTO_ASSIGN, ADD_DEPENDENCY, REMOVE_DEPENDENCY, UPLOAD_ATTACHMENT, DELETE_ATTACHMENT). Login attempts could be logged optionally but are not required by the spec.
5. **No mutations after commit.** Don't write audit logs after `commitTransaction()` — they would be lost if a later failure occurred.

## Pre-Flight Checklist Before Marking a Service Complete

- [ ] Every `repo.save`, `repo.softDelete`, `repo.restore`, `repo.remove` call has a matching `auditLogService.record(...)` in the same transaction
- [ ] Action name matches the table above
- [ ] entityType is uppercase and matches the entity (TICKET, USER, PROJECT, COMMENT)
- [ ] actor is either 'USER' or 'SYSTEM'
- [ ] For SYSTEM actions, performedBy is null
- [ ] Unit tests assert that `auditLogService.record` is called with the correct arguments

## Verifying After the Fact

After implementing a feature, run a grep to confirm:

```
Grep for `save(` and `softDelete(` and `restore(` in the service file.
For each hit, verify an `auditLogService.record(` exists within ~5 lines.
```

If any mutation lacks an audit record, that's a requirements violation (§3.1).
