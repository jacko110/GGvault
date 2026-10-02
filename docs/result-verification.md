# Result verification through Phase 5

## Submit

POST `/matches/:id/result` with:

```json
{ "myScore": 4, "opponentScore": 2 }
```

Only a participant in an IN_PROGRESS match may submit. Scores are integers from 0 to 100000 and draws are rejected. Scores are relative to the authenticated submitter, whose ID comes from the session. The server derives the proposed winner; clients cannot supply winnerUserId, submittedByUserId or status. The result records submittedByUserId/submittedAt and begins PENDING. Both match and challenge become RESULT_SUBMITTED. The one-result-per-match unique constraint prevents duplicate submissions. The opponent cannot overwrite or resubmit the proposal.

`winnerUserId` is a proposal until confirmed. It does not authorize settlement.

## Confirm

POST `/matches/:id/result/confirm` with `{}`. Only the non-submitting opponent can confirm. confirmedByUserId/confirmedAt are recorded. Result, match and challenge pass through CONFIRMED and become SETTLED in the same transaction as LedgerService settlement. The response contains safe settlement details; a retry by the same opponent returns the existing SETTLED result. No client payout fields are accepted.

## Dispute

POST `/matches/:id/result/dispute` with:

```json
{ "reason": "Score is incorrect" }
```

Only the non-submitting opponent can dispute. Reason must contain non-whitespace text and be 5–2000 characters. Exactly one Dispute is created for the result, with status REVIEW to represent the pending review queue. Match, challenge and result become DISPUTED. Evidence uploads close; existing evidence remains immutable and privately readable. Funds stay frozen until an active moderator/admin resolves the dispute through the protected moderation API.

## Terminal decision race

Confirmation and dispute run in Serializable transactions and touch the same match row. Exactly one can win a race; the retried loser sees the terminal state and returns 409. There is no public status PATCH or settlement endpoint. The existing LedgerService performs all transfers; moderator decisions use the same match serialization boundary. See [settlement](settlement.md) and [dispute resolution](dispute-resolution.md).

Common error codes: MATCH_NOT_FOUND (404), MATCH_NOT_PARTICIPANT (403), MATCH_NOT_READY (409), MATCH_NOT_IN_PROGRESS (409), DRAW_UNSUPPORTED (400), RESULT_ALREADY_SUBMITTED (409), RESULT_NOT_SUBMITTED (409), RESULT_SELF_DECISION (403), RESULT_FINALIZED (409). DTO errors reject unknown fields before domain mutation.
