/* Local-only configuration checks. Disposable loopback certificate/credentials are
 * fixtures, never deployment credentials. No host ports or public DNS are used. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, '.cache', 'deployment-config-' + randomUUID());
fs.mkdirSync(folder, { recursive: true });
function execute(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Local ${path.basename(command)} configuration check failed (exit ${result.status})`,
    );
  return result.stdout;
}
const env = {
  ...process.env,
  PLAYER_DOMAIN: 'localhost',
  ADMIN_DOMAIN: '127.0.0.1',
  ADMIN_VPN_CIDR: '127.0.0.1/32',
  BETA_INVITE_CAP: '10',
};
for (const [key, name] of [
  ['DB_PASSWORD_FILE', 'db_password'],
  ['DB_BOOTSTRAP_PASSWORD_FILE', 'db_bootstrap_password'],
  ['REDIS_PASSWORD_FILE', 'redis_password'],
  ['JWT_SECRET_FILE', 'jwt_secret'],
]) {
  env[key] = path.join(folder, name);
  fs.writeFileSync(env[key], randomBytes(32).toString('hex'), { mode: 0o600 });
}
// Bcrypt-format fixture: not a real invitation/password, used only by nginx -t.
for (const [key, name] of [
  ['PLAYER_ACCESS_FILE', 'player_access'],
  ['ADMIN_ACCESS_FILE', 'admin_access'],
]) {
  env[key] = path.join(folder, name);
  fs.writeFileSync(env[key], 'fixture:$2y$12$' + 'a'.repeat(53) + '\n', {
    mode: 0o600,
  });
}
env.TLS_CERT_FILE = path.join(folder, 'tls_cert');
env.TLS_KEY_FILE = path.join(folder, 'tls_key');
const openssl =
  process.env.LOCAL_OPENSSL ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
    : 'openssl');
try {
  execute(openssl, [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout',
    env.TLS_KEY_FILE,
    '-out',
    env.TLS_CERT_FILE,
  ]);
  const config = JSON.parse(
    execute(
      'docker',
      [
        'compose',
        '-f',
        'deploy/compose.beta.yml',
        'config',
        '--format',
        'json',
      ],
      env,
    ),
  );
  assert.deepEqual(
    Object.keys(config.services).filter(
      (k) => config.services[k].ports?.length,
    ),
    ['gateway'],
  );
  for (const network of ['frontend', 'application', 'database'])
    assert.equal(config.networks[network].internal, true);
  for (const service of ['web', 'admin', 'api'])
    assert.ok(
      !config.services[service].secrets.some(
        (s) => s.source === 'db_bootstrap_password',
      ),
    );
  const redisIdentity = execute('docker', [
    'run',
    '--rm',
    '--network',
    'none',
    'redis:7-alpine',
    'sh',
    '-c',
    'id -u redis; id -g redis',
  ])
    .trim()
    .split(/\s+/);
  assert.deepEqual(redisIdentity, ['999', '1000']);
  for (const script of [
    'gateway-start.sh',
    'redis-start.sh',
    'postgres-init.sh',
  ])
    execute('docker', [
      'run',
      '--rm',
      '--network',
      'none',
      '--mount',
      `type=bind,src=${path.join(root, 'deploy', script)},dst=/check.sh,readonly`,
      'redis:7-alpine',
      'sh',
      '-n',
      '/check.sh',
    ]);
  const args = [
    'run',
    '--rm',
    '--network',
    'none',
    '--add-host',
    'web:127.0.0.1',
    '--add-host',
    'admin:127.0.0.1',
    '--mount',
    `type=bind,src=${folder},dst=/run/secrets,readonly`,
    '--mount',
    `type=bind,src=${path.join(root, 'deploy/nginx.conf.template')},dst=/etc/nginx/templates/default.conf.template,readonly`,
    '--mount',
    `type=bind,src=${path.join(root, 'deploy/gateway-start.sh')},dst=/opt/gateway-start.sh,readonly`,
  ];
  for (const key of [
    'PLAYER_DOMAIN',
    'ADMIN_DOMAIN',
    'ADMIN_VPN_CIDR',
    'BETA_INVITE_CAP',
  ])
    args.push('-e', `${key}=${env[key]}`);
  args.push(
    '-e',
    'NGINX_ENVSUBST_FILTER=^(PLAYER_DOMAIN|ADMIN_DOMAIN|ADMIN_VPN_CIDR)$',
    'nginx:stable-alpine',
    'sh',
    '/opt/gateway-start.sh',
    'nginx',
    '-t',
  );
  execute('docker', args);
  assert.throws(() =>
    execute(
      'docker',
      args.map((value) =>
        value.startsWith('ADMIN_VPN_CIDR=')
          ? 'ADMIN_VPN_CIDR=0.0.0.0/00'
          : value,
      ),
    ),
  );
  assert.throws(() =>
    execute(
      'docker',
      args.map((value) =>
        value.startsWith('BETA_INVITE_CAP=') ? 'BETA_INVITE_CAP=51' : value,
      ),
    ),
  );
  console.log(
    JSON.stringify({
      localOnly: true,
      compose: true,
      privatePorts: true,
      separateBootstrapSecret: true,
      redisIdentity: true,
      shellSyntax: true,
      nginxSyntax: true,
      unsafeGatewayConfigurationRejected: true,
      externalDeployment: 'UNVERIFIED',
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
