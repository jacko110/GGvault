// Run on an authorized machine OUTSIDE the eventual deployment host/VPN.
const net = require('node:net');
const dns = require('node:dns/promises');
const fs = require('node:fs');
function configured(value) {
  return (
    typeof value === 'string' && value.length > 0 && !/[<>\s/]/.test(value)
  );
}
async function closed(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(3000, () => finish(true));
    socket.once('connect', () => finish(false));
    socket.once('error', (error) =>
      finish(
        ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error.code)
          ? true
          : null,
      ),
    );
  });
}
async function main() {
  const {
    PLAYER_DOMAIN: player,
    ADMIN_DOMAIN: admin,
    TARGET_ADDRESS: host,
  } = process.env;
  if (
    ![player, admin, host].every(configured) ||
    process.env.CONFIRM_EXTERNAL_CHECK !== 'AUTHORIZED_OUTSIDE_HOST'
  ) {
    console.log('BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED');
    process.exitCode = 2;
    return;
  }
  const checks = [];
  const records = await Promise.all(
    [player, admin, host].map((name) => dns.lookup(name, { all: true })),
  );
  const addresses = [
    ...new Set(records.flat().map((record) => record.address)),
  ];
  checks.push({
    check: 'dns_records_resolved',
    pass: records.every((rows) => rows.length > 0),
  });
  for (const [domain, expected] of [
    [player, 401],
    [admin, 403],
  ]) {
    const response = await fetch(`https://${domain}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      check:
        domain === player
          ? 'player_https_invite_gate'
          : 'admin_outside_vpn_denied',
      pass: response.status === expected,
    });
    checks.push({
      check: `hsts_${domain === player ? 'player' : 'admin'}`,
      pass: /max-age=\d+/.test(
        response.headers.get('strict-transport-security') ?? '',
      ),
    });
    const redirect = await fetch(`http://${domain}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      check: 'https_redirect',
      pass:
        [301, 308].includes(redirect.status) &&
        redirect.headers.get('location') === `https://${domain}/`,
    });
    for (const path of [
      '/storage/evidence/',
      '/evidence/',
      '/docs',
      '/debug',
      '/metrics',
      '/_next/static/test.js.map',
    ]) {
      const result = await fetch(`https://${domain}${path}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      checks.push({
        check: `private_path_${path}`,
        pass: [401, 403, 404].includes(result.status),
      });
    }
  }
  for (const address of addresses)
    for (const port of [3000, 3001, 3002, 5432, 6379, 2375, 2376])
      checks.push({
        check: `closed_port_${port}`,
        address,
        pass: (await closed(address, port)) === true,
      });
  const result = {
    checkedAt: new Date().toISOString(),
    externalVantageAttested: true,
    checks,
    pass: checks.every((c) => c.pass),
  };
  const output = JSON.stringify(result, null, 2);
  if (process.env.INGRESS_REPORT_FILE)
    fs.writeFileSync(process.env.INGRESS_REPORT_FILE, output, { flag: 'wx' });
  console.log(output);
  if (!result.pass) process.exitCode = 1;
}
if (require.main === module)
  main().catch(() => {
    console.error(
      'Ingress verification failed; inspect DNS/TLS/connectivity without disabling certificate checks.',
    );
    process.exitCode = 1;
  });
module.exports = { configured, closed };
