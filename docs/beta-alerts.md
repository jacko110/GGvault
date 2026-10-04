# Closed-beta operational alerts

Use the private authenticated /operations/metrics endpoint, readiness probes and safe JSON logs. No paid service is required: a private Prometheus collector plus a local scheduled invariant command/log rule processor is sufficient. Do not expose collector credentials or logs to players. Assign a named primary and backup operator before launch; test alert delivery through the operator's chosen channel. This document defines rules; it does not claim an external collector/channel is deployed.

| Signal | Initial beta threshold | Action |
| --- | --- | --- |
| Ledger invariant failure / negative balance | Any `ledger_invariants` with ok=false, negativeBalances>0, invalidTransactions>0 or nonzero conservation; CLI runs every minute and after moderator batches | CRITICAL: close ingress and stop writers; preserve evidence; no automatic ledger repair |
| Duplicate/mixed outcome | Any duplicate/mixed settlement/refund or uniqueness violation suggesting competing outcomes; run the invariant CLI and inspect the protected incident record | CRITICAL: stop beta and investigate before reopening |
| Retry exhaustion | `sum(increase(ggvault_transaction_exhausted_total[5m])) >= 3` | Pause invitations; inspect operation labels, contention and DB load; never blind-retry financial requests with new keys |
| API 5xx | At least 5 errors and >5% of HTTP requests in 5 minutes | Page operator; correlate request IDs and dependency health; stop ingress if persistent |
| Database unavailable | /health/ready fails for 30 seconds and DB probe fails | Stop writes/ingress; recover database; validate invariants before reopening |
| Redis unavailable | /health/ready fails for 30 seconds and Redis probe fails | Stop admission; fail closed for sessions/throttling; restore Redis connectivity and require login as needed |
| Evidence integrity | Any safe `service_error` with errorCode=EVIDENCE_INTEGRITY_ERROR | Freeze affected moderation decisions; preserve immutable evidence and investigate storage/backup integrity |
| Moderator authorization failures | >=3 HTTP 401/403 on /moderation route templates per minute | Check account status/role and gateway logs; block suspected abuse and revoke sessions if appropriate |
| Invariant job missing | No successful completion for 3 minutes | Treat financial monitoring as unavailable; stop new beta sessions until restored |

The HTTP metrics use bounded route templates, not raw paths or identities. Transaction attempts include successful and failed attempts; P2034 conflicts and final exhaustion are separate counters. HTTP metrics/counters reset with each process; use rate/increase with process labels. Database-backed product event totals are global and must not be summed across replicas.

Alert smoke: deliberately fail an isolated readiness dependency; use the existing corruption fixture against a disposable test database to verify nonzero invariant exit; send denied moderator requests from an ordinary test identity. Verify the operator receives notifications, acknowledges them, and records a recovery decision. Never inject financial corruption into an active beta database.
