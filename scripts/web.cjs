const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
const result = spawnSync(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    process.argv[2] || 'dev',
    '-p',
    process.env.WEB_PORT || '3000',
  ],
  { cwd: path.join(root, 'apps/web'), env: process.env, stdio: 'inherit' },
);
if (result.error) console.error('Unable to start web server.');
process.exitCode = result.status ?? 1;
