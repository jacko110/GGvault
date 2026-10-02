# GGVault

GGVault uses **non-withdrawable TEST credits** for competitive gaming challenges. The Phase 6A Next.js frontend provides authentication, discovery, challenge creation/joining, vault funding, profiles and transaction history. The approved Phase 5 NestJS backend also supports match verification, evidence, settlement and moderation; those frontend screens belong to Phase 6B. The admin frontend remains a placeholder.

## Local setup

Requires Node 22.9+, Docker, PostgreSQL 16 and Redis 7.

1. Install with npm install.
2. Copy .env.example to .env, configure a random JWT_SECRET (at least 32 bytes), and enable development test credits if desired.
3. Run docker compose up -d postgres redis.
4. Run npm run prisma:generate, npm run prisma:deploy, then npm run seed.
5. Run npm run dev:api. Swagger is http://localhost:3001/docs.
6. Run npm run dev:web and visit http://localhost:3000. Register, link a game account under Profile, then create or join a challenge. The admin placeholder is available with npm run dev:admin.

The API dev/start commands load the root .env. Automatic 100-credit grants are disabled by default; set ENABLE_TEST_CREDITS=true for the development flow. Confirmed matches settle atomically using a server-side fee (default 5%); disputed credits stay locked until moderator resolution or void refund. No real-money, withdrawal or player settlement endpoint exists. Evidence is stored privately under the ignored storage directory; see the evidence documentation for limits.

## Verification

Run npm run build, npm run lint, npm run test:unit, npm run test:integration and npm run test:e2e. Database tests require disposable local data and run serially. See docs/security.md before resetting infrastructure.

Frontend checks: npm --prefix apps/web test and npm --prefix apps/web run test:e2e. The browser flow uses real local services; see [frontend validation setup](docs/frontend.md#validation-commands) and the [Phase 6A results](docs/phase6a-validation.md).

## Documentation

- [Frontend setup, design system and session security](docs/frontend.md)
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
- [Settlement and refunds](docs/settlement.md)
- [Dispute resolution](docs/dispute-resolution.md)
- [Moderation](docs/moderation.md)
