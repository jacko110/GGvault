# GGVault

GGVault uses **non-withdrawable TEST credits** for competitive gaming challenges. The Next.js player frontend provides authentication, discovery, challenge creation/joining, vault funding, match readiness, result verification, private evidence, outcomes, profiles and transaction history. Phase 7 adds closed-beta security controls, observability, recovery and load-test tooling over the existing product. Read the validation and dependency reports before hosting.

## Local setup

Requires Node 22.9+, Docker, PostgreSQL 16 and Redis 7.

1. Install with npm install.
2. Copy .env.example to .env, configure a random JWT_SECRET (at least 32 bytes), and enable development test credits if desired.
3. Run docker compose up -d postgres redis.
4. Run npm run prisma:generate, npm run prisma:deploy, then npm run seed.
5. Run npm run dev:api. Swagger is http://localhost:3001/docs.
6. Run npm run dev:web and visit http://localhost:3000. Register, link a game account under Profile, then create or join a challenge. After both players fund, open the match room.
7. Run npm run dev:admin for the moderator app at http://localhost:3002. An active MODERATOR or ADMIN account is required.

The API dev/start commands load the root .env. The example configuration enables 100-credit TEST grants; the application default remains disabled when ENABLE_TEST_CREDITS is absent. Confirmed matches settle atomically using a server-side fee (default 5%); disputed credits stay locked until moderator resolution or void refund. No real-money, withdrawal or player settlement endpoint exists. Evidence is stored privately under the ignored storage directory; see the evidence documentation for limits.

## Verification

Run npm run build, npm run lint, npm run test:unit, npm run test:integration and npm run test:e2e. Database tests require disposable local data and run serially. See docs/security.md before resetting infrastructure.

Frontend checks: npm --prefix apps/web test, npm --prefix apps/admin test and npm --prefix apps/web run test:e2e. The browser flow uses real local services; see [match experience and validation setup](docs/match-experience.md).

## Beta operations

Use npm run ops:ledger for read-only invariants and npm run test:lab for the isolated recovery/load drill. The admin /operations page requires ADMIN. See the [closed-beta runbook](docs/closed-beta-runbook.md), [threat model](docs/threat-model.md), [session controls](docs/session-security.md), [backup/recovery](docs/backup-recovery.md), [operations](docs/beta-operations.md) and [dependency review](docs/dependency-security.md).

## Documentation

- [Player match experience and moderator application](docs/match-experience.md)
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
