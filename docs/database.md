# Database model

GGVault v0.1 uses PostgreSQL as the system of record and Prisma as the schema and client layer. The database is designed around a double-entry ledger rather than stored wallet balances.

## Core entities

- User: platform identity for players.
- Session: expiring and revocable refresh-token digest associated with a user.
- Profile: optional profile metadata for a user.
- Game: supported title such as FC 26.
- GameAccount: user-specific external game account linkage.
- Challenge: competitive challenge definition.
- ChallengePlayer: join and funding state for a player in a challenge.
- Match: scheduled or active game instance inside a challenge.
- MatchResult: winner, score, and settlement state for a match.
- LedgerAccount: an accounting bucket with an account type, not a mutable balance field.
- LedgerTransaction: a financial event that records a balanced set of entries.
- LedgerEntry: a debit or credit against a single accounting account.
- Evidence / Dispute / AuditLog: operational and review metadata.

## Financial invariants

- No account stores a cached balance.
- A balance is always derived from the ledger entries for that account.
- Each transaction must be balanced: the sum of debits equals the sum of credits.
- Global conservation is required: across all accounts, the sum of all signed ledger amounts equals zero when system funding is included.

## PostgreSQL transaction boundaries

All ledger writes happen inside Prisma transactions. Reads that depend on current balances are done within the same transaction to avoid stale state between validation and mutation.

## Concurrency strategy

The service uses PostgreSQL Serializable isolation for ledger mutations and Phase 3 domain actions. PostgreSQL detects incompatible read/write dependencies and the application retries serialization conflicts. Registration and funding can pass their transaction into LedgerService so identity, challenge state, audit records and credits commit together. No process-local mutex is relied upon.

## Idempotency

Every ledger transaction uses a database-unique idempotency key. Retrying a legitimate operation with the same key returns the original transaction instead of creating another debit/credit pair.
