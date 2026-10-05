const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { isIP } = require('node:net');
function strong(value) {
  return (
    typeof value === 'string' &&
    value.length >= 32 &&
    !/default|password|replace|placeholder|changeme|development|test-only|[<>\s]/i.test(
      value,
    )
  );
}
function domain(value) {
  return (
    typeof value === 'string' &&
    value.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value) &&
    !value.includes('..')
  );
}
function subnet(value) {
  if (typeof value !== 'string') return false;
  const [address, bits, extra] = value.split('/');
  return (
    !extra &&
    !!isIP(address) &&
    /^\d+$/.test(bits ?? '') &&
    Number(bits) > 0 &&
    Number(bits) <= (isIP(address) === 4 ? 32 : 128)
  );
}
function roster(text, cap) {
  const rows = text.trim().split(/\r?\n/),
    names = new Set();
  return (
    rows.length >= 1 &&
    rows.length <= cap &&
    rows.every((row) => {
      const match =
        /^([A-Za-z0-9_-]+):\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.exec(row);
      if (!match || names.has(match[1])) return false;
      names.add(match[1]);
      return true;
    })
  );
}
function containsSecret(directory, secrets) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Symlink rejected in scan');
    if (item.isDirectory()) {
      if (containsSecret(filename, secrets)) return true;
    } else {
      const bytes = fs.readFileSync(filename);
      if (
        secrets.some((secret) =>
          [
            secret,
            encodeURIComponent(secret),
            Buffer.from(secret).toString('base64'),
          ].some((value) => bytes.includes(Buffer.from(value))),
        )
      )
        return true;
    }
  }
  return false;
}
function main() {
  if (!process.env.DEPLOY_ENV_FILE) {
    console.log('BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED');
    process.exitCode = 2;
    return;
  }
  const env = parseEnv(fs.readFileSync(process.env.DEPLOY_ENV_FILE, 'utf8'));
  if (
    ![env.PLAYER_DOMAIN, env.ADMIN_DOMAIN].every(domain) ||
    env.PLAYER_DOMAIN === env.ADMIN_DOMAIN ||
    !subnet(env.ADMIN_VPN_CIDR)
  )
    throw new Error();
  const cap = Number(env.BETA_INVITE_CAP ?? 10);
  if (!Number.isInteger(cap) || cap < 1 || cap > 50) throw new Error();
  const read = (key) => fs.readFileSync(env[key], 'utf8').trim();
  const secrets = [
    'JWT_SECRET_FILE',
    'DB_PASSWORD_FILE',
    'DB_BOOTSTRAP_PASSWORD_FILE',
    'REDIS_PASSWORD_FILE',
  ].map(read);
  if (
    !secrets.every(strong) ||
    new Set(secrets).size !== secrets.length ||
    !/^[A-Za-z0-9_-]+$/.test(secrets[3])
  )
    throw new Error();
  if (
    !roster(read('PLAYER_ACCESS_FILE'), cap) ||
    !roster(read('ADMIN_ACCESS_FILE'), 50)
  )
    throw new Error();
  for (const directory of ['apps/web/.next/static', 'apps/admin/.next/static'])
    if (containsSecret(directory, secrets)) throw new Error();
  if (
    process.env.LOG_SCAN_DIR &&
    containsSecret(process.env.LOG_SCAN_DIR, secrets)
  )
    throw new Error();
  console.log(
    JSON.stringify({
      status: 'REFERENCE_AND_BUNDLE_CHECKS_PASSED',
      logs: process.env.LOG_SCAN_DIR ? 'scanned' : 'UNVERIFIED',
      certificate: 'verify externally',
      bootstrapOperator: 'named-account review still required',
    }),
  );
}
if (require.main === module) {
  try {
    main();
  } catch {
    console.error(
      'Deployment preflight failed; inspect domain, VPN, roster, secret references and bundle/log configuration privately.',
    );
    process.exitCode = 1;
  }
}
module.exports = { strong, domain, subnet, roster, containsSecret };
