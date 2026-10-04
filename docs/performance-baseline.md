# Performance baseline - 2026-10-03

Local Windows/Node/PostgreSQL 16/Redis 7 run against a fresh isolated database. Generator and API share one machine. This short run is a baseline, not a production capacity/SLA claim. Fixture registration/setup is excluded from timings. No financial isolation was relaxed.

## Final paced mixed workload

20 independent two-player flows, 500ms arrival spacing; 220 HTTP requests in 10.045 seconds, **21.90 requests/sec**, **0 failed flows and 0% unexpected HTTP errors**. Each flow performs discovery, create/join, concurrent funding, ready/result/confirm, history and My Matches.

| Operation | Requests | p50 ms | p95 ms | p99 ms | Error rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| GET /challenges | 20 | 17.32 | 29.06 | 29.8 | 0 |
| POST /challenges | 20 | 31.02 | 45.58 | 46.44 | 0 |
| POST /challenges/:id/join | 20 | 34.3 | 47.81 | 48.34 | 0 |
| POST /challenges/:id/fund | 40 | 81.5 | 178.64 | 192.97 | 0 |
| POST /matches/:id/ready | 40 | 42.36 | 103 | 108.63 | 0 |
| POST /matches/:id/result | 20 | 34.7 | 49.61 | 49.81 | 0 |
| POST /matches/:id/result/confirm | 20 | 97.89 | 108.06 | 117.7 | 0 |
| GET /users/me/transactions | 20 | 15.38 | 23.98 | 24.91 | 0 |
| GET /matches | 20 | 15.12 | 19.89 | 25.68 | 0 |

## Concurrent discovery

100 simultaneous discovery requests using the provisioned authenticated actor pool: **252.87 requests/sec**, p50 **339.10ms**, p95 **376.68ms**, p99 **380.72ms**, **0% errors**.

## Burst limitation

The initial synchronized 20-flow workload completed only 1/20 flows (64 requests, 31.25% HTTP error rate). After bounded retry backoff and targeted indexes, a repeated synchronized run completed 2/20 flows (92 requests, 25% HTTP error rate). PostgreSQL P2034 serializable conflicts were observed. Both runs preserved global/transaction conservation and nonnegative balances. Exhausted conflicts now return a safe retryable domain conflict instead of raw database errors.

The successful final workload uses explicit arrival spacing; it does **not** erase the failed burst results or prove 20 simultaneously mutating matches can complete without retries. Keep the invited beta small, monitor conflicts, avoid synchronized mass starts, and investigate contention before expanding. 500/1000 concurrent financial-user capacity was not measured. The harness supports configurable VUs, but configuration support is not a measured result.

## Correctness after load

123 transactions independently balanced; global conservation 0; no negative user/vault balances. Targeted final-slot, same-key funding, readiness, confirm/dispute, settlement/refund and duplicate-refund races also passed with zero overfilled challenges and zero duplicate/mixed financial outcomes.

## Query/index review

Added creator/status and creator/creation-time indexes for the new server-side beta count predicates; ledger account/time/id and transaction-ID indexes for wallet reads and entry lookup; entity/entityId/time for moderation audit history. No ledger schema semantics or arithmetic changed. EXPLAIN ANALYZE was executed for creator counts, history and discovery in the final lab. Tiny fixture sets may legitimately use sequential scans; no performance improvement is claimed solely from an index existing. Existing matchId/sequence and dispute createdAt/id indexes serve timeline/queue ordering. My Matches and aggregate audit/funnel scans remain acceptable only at the measured beta scale; revisit with realistic retained history.

creator: top node Aggregate; execution 0.041ms, planning 0.132ms.

history: top node Limit; execution 0.148ms, planning 0.862ms.

discovery: top node Limit; execution 0.061ms, planning 0.054ms.
