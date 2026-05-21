# Prompts Log — IssueFlow AI Interaction

**Primary AI tool:** Claude Code CLI  
**Primary Claude models used:** `claude-opus-4-7`, `claude-sonnet-4-6`  
**Additional AI tool:** GitHub Copilot CLI  
**Additional model used:** `GPT-5.2 Codex`  
**Project:** IssueFlow — Ticket Management Backend Platform  
**Implementation stack:** TypeScript 5.x, NestJS 10, PostgreSQL 15, TypeORM 0.3, Node.js 20+
**Development mode:** AI-assisted, human-reviewed implementation

This file documents the main prompts and prompt-engineering workflow used while developing IssueFlow.  
The prompts are intentionally structured to make the AI agents operate like controlled software engineering assistants: first understand, then plan, then implement in small reviewable changes, then verify.

> Note: Prompts marked as **Used** were executed during development. Prompts marked as **Reusable template** were prepared for future Claude/Copilot sessions and should only be marked as used after they are actually executed.

## AI Tool Roles

The AI tools were used with separated responsibilities:

- **Claude Opus 4.7** — deeper requirement analysis, architecture review, risk analysis, final requirement traceability, and design decisions.
- **Claude Sonnet 4.6** — implementation assistance, refactoring support, test generation, and documentation updates through Claude Code CLI.
- **GitHub Copilot CLI with GPT-5.2 Codex** — local coding assistance, command-line guidance, small code suggestions, test/debug help, and targeted reviews.

No AI output was accepted automatically. Each meaningful change was reviewed, adjusted when needed, and verified with build/test commands before being considered complete.

---

## Prompt Engineering Principles Used

The prompts in this project follow a consistent structure:

1. **Context** — describe the assignment, stack, and relevant files.
2. **Role** — tell the AI what engineering role to perform.
3. **Task** — define the exact requested output.
4. **Constraints** — define what the AI must not do.
5. **Acceptance criteria** — define what “done” means.
6. **Verification** — require tests, build commands, or manual review notes.
7. **Human review** — final responsibility remains with the developer.

The goal was not to let AI blindly generate the project, but to use it for structured planning, implementation assistance, test design, documentation, and code review.

---

## Global Agent Operating Prompt

**Status:** Used / project instruction baseline  
**Purpose:** Establish safe behavior for the coding agent before implementation.

```text
You are assisting with a backend home assignment called IssueFlow.

Work as a senior backend engineering assistant, not as an autonomous owner.

Before writing code:
1. Inspect the relevant files.
2. Summarize the current state.
3. Propose a short implementation plan.
4. Wait for approval before large changes.

Engineering rules:
- Use TypeScript 5.x and NestJS 10 conventions.
- Use NestJS Controller -> Service -> Repository/ORM architecture.
- Keep controllers thin.
- Put business logic in services.
- Use DTOs for API request/response contracts, with class-validator validation where appropriate.
- Do not expose ORM entities directly from controllers.
- Use class-validator decorators on request DTOs.
- Use database transactions for multi-step state-changing operations.
- Keep changes small, readable, and reviewable.
- Do not modify unrelated files.
- Do not introduce dependencies unless justified.

Quality rules:
- Add or update tests for important business logic.
- Run build/tests when relevant.
- Explain assumptions.
- Mention incomplete areas clearly.
- Do not claim a requirement is implemented unless the code actually supports it.

The final code is owned and reviewed by me.
```

**Output used:**  
This prompt was converted into persistent project guidance in `CLAUDE.md` and supporting `.claude` command/rule files.

**Human review:**  
Reviewed to ensure the agent is constrained, does not make hidden large changes, and follows the assignment requirements.

---

# Session 1 — Requirements Review & Project Setup

## Prompt 1.1 — Assignment Requirement Review

**Status:** Used  
**Goal:** Understand the full assignment before implementation.

```text
Review the assignment file @TDP_issueflow_requirements.pdf.

Do not write code yet.

Act as a senior backend engineer reviewing a home assignment.

Return:
1. The main project goal.
2. All required modules.
3. Core business rules.
4. Extended features.
5. Data model candidates.
6. Risky or complex areas.
7. Suggested implementation order.
8. Files that should be added for documentation and AI usage transparency.

Be precise and separate mandatory requirements from implementation suggestions.
```

**Response summary:**  
Claude produced a structured breakdown of the assignment, including users, authentication, projects, tickets, comments, audit logs, dependencies, attachments, CSV import/export, soft delete, mentions, escalation, and auto-assignment.

**Output used:**  
Used to create the initial implementation plan and documentation structure.

**Human review:**  
Compared the response against the PDF and project README/API contract before continuing.

---

## Prompt 1.2 — AI Workflow and Repository Structure

**Status:** Used  
**Goal:** Create a professional AI-assisted development structure before writing feature code.

```text
Before implementing the backend, help me create the project support structure for an AI-assisted home assignment.

Context:
- The assignment explicitly asks to document AI usage.
- I will use Claude Code as the main coding assistant.
- I want the repository to show professional, controlled AI-assisted engineering.

Do not implement application code yet.

Suggest and/or create files for:
1. Claude instructions.
2. AI usage summary.
3. Prompt log.
4. Implementation plan.
5. Architecture notes.
6. Design decisions.
7. Test plan.
8. Reusable Claude commands or skills.

For each file, explain its purpose briefly.
Keep the structure useful and not over-engineered.
```

**Response summary:**  
Claude suggested `CLAUDE.md`, `AI_USAGE.md`, `prompts.md`, `docs/implementation-plan.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/test-plan.md`, and `.claude` support files.

**Output used:**  
Created the initial documentation and agent-instruction structure.

**Human review:**  
Accepted the structure after checking that it matches the assignment’s requirement to document AI usage.

---

## Prompt 1.3 — Build Strategy Selection

**Status:** Used  
**Goal:** Choose an implementation approach that reduces risk.

```text
Given the IssueFlow assignment scope, recommend the safest build strategy.

Options:
1. Vertical module-by-module.
2. Horizontal layer-by-layer.
3. Critical path first.
4. Hybrid.

Consider:
- The assignment has many features.
- I need a runnable backend early.
- I want to avoid large unfinished layers.
- The final repo should look professional and testable.

Return:
1. Recommended strategy.
2. Why it is best.
3. Feature implementation order.
4. Risks of the other strategies.
5. How to keep commits small and reviewable.
```

**Response summary:**  
The selected approach was a hybrid: start with a minimal critical-path slice, then continue vertically by module.

**Output used:**  
Used as the basis for `docs/implementation-plan.md`.

**Human review:**  
Approved because it allows early runnable progress while still supporting full requirement coverage.

---

# Session 2 — Foundation, Architecture, and Database Model

## Prompt 2.1 — Domain Model and Package Architecture

**Status:** Reusable template  
**Goal:** Design the domain model before implementation.

```text
Inspect the current project structure and the IssueFlow requirements.

Act as a senior NestJS architect.

Do not write code yet.

Design the backend architecture for:
- Users
- Authentication
- Projects
- Tickets
- Comments
- Audit logs
- Dependencies
- Attachments
- Mentions
- Escalation
- Auto-assignment

Return:
1. Recommended package structure.
2. Entity list and main fields.
3. Relationships between entities.
4. DTO boundaries.
5. Service responsibilities.
6. Repository responsibilities.
7. Transaction boundaries.
8. Validation rules.
9. Risks in the model.
10. Suggested first implementation slice.

Constraints:
- Use TypeScript 5.x.
- Use NestJS 10.
- Use PostgreSQL.
- Use the project ORM consistently, such as TypeORM or Prisma depending on the provided skeleton.
- Keep the model simple enough for a home assignment.
- Do not over-engineer with unnecessary abstractions.
```

**Expected output use:**  
Use this to update `docs/architecture.md` and `docs/decisions.md` before implementing entities.

**Human review checklist:**  
- Entity relationships are understandable.
- Ticket lifecycle rules can be enforced.
- Soft delete is supported.
- Audit logging can be implemented without duplication.
- Auto-assignment and escalation are possible with the selected model.

---

## Prompt 2.2 — Foundation Implementation Plan

**Status:** Reusable template  
**Goal:** Plan the foundation code in a controlled way.

```text
Plan the foundation implementation for IssueFlow.

Scope:
- Base package structure
- PostgreSQL configuration
- Global exception filter
- Standard error response format
- ValidationPipe setup
- Base enums
- Base auditing fields if needed

Do not implement yet.

Return:
1. Files to create or modify.
2. Exact responsibilities of each file.
3. Implementation order.
4. Tests or checks to run.
5. Risks or assumptions.
6. What should not be included in this phase.
```

**Expected output use:**  
Use this before allowing Claude to create foundational code.

---

## Prompt 2.3 — Foundation Implementation

**Status:** Reusable template  
**Goal:** Implement only the foundation after the plan is approved.

```text
Implement only the approved foundation phase.

Scope:
- Package structure
- Global exception filter
- Standard error response
- ValidationPipe support
- Basic enum definitions
- PostgreSQL configuration if missing

Do not implement business modules yet.
Do not implement authentication yet.
Do not modify unrelated files.

After implementation, return:
1. Files changed.
2. What was implemented.
3. Commands to run.
4. Any assumptions.
5. Any incomplete items.
```

**Acceptance criteria:**  
- Project still builds.
- Linting and tests still run.
- Error format is consistent.
- No business logic is prematurely implemented.

---

# Session 3 — Authentication and Users

## Prompt 3.1 — Auth/User Design Review

**Status:** Reusable template  
**Goal:** Avoid weak security or poor identity modeling.

```text
Review the requirements for User Management and Authentication.

Act as a backend security reviewer.

Do not write code yet.

Design the user/auth implementation:
1. User entity fields.
2. Register user flow.
3. Login flow.
4. JWT generation and validation.
5. Logout approach.
6. /auth/me behavior.
7. Password hashing strategy.
8. Which endpoints are public vs protected.
9. Error handling for invalid credentials.
10. Tests to add.

Constraints:
- Do not store plain-text passwords.
- Do not leak whether username or password was wrong.
- Do not hardcode secrets.
- Keep the solution appropriate for a home assignment.
```

**Expected output use:**  
Use to update architecture/security decisions before implementation.

---

## Prompt 3.2 — Auth/User Implementation

**Status:** Reusable template  
**Goal:** Implement a focused, reviewable auth/user slice.

```text
Implement the User Management and Authentication slice.

Scope:
- User entity/model and repository/provider
- User DTOs
- User service
- User controller
- Auth DTOs
- Auth service
- Auth controller
- JWT strategy/guard/module configuration
- Password hashing
- /auth/login
- /auth/logout
- /auth/me
- Basic Jest/Supertest tests for login and protected endpoints

Do not implement projects, tickets, or comments in this step.

Business rules:
- Role must be ADMIN or DEVELOPER.
- All non-auth endpoints should be protected unless explicitly public.
- Login returns a signed JWT access token.
- Logout invalidates the current token or relies on a documented stateless expiry approach.

After implementation, return:
1. Files changed.
2. API endpoints added.
3. Security behavior.
4. Tests added.
5. Commands run.
6. Remaining risks.
```

**Acceptance criteria:**  
- User registration works.
- Login works.
- Protected endpoint rejects unauthenticated requests.
- `/auth/me` returns the current user profile.
- Passwords are hashed.

---

# Session 4 — Projects and Tickets Core

## Prompt 4.1 — Ticket Business Rules Plan

**Status:** Reusable template  
**Goal:** Plan the most complex domain logic before coding.

```text
Plan the Ticket module implementation.

Do not write code yet.

Include:
1. Ticket entity fields.
2. Required enums.
3. Request/response DTOs.
4. Ticket service methods.
5. Status transition validation.
6. DONE-ticket update restriction.
7. Optimistic locking / concurrency strategy.
8. Dependency blocker behavior before DONE.
9. Soft delete behavior.
10. Audit log integration.
11. Tests to add.

Assignment rules:
- Status: TODO, IN_PROGRESS, IN_REVIEW, DONE.
- Priority: LOW, MEDIUM, HIGH, CRITICAL.
- Type: BUG, FEATURE, TECHNICAL.
- A ticket cannot be updated once DONE.
- Status may only move forward: TODO -> IN_PROGRESS -> IN_REVIEW -> DONE.
- A ticket cannot move to DONE if it has unresolved blockers.
- Ticket/project deletion should be soft delete.

Return a concise implementation plan and wait for approval.
```

**Expected output use:**  
Use to make sure ticket logic is designed before implementation.

---

## Prompt 4.2 — Projects Implementation

**Status:** Reusable template  
**Goal:** Implement project management first as a prerequisite for tickets.

```text
Implement the Project Management module.

Scope:
- Project entity/model
- Project repository/provider
- Project request/response DTOs
- Project service
- Project controller
- Create, get by id, update, delete, list all
- Soft delete support
- Restore endpoint if required by the API contract
- Audit logs for state-changing actions
- Basic tests

Rules:
- Projects have name, description, and owner userId.
- Standard project listing must hide soft-deleted projects.
- ADMIN-only deleted listing and restore should be implemented according to the assignment/API contract.

Do not implement tickets in this step unless strictly required for compilation.

After implementation, return:
1. Files changed.
2. Endpoints added.
3. Validation rules.
4. Audit events created.
5. Tests added.
6. Commands run.
```

---

## Prompt 4.3 — Tickets Implementation

**Status:** Reusable template  
**Goal:** Implement ticket management with business rules.

```text
Implement the Ticket Management module according to the approved plan.

Scope:
- Ticket entity/model
- Ticket repository/provider
- Ticket DTOs
- Ticket service
- Ticket controller
- Create ticket
- Get ticket by id
- Update ticket
- Delete ticket using soft delete
- List tickets by project
- Lifecycle validation
- DONE-ticket update protection
- Optimistic locking for concurrent updates
- Audit logs for state-changing actions
- Tests for critical rules

Do not implement CSV, attachments, mentions, or scheduler in this step.

After implementation, return:
1. Files changed.
2. Endpoints added.
3. Business rules enforced.
4. Tests added.
5. Commands run.
6. Known limitations.
```

**Acceptance criteria:**  
- Invalid enum values are rejected.
- Backward status transitions are rejected.
- DONE tickets cannot be updated.
- Standard list endpoints hide soft-deleted records.
- Mutations create audit log records.

---

# Session 5 — Comments, Mentions, and Dependencies

## Prompt 5.1 — Comments and Mentions Plan

**Status:** Reusable template  
**Goal:** Design comment behavior and mention parsing carefully.

```text
Plan the Comment and Mention implementation.

Do not write code yet.

Include:
1. Comment entity fields.
2. Mention metadata model.
3. How to parse @username.
4. Case-insensitive username matching.
5. How comment responses include mentionedUsers.
6. How comment update recalculates mentions.
7. Concurrent edit protection.
8. Audit log integration.
9. Tests to add.

Rules:
- Users can add comments to tickets.
- Comments can be fetched by ticket.
- Comment content can be updated.
- Comments can be deleted.
- Two users cannot edit a comment at the same time.
- GET /users/{userId}/mentions returns comments where the user was mentioned, newest first.
- On comment update, newly added mentions are created and removed mentions are deleted.
```

---

## Prompt 5.2 — Dependencies Implementation

**Status:** Reusable template  
**Goal:** Add blocker logic without breaking ticket lifecycle rules.

```text
Implement Ticket Dependencies.

Scope:
- Add dependency endpoint
- List dependencies endpoint
- Remove dependency endpoint
- Service-level validation
- DONE transition blocker validation
- Tests

Rules:
- POST /tickets/{ticketId}/dependencies with body { "blockedBy": 42 } means ticketId is blocked by ticket 42.
- Both tickets must exist.
- Both tickets must belong to the same project.
- A ticket cannot transition to DONE if it has unresolved blockers.
- Avoid duplicate dependencies.
- Consider preventing self-dependency.

After implementation, return:
1. Files changed.
2. Endpoints added.
3. Validation added.
4. Ticket update logic affected.
5. Tests added.
6. Commands run.
```

---

# Session 6 — Extended Features

## Prompt 6.1 — Auto-Assignment Design and Implementation

**Status:** Reusable template  
**Goal:** Implement workload-based assignment deterministically.

```text
Implement auto-assignment by workload.

Scope:
- On ticket creation, if assigneeId is absent, assign the least-loaded DEVELOPER.
- Workload is count of non-DONE tickets assigned to each developer in the same project.
- Ties are broken by user registration order, oldest first.
- If no eligible developer exists, create the ticket unassigned.
- Add GET /projects/{projectId}/workload.
- Record auto-assignment in the audit log with actor = SYSTEM and action = AUTO_ASSIGN.
- Add tests.

Constraints:
- ADMIN users must not be candidates.
- Auto-assignment happens only on creation.
- Explicit assigneeId on update overrides assignment.
- Do not trigger auto-assignment on update.

Return:
1. Files changed.
2. Query strategy for workload.
3. Edge cases handled.
4. Tests added.
5. Commands run.
```

---

## Prompt 6.2 — Escalation Scheduler Design

**Status:** Reusable template  
**Goal:** Implement overdue priority escalation safely and idempotently.

```text
Plan and implement auto-scheduling escalation for tickets.

Before coding, summarize the design.

Rules:
- Ticket creation/update accepts optional dueDate.
- For each overdue non-DONE ticket with priority below CRITICAL, promote priority one level:
  LOW -> MEDIUM -> HIGH -> CRITICAL.
- When a ticket reaches CRITICAL and is still overdue, set is_overdue = true.
- Escalation is idempotent.
- Escalation applies only to tickets with dueDate.
- Manual priority change resets auto-escalation state and clears is_overdue.
- Escalation does not change ticket status.
- System-generated escalation actions must be recorded in audit log.

Return:
1. Scheduler approach.
2. Entity fields needed.
3. Service logic.
4. Tests for idempotency.
5. Files changed.
6. Commands run.
```

---

## Prompt 6.3 — Attachment Management

**Status:** Reusable template  
**Goal:** Implement upload validation without over-complicating storage.

```text
Implement Attachment Management for tickets.

Scope:
- Upload attachment to ticket.
- Validate maximum file size: 10 MB.
- Allow only:
  - image/png
  - image/jpeg
  - application/pdf
  - text/plain
- Reject all other types.
- Store metadata persistently.
- Choose a simple storage strategy appropriate for this home assignment.
- Add tests for allowed and rejected uploads.

Before coding, explain:
1. Storage strategy.
2. Validation strategy.
3. Entity fields.
4. Endpoints.
5. Failure responses.
```

---

## Prompt 6.4 — CSV Export/Import

**Status:** Reusable template  
**Goal:** Implement CSV correctly, including commas and quotes.

```text
Implement Ticket CSV export and import.

Scope:
- GET /tickets/export?projectId={id}
- POST /tickets/import with multipart/form-data CSV file and target projectId form field
- Export fields:
  id, title, description, status, priority, type, assigneeId
- Import creates tickets in bulk.
- Import returns:
  { "created": number, "failed": number, "errors": [...] }

Rules:
- CSV must correctly handle commas and quotes inside field values.
- Invalid rows should not crash the whole import.
- Return informative row-level errors.
- Add tests for quoted fields, commas, invalid enum values, and partial failure.
- Prefer a reliable CSV library if already available or justify adding one.

After implementation, return:
1. Files changed.
2. CSV library/strategy.
3. Edge cases handled.
4. Tests added.
5. Commands run.
```

---

# Session 7 — Testing and Verification

## Prompt 7.1 — Test Strategy

**Status:** Reusable template  
**Goal:** Get useful test coverage without wasting time.

```text
Create a test strategy for IssueFlow.

Testing target:
- Service unit tests for business logic.
- Key integration/e2e tests for main API flows.

Do not write tests yet.

Return:
1. Highest-priority service tests.
2. Highest-priority integration tests.
3. Test data setup strategy.
4. What should be mocked vs real database.
5. Suggested test files.
6. Coverage risks.
7. Recommended implementation order.

Prioritize:
- Auth flow
- Ticket lifecycle
- DONE-ticket update rejection
- Dependency blockers
- Soft delete/restore
- Auto-assignment
- Escalation
- Mentions
- CSV import/export
- Audit log creation
```

---

## Prompt 7.2 — Generate Critical Service Tests

**Status:** Reusable template  
**Goal:** Add focused tests for business logic.

```text
Generate service-level tests for the Ticket module.

Focus on behavior, not implementation details.

Test:
1. Creating a valid ticket.
2. Rejecting invalid status transition.
3. Rejecting backward transition.
4. Rejecting update after DONE.
5. Rejecting DONE transition with unresolved blockers.
6. Auto-assignment when assigneeId is absent.
7. Manual assignee override.
8. Manual priority change clears is_overdue.
9. Audit log is created for state-changing actions.

Use clear test names.
Do not create brittle tests.
After writing tests, run the relevant test command and report the result.
```

---

## Prompt 7.3 — E2E Flow Tests

**Status:** Reusable template  
**Goal:** Prove the API works across layers.

```text
Add key integration/e2e tests.

Flows:
1. Login and access a protected endpoint.
2. Create project -> create ticket -> update ticket status.
3. Add dependency -> attempt blocked DONE transition -> remove dependency -> transition to DONE.
4. Create comment with @mention -> fetch mentioned comments.
5. Soft delete project/ticket -> verify hidden from standard list -> restore.
6. CSV export/import round trip.

Use the existing NestJS test framework and project conventions.

After implementation, return:
1. Tests added.
2. Test data setup.
3. Commands run.
4. Passing/failing status.
5. Remaining untested risks.
```

---

# Session 8 — Code Review, Security Review, and Final Submission

## Prompt 8.1 — Requirement Traceability Review

**Status:** Reusable template  
**Goal:** Check assignment coverage before submission.

```text
Perform a requirement traceability review.

Compare the current codebase against:
- Assignment requirements
- README API contract
- docs/implementation-plan.md
- docs/test-plan.md

Do not write code yet.

Return a table with:
1. Requirement
2. Status: Implemented / Partial / Missing / Risk
3. Evidence: file names or endpoint names
4. Tests covering it
5. Required fix if any

Focus on:
- Auth
- Users
- Projects
- Tickets
- Comments
- Audit log
- Dependencies
- Attachments
- CSV import/export
- Soft delete/restore
- Mentions
- Escalation
- Auto-assignment
- Validation/errors
- Documentation
```

---

## Prompt 8.2 — Security and Robustness Review

**Status:** Reusable template  
**Goal:** Catch risky backend issues.

```text
Review the codebase as a backend security and robustness reviewer.

Do not modify code yet.

Check:
1. JWT authentication coverage.
2. Password hashing.
3. Hardcoded secrets.
4. Authorization gaps.
5. Validation gaps.
6. Unsafe file upload handling.
7. CSV parsing risks.
8. Error messages leaking internals.
9. Transaction consistency.
10. Race conditions / optimistic locking.
11. Soft delete bypasses.
12. Audit log missing mutations.

Return:
- Critical issues
- Important issues
- Nice-to-have improvements
- Suggested fixes
- Files to inspect first
```

---

## Prompt 8.3 — Final Documentation Review

**Status:** Reusable template  
**Goal:** Make the repo submission-ready.

```text
Review and update documentation for final submission.

Files:
- README.md
- run.md
- AI_USAGE.md
- prompts.md
- docs/implementation-plan.md
- docs/architecture.md
- docs/decisions.md
- docs/test-plan.md

Rules:
- Do not claim unimplemented features.
- Ensure commands are exact and reproducible.
- Include database startup instructions.
- Include build/run/test instructions.
- Include model name used.
- Include main AI prompts and how outputs were reviewed.
- Keep the tone professional and concise.

Return:
1. Documentation files changed.
2. Important corrections made.
3. Any claims that still require verification.
```

---

## Prompt 8.4 — Final Submission Gate

**Status:** Reusable template  
**Goal:** Prevent accidental broken submission.

```text
Run a final submission readiness check.

Do not implement new features unless I approve.

Check:
1. Git status.
2. Build command.
3. Test command.
4. Application startup instructions.
5. Database startup instructions.
6. Required files:
   - run.md
   - prompts.md
   - AI_USAGE.md
   - CLAUDE.md
   - docs/implementation-plan.md
   - docs/architecture.md
   - docs/decisions.md
   - docs/test-plan.md
7. Public repo readiness.
8. Any TODOs or misleading documentation.

Return:
- Ready / Not ready
- Blocking issues
- Non-blocking issues
- Exact next command I should run
```

---

# Copilot CLI Support Prompts

## Prompt C.1 — Targeted Copilot CLI Code Review

**Status:** Reusable template  
**Goal:** Use GitHub Copilot CLI with GPT-5.2 Codex for a focused local review without letting it rewrite the project.

```text
Review the current git diff for the IssueFlow NestJS backend.

Act as a pragmatic TypeScript/NestJS reviewer.

Do not rewrite code automatically.
Do not suggest large architecture changes unless there is a correctness or assignment-compliance issue.

Focus on:
1. TypeScript type safety.
2. NestJS module/provider/controller structure.
3. DTO validation with class-validator.
4. JWT guard coverage.
5. Database/ORM query correctness.
6. Missing error handling.
7. Missing tests for changed behavior.
8. Assignment requirement gaps.

Return:
- Blocking issues
- Important improvements
- Small cleanup suggestions
- Commands I should run next
```

---

## Prompt C.2 — Copilot CLI Debugging Prompt

**Status:** Reusable template  
**Goal:** Get focused help when a test/build/runtime error appears.

```text
I am working on a TypeScript 5.x / NestJS 10 backend called IssueFlow.

Analyze this error and propose the smallest safe fix.

Constraints:
- Do not rewrite unrelated files.
- Keep the existing architecture.
- Prefer fixing the root cause over hiding the error.
- If multiple fixes are possible, rank them by safety.
- Include the exact command to re-run after the fix.

Error/log:
[PASTE ERROR HERE]

Relevant files:
[PASTE FILE PATHS OR DIFF HERE]
```

---

## Prompt C.3 — Copilot CLI Test Gap Prompt

**Status:** Reusable template  
**Goal:** Identify missing tests after implementing a module.

```text
Review the current implementation and identify missing Jest/Supertest tests.

Context:
- Project: IssueFlow
- Stack: TypeScript 5.x, NestJS 10, PostgreSQL
- Testing target: service unit tests + key e2e flows

Do not write tests yet.

Return:
1. Existing test coverage found.
2. Missing high-value tests.
3. Which tests should be service-level.
4. Which tests should be e2e/integration-level.
5. Recommended implementation order.
6. Any test setup risks.
```

---

# Session Handoff Prompt

**Status:** Reusable template  
**Goal:** Preserve context when Claude session usage is almost over.

```text
Before this Claude session ends, create a handoff summary for the next session.

Update or create docs/SESSION_HANDOFF.md.

Include:
1. Current project status.
2. What was implemented in this session.
3. Files changed.
4. Commands run.
5. Tests passed or failed.
6. Known bugs.
7. Incomplete requirements.
8. Important design decisions.
9. Next recommended task.
10. Exact prompt to paste into the next Claude session.

Do not implement new feature code.
Only inspect the repo and update the handoff document.
```

**Recommended next-session starter prompt:**

```text
Read CLAUDE.md, AI_USAGE.md, prompts.md, docs/implementation-plan.md, docs/architecture.md, docs/decisions.md, docs/test-plan.md, and docs/SESSION_HANDOFF.md.

Then inspect git status and the relevant source files.

Do not write code yet.

Summarize:
1. Current implementation status.
2. What was completed in the previous session.
3. What remains.
4. Risks or incomplete areas.
5. The next safest implementation step.

Then propose a short plan and wait for approval.
```

---

# Human Review Notes

For every AI-assisted implementation step, the following checks should be performed manually:

```text
1. Read the generated diff.
2. Confirm the code matches the assignment requirements.
3. Confirm no unrelated files were changed.
4. Confirm business rules are enforced in services.
5. Confirm validation exists at the API boundary.
6. Confirm security-sensitive behavior is not hardcoded or unsafe.
7. Run the relevant tests/lint/build commands.
8. Update prompts.md only with prompts that were actually used.
9. Update run.md if setup/build/test commands changed.
10. Commit only reviewed and working changes.
```

---

# Session 9 — Test Coverage Audit and Gap Fill

## Prompt 9.1 — Coverage Audit + Targeted Test Additions

**Status:** Used
**Goal:** Close concrete coverage gaps against the README API contract and assignment business rules.

```text
Review the current NestJS test coverage against the IssueFlow assignment and README API contract.

Before writing code, inspect the controllers/services/DTOs/tests and produce a coverage matrix
showing each endpoint, existing success/error coverage, missing tests, and priority.

Then add only the missing high-value tests. Cover both successful responses and error responses:
auth failures, validation errors, not found, conflicts, and assignment-specific business-rule violations.

Use the existing Jest/Supertest conventions. Keep tests readable, deterministic, and behavior-focused.
Do not modify production code unless required to fix a real bug or testability issue; explain any
such change first.

After adding tests, run the relevant test command, summarize what was added, list any failures,
and update docs/test-plan.md and prompts.md if needed.
```

**Response summary:**
Built an endpoint × coverage × priority matrix. Identified that `CommentsService`,
`DependenciesService`, and `RolesGuard` had no unit specs; and that no e2e tests
exercised DTO validation, RBAC 403s, dep rejections (cross-project/self/dup),
comment version conflicts, mention resync via HTTP, workload, audit-log filter,
attachment HTTP path, or the manual-priority isOverdue clear. Added three new
unit specs and one new e2e suite (`test/api-contract.e2e-spec.ts`).

**Testability fix (explained before applying):**
`tsconfig.json` was missing `esModuleInterop: true`, which caused every
`import request from 'supertest'` to compile to `supertest_1.default`. At runtime
that property is undefined for supertest v7, so every e2e call threw
`(0 , supertest_1.default) is not a function` — meaning all e2e tests were
pre-broken before this session, not just the new ones. Added the single
`"esModuleInterop": true` line; this is the Nest CLI default and unblocks
all supertest usage with no source-code changes.

**Files affected:**
- `src/comments/comments.service.spec.ts` (new)
- `src/dependencies/dependencies.service.spec.ts` (new)
- `src/common/guards/roles.guard.spec.ts` (new)
- `test/api-contract.e2e-spec.ts` (new)
- `tsconfig.json` (added `esModuleInterop: true`)
- `docs/test-plan.md` (current coverage snapshot + new sections)

**Verification:**
- `npm run test` → 11 suites / 93 tests passing (was 8 / 68).
- `npm run test:e2e` → 3 suites / 32 tests passing (was 3 / 32 *that didn't run* — now actually executing).

**Human review:**
Confirmed no production code in `src/` was modified, that each new e2e case
maps to a specific assignment rule (status machine, soft-delete RBAC, dependency
constraints, mention resync, MIME validation, etc.), and that the tsconfig
change is the minimal fix for the supertest interop issue.

---

# Session 10 — E2E Coverage Audit and Targeted Gap Fill

## Prompt 10.1 — Coverage matrix + only high-value e2e additions

**Status:** Used
**Goal:** Inspect the three existing e2e files, produce a matrix, and only add tests that close real assignment / README contract gaps (no blind duplication).

```text
Review the current NestJS e2e test coverage in app.e2e-spec.ts, flows.e2e-spec.ts,
and api-contract.e2e-spec.ts. First produce a coverage matrix (success, error,
missing cases, recommend?, priority P0/P1/P2) for: Auth, Users, Projects, Tickets,
Comments, Dependencies, Attachments, CSV, Soft-delete/Restore, Mentions,
Audit logs, Auto-assignment, Auto-escalation, Validation/error shape.

Then add only the high-value missing tests (P0 covers CRUD HTTP gaps for Users /
Projects / Tickets / Comments / Dependencies; P1 covers attachments MIME, CSV
edge cases, audit-log persistence, auto-assignment audit row; P2 covers malformed
JWT, /auth/me shape, error envelope shape).

Fix hygiene: if app.e2e-spec.ts leaks the Nest app or duplicates better coverage,
remove it. Use existing Jest+Supertest conventions. Don't modify production code
unless a real bug or testability issue is found — explain before doing so.

After: run the e2e suite, summarize added tests, list anything intentionally
uncovered, and update docs/test-plan.md and prompts.md.
```

**Response summary:**
Built the matrix from the three existing files (32 tests). Identified gaps:
all Users/Projects CRUD over HTTP, ticket version-409 + DONE-update lock at HTTP,
comments list/delete/404s, dependencies list/delete/404, attachment pdf/text/missing-file,
CSV partial-failure + missing-projectId, audit-log row persistence for UPDATE /
DELETE / RESTORE / AUTO_ASSIGN, malformed JWT + /auth/me shape, AllExceptionsFilter
envelope. Added one new file `test/api-coverage.e2e-spec.ts` with 39 focused tests
organized by area. Removed `test/app.e2e-spec.ts` — its single test duplicated
`api-contract.e2e-spec.ts` and the suite leaked the Nest app between tests.

**Production code changes:** none.

**Intentionally NOT added at e2e level (documented in `docs/test-plan.md`):**
- >10 MB attachment rejection — unit-tested; generating 11 MB buffers is wasted cost.
- `GET /tickets/export` with unknown projectId — implementation returns header-only
  CSV, not 404; asserting 404 would require source changes.
- Auto-escalation cron — e2e disables the cron to avoid races; covered in
  `escalation.service.spec.ts`.
- "No DEVELOPER → null" / "ADMIN excluded" auto-assignment at e2e — the
  implementation queries DEVELOPERs system-wide, so prior tests' developers
  pollute these scenarios; both are covered in `tickets.service.spec.ts`.

**Files affected:**
- `test/api-coverage.e2e-spec.ts` (new — 39 tests across 9 describe blocks)
- `test/app.e2e-spec.ts` (deleted — duplicate + leaked app)
- `docs/test-plan.md` (new API-Coverage section + "intentionally NOT added" list)

**Verification:**
- `npm run test:e2e` → 3 suites / **70 tests passing** (was 3 / 32).
- `npm run test` → 11 suites / **93 tests passing** (unchanged — no source code touched).

**Human review:**
Confirmed the new file follows the existing `beforeAll` / `afterAll` pattern,
reuses the `createUser` / `login` / `createProject` / `createTicket` helpers
from the other e2e files for consistency, and that each new `it()` maps to
a specific README contract row or assignment-rules clause.

---

# Prompt Log Maintenance Rule

When a new AI interaction produces meaningful project changes, add an entry using this format:

```markdown
## Prompt X.Y — Short Descriptive Title

**Status:** Used  
**Goal:** One-sentence purpose.

```text
Exact prompt used here.
```

**Response summary:**  
Short summary of what Claude returned.

**Output used:**  
What was actually used in the code/docs.

**Human review:**  
How the output was checked.

**Files affected:**  
- path/to/file1
- path/to/file2

**Verification:**  
- Command run:
- Result:
```

This keeps the prompt log transparent, professional, and useful for reviewers.
