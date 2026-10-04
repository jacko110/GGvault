# Phase 7 validation

Work started 2026-10-03 from approved Phase 6B commit `eda752da46ce76b0c8cd2293f2636724687e6ecc`; final validation continued 2026-10-04. Implementation and validation are complete: **242 tests passed**, with builds/lint and operational drills passing. Commit/archive delivery is complete; final identity is recorded in phase7-commit.txt.

## Scope

Shared Redis mutation throttling, server-side beta caps, safe request logs/IDs/errors, protected Prometheus metrics and funnel, dependency readiness, admin operations, bounded BFF JSON and nonce security headers, evidence filename hardening, audit-review deduplication, a consistent-snapshot ledger verifier, backup/restore tools, and a local isolated recovery/concurrency/load lab. Next.js 15.5.27 replaces 14.2.15; async request APIs were migrated. Targeted indexes and retry backoff preserve serializable accounting. No ledger arithmetic, financial outcome rules, payment integration or product redesign was introduced.

## Executed checks

| Check | Evidence |
| --- | --- |
| Prisma validation | Passed; five-migration schema valid |
| Migration/seed | New index migration deployed and seed executed; isolated recovery lab applied all five migrations to a new database |
| Workspace build | Passed: all shared packages, both Next.js frontends and NestJS API; API rebuilt after final error/log changes |
| Lint | Passed for API/player/admin; Next 15 emits a CLI deprecation notice for next lint |
| Player components | 2 suites, 21 tests passed |
| Admin components | 1 suite, 7 tests passed |
| Backend | Final complete run: 14 suites, 208 tests passed; no failures |
| Chromium | Final seeded run: 6 real API-backed scenarios passed, including admin operations and role demotion |
| Recovery | Passed with exact restored state hash and 13 independently balanced transactions; global conservation 0, negative balances 0 |
| Redis loss | Dedicated container destroyed/recreated; ephemeral key lost and PostgreSQL financial/state hash unchanged |
| Targeted concurrency | Passed; 23 balanced transactions, no overfilled challenge, no duplicate/mixed financial outcomes |
| Paced mixed load | 20 two-player flows, 220 requests, 0 errors, 0 failed flows, 21.90 requests/sec |
| Discovery load | 100 simultaneous requests, 0 errors, 252.87 requests/sec |
| Final development ledger CLI | Passed after browser scenarios: 20 independently balanced transactions, global conservation 0, negative balances 0 |
| Script/config checks | All four operational JavaScript scripts passed syntax checks; Compose configuration valid; Git diff whitespace check passed |
| Source hygiene | 220 tracked/candidate paths inspected; recursive artifact/secret exclusions verified; no private-key/token patterns found |
| Post-load ledger | 123 independently balanced transactions; global conservation 0, negative balances 0 |

Recovery source/restore state hash: `5216c57cf94c9b0b0f3a959b448150372c2d96c8cb5221b6901de60b31d0dc1f`. This compares users' IDs, account/entry/transaction rows, challenges, matches, results and disputes; identical postings imply identical available/vault balances. The disposable lab ran standard pg_dump/pg_restore through the PostgreSQL container. Standalone backup/restore wrappers require PostgreSQL tools on PATH and are documented separately. No development database was destroyed by the lab.

## Regression coverage

Prior authentication, scoped funding idempotency, double-spending, match state, evidence access/integrity, settlement, refund, race and conservation tests are retained. New security tests cover unrelated actors, profile/financial mass assignment, suspended/banned users, admin-only operations, role boundaries, correlated safe errors, shared mutation limits, concurrent beta caps, invalid configuration, filename traversal/HTML/long names, safe Unicode, storage key validation and structured log allowlisting. The operational corruption fixture tests independent transaction balancing even when opposite errors leave global conservation at zero, without repairing data.

Real browser checks cover previous register/login/challenge/vault/match/moderation flows, concurrent refresh, private media, exact outcomes, logout, origin rejection, CSP/security headers, chunked oversized JSON and admin operations/demotion. Only isolated components use mocked network. Responsive assertions cover 390/768/1440px in the existing acceptance flows, plus the mobile operations view. Chromium only; no formal accessibility audit or independent penetration test is claimed.

## Corrections and limits

An initial focused Jest command omitted the environment bootstrap and failed before tests could run; the project runner corrected this. A new security test initially used a nonexistent profile URL and was corrected to the real contract. A broad 5xx sanitizer initially hid EVIDENCE_INTEGRITY_ERROR; its safe public code is preserved while internal messages remain hidden. Browser filtering now waits for the actual filtered response before clicking a remounted card. Existing assertions were retained. A subsequent browser run lacked the game catalog after backend tests cleared fixtures; reseeding restored the documented prerequisite and all six scenarios passed.

The successful paced load is not a successful simultaneous mutation burst: initial synchronized 20-flow attempts suffered serializable conflicts (31.25% and 25% HTTP error rates), while preserving financial invariants. See [performance baseline](performance-baseline.md) for exact latency distributions and limitations. No 500/1000-user financial capacity or production RPO/RTO is claimed.

The final dependency audit reports zero critical but remaining high/moderate/low findings, including runtime dependencies. See [dependency review](dependency-security.md) for versions, advisory links and deferred candidates. Do not interpret this handover as approval for unrestricted internet exposure; deployment still requires controlled ingress, operator review of residual runtime risk and the [runbook](closed-beta-runbook.md) launch gate. No real money or Phase 8 work was started.

## Review delivery

Delivered: `phase7.patch`, `phase7-stat.txt`, `phase7-commit.txt` and verified `GGvault-phase7-review.zip`. All 124 archive members match committed source/report hashes; the parent is approved Phase 6B `eda752d`. Backups, evidence, logs, screenshots/traces, dependencies, secrets and build artifacts are excluded.
