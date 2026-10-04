# Closed beta runbook

## Launch gate

Read phase7-validation.md and dependency-security.md. Do not infer production readiness from a build passing. Resolve launch-blocking runtime advisories and failed correctness/security checks first. Use HTTPS and private API/PostgreSQL/Redis ingress; restrict admin access. No payments, deposits, withdrawals, crypto, TikTok or external game APIs.

## Start and verify

The local Compose database and Redis ports bind to 127.0.0.1 only. Keep infrastructure private when adapting this configuration to a deployment host.

1. Load secrets from the operator environment; use .env.example only as a configuration template. Use a strong random JWT secret, exact HTTPS origins and Secure cookies. Enable TEST credits and beta limits explicitly.
2. Start PostgreSQL/Redis, run Prisma validation/generation and `npm run prisma:deploy`, then `npm run seed`. Build and start API, player and admin with their documented scripts.
3. Check /health/live and /health/ready. Run the invariant command. Verify both frontends can login and admin operations denies ordinary players.
4. Provision a moderator/admin using a restricted operator database session after identifying the exact registered account. Never accept role assignment from a registration request. Record who granted access and why. Use a separate moderator identity and unique strong password; restrict its ingress. There is no self-service promotion endpoint.
5. Invite only the agreed 20-50 testers via your controlled invitation channel. Restrict beta ingress to that cohort (VPN/access gateway where available). Registration is not an automatic invitation enforcement system. Explain TEST credits, evidence deadlines and incident contact.

## During a session

Monitor admin operations, authenticated metrics, 5xx/429 rates and latency. Keep the service within the measured local baseline; it is not a production capacity promise. Inspect open disputes through the moderator app; require a reason and review evidence before confirmation. Repeated detail polling records only the first review by each moderator for that match. Check invariants after moderation batches and at the end of the session. Take coordinated database/evidence backups; verify restore drills on an isolated target.

## Incident response and STOP THE BETA

Stop accepting new actions immediately for conservation failure, any negative available/vault balance, duplicate or mixed settlement/refund, unauthorized moderator access, critical authentication bypass, persistent database corruption, or unexplained evidence integrity loss affecting decisions. Disable external ingress and stop API/BFF writers; preserve read-only evidence/logs/backups. Record request IDs and affected time window without tokens/passwords. Do not repair ledger rows or retry financial writes with new idempotency keys blindly.

Investigate under restricted operator access. Revoke affected PostgreSQL sessions; Redis deletion alone is not global backend revocation. Rotate compromised secrets, restore only from a verified coordinated backup if required, and run invariants plus targeted security/financial regressions. A human operator must authorize reopening after the cause is resolved and data is verified.

## Shutdown

Close invitations/ingress, let confirmed requests finish, stop player/admin/API writers, take final coordinated backups, run invariant verification and retain restricted logs. Stop infrastructure without deleting persistent volumes. Clean only explicitly identified disposable lab databases/containers. Record the session outcome and outstanding incidents in the project tracker.
