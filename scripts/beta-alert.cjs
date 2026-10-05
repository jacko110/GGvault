const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const payload = {
  event: 'synthetic_ledger_invariant_critical',
  severity: 'CRITICAL',
  synthetic: true,
  reference: randomUUID(),
  timestamp: new Date().toISOString(),
};
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ status: 'DRY_RUN_NOT_DELIVERED', payload }));
} else if (
  !process.env.ALERT_ADAPTER_FILE ||
  !fs.existsSync(process.env.ALERT_ADAPTER_FILE)
) {
  console.log('BLOCKED — DEPLOYMENT TARGET NOT YET PROVIDED');
  process.exitCode = 2;
} else {
  // The operator supplies the channel adapter and its own secret references later.
  // No arbitrary financial/customer object can enter this synthetic payload.
  const result = spawnSync(process.execPath, [process.env.ALERT_ADAPTER_FILE], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });
  if (result.status !== 0) {
    console.error('Alert adapter failed');
    process.exitCode = 1;
  } else
    console.log(
      JSON.stringify({
        status: 'ADAPTER_ACCEPTED_RECEIPT_STILL_REQUIRED',
        reference: payload.reference,
      }),
    );
}
