---
name: nest-feature-scaffold
description: Scaffolds a complete NestJS feature module for the IssueFlow project (entity, DTOs, service, controller, module, spec). TRIGGER when the user asks to "create a new module", "scaffold a feature", "add a [name] module", "set up [feature] CRUD", or when starting work on a feature listed in docs/implementation-plan.md. Generates files following the conventions in .claude/rules/backend-rules.md.
---

# NestJS Feature Scaffold

Use this skill to generate a complete feature module for IssueFlow following the project's conventions.

## Inputs
- **Feature name** (singular, e.g. "ticket", "project", "comment", "attachment")
- **Fields** required on the entity (id is auto-generated)
- **Relations** (FKs to other entities, if any)
- **Special behaviors** (soft delete? optimistic lock? auth-required? role-restricted?)

## File Layout to Create

```
src/<feature-plural>/
  <feature>.entity.ts
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
  <feature-plural>.service.ts
  <feature-plural>.service.spec.ts
  <feature-plural>.controller.ts
  <feature-plural>.controller.spec.ts
  <feature-plural>.module.ts
```

Then register the new module in `src/app.module.ts` imports array.

## Generation Rules

### Entity (`<feature>.entity.ts`)
- `@Entity('<feature-plural>')` decorator (table name plural snake_case)
- `id: number` with `@PrimaryGeneratedColumn()`
- All fields with proper `@Column()` typing
- `@CreateDateColumn() createdAt: Date`
- `@UpdateDateColumn() updatedAt: Date`
- If soft-deletable: `@DeleteDateColumn() deletedAt: Date | null`
- If concurrently-locked: `@VersionColumn() version: number`
- Use `@Column({ type: 'enum', enum: <Enum> })` for enum columns
- Sensitive fields get `@Exclude()` from class-transformer

### DTOs
- `Create<Feature>Dto`: every field with class-validator decorator (`@IsString`, `@IsEnum`, `@IsOptional`, `@IsInt`, etc.)
- `Update<Feature>Dto extends PartialType(Create<Feature>Dto)` — auto-makes all fields optional
- For enums: include the enum in the validator (`@IsEnum(MyEnum)`)

### Service
- Inject the entity repository via `@InjectRepository(<Feature>)`
- Inject `AuditLogService` if the feature has state changes
- Standard methods: `create`, `findAll`, `findOne`, `update`, `remove`
- All mutating methods record an `AuditLog` entry
- `findOne` throws `NotFoundException` when missing
- For soft-deletable: `remove` uses `softDelete`, add `restore` and `findAllDeleted` (ADMIN-only at controller)

### Controller
- `@Controller('<feature-plural>')`
- `@UseGuards(JwtAuthGuard)` at class level (unless explicitly public)
- Standard routes:
  - `@Get()` → `findAll`
  - `@Get(':id')` → `findOne`
  - `@Post()` → `create`
  - `@Patch(':id')` → `update`
  - `@Delete(':id')` → `remove`
- Use `ParseIntPipe` on `:id` params
- For ADMIN-only routes: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)`

### Module
- Imports the entity via `TypeOrmModule.forFeature([<Feature>])`
- Imports `AuditLogModule` if the service uses it
- Provides the service
- Exports the service (in case other modules need it)

### Spec Files
- Service spec: mock the repository and AuditLogService, test happy path + 404 + business rules
- Controller spec: mock the service, test routing and response shapes
- Follow test naming conventions from `.claude/rules/testing-rules.md`

## After Generation
1. Run `npm run lint` to catch any import or formatting issues
2. Run `npm run test -- <feature-plural>` to verify the generated specs pass
3. Update `docs/implementation-plan.md` — mark the feature phase as complete
4. Add an entry to `prompts.md` documenting the scaffold invocation

## Cross-Check Against Requirements
Before considering the scaffold complete, verify:
- Does this feature appear in the README.md API table? → endpoints must match
- Does this feature appear in `.claude/rules/assignment-rules.md`? → business rules must be enforced
- Does this feature mutate state? → audit log entries must be wired
