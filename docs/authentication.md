# Phase 3 authentication

All credits are non-withdrawable TEST credits. Passwords use Argon2id with a fresh salt, 64 MiB memory, three iterations, and one lane. Passphrases of 10–128 characters are accepted. Emails are trimmed and lowercased; usernames are lowercased and limited to 3–32 letters, digits and underscores.

| Endpoint | Request | Result |
| --- | --- | --- |
| POST /auth/register | email, username, password | 201 user, accessToken, refreshToken, expiresIn, tokenType |
| POST /auth/login | email, password | 200 accessToken, refreshToken, expiresIn, tokenType |
| POST /auth/refresh | refreshToken | 200 replacement token pair |
| POST /auth/logout | empty object, bearer token | 200 success |
| GET /auth/me | bearer token | 200 safe current-user profile |

Access tokens expire after 15 minutes. Application claims contain only `sub`, `role`, and `sessionId`, with standard issuer, audience, issue and expiry claims. HS256 signatures require a configured `JWT_SECRET` of at least 32 bytes. Generate a random secret; never deploy the example placeholder or a test secret.

Refresh tokens contain 48 cryptographically random bytes encoded as hex. Only their SHA-256 digest is persisted. A session lasts at most 30 days; rotation preserves the original expiry, revokes the previous session and creates a replacement. Reusing an old token is rejected. Concurrent refresh requests can create only one replacement. Old access tokens stop working after rotation or logout because every authenticated request checks the live database session and user status.

Clients should keep access tokens in memory and refresh tokens in secure platform storage. This API returns tokens in JSON and does not set cookies. Browser clients should use a secure server-side session/BFF before a final frontend is built. TLS is required for deployment. Do not log Authorization headers or authentication request/response bodies.

Registration, session creation, audit logging and optional initial credit are atomic. Set `ENABLE_TEST_CREDITS=true` and `INITIAL_TEST_CREDITS=100` only for development/testing. Credits go through the existing `LedgerService.createInitialCredit()`. The default is disabled, including in the example configuration. Legacy users migrated with an empty password hash cannot log in until a separate password enrollment workflow is implemented.

Redis enforces 20 attempts per minute per IP and auth route across instances. Account names are not used for blocking. If Redis is unavailable these routes fail closed with 503. Configure trusted proxies deliberately before deployment; the current Express configuration does not trust forwarded IP headers.

Implementation references: [NestJS authentication](https://docs.nestjs.com/security/authentication), [node-argon2](https://github.com/ranisalt/node-argon2), and [class-validator releases](https://github.com/typestack/class-validator/releases).
