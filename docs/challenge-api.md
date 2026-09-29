# Phase 3 challenge API

All challenge endpoints require `Authorization: Bearer <accessToken>`. Swagger UI is `/docs`; OpenAPI JSON is `/docs-json`. Amounts are positive integer TEST-credit units, at most 1,000,000,000 per stake. Two players and `1v1` are the only supported configuration.

| Endpoint | Behavior |
| --- | --- |
| POST /challenges | Body: gameId, stakeAmount, currency="TEST", platform, mode="1v1". Returns OPEN challenge with creator participant, no debit. |
| GET /challenges | Filters: status, gameId, platform, minimumStake, maximumStake. `limit` defaults to 20, max 100. `cursor` is the previous nextCursor. |
| GET /challenges/:id | Public challenge and safe participant information |
| POST /challenges/:id/join | Empty object. Adds authenticated second player and changes OPEN to JOINED. |
| POST /challenges/:id/cancel | Empty object. Creator cancels unfunded OPEN/JOINED challenge. |
| POST /challenges/:id/fund | Empty object plus Idempotency-Key. Locks authenticated participant's stake. |

Funding requires `Idempotency-Key`: 8–128 letters, digits, colons, underscores or hyphens. The server namespaces its digest by authenticated user and challenge. Retries with the same key succeed without another debit; another key after funding returns `CHALLENGE_ALREADY_FUNDED`. A key never establishes identity. Responses contain `challenge`, `player`, and integer `vaultBalance`.

Funding is allowed only after two players have joined. First funding leaves JOINED. Second funding moves to FUNDED. A creator cannot cancel once either stake is locked. Expiration has no public action endpoint in Phase 3.

Discovery is ordered by unique ascending challenge ID. Pass the returned nextCursor without changing filters to fetch the next page. `null` means the last page. Concurrent new challenges can appear on later pages; this is keyset pagination, not a frozen snapshot.

Complete local flow:

1. Start PostgreSQL and Redis, deploy migrations and run `npm run seed` to create enabled FC 26. Obtain its ID from `games` using Prisma Studio or the database. A game catalog API is outside Phase 3.
2. Set `ENABLE_TEST_CREDITS=true`, `INITIAL_TEST_CREDITS=100` and a random JWT secret; start the API with the root `.env` loaded.
3. Register Amir and Samuel with `/auth/register`, then log in with `/auth/login`. Each registration posts 100 credits through LedgerService.
4. PATCH `/users/me` for each profile. POST `/users/me/game-accounts` with the FC 26 ID, platform `PS5`, and a distinct gamertag.
5. Amir POSTs `/challenges` with stakeAmount 10, currency TEST, platform PS5 and mode 1v1.
6. Samuel GETs `/challenges?status=OPEN&platform=PS5` and POSTs the chosen `/join` action.
7. Amir POSTs `/fund` with a fresh key: own balance 90, vault 10, state JOINED.
8. Samuel POSTs `/fund` with a fresh key: own balance 90, vault 20, state FUNDED.
9. Signed global ledger entries sum to exactly zero. This scenario is verified in `phase3.e2e-spec.ts` against PostgreSQL and the real LedgerService.

Errors use `{statusCode, code, message}`. Notable codes: AUTH_INVALID_CREDENTIALS, AUTH_SESSION_EXPIRED, AUTH_SESSION_REVOKED, USER_EMAIL_EXISTS, USER_USERNAME_EXISTS, CHALLENGE_NOT_FOUND, CHALLENGE_NOT_OPEN, CHALLENGE_ALREADY_JOINED, CHALLENGE_FULL, CHALLENGE_SELF_JOIN, CHALLENGE_NOT_PARTICIPANT, CHALLENGE_ALREADY_FUNDED, CHALLENGE_HAS_LOCKED_FUNDS, CHALLENGE_INVALID_STATE, LEDGER_INSUFFICIENT_FUNDS. Validation returns 400; unauthorized access 401/403; missing challenges 404; conflicting domain actions 409.
