const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
process.env.JWT_SECRET ||= 'test-only-jwt-secret-never-use-in-production-0001';
process.env.NODE_ENV = 'test';
const category = process.argv[2] || 'all';
const patterns = {
  unit: '\\.(spec|test)\\.ts$',
  integration: '\\.integration-spec\\.ts$',
  e2e: '\\.e2e-spec\\.ts$',
};
const args = [
  require.resolve('jest/bin/jest'),
  '--runInBand',
  '--config',
  path.join(root, 'apps/api/jest.config.js'),
];
if (patterns[category]) args.push('--testPathPattern', patterns[category]);
args.push(...process.argv.slice(3));
const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
