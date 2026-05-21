# Generate Tests

Generate test cases for the specified service or controller module.

## Instructions

Given a module name (e.g. "tickets", "auth", "comments"), generate:

### 1. Unit Tests (`*.spec.ts`)
For each public service method:
- Happy path: valid input → correct return value
- Not found: referenced entity missing → NotFoundException
- Validation: invalid business rule → BadRequestException
- Conflict: version mismatch → ConflictException (if applicable)
- Role/auth: forbidden action → ForbiddenException (if applicable)

Use the mock repository pattern from `.claude/rules/testing-rules.md`.

### 2. Key Integration Test Cases (describe for `test/*.e2e-spec.ts`)
List (but don't fully write) e2e scenarios:
- Full CRUD flow (create → read → update → delete)
- Auth flow (unauthenticated → 401, wrong role → 403, correct token → 200)
- Business rule enforcement at HTTP level

## Output Format
Write fully runnable `*.spec.ts` file content using Jest + `@nestjs/testing`. 
Include `beforeEach` setup with mocked repositories.
Test names must follow the convention in `.claude/rules/testing-rules.md`.
