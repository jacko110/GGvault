# Phase 5 moderation API

All endpoints require a current active session and database role MODERATOR or ADMIN. USER receives 403; missing authentication receives 401. Role revocation applies immediately. The service rechecks current role/status within its transaction. No account/session secrets are returned.

| Endpoint | Purpose |
| --- | --- |
| GET /moderation/disputes | Filtered cursor queue |
| GET /moderation/disputes/:id | Dispute, safe match/challenge/participants/result, timeline, evidence metadata and relevant safe audit events; records review |
| POST /moderation/disputes/:id/resolve | PLAYER_A_WINS, PLAYER_B_WINS or VOID_MATCH with reason |

Queue filters: `status` (OPEN, REVIEW, RESOLVED, REJECTED), `gameId`, ISO `createdBefore` / `createdAfter` (exclusive), `cursor` (previous dispute ID) and `limit` (default 20, max 100). A reversed date range, unknown cursor or invalid value returns 400. Ordering is descending createdAt then ID, preserving cursor stability when timestamps tie. The response is `{items, nextCursor}`; each item includes dispute ID, match/challenge IDs, player A/B mapping, original proposed scores/winner, reason, safe evidence metadata and resolution fields. Follow nextCursor with the same filters.

Detail includes only audit events for that match; metadata is allowlisted to matchId, challengeId, disputeId and resolution. Staff read responses use private/no-store caching. Evidence bytes are obtained separately through the existing protected match evidence endpoint. Reviewing does not unlock funds or mutate evidence. A resolution can be submitted without a prior GET because authorization and state are validated independently; the reason is mandatory.

Swagger at `/docs` and `/docs-json` documents request/response DTOs. Unknown body fields, including winnerUserId, platformFee, payoutAmount, destinationAccount and status, are rejected. See [dispute-resolution.md](dispute-resolution.md) and [settlement.md](settlement.md) for financial invariants and retry behavior.
