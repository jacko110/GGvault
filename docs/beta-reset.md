# TEST-only beta reset

Reset means switching to a fresh database migrated and seeded from source, never manually editing ledger postings. The old database stays intact for audit/recovery. This tool is intentionally unavailable for production; use it only on a local TEST deployment while writers and ingress are stopped.

`node scripts/beta-reset.cjs` requires PostgreSQL client tools on PATH and all of:

```text
NODE_ENV=test
BETA_MODE=true
ENABLE_TEST_CREDITS=true
RESET_CREDIT_MODE=TEST
REAL_MONEY_MODE=false
CONFIRM_BETA_RESET=CREATE_NEW_TEST_DATABASE
```

It rejects NODE_ENV=production (or unset), remote databases, missing acknowledgements and any schema whose fingerprint differs from the reviewed TEST-only schema. Future schema changes, especially money-related changes, invalidate this gate and require explicit review. Never bypass it by relabeling a production environment. There is no target database deletion option.

1. Close local beta ingress, stop API/BFF writers, and take a coordinated backup of the old database/evidence.
2. Inject the acknowledgements and local database operator credentials, then run the script. It prints only the generated database name after migrations/seed succeed. Failure leaves the old database unchanged; inspect any newly generated database before retrying.
3. Change the stopped TEST services' DATABASE_URL to the generated database. Clear only this TEST deployment's Redis session namespace; retain the old evidence volume with its backup and use a new empty private evidence directory.
4. Restart services, provision named moderator access, run the clean smoke scenario and invariant CLI, and reopen only after validation.
5. Retain/delete the old database and coordinated evidence only under a separate explicitly reviewed retention operation. This script performs neither deletion nor financial-row mutation.
