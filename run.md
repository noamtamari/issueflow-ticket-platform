# Run Instructions — IssueFlow

## Prerequisites
- Node.js 20+
- npm 10+
- Docker + Docker Compose

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=issueflow
DATABASE_PASSWORD=issueflow
DATABASE_NAME=issueflow
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=3600s
ESCALATION_CRON=*/1 * * * *
ESCALATION_DISABLED=false
```

## 3. Start the Database

```bash
docker compose up -d
```

This starts a PostgreSQL 15 instance on port 5432 using the credentials above.
TypeORM is configured with `synchronize: true` in development — the schema is created automatically on first run.

## 4. Build the Project

```bash
npm run build
```

## 5. Run the Application

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run start:prod
```

The API is available at `http://localhost:3000`.

## 6. Run Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests (requires the database to be running)
npm run test:e2e
```

## 7. Notes

- **Token denylist:** The JWT logout denylist is stored in memory. Restarting the server will invalidate the denylist (previously logged-out tokens become valid again until their natural expiry). This is an acceptable trade-off for the scope of this assignment.
- **File uploads:** Attachments are stored in the local `./uploads/` directory, created automatically on first upload.
- **Schema:** TypeORM `synchronize: true` is enabled for development. Do not use this in production — use migrations instead.
- **Escalation cron:** Runs every minute by default (configurable via `ESCALATION_CRON` env var). Set `ESCALATION_DISABLED=true` to disable the cron job (useful for tests).
