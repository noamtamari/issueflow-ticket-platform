# Security Rules

## Authentication
- All endpoints require a valid JWT in `Authorization: Bearer <token>` header.
- Exceptions (public routes): `POST /auth/login`, `POST /users` (user registration).
- Use a global `JwtAuthGuard` applied at the app level; mark public routes with `@Public()` decorator.
- JWT payload must include: `sub` (userId), `username`, `role`, `jti` (unique token ID for denylist).

## JWT Configuration
- Secret: read from environment variable `JWT_SECRET` — never hardcode.
- Expiry: `JWT_EXPIRES_IN` (e.g. `3600s` / 1 hour). Set a sensible default if env var is missing.
- Algorithm: HS256 (default for @nestjs/jwt).

## Logout / Token Invalidation
- On `POST /auth/logout`, extract the token's `jti` claim and add it to a denylist.
- Denylist can be an in-memory `Set<string>` for this assignment (document the limitation in run.md).
- The `JwtAuthGuard` must check the denylist on every request and reject denylisted JTIs with 401.

## Password Handling
- Hash passwords with `bcrypt` (rounds: 10) before storing.
- Never log or return the password field — use `@Exclude()` on the entity column.
- `POST /users` (registration) does NOT require authentication — but store a hashed password.
- For this assignment, the login endpoint accepts username + password and compares against the hash.

## Role-Based Access Control
- Implement a `@Roles(...roles)` decorator + `RolesGuard`.
- Apply `RolesGuard` after `JwtAuthGuard` (order matters in NestJS guards).
- ADMIN-only endpoints:
  - `GET /tickets/deleted`
  - `GET /projects/deleted`
  - `POST /tickets/:id/restore`
  - `POST /projects/:id/restore`

## Input Sanitization
- Enable `ValidationPipe` globally with `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Never trust user-supplied `authorId` or `assigneeId` without verifying the referenced user exists.
- Validate file MIME type by reading the actual `mimetype` from the multer file object — do not trust the extension.
- For CSV import, validate each row's enum values before inserting; collect errors rather than failing fast.

## SQL Injection
- Use TypeORM query builder or repository methods exclusively — never concatenate raw SQL strings with user input.
- If raw queries are needed, use parameterized queries: `query('SELECT * FROM users WHERE id = $1', [userId])`.

## Sensitive Data in Responses
- User responses must never include `password` (use `@Exclude()` + `ClassSerializerInterceptor`).
- Audit log responses should not expose internal system tokens or secrets.

## Environment Variables Required
```
DATABASE_HOST
DATABASE_PORT
DATABASE_USER
DATABASE_PASSWORD
DATABASE_NAME
JWT_SECRET
JWT_EXPIRES_IN
```
Use a `.env` file locally (add to `.gitignore`). Document all vars in `run.md`.
