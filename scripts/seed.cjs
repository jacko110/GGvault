const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'apps/api/node_modules/ts-node/dist/bin.js'),
    '--project',
    path.join(root, 'apps/api/tsconfig.json'),
    path.join(root, 'packages/database/prisma/seed.ts'),
  ],
  { cwd: root, env: process.env, stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
