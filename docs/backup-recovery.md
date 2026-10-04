# PostgreSQL backup and recovery

Use PostgreSQL 16-compatible pg_dump/pg_restore. Set DATABASE_URL in the operator environment; scripts do not embed credentials and pass passwords only through child-process environment. Protect shell history and process environments. Store archives outside served directories, encrypted at rest and accessible only to operators.

```
node scripts/backup-db.cjs backups/beta.dump
# Set CONFIRM_RESTORE_DATABASE to the exact destination database name first.
node scripts/restore-db.cjs backups/beta.dump
node scripts/ledger-invariants.cjs
```

The backup script refuses to overwrite files and checks pg_restore's archive listing. Restoration replaces destination objects in one transaction; stop application writers first. A successful listing is not a recovery test. Restore to a separate database, restart services against it, compare balances/vaults/matches/disputes and run invariants before resuming traffic. Credentials and archives must never enter review packages.

## Repeatable local drill

`node load-tests/lab.cjs` requires the local ggvault-postgres Docker container and Redis image. It creates a new generated ggvault_phase7_* database, applies migrations, seeds accounts through the actual AuthService/ledger, and uses real HTTP lifecycle routes. It creates a funded vault, settled match, open dispute and refunded match. It closes the API, runs standard pg_dump, destroys/recreates **only that generated database**, restores through pg_restore, restarts NestJS and compares exact hashes of financial/state rows. It separately destroys/recreates its dedicated ephemeral Redis container on loopback port 6387 and verifies financial state is unchanged. Development PostgreSQL data and the development Redis container are not destroyed.

The lab keeps its database and ignored .cache/phase7-lab-*/recovery.dump for local inspection. Delete retained lab data using the exact generated database name after review. It does not start player/admin servers; frontend integration is validated separately. Detailed measured results are in phase7-validation.md and performance-baseline.md. Production RPO/RTO have not been measured; for the invited beta, take coordinated DB/evidence backups before each session and after moderation batches, then agree retention/RPO with the operator.
