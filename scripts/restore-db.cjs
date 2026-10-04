const { postgres } = require('./backup-db.cjs');
const fs = require('node:fs');
const path = require('node:path');
try {
  const file = process.argv[2];
  if (!file || !fs.statSync(file).isFile())
    throw new Error('Usage: node scripts/restore-db.cjs <backup.dump>');
  const database = decodeURIComponent(
    new URL(process.env.DATABASE_URL).pathname.slice(1),
  );
  if (process.env.CONFIRM_RESTORE_DATABASE !== database)
    throw new Error(
      'Set CONFIRM_RESTORE_DATABASE to the exact destination database name; restore replaces its data',
    );
  postgres('pg_restore', [
    '--clean',
    '--if-exists',
    '--single-transaction',
    '--no-owner',
    '--no-acl',
    '--dbname',
    database,
    path.resolve(file),
  ]);
  console.log(
    'Restore complete. Run ledger-invariants.cjs and verify application state before reopening traffic.',
  );
} catch (error) {
  console.error(
    error instanceof TypeError
      ? 'Invalid restore configuration'
      : error.message,
  );
  process.exitCode = 1;
}
