# Architecture Decision Records

## ADR-001: Token Denylist as In-Memory Set
**Decision:** Use an in-memory `Set<string>` for JWT logout denylist.  
**Reason:** No Redis or external cache is available in the assignment environment. Simple and sufficient for a single-instance server.  
**Trade-off:** Denylisted tokens are cleared on server restart. Documented in run.md.

## ADR-002: TypeORM @VersionColumn for Optimistic Locking
**Decision:** Use `@VersionColumn()` on Ticket and Comment entities.  
**Reason:** The assignment requires preventing simultaneous updates by two users. Optimistic locking is the standard approach without requiring explicit DB-level locks. TypeORM has built-in support.  
**Trade-off:** Clients must include the current `version` in update requests. Requires documenting in the API contract.

## ADR-003: Soft Delete via @DeleteDateColumn
**Decision:** Use TypeORM's built-in `@DeleteDateColumn()` for soft delete.  
**Reason:** TypeORM automatically handles filtering of soft-deleted records from standard queries. The restore API uses `restore()`. Minimal custom code needed.  
**Trade-off:** Slightly less flexible than a manual `isDeleted: boolean` flag but more idiomatic.

## ADR-004: Local Disk for Attachment Storage
**Decision:** Store uploaded files in a local `/uploads` directory.  
**Reason:** Assignment is a local backend with no cloud infrastructure requirement.  
**Trade-off:** Files are lost if the container is recreated. S3 would be the production choice.

## ADR-005: AuditLog Written in Same Transaction
**Decision:** `AuditLogService.record()` uses the same `QueryRunner` as the main operation.  
**Reason:** Prevents audit entries from being persisted when the main operation fails, which would result in phantom audit records.  
**Trade-off:** Slightly more verbose service code (must pass `queryRunner` to record method).

## ADR-007: bcryptjs Instead of bcrypt
**Decision:** Use `bcryptjs` (pure JS) instead of `bcrypt` (native).  
**Reason:** The development directory path contains `&` (`at&t`). `bcrypt`'s native build script is spawned by npm through cmd.exe, which interprets `&` as a command separator and fails. `bcryptjs` is API-compatible and pure JavaScript, requiring no native compilation.  
**Trade-off:** `bcryptjs` is ~30% slower than native `bcrypt`. Acceptable for this assignment's load profile.

## ADR-008: npm Scripts Invoke Binaries via `node` Directly
**Decision:** Every script in `package.json` calls `node ./node_modules/<pkg>/bin/<bin>.js` instead of the short `nest`/`jest`/`eslint`/`prettier` form.  
**Reason:** Same `&`-in-path issue as ADR-007. The `.cmd` shims in `node_modules/.bin/` use unquoted paths that break when cmd.exe sees `&`. Invoking node directly bypasses the shim and shell parsing entirely.  
**Trade-off:** Scripts are slightly more verbose. If the project is cloned to a path without `&`, the longer form still works.

## ADR-006: Auto-Escalation Cron Frequency
**Decision:** Default cron interval is every minute (`*/1 * * * *`) in development.  
**Reason:** Easy to observe and test during development. Configurable via `ESCALATION_CRON` env var.  
**Trade-off:** Fine-grained scheduling; acceptable for the scope of this assignment.
