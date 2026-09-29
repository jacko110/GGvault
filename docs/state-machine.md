# Phase 3 challenge state machine

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

Expiration is an internal domain action; Phase 3 provides no expiration scheduler or public status editing route. Existing later-phase enum values remain for compatibility with Phase 2 ledger internals but are unreachable through this API. No match start, results, disputes, or public settlement is implemented.
