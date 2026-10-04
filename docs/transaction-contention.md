# Phase 7.1 transaction contention

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

## Remaining gate

NO-GO for invited sessions at this synchronized load. Follow-up must profile individual SQL/SSI dependencies on the deployment-sized dataset, design safe admission or contention reduction, and rerun the same workload until exhaustion is acceptable. A paced success from Phase 7 does not override this failure.
