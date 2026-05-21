# Testing Rules

## What to Test
Focus on behavior, not implementation details. Cover:
1. Happy path for every endpoint
2. Validation errors (missing fields, wrong enums, constraint violations)
3. Business rule enforcement (status machine, DONE lock, concurrent update, dependency blocker)
4. Auth guard (unauthenticated request returns 401, wrong role returns 403)
5. Auto-assignment logic (no assigneeId → least loaded dev; no devs → null)
6. Escalation logic (due date past → priority promoted; CRITICAL → is_overdue set)

## Unit Tests (*.spec.ts)
- Test services in isolation by mocking repositories with `jest.fn()`.
- Do NOT hit the database in unit tests.
- Test one behavior per `it()` block — keep tests focused and readable.
- Structure: `describe('TicketsService')` → `describe('createTicket')` → `it('should auto-assign to least loaded dev')`.

## Integration / E2E Tests (test/*.e2e-spec.ts)
- Use `@nestjs/testing` `createTestingModule` with a real in-memory or test PostgreSQL instance.
- Set up and tear down the database between test suites.
- Test the full HTTP layer: send real HTTP requests via `supertest`, assert status codes and response bodies.
- Cover at least one full flow per major feature (create → update → delete, login → protected endpoint → logout).

## Mocking Patterns
```typescript
// Repository mock
const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  softDelete: jest.fn(),
};

// Provide in module
{ provide: getRepositoryToken(Ticket), useValue: mockRepo }
```

## Test File Location
- Unit tests: beside the file being tested (`tickets.service.spec.ts` in `src/tickets/`).
- E2E tests: in `test/` directory (`tickets.e2e-spec.ts`).

## Coverage Targets
- Services: high coverage (all branches of business logic).
- Controllers: at least happy path + 404/400 cases.
- Guards and interceptors: at least one test per guard behavior.
- Scheduler: mock the cron trigger and assert the escalation logic.

## Test Naming Convention
```typescript
describe('TicketsService', () => {
  describe('updateTicket', () => {
    it('should throw BadRequestException when updating a DONE ticket', ...)
    it('should throw BadRequestException on backward status transition', ...)
    it('should throw ConflictException on version mismatch', ...)
    it('should update allowed fields and return updated ticket', ...)
  })
})
```

## What NOT to Test
- TypeORM internals (that it saves correctly to DB — trust the ORM).
- NestJS framework behavior (that guards run in order — trust the framework).
- Generated code or trivial getters/setters with no logic.
