// TEST-only reset by replacement: never delete or edit the previous database.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function guard(env, schema) {
  if (
    !['test', 'development'].includes(env.NODE_ENV) ||
    env.BETA_MODE !== 'true' ||
    env.ENABLE_TEST_CREDITS !== 'true' ||
    env.RESET_CREDIT_MODE !== 'TEST' ||
    env.REAL_MONEY_MODE !== 'false' ||
    env.CONFIRM_BETA_RESET !== 'CREATE_NEW_TEST_DATABASE'
  )
    throw new Error(
      'Reset refused: explicit non-production TEST-only acknowledgements required',
    );
  // A future schema (including any money support) requires a new security review.
  const fingerprint = createHash('sha256')
    .update(schema.replace(/\r\n/g, '\n'))
    .digest('hex');
  if (
    fingerprint !==
    '529419155d49c7fc82283ca17e4a305af36a30fe82c330e7b4982fb9b0e1535e'
  )
    throw new Error('Reset refused: schema requires review');
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('Reset refused: invalid database configuration');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('Reset refused: local PostgreSQL required');
  return url;
}
module.exports = { guard };
if (require.main === module) {
  try {
    if (fs.existsSync(path.join(root, '.env')))
      process.loadEnvFile(path.join(root, '.env'));
    const url = guard(
      process.env,
      fs.readFileSync(
        path.join(root, 'packages/database/prisma/schema.prisma'),
        'utf8',
      ),
    );
    const name = 'ggvault_beta_reset_' + randomUUID().replaceAll('-', '');
    const env = {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
    };
    function run(command, args) {
      const result = spawnSync(command, args, {
        cwd: root,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      if (result.error || result.status !== 0)
        throw new Error('Reset step failed; old database is unchanged');
    }
    run('createdb', [name]);
    url.pathname = '/' + name;
    env.DATABASE_URL = url.toString();
    run(process.execPath, [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      'packages/database/prisma/schema.prisma',
    ]);
    run(process.execPath, ['scripts/seed.cjs']);
    console.log(
      JSON.stringify({
        event: 'test_database_created',
        database: name,
        previousDatabaseUnchanged: true,
        action:
          'Stop writers, switch local DATABASE_URL, clear TEST browser sessions, then smoke-test before reopening.',
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
