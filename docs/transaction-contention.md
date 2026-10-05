# Transaction contention: Phase 7.1 baseline and Phase 7.2 closure

The Phase 7.1 sections below are retained as historical BEFORE evidence. The Phase 7.2 results at the end supersede the local load failure, but do not authorize deployment.

Measured locally on 2026-10-04 with PostgreSQL 16, Redis 7 and Node 24 on the same Windows host. The synchronized scenario remains 20 independent two-player flows with LOAD_ARRIVAL_MS=0, concurrent funding/readiness, then result/confirmation/history. Fixture setup is excluded. No isolation level or financial outcome constraint changed.

## Before and after

| Run | Requests | Failed flows / 20 | HTTP error rate | Seconds | Requests/sec |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase 7 original synchronized | 64 | 19 | 31.25% | See Phase 7 report | 41.54 |
| Phase 7 indexed synchronized | 92 | 18 | 25.00% | See Phase 7 report | 32.76 |
| Phase 7.1 instrumented unchanged baseline | 116 | 18 | 16.38% | 4.131 | 28.08 |
| Phase 7.1 intermediate backoff/runtime | 164 | 10 | 6.10% | 8.246 | 19.89 |
| Phase 7.1 final, with PostgreSQL sampling | 162 | 11 | 6.79% | 8.827 | 18.35 |

The final load still fails its threshold and exits nonzero. HTTP error percentage falls partly because more flows reach later requests; **11 failed flows is not beta readiness**. No 500/1000-user capacity claim is made. Final ledger: 103 balanced transactions, conservation 0, negative balances 0, duplicate/mixed outcomes 0 and overfilled challenges 0. Concurrent discovery: 100 requests, zero errors, 239.94 requests/sec, p50 353.29ms, p95 395.43ms, p99 397.22ms.

## Operation attribution

Attempt duration includes transaction acquisition/execution and excludes backoff. These are P2034 counts, not generic HTTP 409 counts. Confirmation includes atomic settlement; it remains one financial transaction.

| Operation | Before conflicts / exhaustion | Final conflicts / exhaustion | Final attempts | Max attempt ms | HTTP p50 / p95 / p99 ms |
| --- | ---: | ---: | ---: | ---: | --- |
| Create | 49 / 2 | 47 / 0 | 67 | 164.79 | 304.69 / 1329.82 / 1453.45 |
| Join | 43 / 1 | 26 / 0 | 46 | 186.98 | 159.71 / 587.97 / 666.47 |
| Funding | 149 / 13 | 194 / 9 | 225 | 247.46 | 1354.33 / 4266.36 / 4505.08 |
| Ready | 14 / 0 | 11 / 0 | 33 | 93.28 | 110.32 / 159.37 / 265.28 |
| Result submission | 2 / 0 | 0 / 0 | 11 | 78.87 | 44.36 / 102.57 / 102.57 |
| Confirmation + settlement | 26 / 3 | 41 / 2 | 50 | 117.77 | 126.91 / 4176.57 / 4176.57 |

Funding dominates final contention: 194 conflicts and 9 of 11 exhaustions. Confirmation/settlement accounts for the other two. The separate clean VOID/refund took one attempt, 145.43ms, zero conflicts and zero exhaustion; this is a single-flow measurement, not a refund-burst capacity claim. Competing settlement/refund and duplicate-refund races also passed.

## PostgreSQL evidence and limits

The final run sampled pg_locks/pg_stat_activity 80 times at roughly 100ms intervals, without query text or parameters. Observed SIReadLock entries on challenges (peak 13), challenge_players (9), ledger_accounts (8), ledger_entries (6), matches (9) and result/participant tables (5). At most one ungranted transaction ShareLock and one backend with Lock wait were sampled; sampled maximum transaction age was 125.08ms. Sampling can miss short waits. Attempt durations and retry counts show repeated conflicts rather than sustained multi-second row blocking.

Inference: funding reads balances and participant/challenge state while inserting postings and updating player/challenge state. The two players intentionally contend on their shared challenge/vault; independent flows also overlap predicate reads on small tables. Confirmation locks the match, reads result/vault/locks and posts to the singleton platform-revenue account. Ready touches the same match row to serialize opposing actions. Samples identify hot relations, not a proven tuple/query for every abort. Existing EXPLAIN ANALYZE shows sequential scans on tiny fixtures despite Phase 7 indexes, so SSI predicate overlap is plausible. No forced planner settings or unproven indexes were introduced.

PostgreSQL documents full-transaction retry and predicate locks under [Serializable isolation](https://www.postgresql.org/docs/16/transaction-iso.html), and [pg_locks diagnostics](https://www.postgresql.org/docs/16/monitoring-locks.html).

## Retry and transaction scope

The common helper retries only P2034, at most eight retries/nine attempts, with exponential 50ms base, 1000ms cap and independent half-to-full-window jitter. Previously it retried P2034/P2002 six times with a 250ms cap. Unique violations, validation, authorization, insufficient funds and business-state exceptions are not retried. Exhaustion returns the existing safe TRANSACTION_RETRY. Acquisition wait is bounded at 5000ms (previous default 2000ms); transaction timeout remains 15000ms. These are per-attempt bounds, not a whole-request SLA. A browser timeout may occur first; the funding key remains reusable.

LedgerService standalone transactions use the same helper instead of three immediate attempts; nested calls retain the supplied transaction. Standalone transaction timeout therefore changes from Prisma's default five seconds to the common helper's fifteen seconds. No arithmetic, fee calculation, posting, authorization, balance, idempotency or state check moved outside its transaction. **There are no transaction-scope reductions**: account upserts, participant checks and match locking were retained because moving them creates races. Observation records bounded labels/counts/durations outside the financial work.

The browser never automatically resubmits a financial mutation. TRANSACTION_RETRY displays a plain retry message and retains the existing idempotency key for manual retry. Permanent business errors retain their existing handling.

## Phase 7.1 remaining gate (historical)

NO-GO for invited sessions at this synchronized load. Follow-up must profile individual SQL/SSI dependencies on the deployment-sized dataset, design safe admission or contention reduction, and rerun the same workload until exhaustion is acceptable. A paced success from Phase 7 does not override this failure.

## Phase 7.2 measured experiments

The exact acceptance flow is preserved: 20 actors pairs, zero arrival spacing, discovery/create/join, concurrent A/B funding, concurrent A/B ready, result/confirmation, history/matches. Fixture construction, financial race checks and PostgreSQL/Redis recovery precede each run in a new isolated database. Failed flows previously stopped early; 220 requests is the complete unchanged 20-flow scenario, not extra traffic to dilute errors. No rate limits, deadlines, test assertions, accounting or isolation were relaxed.

| Experiment/run | Requests | Failed flows | Unexpected HTTP errors | Seconds | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Approved Phase 7.1 BEFORE | 162 | 11 | 6.79% | 8.827 | Failed |
| First diagnostic `701c49aee5` | Not reached | Not measured | Not measured | N/A | P1001/connection failure in setup/race checks; aborted, not an acceptance run |
| Instrumented BEFORE `7b816e9133` | 150 | 13 | 9.33% | 9.649 | Failed |
| Existing-account read before upsert `5193eed332` | 148 | 12 | 8.11% | 10.172 | Failed; change removed |
| Forced index-plan experiment `ed0fe8a7fd` | 164 | 10 | 6.10% | 8.472 | Failed; planner override removed |
| Admission experiment `1668fefdf6` | 220 | 0 | 0% | 21.064 | Promising; not one of final repetitions |
| Final repetition 1 `8fb4d4a786` | 220 | 0 | 0% | 9.063 | PASS |
| Final repetition 2 `8c33fc2be8` | 220 | 0 | 0% | 9.123 | PASS |
| Final repetition 3 `388b8faa8d` | 220 | 0 | 0% | 8.972 | PASS |
| Optional 50-flow `4783b9dbf4` | 550 | 0 | 0% | 20.857 | Observation after all three gates passed |

All completed mixed runs preserved conservation, nonnegative balances, balanced postings, unique settlement/refund outcomes and two-player capacity. The final three runs each contain 123 balanced ledger transactions; the 50-flow run contains 273. One sandbox-denied Docker invocation (`afc9f2c0c9`) never reached setup and was rerun with Docker access. It is not counted as a workload result. All failed performance experiments are listed; none was silently discarded in favor of a best run.

See [operation measurements](phase7-2-contention-measurements.md) for separate create, join, A/B funding, A/B ready, result, confirmation and nested settlement attempts/successes, P2034/P2028, other HTTP failures, retries/exhaustion and p50/p95/p99. Every final operation had zero P2034, P2028 or retry exhaustion. Settlement is part of confirmation's atomic transaction, not a separately committed HTTP action. Its body-return count does not alone prove commit; the confirmation response and persisted invariant checks do.

## Exact observed conflict surfaces and hot resources

The instrumented BEFORE had funding A 94 P2034/6 exhausted, funding B 114/6, confirmation 46/2, create 41/0, join 32/0, ready A 4/0, ready B 7/0, result 5/0. P2028 was zero. Query middleware measures elapsed time and error code without retaining parameters/SQL or account/user identifiers. Before admission, funding errors surfaced at account upsert (62 combined), ledger transaction creation (52), challenge lookup (24), participant operations and audit insertion (8). Confirmation errors surfaced at match update (17), match lookup (7), audit insertion (5), account upsert and other reads. The detailed table retains every measured surface. PostgreSQL can report an SSI abort at a later statement than the original dependency; these are exact error surfaces, **not proof that the reported row caused every conflict**.

| Candidate resource | Evidence and disposition |
| --- | --- |
| Shared PLATFORM account | Only settlement retrieves the singleton; it appends credits, not a mutable balance counter. Final three runs measured exactly 20 platform upserts each, total 122.58 / 113.65 / 118.65 ms, no errors. Before measurements did not separate account kind. This does not prove platform contention was absent before admission; it does not justify an accounting redesign. |
| Shared SYSTEM account | Initial-credit fixture setup uses it; no SYSTEM lookup occurred in the measured mixed workload. It is not an active mixed-load writer. |
| Match vault/user accounts | Funding's account upserts and ledger inserts had the largest observed error counts; both players intentionally share the vault/challenge. Existing-account lookup experiment did not meet the gate and was removed. |
| Challenge/participant/match rows | Independent create/join operations and opposing funding/ready updates aborted. Confirmation locks the match. Samples show predicate locks on these relations. State checks and locks remain atomic. |
| Ledger indexes/sequence | Baseline sampled SIReadLock on ledger primary/idempotency/match-type and entry indexes. IDs are CUIDs, not one application-maintained numeric ledger sequence. Forced index scans did not meet the gate. No uniqueness/index/accounting redesign. |
| Audit/analytics | Audit insertion sometimes surfaced an abort but no causal dominance was established. Audit records supply committed operations/funnel evidence; no external analytics call exists in the financial closure. Moving them would risk losing coherent audit evidence, so they remain atomic. |
| Other shared resources | Before: 87 PG samples, max observed open transaction age 269.25 ms, up to one waiting transaction ShareLock. Predicate overlap on small fixtures is consistent with the observed SSI aborts; samples do not reconstruct PostgreSQL's full dependency graph. |

## Admission and duration tradeoff

The common Serializable helper now first executes `LOCK TABLE ledger_transactions IN SHARE ROW EXCLUSIVE MODE`, before application reads. PostgreSQL serializes participating writers across API processes/instances; this is not a process-local mutex. The lock is self-exclusive, compatible with ordinary reads, and released on commit/rollback/disconnect. [PostgreSQL's LOCK documentation](https://www.postgresql.org/docs/16/sql-lock.html) requires acquisition before the first query under Serializable to avoid taking an earlier snapshot. No financial check moved outside the transaction. Standalone ledger calls use the helper; nested settlement continues to use the parent transaction without starting another transaction or admission cycle.

This deliberately broad admission includes other callers of the existing Serializable helper (including auth/session and evidence work). It avoids application lock-order inversions and keeps a single path; it limits mutation throughput and must be monitored. It is not a scalable accounting redesign. PostgreSQL maintenance/DDL and direct writes outside the helper still need operational coordination. Prisma acquisition remains bounded at 5 seconds and each transaction at 15 seconds; P2034 retries remain at most nine attempts with 50 ms exponential half-to-full jitter capped at 1 second. There is no whole-request SLA and P2028 is not automatically retried. Exhaustion remains safe, not a reason to weaken constraints.

Final PG sampling observed up to 11 queued ShareRowExclusiveLock requests on the ledger transaction table, as designed, and max sampled transaction ages 1219.79 / 1158.99 / 1232.74 ms. Each final run had 28 samples. Short waits can be missed. The new per-operation timings distinguish table admission wait from the existing transaction body; total attempt time also includes Prisma connection acquisition/commit overhead. In repetition 3, median work was about 20–104 ms across operations; median confirmation work 104.06 ms versus admission 661.27 ms. The delay is predominantly admission/acquisition, not a new external call inside the transaction. Existing closures contain database reads/writes and small synchronous checks/mapping/arithmetic; no network notification, file upload, sleep/backoff or HTTP response serialization was moved into them. Request logging runs after the request, and retry sleep follows rollback. No invariant-critical read was removed based on unproven redundancy.

The 50-flow observation passed but combined funding p95 reached 6463.81 ms; create p95 6417.93 ms and confirmation p95 4244.45 ms. Do not extrapolate capacity from this one local machine. Re-measure on the real target and database size before expansion.

## Retry visibility and recovery

`transaction_retry_total` and `transaction_retry_exhausted_total` expose fixed route/operation labels alongside existing metrics, with no user/match/challenge label. Detailed query/stage/timing arrays are bounded and enabled only in the explicit test lab; production ignores the lab-step header. Production diagnostics keep counters, not sample arrays/query parameters.

The backend's existing same-key funding recovery returns the existing posting/result; current concurrency tests retain duplicate funding and settlement/refund assertions. Browser uncertain funding keeps the same idempotency key, refreshes authoritative challenge/vault/balance before enabling manual retry and does not automatically issue another financial POST. Match and moderation errors refresh authoritative outcome first. Exhausted concurrency displays exactly: “GGVault was updated at the same time. Please try again.” New component coverage simulates a committed funding mutation whose response is lost and verifies the funded server state suppresses another POST.

**Local load gate: PASS. Overall deployment decision: NO-GO.** External deployment verification is **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**.
