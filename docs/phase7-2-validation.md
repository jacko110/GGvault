# Phase 7.2 validation

Validated locally on 2026-10-04; Linux image and handover checks completed 2026-10-05 from approved parent `79485c074bdda4477575cd7e0f0cf9d2582a370e`. Scope is contention closure and provider-neutral deployment preparation only. No real-money or product-feature work. Final commit identity is recorded in `phase7-2-commit.txt`; this report is committed source.

## Decision

**NO-GO** for closed beta until the real deployment gates are verified. **LOCAL GATES PASSED — DEPLOYMENT VERIFICATION PENDING**. The three required local synchronized load gates passed. No deployment target, DNS names, credentials, VPN, certificates or alert channel was supplied or invented. Real-environment checks are **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**.

## Required load evidence

| Run | Independent lab ID | Flows / arrival | Requests | Failed flows | Unexpected HTTP errors | Duration |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Approved BEFORE | Phase 7.1 | 20 / 0 ms | 162 | 11 | 6.79% | 8.827 s |
| Final repetition 1 | `8fb4d4a786` | 20 / 0 ms | 220 | 0 | 0% | 9.063 s |
| Final repetition 2 | `8c33fc2be8` | 20 / 0 ms | 220 | 0 | 0% | 9.123 s |
| Final repetition 3 | `388b8faa8d` | 20 / 0 ms | 220 | 0 | 0% | 8.972 s |
| Optional observation, after all three passes | `4783b9dbf4` | 50 / 0 ms | 550 | 0 | 0% | 20.857 s |

Each final run had zero negative balances, zero unbalanced transactions, zero duplicate settlements, zero duplicate refunds, zero mixed settlement/refund outcomes, zero overfilled challenges and global conservation exactly 0. The invariant checker groups duplicate/mixed outcomes into a combined check: zero means no category had a violation. Each 20-flow report has 123 balanced transactions; the 50-flow report has 273. Financial race/recovery/Redis checks preceding each workload passed. Final operation attempts have zero P2034/P2028/retry exhaustion; no 409/429/5xx/network errors occurred in the measured acceptance workload. Expected business conflicts in the separate race fixtures are not mixed-load failures.

The flow was not paced or replaced. Complete flows make 11 requests; earlier failures stopped before later requests, explaining 162 BEFORE versus 220 AFTER. Funding/readiness remain concurrent. Three fresh databases use identical final code/configuration/fixture construction. All diagnostic failures and removed experiments are retained in [contention analysis](transaction-contention.md); [per-operation tables](phase7-2-contention-measurements.md) report every final repetition, the instrumented BEFORE and optional observation, including nested settlement and queue/body timing.

Admission uses a transaction-scoped PostgreSQL table lock before reads, with Serializable isolation and existing invariant checks retained. This broad small-beta tradeoff queues writers and increases latency. It is not proof of production capacity: the 50-flow funding p95 was 6.46 seconds. Accounting/fee arithmetic, schema uniqueness, idempotency, settlement/refund state rules and rate limits are unchanged.

## Regression evidence

| Check | Result |
| --- | --- |
| Backend unit, integration, authentication/authorization, security, evidence, moderation, ledger, retry and reset guards | **PASS — 228 tests, 17 suites** |
| Player component tests | **PASS — 24 tests**; includes same-key retry and committed funding/lost response recovery without a second POST |
| Admin component tests | **PASS — 7 tests**, including concurrent resolution with authoritative refresh |
| Real API-backed Chromium flows | **PASS — 6 tests**, player/admin BFFs, two-player funding, match/evidence/VOID, security/role changes; responsive views exercised by existing flow |
| Deployment-script safety tests | **PASS — 6 tests**, placeholders/defaults/roster cap, isolated restore guard and quoted configuration, encoded secret detection, loopback probe and unconfigured fail-closed behavior |
| Production application build | **PASS**, database/shared/ledger/match-engine/player/admin/API |
| Lint | **PASS**; Next 15 reports the existing `next lint` deprecation notice, no lint errors |
| Local Compose/nginx/TLS-fixture syntax | **PASS**, only gateway ports; internal networks; bootstrap secret absent from app services; shell syntax and nginx config valid |
| Local private service initialization | **PASS**, nonprivileged app DB role/schema migration privilege; forbidden role escalation denied; authenticated Redis; no published ports |
| Production Linux image | **PASS**, locked Linux production build and non-root runtime dependency/native-module check |

Total completed automated regression tests: **271**. The first backend run had 227 passing tests and one CLI subprocess blocked by Windows sandbox permissions. Rerunning that existing 12-test security suite with subprocess permission passed all 12; no assertion was weakened. Initial Next build and Node test-runner subprocess denials were likewise rerun with permission and passed. Docker access denial before the first gate was not a measured workload. Debian package-mirror downloads stalled during early image preparation and the first npm install failed with ECONNRESET. The standard Node Debian base plus cached npm downloads/reduced concurrency completed successfully; no insecure TLS bypass or dependency upgrade was used. The runtime check resolves API dependencies from its workspace, as the application does.

`npm test`, `npm --prefix apps/web test`, `npm --prefix apps/admin test`, `npm --prefix apps/web run test:e2e`, `node --test scripts/deployment-preparation.test.cjs`, `npm run build` and `npm run lint` are the validation entry points. Browser tests ran after backend database-mutating tests and seed. Load tests ran separately from build/regression activity.

## Clean local smoke and recovery

Fresh local smoke lab `764bb983d5`: Amir/Samuel start at 100 TEST each, both stake 10, secured vault 20. Amir's 4–2 result confirmed by Samuel yields Amir 109, Samuel 90, platform 1, vault 0. Second funded match includes evidence before dispute under the existing deadline; moderator VOID returns both original stakes, leaving Amir 109/Samuel 90/vault 0. Nine ledger transactions balanced; every invariant zero. No accounting rewrite or seed shortcut supplies those outcomes.

Every final acceptance lab also performed PostgreSQL custom-format backup/isolated restore with exact state hash equality and invariant checks, plus isolated Redis-loss/restart with financial state unchanged and restored service access. These are local drills. Target-host backups, restores and Redis drills remain blocked.

## Dependency recheck

Fresh explicit `https://registry.npmjs.org` audit, same lockfile and manifests: production **0 critical, 1 high, 3 moderate** (4 graph findings); full graph **0 critical, 47 high, 8 moderate, 3 low** (58). No dependency version or unrelated major upgrade was introduced. An initial sandbox registry response reported no findings; the authoritative network-enabled registry rerun above supersedes it. Audit JSON/logs stay local and are excluded from review.

The production findings remain PostCSS/Next and js-yaml/Swagger with the Phase 7.1 documented trigger/reachability limitations: trusted repository CSS processing during builds and no attacker YAML parsing. See [dependency classification](phase7-1-dependencies.md) and its linked upstream advisories. This is **PASS WITH LIMITATION**, not “vulnerability free.” Keep untrusted build input and Swagger out of public ingress and recheck before deployment.

## Acceptance categories

| Category | Status | Evidence or limitation |
| --- | --- | --- |
| Authentication | PASS | API/BFF tests, revoked sessions and real login/logout flows |
| Authorization | PASS | Current role/status checks, IDOR/moderation/operations tests |
| Dependencies | PASS WITH LIMITATION | Zero critical; one high/three moderate production graph findings with documented triggers |
| Ledger | PASS | All synchronized/race/smoke invariants; conservation 0 |
| Settlement | PASS | Exactly-once settlement/races and 109/90/1/0 smoke |
| Refund | PASS | VOID refunds, duplicate/mixed-outcome guards |
| Evidence | PASS | Validation/ownership/integrity tests and real browser evidence flow; target storage access still pending |
| Moderation | PASS | API/admin/browser validation, current authorization and concurrent resolution |
| Load | PASS | Three identical synchronized 20-flow runs each 0% errors; latency/capacity limits documented |
| Observability | PASS WITH LIMITATION | Safe retry metrics and local diagnostics; actual collector/scheduler not configured |
| Backup | PASS WITH LIMITATION | Local hash-verified restore; target-host drill blocked |
| Redis recovery | PASS WITH LIMITATION | Local sessions lost, financial state unchanged; target-host drill blocked |
| Alerts | FAIL | Synthetic payload/adapter contract prepared; real receipt UNVERIFIED |
| HTTPS | FAIL | Template/local syntax only; real DNS/certificate/HTTPS verification blocked |
| Ingress | FAIL | Private port configuration and fail-closed checker prepared; external verification blocked |
| Admin access | FAIL | VPN plus named gateway/application accounts prepared; actual VPN/MFA control unverified |
| Secrets | PASS WITH LIMITATION | No actual secret supplied/committed; file-reference preflight and bundle/log scan prepared; actual secrets/bootstrap roster unverified |
| Deployment smoke | FAIL | Local clean financial smoke passes; external target smoke blocked |

Every FAIL above requiring a real environment is **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**. No local fixture certificate, password, address or delivery test is represented as a deployed control.

## Review delivery

Implementation/validation completion and commit/archive delivery are tracked separately in [project progress](project-progress.md). Review delivery is complete: `GGvault-phase7-2-review.zip` contains 136 verified committed-source/review members, with matching hashes and excluded-path checks. `phase7-2.patch`, `phase7-2-stat.txt` and `phase7-2-commit.txt` match the completed phase commit and its approved parent. Separate UTF-8 copies of this report and `closed-beta-final-go-no-go.md` are provided, plus an extracted readable review folder. Runtime reports, secrets, backups, evidence, dependencies, build output, caches and Git internals are excluded. Final commit identity is in the generated commit report.
