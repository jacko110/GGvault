# GGVault

Phase 4 backend for a competitive gaming challenge platform using **non-withdrawable TEST credits**. Next.js public/admin pages remain placeholders. The NestJS API supports authenticated profiles, game accounts, challenge funding, private match rooms, readiness, result confirmation/dispute and immutable evidence.

## Local setup

Requires Node 22.9+, Docker, PostgreSQL 16 and Redis 7.

1. Install with npm install.
2. Copy .env.example to .env, configure a random JWT_SECRET (at least 32 bytes), and enable development test credits if desired.
3. Run docker compose up -d postgres redis.
4. Run npm run prisma:generate, npm run prisma:deploy, then npm run seed.
5. Run npm run dev:api. Swagger is http://localhost:3001/docs.
6. Optional placeholders: npm run dev:web and npm run dev:admin.

The API dev/start commands load the root .env. Automatic 100-credit grants are disabled by default; set ENABLE_TEST_CREDITS=true for the development flow. Confirmed and disputed matches keep all credits in the vault. No real-money, withdrawal, public settlement or moderator dispute-resolution endpoint exists. Evidence is stored privately under the ignored storage directory; see the evidence documentation for limits.

## Verification

Run npm run build, npm run lint, npm run test:unit, npm run test:integration and npm run test:e2e. Database tests require disposable local data and run serially. See docs/security.md before resetting infrastructure.

## Documentation

- [Project progress and work log](docs/project-progress.md)
- [Authentication](docs/authentication.md)
- [Authorization](docs/authorization.md)
- [Challenge API and complete two-user flow](docs/challenge-api.md)
- [Match lifecycle](docs/match-lifecycle.md)
- [Result verification](docs/result-verification.md)
- [Evidence storage and access](docs/evidence.md)
- [State machine](docs/state-machine.md)
- [Security and validation](docs/security.md)
- [Ledger](docs/ledger.md)
