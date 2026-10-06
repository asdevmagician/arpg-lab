import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 15000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 1280, height: 720 }, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/server.js --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});
