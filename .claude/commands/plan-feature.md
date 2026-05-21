# Plan Feature

Plan the implementation of a new IssueFlow feature before writing any code.

## Instructions
Given the feature name passed as an argument, produce a step-by-step implementation plan.

**Steps to cover:**
1. Identify all entities and DB columns needed (including relations, indexes, constraints).
2. List DTOs required (create, update, response shapes).
3. Describe the service methods and their logic, including error cases.
4. List the controller endpoints with HTTP method, route, guards, and expected response.
5. Identify which other modules/services this feature depends on (e.g., AuditLogService, UsersService).
6. List edge cases and validations to handle.
7. List test cases to write (unit + e2e).

**Constraints to check:**
- Does this feature touch tickets or projects? → confirm soft-delete awareness.
- Does it mutate state? → confirm AuditLog entry is planned.
- Does it involve concurrent access? → confirm optimistic lock if needed.
- Does it require auth/role restrictions? → specify which guards apply.

## Output Format
Return a markdown plan with one section per step above. Keep it concise — this is a working plan, not a design doc.
