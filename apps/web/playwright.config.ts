import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 10000 },
  outputDir: '../../.cache/web-test-results',
  reporter: [['list']],
  use: {
    actionTimeout: 15000,
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/web-test-server.cjs admin',
      cwd: path.resolve(__dirname, '../..'),
      url: 'http://127.0.0.1:3102/login',
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/web-test-server.cjs api',
      cwd: path.resolve(__dirname, '../..'),
      url: 'http://127.0.0.1:3101/health',
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/web-test-server.cjs web',
      cwd: path.resolve(__dirname, '../..'),
      url: 'http://127.0.0.1:3100/login',
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
