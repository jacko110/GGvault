# Security and validation through Phase 7

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

The root test commands load `.env` and supply a test-only JWT secret if one is absent. They do not disable tests or mock the database. Financial assertions use the real ledger; rollback tests inject a failure only after the real primitive has written inside its transaction. Node 22.9+ is required by the environment-loading scripts. Test categories run serially to avoid concurrent database truncation.

Deployment needs a TLS terminator, deliberately configured proxy trust, secrets management, Redis/PostgreSQL isolation and audit retention policy. Email verification, password reset, refresh-session management UI and automatic challenge expiration remain future workflows. Phase 5 adds automatic verified test-credit settlement and moderator resolution, but no real payments, withdrawals, player settlement endpoint, tournaments or external game integrations.

## Phase 4 match and evidence boundaries

Match rooms, timelines and evidence reads are private to participants and active moderators/admins. Match actions and evidence upload require actual participation; staff roles do not confer impersonation rights. Scores derive the proposed winner on the server. The submitting player cannot confirm or dispute their own result. A unique match-per-challenge index, unique result-per-match index, unique dispute-per-result index and Serializable retries protect concurrent actions.

All match mutations touch the same match row. Confirmation/dispute races produce one winner, and evidence cannot commit after a terminal decision. Every upload records a safe timeline event and a private audit entry atomically with metadata. Phase 5 confirmation settles atomically through LedgerService; disputes retain the vault until moderator resolution. Tests verify exact financial outcomes and global conservation.

Uploaded files are size-bounded, checked against MIME/extension/content markers, and stored outside public assets under random server IDs. PostgreSQL holds metadata and SHA-256 only. Download checks authorization, match ownership and integrity before serving an attachment with no-sniff/no-store headers. A database trigger prevents changes or deletion of committed evidence. There is no evidence update/delete API. See [evidence.md](evidence.md) for memory bounds, configuration, orphan reconciliation and the limits of header validation.

## Dependency audit limitation

The September 29, 2026 full-workspace audit flagged existing Next.js 14.2.15 and NestJS/tooling dependencies. In particular Next.js has critical advisories, including GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4. Passing Phase 3 tests does not make these versions suitable for public deployment. A separate framework dependency upgrade is still required. Phase 3 upgrades the directly used class-validator from 0.13 to 0.15.1, removing its GHSA-fj58-h2fr-3pp2 advisory; no force-upgrade of the application frameworks was performed.

## Phase 5 settlement and moderation

Phase 5 supersedes the prior no-settlement boundary. Confirmation, moderator resolution and posting run in Serializable transactions, with same-match writes and database uniqueness across settlement/refund outcomes. Clients cannot supply monetary amounts or winner accounts. SettlementPolicy validates startup configuration. MODERATOR/ADMIN permissions are rechecked; participants cannot adjudicate their own match. Raw ledger editing is not exposed. Safe audit fields and private/no-store moderation responses avoid unrelated private data. Evidence remains protected and immutable. Existing dependency advisory and deployment limitations above remain open. See [settlement.md](settlement.md) and [moderation.md](moderation.md).

## Phase 6A browser boundary

The public web app uses an opaque HttpOnly, SameSite=Lax session cookie; backend access/refresh tokens remain in private server-side Redis. Production cookies require HTTPS by default. Mutations require an exact Origin and JSON content type. The server proxy allowlists Phase 6A routes, strips internal vault account IDs and returns safe error messages. See [frontend security and deployment details](frontend.md#authentication-and-browser-api-boundary). Backend authorization remains authoritative, including ownership and participant checks. No ledger accounting or real-payment behavior changed.
## Phase 6B match and moderator frontends

Admin uses a separate opaque HttpOnly session cookie and Redis namespace. Login checks the active backend role; layouts, proxy requests and evidence reads recheck moderation access. Player BFF allowlists never include moderation. JSON decisions and multipart player evidence uploads validate their exact application origin. Evidence responses stay private/no-store with restricted MIME and no-sniff headers; storage paths are not exposed. Read-only match/refund projections enforce ownership or participant/staff access and expose no raw ledger entries. Existing backend readiness, evidence locking, result authorization, moderator conflict checks and settlement accounting remain unchanged. See [match experience](match-experience.md) for the evidence-before-dispute constraint and deployment setup.

## Phase 7 operational security

See [threat model](threat-model.md), [session/CSRF controls](session-security.md), [dependency review](dependency-security.md), [evidence operations](evidence-operations.md) and [closed-beta runbook](closed-beta-runbook.md). Shared actor/action mutation limits, server beta caps, nonce script CSP, bounded BFF JSON, safe correlated errors and structured logs supplement existing domain controls. Existing financial mutation implementations and ledger arithmetic are retained. The common serializable wrapper uses bounded jittered retries and a safe conflict error on exhaustion; it never lowers isolation. Header/media checks are not malware scanning. Repeated moderator reads record only the first review by that actor for that match.

The dependency review supersedes historical audit notes above. Phase 7 is not an independent security certification; unresolved runtime advisories and load limitations must be considered before hosting.
