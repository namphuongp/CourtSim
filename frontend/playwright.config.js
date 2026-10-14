import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', timeout: 90000, workers: 1, fullyParallel: false,
  testIgnore: ['**/analytics-browser/**', '**/analytics.test.mjs'],
  outputDir: '../.test-artifacts/e2e', preserveOutput: 'failures-only',
  use: { baseURL: 'http://127.0.0.1:4175', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4175', url: 'http://127.0.0.1:4175', reuseExistingServer: false,
    env: { VITE_API_URL: 'http://127.0.0.1:5019/api' } },
});
