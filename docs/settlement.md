# Phase 5 secure TEST credit settlement

Credits are non-withdrawable and have no real-money payment integration. A confirmed score calls the existing `LedgerService.settleMatch()` inside the confirmation's Serializable transaction. Confirmation, entries, final domain states and audit events either all commit or all roll back. Players cannot supply a winner, fee, payout or account. There is no `POST /matches/:id/settle`.

## Fee policy

`SettlementPolicy` reads `PLATFORM_FEE_BPS`, default 500 (5%). Startup rejects noninteger values outside 0..10000. It uses BigInt integer arithmetic: `fee = floor(vault * basisPoints / 10000)`; `winner = vault - fee`. A 20-credit vault pays 19 to the winner and 1 to the platform. A 19-credit vault pays 19 and 0. Zero-value entries are omitted. Values must fit a positive PostgreSQL integer. The result records the actual vault, payout, fee, policy rate and settlement timestamp, so later configuration changes cannot alter a historical response.

## Atomicity and retries

All financial outcome operations touch the same match row. Serializable conflicts retry the whole transaction. Existing `(matchId, type)` uniqueness guarantees at most one MATCH_SETTLEMENT; a new partial unique index across MATCH_SETTLEMENT and STAKE_REFUND ensures at most one financial outcome of either kind. Match.challengeId uniqueness also prevents separate matches refunding the same challenge. No balances are directly updated.

Only CONFIRMED results without a dispute or RESOLVED winner decisions can pay out. The requested internal winner must match the persisted verified result and a funded challenge participant. Disputed, pending, voided and refunded outcomes cannot settle. A repeated internal operation returns the existing ledger transaction; a contradictory winner is rejected. Concurrent HTTP confirmation retries by the original opponent return the same safe SETTLED outcome. Existing Phase 4 CONFIRMED matches can settle when that opponent repeats confirmation or when an internal worker calls the guarded primitive; no worker/scheduler is added in this phase.

Successful settlement sets MatchResult, Match and Challenge to SETTLED. A dispute remains RESOLVED, with its actor/reason/time preserved. Events include RESULT_CONFIRMED, SETTLEMENT_STARTED and MATCH_SETTLED. Audit metadata carries match/challenge and dispute/resolution identifiers where applicable, never tokens.

## Safe output and history

The match room and confirmation/resolution responses include `settlement`: matchId, status, winner `{id, username}`, original vaultAmount, winnerAmount and platformFee. A void has status REFUNDED, null winner and zero prize/fee. The room retains submitted score fields and their submitting user; a moderator may override the proposed winner without rewriting submitted evidence or scores.

`GET /users/me/transactions` returns only the authenticated user's available-credit movements: INITIAL_CREDIT +100, STAKE_LOCK -10, MATCH_WIN +19 or STAKE_REFUND +10. Each has timestamp, type, signed amount, description and challenge/match references where known. It exposes no ledger account IDs, counterparty entries or entire transaction structure. Pagination uses `limit` (default 20, max 100) and an owned entry `cursor`, ordered by timestamp then ID descending. Existing historical stake entries have challengeId but no matchId; outcome entries include both.

## Void refunds

`LedgerService.refundMatch()` accepts only a persisted resolved VOID_MATCH. It derives each stake from the original STAKE_LOCK debit and vault credit, validates two original owners and total vault conservation, and creates one balanced STAKE_REFUND transaction containing the vault debit and both user credits. It never reads client amounts or recalculates refunds from a mutable challenge entry fee. For two 10-credit stakes: both users return to 100, vault 0, platform 0. Result/match/challenge become REFUNDED atomically. Internal retries recognize the existing refund; conflicting resolution HTTP retries return 409 and cannot change it.

No payment processor, deposits, withdrawals, arbitrary ledger editing or real money is introduced.
