# AI Usage Summary

**Model:** claude-sonnet-4-6  
**Tool:** Claude Code CLI (Anthropic)

## How AI Was Used

### Planning & Architecture
- Reviewed the requirements PDF to extract all functional and non-functional requirements.
- Generated the full module structure and layer architecture before writing any code.
- Produced architectural decision records (ADRs) in `docs/decisions.md` to document trade-offs.

### Code Generation
- Generated NestJS module scaffolding (entity, DTO, service, controller) for each feature.
- Implemented complex business logic including the ticket status state machine, optimistic locking, and auto-assignment workload algorithm.
- Generated TypeORM entity definitions with correct column types, relations, and cascade rules.

### Rules & Constraints
- Translated requirements into machine-readable rule files (`.claude/rules/`) to ground each implementation session.
- Created Claude Code slash commands (`.claude/commands/`) to enforce review and testing patterns throughout development.

### Testing
- Generated unit test scaffolding for each service module.
- Produced test case lists covering happy paths, error paths, and business rule enforcement.

## What I Verified Myself
- All generated code was reviewed line-by-line before committing.
- Business logic (status machine transitions, escalation algorithm, mention diffing) was traced manually against the requirements.
- API responses were tested manually against the README.md API contract.
- The full application was run locally and exercised via curl/Postman before final submission.

## Limitations Acknowledged
- AI-generated code may have subtle bugs in edge cases — test coverage is the primary mitigation.
- Token denylist is in-memory (noted in `docs/decisions.md` ADR-001).
- File storage is local disk (noted in `docs/decisions.md` ADR-004).
