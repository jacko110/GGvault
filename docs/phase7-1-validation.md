# Phase 7.1 validation

Started 2026-10-04 from approved Phase 7 `7b56476`. Dependency migration and hardening were developed on isolated branch `phase7-1-deployment-gate`; integration requires all regressions to pass. No product features, financial arithmetic changes, new payments or weaker isolation were introduced.

## Executed checks

| Check | Result |
| --- | --- |
| Prisma validate | Passed |
| Migrations | Passed; existing five migrations apply; no schema change required |
| Seed | Passed before final browser scenarios |
| Full workspace production build | Passed: shared packages, player/admin Next.js and NestJS11 API |
| Lint | Passed for API/player/admin; Next lint deprecation notice only |
| Backend | 16 suites, 224 tests passed, zero failures |
| Player components | 2 suites, 22 tests passed |
| Admin components | 1 suite, 7 tests passed |
| Real Chromium browser scenarios |6 passed, including 390/768/1440px checks, exact financial outcomes and admin eight-hour cookie lifetime; total 259 passing regression tests |
| Dependency audit | Executed:58 findings,47 high/8 moderate/3 low/0 critical. Production-only4:1 high/3 moderate, classified B (unreachable advisory triggers in current application). See full reachability review |
| Synchronized20-flow load | FAILED reliability threshold:162 requests,11 failed flows,6.79% HTTP errors. Financial invariants passed; full before/after evidence in contention report |
|100 concurrent discovery reads | Passed:100 requests,0 errors,239.94 requests/sec |
| Real backup/restore | Passed: exact state hash preserved;13 balanced transactions |
| Redis loss | Passed: dedicated Redis destroyed/recreated; PostgreSQL financial state unchanged |
| Competing outcome/concurrency checks | Passed:23 balanced transactions; no overfill or duplicate/mixed outcome |
| Post-load invariant CLI implementation | Passed:103 balanced transactions; conservation0, negative0, invalid0, duplicate/mixed0, overfilled0 |
| Clean financial smoke | Passed on a newly generated database and dedicated Redis:100/100 initial, vault20, confirmed4–2 gives109/90/platform1/vault0; private evidence and moderator VOID refund both stakes;9 balanced transactions and all violation counts0 |
| Final standalone ledger CLI | Passed after browser run:15 balanced transactions, conservation0 and all violation counts0 |
| TEST reset guard |8 unit cases passed, including production, missing acknowledgement, future money mode/schema and remote-target rejection |

Final recovery state hash: `2710b7eb1528128aca6b09d09f320cf36d1b3059c72929b87be92ad9ac6037d5`. Local raw evidence is retained in ignored `.cache/phase7-lab-d1472387c1` (load/recovery/diagnostics), `.cache/phase7-lab-26a4feb1bf` (clean smoke), `.cache/phase7-lab-2b8f71c073` (unchanged baseline), and `.cache/phase7-lab-c081599bf6` (intermediate retry experiment). These contain data/logs and are intentionally excluded from review delivery.

## Corrections during validation

The initial Nest migration retained a hoisted Nest10 common peer used by JWT and failed TypeScript compilation. Pinning the shared common peer to11.2.7 fixed the graph without force/legacy-peer flags. The first full regression had214 passing/two auth-race failures caused by P2028 transaction-start timeouts, plus a retry-test TypeScript error before that suite ran. The acquisition wait was increased from default2000 ms to bounded5000 ms, test typing corrected, and the63-test auth/retry recheck passed. The final complete backend run then passed all 224 tests. No domain assertion was weakened.

Operational wrapper limitations: native backup/restore and TEST replacement reset require PostgreSQL CLI tools on PATH. The real recovery lab executes PostgreSQL tools inside the local container. Reset safety guards executed, but the standalone native reset wrapper has not been run on this host; it never deletes the old database. No remote ingress, gateway MFA, certificate, notification channel or external-host backup schedule has been deployed or verified here. Chromium checks are not an independent penetration test or full accessibility audit.

## Outcome and review delivery

The [go/no-go report](closed-beta-go-no-go.md) recommends **NO-GO**, despite completed hardening and passing local correctness checks: synchronized-load reliability and actual deployment gates remain open. See [dependency classification](phase7-1-dependencies.md), [upload mapping](upload-advisories.md), [contention evidence](transaction-contention.md), [deployment](beta-deployment.md), [alerts](beta-alerts.md) and [reset procedure](beta-reset.md).

Source hygiene passed:232 tracked/candidate files inspected, recursive exclusions verified, no forbidden artifacts or private-key/token patterns found, and Phase7 parent verified. Commit and source-only `GGvault-phase7-1-review.zip` delivery are complete:112 members verified against committed source/report bytes; excluded files absent. Final commit identity is in phase7-1-commit.txt; parent is Phase7 `7b56476`. Delivered reports: `phase7-1.patch`, `phase7-1-stat.txt`, `phase7-1-commit.txt`. Stop after Phase 7.1.
