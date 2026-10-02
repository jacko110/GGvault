# Phase 5 dispute resolution

A participant dispute leaves match/result/challenge DISPUTED and the vault locked. Dispute.status REVIEW is the existing database name for the UNDER_REVIEW stage; there is no new arbitrary status endpoint. Staff can read protected evidence, then resolve with a required trimmed reason (3..2000 characters).

`POST /moderation/disputes/:id/resolve`

```json
{"resolution":"PLAYER_A_WINS","reason":"Screenshot and video confirm final score."}
```

| Resolution | Server mapping | Final financial state |
| --- | --- | --- |
| PLAYER_A_WINS | Challenge creator, verified against fixed match participants | SETTLED; winner receives vault less fee |
| PLAYER_B_WINS | Other fixed match participant | SETTLED; winner receives vault less fee |
| VOID_MATCH | Neither player wins | REFUNDED; each original stake returned, no platform fee |

The response contains disputeId, resolution, status RESOLVED and safe settlement details. The database stores resolvedByUserId, resolution, resolutionReason and resolvedAt. Submitted scores/evidence remain unchanged. The queue derives the original proposed winner from the submitted scores and identity even if the moderator chooses the other winner.

Resolution and ledger posting share one Serializable transaction and match-row write. Exactly one of competing moderator decisions succeeds; the loser returns 409 after retrying against the committed final state. Duplicate resolution returns 409 (read the detail for the existing result). A moderator cannot resolve their own match. Active ADMIN has the same Phase 5 resolution permissions, not raw ledger access. Every resolution writes DISPUTE_RESOLVED and MATCH_SETTLED or MATCH_REFUNDED with actor and domain references. Detail reads record DISPUTE_REVIEWED. Failure anywhere, including after ledger posting, rolls the whole operation back.

Evidence continues through `GET /matches/:id/evidence/:evidenceId/content`, with the existing active participant/staff authorization, attachment headers and hash verification. No new public URLs, evidence edits or post-decision uploads are allowed. There is no appeal/reopening flow or automatic AI adjudication in Phase 5.
