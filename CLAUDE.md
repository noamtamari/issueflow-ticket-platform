# IssueFlow — Claude Code Instructions

## Project
Backend API for IssueFlow, a ticket management platform. Built with **NestJS 10 + TypeScript 5 + PostgreSQL + TypeORM**.
Assignment: AT&T TDP 2026. Primary model: **claude-opus-4-7** (secondary: `claude-sonnet-4-6`). See `prompts.md` for the per-session breakdown.

## Tech Stack
- Runtime: Node.js 20+
- Framework: NestJS 10
- Language: TypeScript 5
- ORM: TypeORM 0.3
- DB: PostgreSQL 15 (via Docker compose.yml)
- Auth: JWT (stateless + server-side denylist for logout)
- Validation: class-validator + class-transformer
- File uploads: multer
- CSV: csv-parse + csv-stringify
- Scheduler: @nestjs/schedule

## Project Structure
```
src/
  auth/           # JWT strategy, guards, login/logout/me, token denylist
  users/          # User entity, CRUD, workload, mentions retrieval
  projects/       # Project entity, CRUD, soft delete, restore, workload endpoint
  tickets/        # Ticket entity, CRUD, soft delete, restore, export/import CSV
  comments/       # Comment entity, CRUD, @mention parsing
  audit-log/      # AuditLog entity, service, interceptor
  attachments/    # Attachment entity, file upload controller
  dependencies/   # TicketDependency entity, blocker management
  scheduler/      # Cron job for auto-escalation
  common/         # Shared guards, filters, decorators, pipes, types
  database/       # TypeORM config, data source
```

## Coding Conventions

### NestJS Module Pattern
Every feature follows this pattern:
- `*.module.ts` — imports, providers, exports
- `*.entity.ts` — TypeORM entity
- `*.dto.ts` — create/update DTOs with class-validator decorators
- `*.service.ts` — business logic only, no HTTP concerns
- `*.controller.ts` — HTTP layer only, no business logic
- `*.spec.ts` — unit tests beside the file

### DTOs
- Always use `class-validator` decorators on DTOs (`@IsString`, `@IsEnum`, `@IsOptional`, etc.)
- Enable `ValidationPipe` globally with `whitelist: true, forbidNonWhitelisted: true`
- Use `@ApiProperty()` only if Swagger is added later — skip for now

### TypeORM
- Use repository pattern via `InjectRepository`
- Entities use `@PrimaryGeneratedColumn()`, `@Column()`, `@CreateDateColumn()`, `@UpdateDateColumn()`
- Soft delete via `@DeleteDateColumn() deletedAt: Date` (use `withDeleted()` for admin queries)
- Always use transactions for operations that touch multiple tables

### Response Format
- Return the entity/DTO directly from controller methods — NestJS serializes automatically
- On error, throw NestJS built-in exceptions: `NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException`
- Never return raw TypeORM entities with password fields — use response DTOs or `@Exclude()`

### File Naming
- kebab-case for all files: `ticket-dependency.entity.ts`
- Singular for entities, plural for modules: `tickets.module.ts` but `ticket.entity.ts`

## Always Do
- Validate all inputs at the controller boundary using DTOs + ValidationPipe
- Record every state-changing action in the AuditLog (use the AuditLogService)
- Use `@UseGuards(JwtAuthGuard)` on every controller except `POST /auth/login` and `POST /users`
- Use optimistic locking (`@VersionColumn()`) on Ticket and Comment entities for concurrent update protection
- Run `npm run lint` before considering a feature complete

## Never Do
- Never put business logic in a controller
- Never expose the `password` field in any user response
- Never allow hard delete of tickets or projects — soft delete only
- Never allow backward ticket status transitions
- Never allow updating a ticket with status `DONE`
- Never skip input validation on file uploads (check MIME type + size)

## Business Rules (quick reference)
See `.claude/rules/assignment-rules.md` for the full list. Critical ones:
- Ticket status: `TODO → IN_PROGRESS → IN_REVIEW → DONE` (forward only, no updates on DONE)
- Priority: `LOW | MEDIUM | HIGH | CRITICAL`
- Type: `BUG | FEATURE | TECHNICAL`
- Role: `ADMIN | DEVELOPER`
- Auto-assignment: only DEVELOPERs, least open tickets in project, tie-break by registration date
- Escalation cron: promote priority one level per cycle when `dueDate` passed and status != DONE

## Rules Files
- Backend patterns: `.claude/rules/backend-rules.md`
- Security requirements: `.claude/rules/security-rules.md`
- Testing requirements: `.claude/rules/testing-rules.md`
- Full business logic: `.claude/rules/assignment-rules.md`
