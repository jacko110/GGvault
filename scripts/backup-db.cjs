// Standard PostgreSQL custom-format archive. Secrets are passed in child environment only.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
function connection() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('PostgreSQL URL required');
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.get('sslmode')
      ? { PGSSLMODE: url.searchParams.get('sslmode') }
      : {}),
  };
}
function postgres(command, args) {
  const result = spawnSync(command, args, {
    env: connection(),
    stdio: ['ignore', 'inherit', 'pipe'],
    windowsHide: true,
  });
  // PostgreSQL errors may contain infrastructure details. Do not print them into shared logs.
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed; check connectivity, tool installation and permissions locally`,
    );
}
module.exports = { postgres };
if (require.main === module) {
  try {
    const target = process.argv[2];
    if (!target)
      throw new Error('Usage: node scripts/backup-db.cjs <new-backup.dump>');
    const file = path.resolve(target);
    if (fs.existsSync(file))
      throw new Error('Backup destination already exists');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    postgres('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file',
      file,
    ]);
    postgres('pg_restore', ['--list', file]);
    console.log(
      'Backup created and archive listing verified. Perform a restore drill to verify data.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
