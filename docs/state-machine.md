# Challenge and match state machines (through Phase 5)

| Current state | Action | Required conditions | New state |
| --- | --- | --- | --- |
| None | Create | Active creator, enabled game, matching account, positive integer stake | OPEN |
| OPEN | Join | Active second user, not creator, compatible account, vacant slot | JOINED |
| JOINED | First funding | Participant, sufficient credits, unique operation | JOINED |
| JOINED | Second funding | Both participants funded | FUNDED |
| OPEN | Cancel | Creator, no locked funds | CANCELLED |
| JOINED | Cancel | Creator, no locked funds | CANCELLED |
| OPEN | Expire (internal) | No locked funds | EXPIRED |

All mutating actions use Serializable PostgreSQL transactions. Simultaneous joins cannot both take the final slot. Cancellation conflicts with funding and cannot leave a CANCELLED challenge holding a funded stake. Funding reuses LedgerService and changes participant status from JOINED to FUNDED in the same transaction as the ledger transfer.

Expiration remains an internal domain action with no scheduler or public status-editing route.

## Match lifecycle through Phase 5

| Match state | Action | Required conditions | New match / challenge / result states |
| --- | --- | --- | --- |
| None | Second challenge funding | Two funded participants | READY / FUNDED / no result |
| READY | First ready | Participant; readyAt not set | READY / FUNDED / no result |
| READY | Second ready | Both participants ready | IN_PROGRESS / IN_PROGRESS / no result |
| IN_PROGRESS | Submit score | Participant; valid non-draw scores; no prior result | RESULT_SUBMITTED / RESULT_SUBMITTED / PENDING |
| RESULT_SUBMITTED | Confirm | Non-submitting opponent only | CONFIRMED then SETTLED for all three, atomically |
| RESULT_SUBMITTED | Dispute | Non-submitting opponent; reason required | DISPUTED / DISPUTED / DISPUTED; Dispute REVIEW |

Ready and confirmed-settlement retries are idempotent. Duplicate submissions/disputes and moderator resolutions reject with 409. Confirmation and dispute are mutually exclusive decisions. Evidence is immutable immediately after upload; the submitter's uploads close at submission and all uploads close after either terminal decision. Uploads and decisions share the match's transaction serialization boundary.

| Disputed state | Moderator action | Final state |
| --- | --- | --- |
| DISPUTED; Dispute REVIEW (under review) | PLAYER_A_WINS / PLAYER_B_WINS | Dispute RESOLVED; result RESOLVED then result/match/challenge SETTLED atomically |
| DISPUTED; Dispute REVIEW | VOID_MATCH | Dispute RESOLVED; result RESOLVED then result/match/challenge REFUNDED atomically |

Disputes retain 20 locked credits until resolution. Settlement pays 19/1 with the default policy; void refunds 10/10. Intermediate CONFIRMED/RESOLVED states are inside the transaction and are not left committed on failure. No arbitrary status PATCH or player settlement route exists. Evidence remains closed after either decision.
