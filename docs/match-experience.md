# Phase 6B match experience

Phase 6B extends the approved Phase 6A player app and implements the first moderator interface in `apps/admin`. The existing Phase 4/5 mutations and ledger accounting are unchanged. All balances, stakes, settlements and refunds use non-withdrawable TEST credits.

## Player journey

After both players fund a challenge, **Open match room** links to `/matches/:id`. **My matches** in player navigation opens `/matches`, with server-filtered READY, IN_PROGRESS, RESULT_SUBMITTED, DISPUTED, SETTLED and REFUNDED states and cursor pagination.

The room shows the game, platform, players, individual readiness, stake, server vault amount and result state. READY displays **PRIZE SECURED 🔒**. The first ready action waits for the opponent; after both players are ready, the server starts the match and supplies its start time. GGVault does not launch the external game.

Result submission sends only `myScore` and `opponentScore`, relative to the submitting player. The UI always renders scores against the correct player, independent of creator/submission order. The submitter sees a waiting state and cannot confirm. The opponent reviews the report and chooses confirmation or dispute. Confirmation requires a dialog explaining finalization and settlement. Disputes require a reason and explain that the vault remains locked.

SETTLED displays the server's winner, original prize pool, platform fee and payout. A moderator can override the proposed winner; the recorded score remains visible as the reported score. REFUNDED displays each actual posted refund and the server's remaining vault balance. No payout/refund calculation or synthetic transaction is performed in the browser. Terminal match states refresh the available balance; wallet history reloads on navigation, visibility return and the in-app wallet-change event.

Rooms refresh visible match, evidence and timeline state every five seconds. Pending mutations suppress polling, actions disable while pending, and existing resource request generations prevent stale responses replacing newer results. Status banners use text and accessible status regions. Notifications are in-app indicators only; there is no push or email delivery.

## Evidence contract

The browser shows configured limits before selection: defaults are PNG/JPEG/WEBP up to 10 MiB and MP4 up to 50 MiB. It displays the selected filename, MIME type and size, then sends the existing multipart format with `file` and `type=SCREENSHOT|VIDEO`. Uploads display a busy state. The backend remains authoritative for MIME signatures, file limits and authorization.

**The approved backend accepts evidence only while IN_PROGRESS or RESULT_SUBMITTED, and never from a player who has already submitted a result. Disputing closes uploads.** The UI explains this deadline and places uploads before the decision. The real dispute/void acceptance test therefore uploads evidence before opening the dispute. Uploading after dispute creation would require a domain change and is intentionally not introduced.

Evidence cards show uploader and timestamp. Images and MP4 files are viewed through authorized same-origin endpoints, with a download option. No storage keys/paths or public object URLs are exposed. There are no edit/delete controls. Player and moderator requests use their own server-side session, with private/no-store, MIME allowlisting and no-sniff response headers. Upload buffering is bounded before forwarding; backend multipart limits still apply. The web and API deployment must share evidence-limit configuration.

The timeline retains the server's sequence order. It shows readiness, match start, result/evidence/decision events, moderator review and settlement/refund. It does not synthesize events or reorder by browser timestamps.

## Moderator application

Run `npm run dev:admin` and visit `http://localhost:3002`. `ADMIN_PORT` and `ADMIN_ORIGIN` configure its listener/origin. Production start uses `npm --prefix apps/admin start`. Use an existing active MODERATOR or ADMIN account provisioned by a trusted operator; there is no browser role-promotion route or public moderator registration.

The dashboard supports OPEN, UNDER REVIEW and RESOLVED. UNDER REVIEW maps to the existing backend `REVIEW` enum. Queue cards show dispute/game/player/score/reason/time/status data. Detail displays the original proposal and proposed winner, private evidence, server timeline, challenge/match references and the final outcome when resolved.

Reviewers choose PLAYER_A_WINS, PLAYER_B_WINS or VOID_MATCH, enter a resolution reason and confirm a final decision. Player A is the challenge creator, not whichever participant happens to sort first. The dialog explains prize release or original-stake refunds. Conflicts reload current server state and show a friendly already-resolved message. Existing backend checks prevent participants moderating their own match.

## Session and authorization boundaries

Admin reuses the Phase 6A server-only session implementation, with a separate `ggvault-admin-session` cookie and `ggvault:admin:session:*` Redis namespace. Production uses the Secure `__Host-` cookie prefix. Browser cookies contain random opaque identifiers only. JWTs/refresh tokens stay server-side; they are never placed in localStorage, sessionStorage or readable cookies.

Admin login verifies `/auth/moderation-access` before creating its local session; rejected player logins revoke the newly created upstream session. Admin layouts, every admin proxy request and every private admin evidence request recheck role access. Role demotion is therefore enforced even with an existing browser cookie. The public player BFF never forwards `/moderation/*`. Exact mutation-origin checks apply independently to player and admin applications. Admin has its own login/logout and no player navigation link to moderation.

## Small read-only API additions

| Endpoint/change | Purpose and boundary |
| --- | --- |
| `GET /matches` | Authenticated user's own matches only; safe summary, status filter, bounded limit and cursor; no unrelated-player list access |
| `GET /matches/:id/refunds` | Participant/staff-authorized projection of actual posted refund credits: `userId`, `amount` only; no ledger account/entry internals |
| Moderation queue `game` | Existing read response adds safe game `id`/`name`, avoiding a per-card match request |

These additions are documented in generated OpenAPI. There are no schema/migration changes and no changes to readiness/result/dispute/evidence/settlement mutation semantics.

## Validation and review

Run `npm --prefix apps/web test`, `npm --prefix apps/admin test`, `npm test`, `npm run build`, `npm run lint` and `npm --prefix apps/web run test:e2e`. The browser suite runs production Next.js player/admin servers and the compiled NestJS API on 3100/3102/3101 with real PostgreSQL and Redis. Install Chromium using the existing Playwright setup. Use disposable test infrastructure and do not run backend fixture-reset tests concurrently with browser tests. Only isolated component tests mock fetch.

Real acceptance creates unique Amir, Samuel and Moderator accounts. Moderator role assignment is test-fixture provisioning directly in the disposable database, not a product API. Scenario A confirms 4–2 and checks a 20 TEST pool, 1 TEST fee, 19 TEST payout and balances 109/90. Scenario B uploads private evidence, disputes a separate match, reviews it in admin and voids it, returning 10 TEST each with an empty vault. Screenshots/traces/uploads stay in ignored cache/storage directories and never enter review archives.

See the final Phase 6B validation report and `docs/project-progress.md` for verified results and delivery status. Existing framework advisory/deployment limitations in `docs/security.md` remain applicable; this phase does not upgrade the application frameworks.
