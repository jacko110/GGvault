# Phase 6A frontend

Phase 6B now extends this foundation with match rooms and a separate moderator app. See [match experience](match-experience.md) for the current flow; this document records the Phase 6A foundation.

The public application lives in `apps/web`. It uses the existing Next.js App Router, TypeScript and the NestJS API. All money-like values are non-withdrawable TEST credits. Admin and Phase 6B match/result/evidence/dispute screens are not implemented here.

## Run locally

Follow the root README to install dependencies, start PostgreSQL/Redis, deploy migrations and seed games. Set `ENABLE_TEST_CREDITS=true` only when development accounts should receive the existing 100-credit welcome grant. Run `npm run dev:api` and `npm run dev:web`, then visit `http://localhost:3000`.

The web launcher loads the root `.env`. `API_BASE_URL` is the private backend URL (default `http://127.0.0.1:3001`). `WEB_ORIGIN` must match the browser origin exactly, including scheme and port. `WEB_REDIS_URL` optionally selects a separate session Redis; otherwise `REDIS_URL` is used. These are server settings, not `NEXT_PUBLIC` browser configuration. Review packages contain only `.env.example`.

Production requires HTTPS. Cookies default to Secure with the `__Host-` prefix. `WEB_COOKIE_SECURE=false` is exclusively for local HTTP production-build testing. Keep Redis private, authenticated and encrypted in transit when accessed across hosts; it holds backend session credentials. Use the same Redis and origin configuration across web replicas. Sessions expire after 30 days without extending their absolute lifetime. Redis loss signs users out.

## Screens and design system

| Route                   | Screen                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `/login`, `/register`   | Real authentication forms                                         |
| `/`                     | Home, available balance, games and open challenges                |
| `/challenges`           | Discovery with game/platform/status filters and cursor pagination |
| `/challenges/new`       | Create a TEST-credit 1v1 challenge                                |
| `/challenges/:id`       | Players, stake, join/cancel and vault entry                       |
| `/challenges/:id/vault` | Funding status and server-confirmed secured prize                 |
| `/profile`              | Player profile and linked game accounts                           |
| `/transactions`         | Available TEST credits and safe transaction history               |

`components/ui.tsx` contains Button, Card, Modal, Badge, Avatar, PlayerCard, ChallengeCard, GameCard, VaultCard, TransactionRow, StatusBadge, LoadingState, EmptyState, ErrorState and ConfirmationDialog. `components/shell.tsx` provides Navigation, MobileBottomNavigation and DesktopSidebar. CSS tokens define navy surfaces, violet/blue accents, typography, borders and spacing. The mobile navigation replaces the sidebar below 900px; the layout has a further 600px breakpoint and targets 390px phones. Inline SVG and CSS artwork need no external assets or fonts.

Forms use semantic controls and labels, pending buttons suppress duplicate actions, focus outlines remain visible, a skip link targets the main region, and native dialogs provide keyboard focus containment and Escape dismissal. Reduced-motion preferences disable decorative animation.

## Authentication and browser API boundary

The existing backend returns access and rotating refresh tokens in JSON. A server-only Next.js adapter exchanges these tokens and stores them in Redis. The browser receives only a random opaque HttpOnly, SameSite=Lax cookie. Neither backend token is placed in browser storage or browser responses. Redis keys hash the opaque identifier. Authenticated layouts call the real `/auth/me` endpoint; missing/expired sessions redirect to login.

`POST /api/session/register|login|refresh|logout` connects the corresponding backend operation. `/api/backend/*` has an explicit method/path allowlist for Phase 6A. It forwards authentication on the server, retries once after an expired access token and serializes refresh/logout per session using a Redis lock. Concurrent reads reuse the refreshed token instead of replaying a rotating refresh token. Session writes require the Redis record to still exist. Logout revokes the backend session and deletes the local record; if upstream revocation cannot be confirmed, the local cookie is still cleared and the UI reports that sign-out could not be confirmed. An offline request that never reaches the server must be retried.

Mutations require the exact configured Origin and JSON content type, and small request bodies. Browser responses are uncached and domain failures are mapped to safe messages. Raw database/server error messages are never rendered. The proxy strips `vaultAccountId`; transaction history uses the existing safe user endpoint, never raw ledger routes. The new authenticated, read-only `GET /games` returns only enabled games' `id`, `name` and `slug`; its response is documented in generated OpenAPI. Backend domain and ledger accounting logic are unchanged.

The backend's existing auth rate limit sees requests from the web server. Deployment must account for this shared upstream address when sizing the existing rate policy. This phase does not change authentication rate-limit semantics or introduce a new forwarding trust policy.

## Challenge and wallet behavior

Players link a matching game/platform account before creating or joining. Funding opens after two players join. Every new funding operation gets `crypto.randomUUID()` as its Idempotency-Key. A pending operation disables duplicate clicks. An uncertain network/5xx outcome retains the same non-secret operation key in sessionStorage for a retry, including after reload. Success or a definitive client error clears it. No access or refresh credentials use this storage.

The challenge, funding response, vault endpoint and balance endpoint are authoritative. The browser never subtracts stakes or computes secured balances. It displays **PRIZE SECURED 🔒** only for the server's FUNDED state with both players funded. Detail views refresh every eight seconds while visible; stale fetch completions cannot overwrite newer mutation results. Wallet entries display INITIAL_CREDIT, STAKE_LOCK, MATCH_WIN and STAKE_REFUND with readable labels and signed server amounts.

## Validation commands

```sh
npm run build:web
npm --prefix apps/web run lint
npm --prefix apps/web test
npm --prefix apps/web run test:e2e
```

Install the browser once with `npx playwright install chromium`. Browser tests require the compiled API (`npm run build:api`), a production web build, seeded games, PostgreSQL and Redis. They start real API/web servers on 3101/3100 and use real registration and challenge APIs; no network routes are mocked. Use disposable development infrastructure. Do not run backend database regression tests concurrently: those suites reset their fixtures. Only isolated React component tests mock fetch. Screenshots and failure traces go to ignored `.cache/` and are not source review contents.
