# Invited TEST-credit beta deployment

This is a concrete deployment design, not evidence that a remote host has been deployed or tested. Current provider-neutral files, exact placeholders and the unverified target checklist are in [Phase 7.2 deployment preparation](phase7-2-deployment-preparation.md). No deployment target exists; overall NO-GO remains.

## Network boundary

Use one hardened Linux host with a TLS reverse proxy and private container networks. Only TCP 443 is public; TCP 80 may redirect to HTTPS or serve certificate challenges. SSH is restricted to the operator VPN. Publish no database, Redis, API or evidence-storage port. The development Compose loopback bindings are for local use, not an instruction to expose infrastructure.

- `<PLAYER_DOMAIN>`: HTTPS proxy to player Next.js; an access gateway restricts admission to the named tester cohort. Registration alone does not enforce invitations.
- `<ADMIN_DOMAIN>`: separate HTTPS proxy to admin Next.js, accessible only through the operator VPN and a separate named gateway credential/explicit moderator allowlist; configure MFA on the real VPN where available. The application still requires its own ADMIN/MODERATOR account. The edge must remove spoofable identity/forwarding headers and must not bypass application authorization.
- Nest API: private container network, reachable only by the two BFFs and restricted operational collectors. Do not publish Swagger, metrics or API routes at the public proxy. Browser mutations go through exact-origin BFF routes.
- PostgreSQL and Redis: private backend network, no host/public port publishing; separate strong credentials, persistent PostgreSQL volume and restricted Redis access. Firewall deny rules provide a second boundary.
- Evidence: private API-only volume, never a static proxy alias or public bucket. Encrypted off-host backups contain both database and coordinated evidence; restrict operator access and retention.

Terminate HTTPS at the proxy with maintained TLS configuration. Preserve Host and correct scheme, cap upload bodies at the configured evidence maximum plus bounded multipart overhead, limit concurrent uploads per admitted identity/IP and enforce upload/read timeouts. Set exact WEB_ORIGIN/ADMIN_ORIGIN/CORS_ORIGIN. Keep Secure HttpOnly host-only cookies; never set WEB_COOKIE_SECURE=false on this deployment. Trust forwarding headers only from the private proxy; do not globally trust arbitrary X-Forwarded-For. Enforce rate limits at the edge as well as the application's actor limits.

## Secrets and rotation

Inject secrets from a restricted host secret store or files readable only by the service account. Do not put secrets in image layers, source, review ZIPs, shell history or command arguments. `.env.example` is a placeholder template.

| Secret/configuration | Use and rotation |
| --- | --- |
| JWT_SECRET | Generate at least 32 cryptographically random bytes. Rotation intentionally invalidates existing access tokens; revoke database refresh sessions and clear both BFF session namespaces during a maintenance window, then require login. |
| Database credentials / DATABASE_URL | Unique application and operator roles. Rotate server credential and injected application configuration together; restart writers and verify readiness/invariants. Never grant application superuser access. |
| Redis credentials / REDIS_URL / WEB_REDIS_URL | Private Redis ACL user with only required commands/key prefixes. Rotate credentials, restart API/BFF clients and verify login/throttling. Clearing Redis sessions forces browser login but does not revoke database refresh tokens. |
| Session configuration | Opaque 256-bit random cookie IDs reference server-side tokens; there is no separate browser JWT/signing secret. Preserve namespace separation and exact origins. Protect Redis backups as secrets. |
| Admin bootstrap credentials | Register an ordinary named account through controlled ingress, verify its owner, grant the role through a restricted operator database session and record the approver. No shared/default admin password or public role-registration endpoint. Use a unique strong password plus the verified restricted VPN/gateway control. |

For compromise, first close ingress and preserve safe incident evidence. Revoke affected refresh sessions and BFF sessions, rotate relevant credentials, validate authorization and ledger invariants, then reopen only with operator approval. Role removal and SUSPENDED/BANNED status are checked by the API; revoke sessions too. Keep at least two named operators with separate credentials and a documented recovery process.

## Deployment acceptance

Admin browser sessions have an eight-hour absolute lifetime, including cookie and Redis record; refresh preserves the original deadline. Player sessions retain their existing lifetime. This does not shorten every API refresh token globally: direct API access remains private and stolen backend tokens must be revoked explicitly. Moderation mutations allow at most ten requests per actor/action per minute, including invalid requests. Existing login throttling, Argon2id and current account/role checks remain in force. There is no native application MFA; verify the prepared VPN restriction or an alternative identity-aware MFA gateway on the actual target.

From outside the VPN, verify PostgreSQL, Redis, API and admin are unreachable; an uninvited identity must not access player registration. Verify HTTPS redirects, certificate validity, Secure cookies, headers, denied cross-origin mutations, denied ordinary-user moderation, dependency readiness and backup restore. Record the actual host, date, operator and evidence in the go/no-go report. Local tests cannot satisfy this remote ingress gate.
