# GGVault Architecture Notes

## Overview

GGVault is a competitive gaming challenge platform using non-withdrawable TEST credits. The approved Phase 5 backend handles secure settlement and dispute resolution. Phase 6A provides the authenticated foundation; Phase 6B connects player matches, evidence, outcomes and a separate moderator app. Real payments remain out of scope.

## Components

- API: NestJS service layer for routes, health checks, and challenge operations
- Web app: Next.js authenticated shell, challenges, match rooms, private evidence, outcomes, profile and wallet; server-only adapter keeps credentials out of the browser
- Admin app: Next.js moderator queue, private evidence review and final decisions; separate session cookie/Redis namespace with live backend role checks
- Database: PostgreSQL via Prisma for persistence
- Redis: shared authentication rate-limit counters and private web sessions/refresh locks in separate key namespaces
- Shared packages: reusable cross-app types and helpers
- LedgerService: PostgreSQL-backed test-credit accounting; shared ledger package supplies accounting helpers
- Match engine package: match ordering and candidate scoring primitives

## Why this design

1. Modular packages reduce coupling between business logic and app entrypoints.
2. Prisma centralizes database schema and data access for PostgreSQL.
3. Redis provides a lightweight cache layer without adding settlement complexity.
4. The ledger package intentionally models test credits rather than wallet transfers or withdrawals.
5. Match-engine logic remains separate until settlement and payout rules are introduced.

## v0.1 constraints

- No real-money or withdrawal flows
- No cryptocurrency support
- No TikTok integration
- No public match settlement endpoint (Phase 2 ledger internals remain)

These constraints keep the first version focused on the challenge platform foundation and health of the application stack.
