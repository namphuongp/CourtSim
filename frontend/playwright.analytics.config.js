import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/analytics-browser', timeout: 45000, workers: 1,
  outputDir: '../.test-artifacts/analytics',
  use: { baseURL: 'https://courtsimvn.com', channel: process.platform === 'win32' ? 'msedge' : undefined },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
});
