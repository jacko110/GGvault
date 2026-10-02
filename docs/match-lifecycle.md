# Match lifecycle through Phase 5

The lifecycle starts at a funded two-player challenge and ends in SETTLED or REFUNDED. Disputed credits remain locked until moderator resolution. All endpoints require a live authenticated session.

## Creation and readiness

The second successful challenge funding action creates the match in the **same Serializable transaction** as funding. A unique database index on `matches.challengeId` enforces one match per challenge, including retries and concurrent funding. Challenge responses include `matches: [{ id, status }]` so participants can find their room. Migration also provisions missing READY matches for existing correctly funded two-player challenges and snapshots participants for existing matches. Ambiguous historical duplicate matches/disputes cause migration failure instead of silent data deletion.

The match initially has status READY. Each `MatchParticipant` stores its own `readyAt`. POST `/matches/:id/ready` with `{}` marks the authenticated player ready. The first player leaves the match READY. When both are ready, the match and challenge become IN_PROGRESS and `Match.startedAt` is recorded. Retrying readiness preserves the timestamps and does not add another event.

## Private room and timeline

GET `/matches/:id` returns match state, participant names and readiness, challenge/game/platform/stake, vault balance, result/dispute state and safe settlement details (winner, prize and platform fee). Submitted scores remain attributed to their submitter. Access is limited to participants and active MODERATOR/ADMIN accounts. Staff read access grants no permission to ready, submit, decide or upload for another player. Passwords, emails, sessions, risk fields and audit records are excluded.

GET `/matches/:id/timeline` has the same read policy and returns safe events ordered by database sequence. Events are MATCH_CREATED, PLAYER_READY, MATCH_STARTED, RESULT_SUBMITTED, RESULT_CONFIRMED, RESULT_DISPUTED, EVIDENCE_UPLOADED, DISPUTE_OPENED, DISPUTE_REVIEWED, DISPUTE_RESOLVED, SETTLEMENT_STARTED, MATCH_SETTLED and MATCH_REFUNDED. Sequence values are monotonic but can have gaps after transaction rollbacks. All mutation paths touch the match row, so same-match events cannot be reordered by competing commits. Audit records are separate from the room timeline.

## Concurrency and finance

Database uniqueness and Serializable retry protect match creation, readiness, result submission and decisions. Each match mutation writes the shared match row before changing related state. This serializes upload/decision races as well as confirmation/dispute races.

MatchesService calls the existing LedgerService settlement primitive inside confirmation. Moderator resolution calls settlement or refund inside its transaction. With default fees, confirmation pays a 20-credit vault as 19 to the winner and 1 to the platform. Disputes retain the vault until resolution; a void returns the original stakes. EvidenceService performs no financial operations. See [settlement.md](settlement.md).

Swagger UI is `/docs` and OpenAPI JSON is `/docs-json`. See [result verification](result-verification.md) and [evidence](evidence.md) for request details.
