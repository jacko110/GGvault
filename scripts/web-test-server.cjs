// Isolated ports; the real API uses the existing disposable development database.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
Object.assign(process.env, {
  APP_PORT: '3101',
  PORT: '3101',
  WEB_PORT: '3100',
  API_BASE_URL: 'http://127.0.0.1:3101',
  WEB_ORIGIN: 'http://127.0.0.1:3100',
  WEB_COOKIE_SECURE: 'false',
  ENABLE_TEST_CREDITS: 'true',
  INITIAL_TEST_CREDITS: '100',
});
const api = process.argv[2] === 'api';
const child = spawn(
  process.execPath,
  api
    ? [path.join(root, 'apps/api/dist/main.js')]
    : [require.resolve('next/dist/bin/next'), 'start', '-p', '3100'],
  {
    cwd: api ? root : path.join(root, 'apps/web'),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
