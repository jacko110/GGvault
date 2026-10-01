# Phase 3 authorization

`JwtAuthGuard` runs globally. Only registration, login, refresh, root health and `/health` are public application endpoints. Swagger is available at `/docs` and `/docs-json` without credentials; it contains schemas, never database records.

`@CurrentUser()` returns the verified session identity. Creator IDs, participant IDs and funding user IDs always come from that identity. Body fields claiming another identity are rejected by global DTO validation.

`RolesGuard` implements `@Roles(...)`. `GET /auth/moderation-access` requires ADMIN or MODERATOR and returns only an access confirmation. It performs no moderation actions. Authorization uses the current database role, so role changes take effect immediately. SUSPENDED, BANNED and DELETED accounts cannot use authenticated routes.

| Resource | Rule |
| --- | --- |
| Current profile | Only the authenticated user's profile |
| Game accounts | Only own accounts may be listed, created or deleted |
| Challenge discovery/detail | Any authenticated active user; only public participant names and IDs |
| Create challenge | Active user with matching game/platform account |
| Join challenge | Active non-creator with matching game/platform account; one vacant slot |
| Cancel challenge | Creator only, OPEN/JOINED, no locked funds |
| Fund challenge | Participant only, both participants joined, own stake only |
| User balance/history | Own user ID only |
| Vault read | Challenge participant only |

Profile DTOs allow displayName, bio, avatarUrl and countryCode. They cannot change roles, status, accounts, balances or trust fields. Responses use explicit selections and response DTOs rather than serializing Prisma users or sessions.

Phase 4 match rooms, timelines and evidence are private to participants plus active MODERATOR/ADMIN readers. Only participants can ready, submit scores or upload evidence. Only the non-submitting opponent can confirm/dispute. Staff read permissions grant no action or financial permissions. Evidence requests also bind the evidence ID to the requested match.
