# Local Phase 7 lab

Phase 7.1 adds operation-specific attempt/conflict/exhaustion counts and 100ms PostgreSQL lock/wait sampling (no query text, credentials or bind parameters). Use `LOAD_ARRIVAL_MS=0` and `LOAD_VUS=20` to reproduce the synchronized workload. `BETA_SMOKE_ONLY=true` instead runs Amir/Samuel registration, exact 109/90/1 settlement, private evidence, moderator VOID and invariant checks on a newly generated database. No existing database is reset. Evidence is uploaded before dispute under the existing deadline. Both switches are environment variables; output remains in ignored `.cache`.

Run from the repository root after `npm run build:api`, with local PostgreSQL/Redis Docker images available:

```
node load-tests/lab.cjs
```

The harness creates an isolated database and dedicated Redis container; it never accepts a remote load target. It performs real HTTP requests against the compiled NestJS application and uses the existing AuthService/ledger only to provision actors. No mocked network or financial bypass is used. It uses Node's built-in fetch as a lightweight load generator.

Environment knobs:

- `LOAD_VUS`: 1..1000 independent two-player flows, default 20.
- `LOAD_ARRIVAL_MS`: arrival spacing, default 500; 0 gives a synchronized burst.
- `LOAD_DISCOVERY_VUS`: 1..1000 concurrent discovery requests, default 100, reusing the provisioned authenticated actor pool.

Scenarios cover A discovery; B create/join; C concurrent funding; D ready/result/confirm; E a mixed lifecycle with history/My Matches reads. Separate targeted races cover final-slot join, repeated same-key funding, readiness, confirm/dispute, moderator settlement/refund and duplicate refunds. Afterward it checks transaction/global balance, nonnegative user/vault balances, no overfilled challenge and no mixed/duplicate financial outcome.

Examples in PowerShell: set `$env:LOAD_VUS='100'` or `$env:LOAD_DISCOVERY_VUS='500'` before running. A 1000-user run is optional and must fit local resources. Do not extrapolate capacity from a short local run. The API and generator share the machine; this is not a distributed steady-state benchmark. Reports record p50/p95/p99 in milliseconds, HTTP error rate, failed flows, requests/sec, VUs and arrival spacing. Fixture setup is excluded from the load timing. Expected 409 race outcomes are separately checked; unexpected load failures remain failures and set a nonzero exit code.

Reports, query plans, logs and the recovery archive are retained only under ignored `.cache/phase7-lab-*`. The generated disposable database is retained for inspection. Financial/test data, archives, logs and tokens are never included in the review ZIP. Measured findings and limitations belong in `docs/performance-baseline.md`.
