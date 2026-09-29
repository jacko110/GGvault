# Phase 3 security and validation

Passwords are Argon2id hashes; refresh tokens are hashed random secrets. JWT secrets are mandatory configuration. Passwords, hashes and tokens are excluded from audit events and user responses. Framework validation suppresses target objects and submitted values in exceptions. Unhandled errors return a generic 500 without Prisma errors or stack traces.

Every body/query DTO uses class-validator with global whitelist, forbidNonWhitelisted and transform. Resource IDs use the existing 25-character CUID format. Platform values are PC, PS5, PS4, XBOX_SERIES, XBOX_ONE, SWITCH or MOBILE. Only TEST currency and 1v1 mode are allowed. Avatar URLs must use HTTPS; the server stores these URLs and never fetches them.

Database uniqueness protects email, username, refresh token hashes, user/game/platform accounts, game/platform/gamertag claims, and challenge participants. Serializable transactions retry conflicts. Join, cancel and fund read/write shared challenge/participant state inside transactions. Funding passes the transaction into the existing LedgerService, preserving its accounting logic; registration does the same for initial credits. Failed actions roll back ledger entries, participant state and audit events together.

The existing ledger has only one small integration extension: optional caller-owned transactions for createInitialCredit and lockStake. Standalone Phase 2 behavior and settlement internals remain intact. There is no public settlement API.

AuditLog records USER_REGISTERED, LOGIN_SUCCEEDED, LOGIN_FAILED, SESSION_REFRESHED, LOGOUT, PROFILE_UPDATED, CHALLENGE_CREATED, CHALLENGE_JOINED, CHALLENGE_CANCELLED and CHALLENGE_FUNDED. `userId` is the actor, `entity` is entityType, `entityId` identifies the record, and `createdAt` is the timestamp. Audit records are not exposed through public endpoints.

Run validation against disposable local infrastructure. Tests truncate application data and clear auth-rate Redis keys. Never point tests at production or shared data.

```sh
docker compose down -v
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:deploy
npm run seed
npm run build
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
```

The root test commands load `.env` and supply a test-only JWT secret if one is absent. They do not disable tests, mock the database, or mock the ledger. Node 22.9+ is required by the environment-loading scripts. Test categories run serially to avoid concurrent database truncation.

Deployment needs a TLS terminator, deliberately configured proxy trust, secrets management, Redis/PostgreSQL isolation and audit retention policy. Email verification, password reset, refresh-session management UI and automatic challenge expiration are future workflows, not Phase 3 public endpoints. There are no real payments, withdrawals, match results, disputes, tournaments or external game integrations.

## Dependency audit limitation

The September 29, 2026 full-workspace audit flagged existing Next.js 14.2.15 and NestJS/tooling dependencies. In particular Next.js has critical advisories, including GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4. Passing Phase 3 tests does not make these versions suitable for public deployment. A separate framework dependency upgrade is still required. Phase 3 upgrades the directly used class-validator from 0.13 to 0.15.1, removing its GHSA-fj58-h2fr-3pp2 advisory; no force-upgrade of the application frameworks was performed.
