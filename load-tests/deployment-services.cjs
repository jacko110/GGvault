// Disposable local containers, no published ports, no actual deployment target.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  suffix = randomUUID().slice(0, 8);
const folder = path.join(root, '.cache', 'service-config-' + suffix);
fs.mkdirSync(folder, { recursive: true });
for (const name of ['db_password', 'db_bootstrap_password', 'redis_password'])
  fs.writeFileSync(path.join(folder, name), randomBytes(32).toString('hex'), {
    mode: 0o600,
  });
const pg = 'ggvault-config-pg-' + suffix,
  redis = 'ggvault-config-redis-' + suffix,
  created = [];
function docker(args, required = true) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  });
  if (required && (r.status !== 0 || r.error))
    throw new Error('Disposable service check failed: ' + args[0]);
  return r;
}
(async () => {
  try {
    docker([
      'run',
      '-d',
      '--name',
      pg,
      '--network',
      'none',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '--mount',
      `type=bind,src=${folder},dst=/run/secrets,readonly`,
      '--mount',
      `type=bind,src=${path.join(root, 'deploy/postgres-init.sh')},dst=/docker-entrypoint-initdb.d/10-app.sh,readonly`,
      '-e',
      'POSTGRES_DB=fixture',
      '-e',
      'POSTGRES_USER=ggvault_owner',
      '-e',
      'APP_DB_USER=ggvault',
      '-e',
      'POSTGRES_PASSWORD_FILE=/run/secrets/db_bootstrap_password',
      'postgres:16-alpine',
    ]);
    created.push(pg);
    let ready = false;
    for (let i = 0; i < 45; i++) {
      const check = docker(
        [
          'exec',
          pg,
          'psql',
          '-U',
          'ggvault_owner',
          '-d',
          'fixture',
          '-Atc',
          "SELECT rolname FROM pg_roles WHERE rolname='ggvault'",
        ],
        false,
      );
      if (check.status === 0 && check.stdout.trim() === 'ggvault') {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(ready, 'Application role initialization');
    assert.equal(
      docker([
        'exec',
        pg,
        'psql',
        '-U',
        'ggvault_owner',
        '-d',
        'fixture',
        '-Atc',
        "SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='ggvault'",
      ]).stdout.trim(),
      'f|f|f',
    );
    docker([
      'exec',
      pg,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'ggvault',
      '-d',
      'fixture',
      '-c',
      'CREATE TABLE migration_probe(id int); INSERT INTO migration_probe VALUES(1);',
    ]);
    assert.notEqual(
      docker(
        [
          'exec',
          pg,
          'psql',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'ggvault',
          '-d',
          'fixture',
          '-c',
          'CREATE ROLE forbidden_super SUPERUSER;',
        ],
        false,
      ).status,
      0,
    );
    docker([
      'run',
      '-d',
      '--name',
      redis,
      '--network',
      'none',
      '--user',
      'redis',
      '--tmpfs',
      '/run/redis:uid=999,gid=1000,mode=0700',
      '--tmpfs',
      '/data:uid=999,gid=1000,mode=0700',
      '--mount',
      `type=bind,src=${folder},dst=/run/secrets,readonly`,
      '--mount',
      `type=bind,src=${path.join(root, 'deploy/redis-start.sh')},dst=/opt/start.sh,readonly`,
      '--entrypoint',
      'sh',
      'redis:7-alpine',
      '/opt/start.sh',
    ]);
    created.push(redis);
    let pong = false;
    for (let i = 0; i < 15; i++) {
      const r = docker(
        [
          'exec',
          redis,
          'sh',
          '-c',
          'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli ping',
        ],
        false,
      );
      if (r.status === 0 && r.stdout.trim() === 'PONG') {
        pong = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(pong, 'Authenticated Redis readiness');
    assert.match(docker(['exec', redis, 'redis-cli', 'ping']).stdout, /NOAUTH/);
    for (const name of created)
      assert.equal(docker(['port', name]).stdout.trim(), '');
    console.log(
      JSON.stringify({
        localOnly: true,
        applicationRoleLeastPrivilege: true,
        migrationPrivilege: true,
        redisAuthentication: true,
        noPublishedPorts: true,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    for (const name of created) docker(['rm', '-f', name]);
  }
})();
