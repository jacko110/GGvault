# Ledger design

GGVault uses a test-credit ledger built with double-entry accounting.

## Account types

- USER_AVAILABLE: credits available to a user.
- MATCH_VAULT: funds locked for a challenge.
- PLATFORM_REVENUE: platform fee account.
- SYSTEM: system-controlled funding account.

## Transaction types

- INITIAL_CREDIT
- STAKE_LOCK
- STAKE_REFUND
- MATCH_SETTLEMENT
- PLATFORM_FEE
- ADMIN_ADJUSTMENT

## Double-entry accounting

Every LedgerTransaction includes one or more LedgerEntry records. For a valid transaction:

- each debit is matched by a credit of equal amount
- the sum of all debits equals the sum of all credits
- no balances are mutated directly

Example:

SYSTEM debit 100
Amir credit 100

This is the canonical way to allocate initial test credits.

## Balance calculation

Account balance is derived from the signed effect of its entries:

- CREDIT entries add to the balance
- DEBIT entries subtract from the balance

All reads for GET /users/:userId/balance, GET /users/:userId/ledger, and GET /challenges/:challengeId/vault compute balances from the actual ledger entries in PostgreSQL.

## Stake locking

The lockStake flow creates a LedgerTransaction with:

- user available: DEBIT amount
- challenge vault: CREDIT amount

The challenge player state is updated as part of the same transaction so the funding decision and ledger mutation succeed together or roll back together.

## Settlement

Settlement transfers the challenge vault to the winner and the configured platform fee. The matching LedgerTransaction is balanced and idempotent.

## Invariants

- sum of all signed ledger amounts equals 0 across the complete ledger
- each transaction is balanced
- repeated idempotency keys do not create a duplicate transaction
- settlement cannot be processed twice for the same match

## Phase 5 outcomes

The existing settleMatch primitive accepts the caller transaction, validates a verified outcome and updates result/match/challenge atomically. SettlementPolicy replaces the old fixed one-credit fee with configurable integer basis points and floor rounding. Zero-valued fee/prize entries are omitted. A partial unique index allows at most one MATCH_SETTLEMENT or STAKE_REFUND per match, supplementing (matchId, type). refundMatch reconstructs original stake ownership/amounts from STAKE_LOCK entries and creates one balanced transaction with two user credits. See [settlement.md](settlement.md) for exact invariants, history and retry behavior.
