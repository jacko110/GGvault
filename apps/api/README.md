# GGVault Phase 3 API

From the repository root, follow README.md for database setup and run npm run dev:api. This builds the shared package and loads the root .env. Configure JWT_SECRET, DATABASE_URL and REDIS_URL before startup.

Swagger UI: http://localhost:3001/docs. OpenAPI JSON: /docs-json.

Run npm run test:unit, npm run test:integration and npm run test:e2e from the repository root, or npm test inside this directory for all suites. Tests use disposable local PostgreSQL/Redis data. The test commands load the root .env and provide a test-only JWT secret if none is configured.

See ../../docs/authentication.md, ../../docs/authorization.md, ../../docs/challenge-api.md and ../../docs/security.md.
