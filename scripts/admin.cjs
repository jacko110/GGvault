const path = require('node:path'),
  fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
process.env.GGVAULT_APP = 'admin';
process.env.WEB_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3002';
const result = spawnSync(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    process.argv[2] ?? 'dev',
    '-p',
    process.env.ADMIN_PORT ?? '3002',
  ],
  {
    cwd: path.join(root, 'apps/admin'),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  },
);
process.exitCode = result.status ?? 1;
