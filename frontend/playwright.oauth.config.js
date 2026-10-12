import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './oauth-tests', workers: 1, timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: '../.test-artifacts/oauth-browser',
  use: { baseURL: 'https://courtsim.test', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), trace: 'off', screenshot: 'off' },
  projects: [{ name: 'desktop', use: devices['Desktop Chrome'] }],
  // Dùng bundle đã build để tránh hàng trăm request module dev qua proxy mô phỏng.
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4176', url: 'http://127.0.0.1:4176' },
});
