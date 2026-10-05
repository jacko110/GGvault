const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const {
  strong,
  domain,
  subnet,
  roster,
  containsSecret,
} = require('./verify-deployment-secrets.cjs');
const { isolated, identifiers } = require('./beta-backup.cjs');
test('backup identifiers respect quoted configuration and Compose environment precedence', () => {
  assert.deepEqual(
    identifiers('POSTGRES_DB="custom_beta"\nPOSTGRES_USER=custom_user', {}),
    { user: 'custom_user', live: 'custom_beta' },
  );
  assert.equal(
    identifiers('POSTGRES_DB=custom_beta', { POSTGRES_DB: 'override_beta' })
      .live,
    'override_beta',
  );
  assert.throws(() => identifiers('POSTGRES_DB=invalid-name', {}));
});
const { closed } = require('./verify-beta-ingress.cjs');
test('configuration rejects placeholders, default secrets, unrestricted admin networks and excessive invitations', () => {
  assert.equal(domain('<PLAYER_DOMAIN>'), false);
  assert.equal(domain('x;inject'), false);
  assert.equal(subnet('0.0.0.0/0'), false);
  assert.equal(subnet('::/0'), false);
  assert.equal(subnet('127.0.0.1/32'), true);
  assert.equal(
    strong('default-password-that-is-over-thirty-two-characters'),
    false,
  );
  assert.equal(strong(randomBytes(32).toString('hex')), true);
  const hash = '$2y$12$' + 'a'.repeat(53);
  assert.equal(roster('one:' + hash, 10), true);
  assert.equal(roster('one:' + hash + '\none:' + hash, 10), false);
  assert.equal(
    roster(
      Array.from({ length: 11 }, (_, i) => `p${i}:${hash}`).join('\n'),
      10,
    ),
    false,
  );
  assert.equal(roster('one:plaintext', 10), false);
});
test('restore destinations cannot select the live database or arbitrary names', () => {
  assert.equal(isolated('ggvault_beta', 'ggvault_beta'), false);
  assert.equal(
    isolated('ggvault_restore_trial', 'ggvault_restore_trial'),
    false,
  );
  assert.equal(isolated('ggvault_restore_trial', 'ggvault_beta'), true);
  assert.equal(isolated('ggvault_restore_x;DROP', 'ggvault_beta'), false);
});
test('bundle scan detects encoded secrets without printing values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ggvault-scan-'));
  const secret = randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(
      path.join(directory, 'client.js'),
      Buffer.from(secret).toString('base64'),
    );
    assert.equal(containsSecret(directory, [secret]), true);
    assert.equal(
      containsSecret(directory, [randomBytes(32).toString('hex')]),
      false,
    );
  } finally {
    fs.unlinkSync(path.join(directory, 'client.js'));
    fs.rmdirSync(directory);
  }
});
test('network check distinguishes a listening port from a refused local port', async () => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  assert.equal(await closed('127.0.0.1', port), false);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await closed('127.0.0.1', port), true);
});
test('external tools fail closed without a target or selected alert channel', () => {
  const env = { ...process.env };
  for (const key of [
    'DEPLOY_ENV_FILE',
    'PLAYER_DOMAIN',
    'ADMIN_DOMAIN',
    'TARGET_ADDRESS',
    'ALERT_ADAPTER_FILE',
  ])
    delete env[key];
  for (const script of [
    'verify-beta-ingress',
    'verify-deployment-secrets',
    'beta-backup',
    'beta-alert',
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, script + '.cjs')],
      { env, encoding: 'utf8', windowsHide: true },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED/);
  }
  const dry = spawnSync(
    process.execPath,
    [path.join(__dirname, 'beta-alert.cjs'), '--dry-run'],
    { env, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(dry.stdout).status, 'DRY_RUN_NOT_DELIVERED');
});
