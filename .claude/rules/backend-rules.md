# Backend Rules — NestJS / TypeORM Patterns

## Module Structure
Each feature module must contain:
```
feature/
  feature.module.ts       # @Module decorator, imports, providers, exports
  feature.entity.ts       # TypeORM @Entity
  dto/
    create-feature.dto.ts
    update-feature.dto.ts
  feature.service.ts      # Business logic
  feature.controller.ts   # HTTP handlers
  feature.spec.ts         # Unit tests
```

## Entity Rules
- Always define `@PrimaryGeneratedColumn()` as `id: number`.
- Use `@CreateDateColumn()` for `createdAt` and `@UpdateDateColumn()` for `updatedAt`.
- Soft-deleteable entities need `@DeleteDateColumn() deletedAt: Date | null`.
- Concurrently-locked entities need `@VersionColumn() version: number`.
- Use `@Column({ type: 'enum', enum: MyEnum })` for enum columns.
- Define relations with `@ManyToOne`, `@OneToMany`, `@ManyToMany` — always specify `{ onDelete: ... }`.

## DTO Rules
- Create DTOs use `class-validator` decorators on every field.
- Update DTOs extend create DTO with `PartialType(CreateDto)` — makes all fields optional automatically.
- Always whitelist and strip unknown fields via the global `ValidationPipe`.
- For enums: `@IsEnum(MyEnum)` with a clear error message.
- For optional fields: `@IsOptional()` must come before other decorators.

## Service Rules
- Services hold all business logic. Controllers call services, never query the DB directly.
- Services throw NestJS exceptions (`NotFoundException`, `BadRequestException`, etc.) — never return error objects.
- For multi-table operations, use a TypeORM `QueryRunner` with explicit transaction commit/rollback.
- Call `AuditLogService.record(...)` inside the same transaction when the action creates audit entries.

## Controller Rules
- Controllers are thin: validate input (via DTOs), call service, return result.
- Use `@Body()`, `@Param()`, `@Query()` for input extraction.
- Use `@UseGuards(JwtAuthGuard)` at the controller class level. Exempt specific routes with a custom `@Public()` decorator if needed.
- Use `@UseInterceptors(ClassSerializerInterceptor)` globally to respect `@Exclude()` on entities.

## TypeORM Query Patterns
```typescript
// Standard find with soft-delete awareness (TypeORM withDeleted defaults to false)
repo.find({ where: { projectId } })

// Admin-only: include soft-deleted
repo.find({ where: { projectId }, withDeleted: true })

// Optimistic lock update
repo.save({ ...ticket, version: incomingVersion })

// Transaction
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  await queryRunner.manager.save(entity);
  await queryRunner.commitTransaction();
} catch (e) {
  await queryRunner.rollbackTransaction();
  throw e;
} finally {
  await queryRunner.release();
}
```

## Response Serialization
- Use `ClassSerializerInterceptor` globally (set in `main.ts`).
- Add `@Exclude()` to sensitive fields (e.g., `password`) on the entity.
- For complex response shapes, create a dedicated response DTO and map to it in the service.

## Error HTTP Status Codes
| Situation | Exception |
|---|---|
| Entity not found | `NotFoundException` (404) |
| Invalid input / constraint violated | `BadRequestException` (400) |
| Optimistic lock conflict | `ConflictException` (409) |
| Not authenticated | `UnauthorizedException` (401) |
| Insufficient role | `ForbiddenException` (403) |
| Duplicate unique field | `ConflictException` (409) |

## File Uploads
- Use `@UseInterceptors(FileInterceptor('file'))` and `@UploadedFile()`.
- Validate MIME type and size in the service (not just in multer config — multer config can be bypassed).
- Store files with a UUID-based filename to avoid collisions.

## Pagination
- For paginated endpoints (mentions), accept `page` (default 1) and `pageSize` (default 20) as query params.
- Return `{ data: [...], total: N, page: N }`.
