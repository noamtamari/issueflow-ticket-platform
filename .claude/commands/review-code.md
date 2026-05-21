# Review Code

Review the specified file or module against the IssueFlow assignment requirements and coding rules.

## Review Checklist

### Requirements Compliance
- [ ] All endpoints from README.md API table are implemented with correct HTTP method and route
- [ ] Response body matches the shape defined in README.md
- [ ] All business rules from `.claude/rules/assignment-rules.md` are enforced
- [ ] Enum values are validated (Status, Priority, Type, Role)

### Security
- [ ] JWT guard applied to all non-public endpoints
- [ ] Role guard applied where ADMIN-only access is required
- [ ] Password never returned in response
- [ ] File uploads validated for MIME type and size
- [ ] No raw SQL string concatenation

### Code Quality
- [ ] No business logic in controllers
- [ ] Services throw NestJS exceptions (not return error objects)
- [ ] DTOs use class-validator decorators
- [ ] AuditLog recorded for every state-changing action
- [ ] Transactions used for multi-table writes

### Concurrency
- [ ] @VersionColumn present on Ticket and Comment entities
- [ ] Optimistic lock conflict results in 409 response

### Soft Delete
- [ ] DELETE endpoints set deletedAt, not hard-delete
- [ ] Standard GET excludes soft-deleted records
- [ ] Admin restore endpoints exist and are ADMIN-guarded

### Tests
- [ ] Service unit tests cover happy path and error cases
- [ ] Status machine transitions are tested (forward OK, backward throws, DONE blocks)
- [ ] Guard behavior tested (401/403 cases)

## Output Format
List findings as: PASS / FAIL / MISSING for each item. For failures, quote the line and explain the fix needed.
