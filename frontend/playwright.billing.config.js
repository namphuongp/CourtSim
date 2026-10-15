import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './billing-tests', timeout: 30000, workers: 1,
  outputDir: '../.test-artifacts/billing-browser',
  use: { baseURL: 'http://127.0.0.1:4177', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), trace: 'off' },
  projects: [{ name: 'desktop', use: devices['Desktop Chrome'] }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4177', url: 'http://127.0.0.1:4177' },
});
