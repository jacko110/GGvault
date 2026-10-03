# Phase 6B validation — 2026-10-03

Approved baseline: `b3b3cd8b2db435db30428faf5f86957b809f2d7a` (Phase 6A). Implementation and validation are complete. Commit and source-only review delivery are complete.

## Validation evidence

| Check                       | Result                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full workspace build        | Passed: database/shared/ledger/match-engine packages, player/admin Next.js production builds and NestJS API                                                |
| Repository lint             | Passed for API, player and admin; no ESLint warnings/errors                                                                                                |
| Backend regressions         | 11 suites, 185 tests passed, 0 failures; 32 unit, 17 ledger integration and 136 API e2e                                                                    |
| Player components           | 2 suites, 21 tests passed, 0 failures                                                                                                                      |
| Admin components            | 1 suite, 7 tests passed, 0 failures                                                                                                                        |
| Real Chromium browser suite | 3 tests passed, 0 failures; Phase 6A regression plus full Phase 6B acceptance                                                                              |
| Responsive evidence         | No horizontal overflow at checked 390/768/1440px match-outcome and admin-review views; mobile match progress, dispute, refund and admin queue also checked |

Automated total: **216 passed, 0 failures**. Browser acceptance uses real production Next.js player/admin servers, NestJS, PostgreSQL and Redis. Only isolated component tests mock network responses. Backend database tests ran serially and completed before browser testing; the game seed was restored afterward.

## Scenario A: confirmed winner

Unique Amir and Samuel accounts registered, linked game accounts, created/joined a 10 TEST challenge, funded both stakes and readied up. The room displayed server readiness, the 20 TEST vault and match start time. Amir submitted 4–2 using only `myScore`/`opponentScore`; his UI offered no self-confirm action. Samuel confirmed through the finalization dialog.

The browser displayed Amir as winner, pool **20**, fee **1**, payout **19**, with available balances **109/90**. Timeline included confirmation and settlement. The wallet displayed the actual MATCH_WIN **+19** entry. Screenshots of the winner view were checked at 390, 768 and 1440px.

## Scenario B: private evidence and moderator void

A separate match used the same participants. After Amir reported 4–2, Samuel selected an invalid file and received a safe validation message, then uploaded a valid JPEG. The timeline recorded the upload. Samuel disputed with a reason; the browser displayed UNDER REVIEW with **20 TEST locked** and removed upload controls.

The existing backend closes evidence on dispute, so evidence was uploaded **before** opening it. No domain rule was changed to support post-dispute uploads.

A separately provisioned test Moderator logged into the real admin app. Ordinary player login/API access was denied. The moderator saw the queue, opened the dispute and viewed the image through an authorized private endpoint; an unauthenticated request to that content returned 401. The image decoded successfully. Escape dismissed the modal.

VOID_MATCH required a resolution reason and a final confirmation explaining original-stake refunds. The result displayed **+10 TEST for each player and vault 0**. Player balances returned to **109/90** (preserving the earlier match outcome), transaction history showed STAKE_REFUND **+10**, and My Matches showed the two terminal states. A conflicting second resolution returned DISPUTE_ALREADY_RESOLVED. Moderator logout restored protected-route redirection.

No JWT/refresh tokens were present in browser storage. The admin cookie was HttpOnly/SameSite=Lax, with a separate name from the player cookie. Public BFF moderation requests returned 404. No browser runtime errors were recorded.

## Additional tests and boundaries

Component tests cover first readiness, both-ready progress, score payloads, submitter restriction, opponent confirmation, locked disputes, exact settlement/refund projections, multipart upload and invalid files, server timeline ordering and My Matches. Moderator tests cover role rejection, queue/filter mapping, required reason, all three decisions and conflicting-resolution UI. Existing backend tests continue to exercise accounting conservation, authorized evidence, winner decisions, voids and concurrent outcomes. New read tests verify owned-match filtering, bounded query validation, refund amounts, excluded ledger internals and denial after moderator demotion.

The backend changes consist only of a safe owned-match list, a participant/staff-authorized refund read projection and game metadata in the existing moderation read response. Readiness, result, dispute, evidence and financial mutation implementations are unchanged; no schema/migrations changed.

## Validation corrections and limits

After the interrupted session, Docker Desktop/PostgreSQL were stopped. The initial resumed database test run failed to connect; services were restored and all 185 backend tests passed. Visual review prompted radio alignment and upload loading/error-state fixes; both frontend production builds and all 21 player component tests passed afterward. The focused real Phase 6B browser flow also passed again (1 test); this repeat is not counted twice in the 216-test total.

Chromium was tested; Safari/Firefox and a formal WCAG audit were not performed. No payments, withdrawals, TikTok, tournaments or push/email notifications were added. Existing framework advisories and production deployment requirements remain documented in [security.md](security.md). Test screenshots, traces and uploaded evidence remain ignored local artifacts.

## Review delivery

Delivered: UTF-8 `phase6b.patch`, `phase6b-stat.txt`, `phase6b-commit.txt`, and source-only `GGvault-phase6b-review.zip`. All 109 archive member hashes match committed source/report bytes; forbidden files are excluded. The phase commit has the approved Phase 6A baseline as its parent; its final identity is recorded in `phase6b-commit.txt`.
