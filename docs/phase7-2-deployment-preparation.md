# Phase 7.2 deployment preparation

**Prepared locally; not deployed. Overall closed-beta decision: NO-GO.** No provider, host, address, DNS zone, certificate issuer, VPN, secret store or alert channel has been selected. Every real-environment check below is **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**. The local test results cannot satisfy these checks.

## Files and boundary

`deploy/compose.beta.yml`, `deploy/Dockerfile`, `deploy/nginx.conf.template` and `deploy/.env.example` describe a provider-neutral Linux deployment. The development `docker-compose.yml` is not the production file.

```text
Internet -> HTTPS reverse proxy -> invited player Next.js
                              -> VPN-restricted admin Next.js
                private application network -> NestJS API -> PostgreSQL
                                            -> Redis
                                            -> private evidence volume
```

Only the gateway publishes ports 80 and 443. PostgreSQL, Redis, API and both Next.js services publish no host ports. Database, application and frontend networks are internal. Evidence is mounted only by API and restricted operations; nginx has no evidence mount. Direct evidence/storage, Swagger, debug, metrics and source-map paths are denied. Authenticated evidence downloads still use the authorized BFF route. Docker socket/API is never mounted or published. The eventual host firewall must independently deny private service ports and restrict management to operators.

The API uses a distinct NOSUPERUSER/NOCREATEDB/NOCREATEROLE PostgreSQL account. A separate bootstrap owner initializes the empty database and is unavailable to API/BFF containers. Migrations run as the application schema owner. The bootstrap script runs only on an empty PostgreSQL volume: never assume a changed password file updates an existing database role. Redis requires its own strong password and runs as its image's `redis` user. Persistent volumes require encrypted host storage, permissions and backup policy on the actual target.

## Configuration and secret references

Copy only the template structure to a restricted operator-managed environment file **outside source control/build context**. Do not fill the checked-in `.env.example` with real values. Run Compose with `--env-file <OPERATOR_ENV_FILE> -f deploy/compose.beta.yml`. Paths in that file must be absolute host paths. No specific secret-store names have been chosen; the variables below are logical interfaces to whatever storage the operator later selects.

| Variable | Meaning |
| --- | --- |
| `PLAYER_DOMAIN=<PLAYER_DOMAIN>` | Actual player DNS hostname, no URL scheme |
| `ADMIN_DOMAIN=<ADMIN_DOMAIN>` | Different actual admin DNS hostname |
| `ADMIN_VPN_CIDR=<ADMIN_VPN_CIDR>` | Real operator VPN source subnet as seen by nginx; a universal subnet is rejected |
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | Restricted references to real certificate chain and matching private key; certificate must cover both domains |
| `PLAYER_ACCESS_FILE` | Individual invited tester bcrypt htpasswd records; default maximum 10 |
| `ADMIN_ACCESS_FILE` | Separate individual operator bcrypt htpasswd records |
| `DB_PASSWORD_FILE` | Unique application database credential, at least 32 random characters |
| `DB_BOOTSTRAP_PASSWORD_FILE` | Different bootstrap owner credential, not mounted in application containers |
| `JWT_SECRET_FILE` | Unique randomly generated JWT key, at least 32 random bytes |
| `REDIS_PASSWORD_FILE` | Unique random credential; use at least 32 characters from letters/digits/underscore/hyphen for the Redis config writer |
| `POSTGRES_DB`, `POSTGRES_USER` | Nonsecret database/application-role identifiers; defaults `ggvault_beta`, `ggvault` |
| `BETA_INVITE_CAP` | Initial 10; explicitly approved, recorded expansion can increase to 20–50; gateway refuses more than 50 |
| `ALERT_ADAPTER_FILE` | Operator-provided Node adapter path, once a real channel is selected; currently unconfigured |

Compose secret names are internal mount identifiers, not claims that an external secret-store record exists. Neither values nor real references are shipped. `deploy/start.cjs` reads files at runtime; no secret is a Docker build argument or `NEXT_PUBLIC_*` variable. The API validates its production configuration. `node scripts/verify-deployment-secrets.cjs` uses `DEPLOY_ENV_FILE` to check references, distinct strong credentials, domains, VPN subnet, rosters and both built client bundles. Optional `LOG_SCAN_DIR` checks a restricted local log export without printing secret values. Missing builds/references fail the check. This scan detects known raw/URL/base64 values, not every possible leak; review build configuration and log policy as well. File ACLs must allow only the service/operator identities that need them; file-backed Compose secrets are not an encrypted secret store.

## TLS and admin restriction

Obtain valid certificates through the actual operator's selected CA/ACME mechanism after DNS ownership is established. No issuer/account/challenge configuration is assumed. Supply full chain and key using the file references, test expiry/SAN/key match, and automate renewal plus a tested nginx reload. Port 80 redirects recognized hosts to HTTPS; unknown hosts are rejected. TLS allows 1.2/1.3; HSTS is sent even on access denials with a one-year lifetime (no preload or includeSubDomains). Do not enable HSTS on an unready real hostname.

Production BFFs use HTTPS origins and Secure, HttpOnly, host-only cookies. Do not disable secure cookies over this topology. The proxy fixes the forwarded scheme/address and removes gateway Basic Authorization before proxying; the BFF authenticates its own opaque session and sets its own API authorization. No public raw API route is added.

The prepared admin approach is **VPN restriction plus a separate named gateway credential plus application ADMIN/MODERATOR authentication**. It does not create or deploy a VPN, MFA or identity provider. Configure the real VPN so nginx observes the intended source subnet; do not substitute a shared NAT subnet that also admits untrusted users. Prefer MFA on the VPN where available. An identity-aware gateway with MFA is an alternative that needs its own configuration and verification before replacing this template. Test denial from outside the VPN, access by an authorized operator inside it, and denial to a USER inside it. Admin BFF absolute session lifetime remains eight hours. No public operator-registration endpoint exists.

The player gateway permits a named roster of ten testers by default. Generate bcrypt htpasswd entries interactively; do not put passwords on command lines. Gateway startup rejects duplicate/malformed/empty/over-cap rosters. Reload/recreate the gateway after a validated roster change. Gateway identity and application account are separate: this is an operational cohort cap, not a new invitation product or a hard database account-count limit. Operators must reconcile identities/accounts, forbid credential sharing and revoke abused invitations. Expansion requires load/incident review and a recorded cap/roster update.

## Later deployment sequence (not executed on a target)

1. Select target, operator identities, DNS, valid certificates, VPN path and secret storage. Record access/ownership without recording credentials.
2. Build/review image in a controlled environment; pin approved image digests in the deployment record. Run preflight, Compose configuration validation and nginx configuration validation using actual references.
3. Start PostgreSQL and Redis on their private networks. Run `docker compose ... run --rm operations node node_modules/prisma/build/index.js migrate deploy --schema packages/database/prisma/schema.prisma`. Do not run the development seed against a deployed database: it includes development identities. Provision only the approved game catalogue through a reviewed operator database change.
4. Start API, player and admin, check readiness internally, then gateway. Verify runtime role privileges and volume ownership. Back up the initialized state.
5. Provision individual operators/tester roster, perform the security, backup, Redis and financial smoke checks below. Keep public admission closed until every target gate has evidence.

## Named operator provisioning and revocation

The accountable owner records each person's name, unique application identity, gateway identity, role, approver and date in a restricted operational roster (not this repository). Each person chooses a unique password through the controlled ordinary registration flow. Confirm ownership before elevation; public registration cannot choose roles. Do not seed a shared/bootstrap admin password. Use a restricted operator database session with parameterized values to transactionally update the exact user's role to `ADMIN` or `MODERATOR` and insert an audit record recording the approved role change. Check the target identity before commit. Grant least privilege; only ADMIN can read operations data.

For revocation, first remove the individual's VPN/gateway access and reload the validated roster. In one approved database transaction set the role to `USER` (and status to `SUSPENDED` for full account revocation), set `revokedAt` on every active `sessions` row for that exact user, and audit the change. The API reads current role, status and revocation on every protected request, so old access tokens cannot retain privileges. Remove affected opaque BFF sessions using the existing [session operations](session-security.md); if precise removal cannot be established, perform the documented maintenance-window namespace invalidation, never an indiscriminate shared Redis `FLUSHALL`. Verify old browser/access/refresh sessions fail. Preserve financial/audit records; never delete ledger entries to revoke a user.

There is no default admin password to retain. Before opening admission, enumerate elevated accounts privately and verify every one belongs to an approved individual, has a nonempty current password hash and has no development/bootstrap identity. This is an operator acceptance check, not something local fixtures can prove.

For key compromise, close ingress, revoke database sessions, invalidate both BFF namespaces and rotate JWT. For DB rotation, change the matching database role password and file together under maintenance; restart clients and verify readiness/ledger. Rotate Redis password and client references together, restart API/BFF and require reauthentication. Rotate gateway passwords/remove compromised invitations; rotate certificates with the actual CA. Do not retain secrets in logs/history or review artifacts.

## Backup and isolated restore

`scripts/beta-backup.cjs backup <NEW_ARCHIVE.dump>` uses `DEPLOY_ENV_FILE` and the PostgreSQL container's matching tools. It creates a new archive only and verifies its format. No password appears in command arguments or output. Backups contain sensitive data: use a restricted encrypted destination, then copy encrypted data off-host according to the eventual retention/access policy. Back up the private evidence volume at the same maintenance checkpoint; record content hashes and protect it like database data.

For a complete drill, stop admission and API/BFF writes, run `operations node scripts/beta-state.cjs` and save its hash/invariants privately, take the backup, then reopen only when consistent. `beta-state.cjs` hashes accounts, entries, transactions, challenges/players, matches/participants/results, disputes and evidence metadata in a RepeatableRead snapshot; no raw rows are printed. Invariants separately verify balances/conservation/outcome uniqueness. Quiesce writes to make those two snapshots comparable. Evidence binary hashes must also be compared with the coordinated volume backup.

Restore with `scripts/beta-backup.cjs restore <ARCHIVE.dump>`, setting `ISOLATED_RESTORE_DATABASE=ggvault_restore_<UNIQUE_SUFFIX>` and `CONFIRM_ISOLATED_RESTORE` to that exact name. It creates a **new** database and refuses the live name, arbitrary names or an existing destination. It never drops/cleans the live database. Run operations with `-e ISOLATED_RESTORE_DATABASE=<ACTUAL_ISOLATED_NAME>` and `node scripts/beta-state.cjs`; compare the exact saved hash and require every invariant to pass. Record successful restore, balances, settlements/refunds and evidence verification. Retire the drill database only through an explicit reviewed operator cleanup. Existing generic development restore tools are not instructions to restore over beta.

Target-host backup/restore: **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**.

## Redis failure drill

During an announced target maintenance window, close mutations and save `beta-state.cjs` output. Restart the deployment's Redis container and verify readiness recovers. A separate approved ephemeral-session-loss drill may invalidate **only this deployment's** API/BFF session keys, requiring login; preserve financial PostgreSQL data and other services' Redis data. Verify the exact financial state hash and invariants are unchanged, then reauthenticate and exercise a harmless authorized read. Local lab Redis loss is already separate from a target drill. Target-host Redis failure drill: **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**.

## Alert adapter

No external channel exists in this task. `node scripts/beta-alert.cjs --dry-run` emits a fixed synthetic critical event with random reference/time and no user, balance, match, evidence, token or connection details. It explicitly says NOT DELIVERED. Without an adapter reference the command fails closed. After selecting an existing channel, supply an operator-owned Node adapter through `ALERT_ADAPTER_FILE` and mount it read-only with only its required secret references. The adapter reads one JSON event from stdin, sends through that channel and exits nonzero on failure. Its stdout/stderr are not copied into application logs; execution is bounded to 15 seconds. Success means adapter acceptance only, not verified delivery. Record the received event reference and recipient acknowledgement separately.

Configure the target scheduler/monitor to run the existing ledger invariant CLI regularly and route a sanitized critical event on invariant/check failure; scrape authenticated `/operations/metrics` privately for retry exhaustion and readiness/error alarms. Schedule frequency, adapter, recipients and escalation owner are deployment configuration, not invented here. The synthetic critical alert remains **UNVERIFIED**. Real alert delivery: **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**.

## External verification and clean smoke checklist

Run `scripts/verify-beta-ingress.cjs` from an authorized machine outside the host/VPN with real `PLAYER_DOMAIN`, `ADMIN_DOMAIN`, `TARGET_ADDRESS`, and `CONFIRM_EXTERNAL_CHECK=AUTHORIZED_OUTSIDE_HOST`. It refuses missing placeholders, verifies DNS resolution/normal TLS validation, redirects/HSTS, uninvited 401, admin denial, private paths and closed private/Docker ports. Save `INGRESS_REPORT_FILE` to a new restricted report. A TCP timeout is only evidence that this vantage could not connect, not proof of firewall configuration. Also check every public IPv4/IPv6 address, host firewall and published Docker bindings; no TLS verification bypass is permitted.

Manually verify invited browser login/register/logout, Secure/HttpOnly/SameSite cookies, cross-origin mutation rejection, role restrictions, no response stack traces, no public source maps, evidence authorization, and the actual certificate chain/expiry/SAN. The script's unauthenticated denials do not prove authenticated authorization or MFA/VPN controls.

On the **clean actual deployment**, with reserved named test identities and approved operator:

1. Register Amir and Samuel through invited ingress; verify 100 TEST each. Connect their FC 26 accounts.
2. Amir creates a 10 TEST challenge; Samuel joins; both fund. Verify server vault = 20 and PRIZE SECURED. Both ready.
3. Amir submits 4–2; Samuel confirms. Verify authoritative balances: Amir 109, Samuel 90, platform 1, vault 0; exactly one settlement.
4. Create/fund a second match; both ready, submit a result, upload evidence **before opening the dispute** under the existing deadline. Dispute it. Named moderator reviews and resolves `VOID_MATCH`. Verify both original stakes refunded once; no mixed settlement/refund.
5. Run private ledger invariants and save safe results. Verify user history/room reflect the server outcome. Do not rewrite accounting or use a reset against live non-test data.

External HTTPS, DNS, TLS certificate, external port scanning, admin MFA/VPN verification, real alert delivery, target-host backup/restore, target-host Redis failure drill and external deployment smoke test are all **BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED**. The final decision remains **NO-GO** until these are actually completed.
