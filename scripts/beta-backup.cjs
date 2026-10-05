// Uses the target's PostgreSQL 16 tools. No passwords in command arguments/logs.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseEnv } = require('node:util');
function identifiers(text, environment = process.env) {
  const settings = parseEnv(text);
  const user = environment.POSTGRES_USER || settings.POSTGRES_USER || 'ggvault';
  const live =
    environment.POSTGRES_DB || settings.POSTGRES_DB || 'ggvault_beta';
  if (
    ![user, live].every((value) => /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value))
  )
    throw new Error('Invalid database identifiers');
  return { user, live };
}
function isolated(name, live) {
  return (
    typeof name === 'string' &&
    /^ggvault_restore_[a-z0-9_]{1,32}$/.test(name) &&
    name !== live
  );
}
function main() {
  const envFile = process.env.DEPLOY_ENV_FILE;
  if (!envFile || !fs.existsSync(envFile)) {
    console.log('BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED');
    process.exitCode = 2;
    return;
  }
  const [action, filename] = process.argv.slice(2);
  if (!['backup', 'restore'].includes(action) || !filename)
    throw new Error('Use backup|restore <archive.dump>');
  const prefix = [
    'compose',
    '--env-file',
    path.resolve(envFile),
    '-f',
    path.resolve(__dirname, '../deploy/compose.beta.yml'),
  ];
  const pg = (args, input, output) => {
    const result = spawnSync(
      'docker',
      [
        ...prefix,
        'exec',
        '-T',
        'postgres',
        'sh',
        '-c',
        args[0] === 'createdb'
          ? 'export PGPASSWORD="$(cat /run/secrets/db_bootstrap_password)"; exec "$@"'
          : 'export PGPASSWORD="$(cat /run/secrets/db_password)"; exec "$@"',
        'sh',
        ...args,
      ],
      {
        stdio: [input ?? 'ignore', output ?? 'ignore', 'pipe'],
        windowsHide: true,
      },
    );
    if (result.error || result.status !== 0)
      throw new Error(
        'Database operation failed; inspect the target privately',
      );
  };
  // The deployment env file contains references, not secrets. Read only nonsecret DB identifiers.
  const { user, live } = identifiers(fs.readFileSync(envFile, 'utf8'));
  if (action === 'backup') {
    const fd = fs.openSync(filename, 'wx', 0o600);
    try {
      pg(
        [
          'pg_dump',
          '-U',
          user,
          '-d',
          live,
          '--format=custom',
          '--no-owner',
          '--no-acl',
        ],
        undefined,
        fd,
      );
    } finally {
      fs.closeSync(fd);
    }
    const input = fs.openSync(filename, 'r');
    try {
      pg(['pg_restore', '--list'], input);
    } finally {
      fs.closeSync(input);
    }
    console.log(
      'Backup archive created and readable; restore/state comparison still required.',
    );
  } else {
    const target = process.env.ISOLATED_RESTORE_DATABASE;
    if (
      !isolated(target, live) ||
      process.env.CONFIRM_ISOLATED_RESTORE !== target
    )
      throw new Error(
        'An explicitly confirmed isolated restore database is required',
      );
    const input = fs.openSync(filename, 'r');
    try {
      // Fails if already present. Never DROP, --clean, or overwrite a running database.
      pg(['createdb', '-U', 'ggvault_owner', '-O', user, target]);
      pg(
        [
          'pg_restore',
          '-U',
          user,
          '-d',
          target,
          '--single-transaction',
          '--no-owner',
          '--no-acl',
        ],
        input,
      );
    } finally {
      fs.closeSync(input);
    }
    console.log(
      'Isolated restore complete; compare state hash and run ledger invariants before acceptance.',
    );
  }
}
if (require.main === module) {
  try {
    main();
  } catch {
    console.error(
      'Backup/restore rejected or failed; verify references, new archive path and isolated destination privately.',
    );
    process.exitCode = 1;
  }
}
module.exports = { isolated, identifiers };
