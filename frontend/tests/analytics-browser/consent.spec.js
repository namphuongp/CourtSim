import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const buildRoot = fileURLToPath(new URL('../../../.test-artifacts/analytics-build/', import.meta.url));
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.html': 'text/html' };

// Production giả lập: toàn bộ website và Google script bị chặn/mô phỏng, không gửi GA thật.
test.beforeEach(async ({ page, context }) => {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ contentType: 'application/javascript', body: 'window.__gaScriptLoads = (window.__gaScriptLoads || 0) + 1;' });
    if (!['courtsimvn.com', 'www.courtsimvn.com'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated fixture' } });
    const path = resolve(buildRoot, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(resolve(buildRoot) + sep) && path !== resolve(buildRoot)) return route.abort();
    const extension = extname(path);
    try {
      const body = await readFile(extension ? path : resolve(buildRoot, 'index.html'));
      return route.fulfill({ body, contentType: mime[extension] || 'text/html' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
});

const views = page => page.evaluate(() => (window.dataLayer || []).map(args => Array.from(args)).filter(([command, name]) => command === 'event' && name === 'page_view'));

test('consent, điều hướng, reload, rút lại và không rò rỉ query/hash', async ({ page }, testInfo) => {
  await page.goto('/?email=private@example.test#token-secret');
  const banner = page.getByRole('complementary', { name: 'Lựa chọn cookie phân tích' });
  await expect(banner).toBeVisible();
  await expect(page.locator('.landing-header')).toBeVisible();
  expect(await page.evaluate(() => window.dataLayer)).toBeUndefined();
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('consent.png'), fullPage: false });
  await banner.getByRole('button', { name: 'Đồng ý', exact: true }).click();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  await expect(banner).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__gaScriptLoads)).toBe(1);
  await page.evaluate(() => {
    history.pushState(null, '', '/?email=private@example.test#new-secret');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('.privacy-footer a').click();
  await expect(page.getByRole('heading', { name: 'Cài đặt quyền riêng tư' })).toBeVisible();
  await expect.poll(async () => (await views(page)).length).toBe(2);
  await page.goBack();
  await expect.poll(async () => (await views(page)).length).toBe(3);
  expect(JSON.stringify(await views(page))).not.toMatch(/private@|token-secret|email=/);
  await page.reload();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  await expect(banner).toHaveCount(0);
  await page.locator('.privacy-footer a').click();
  await expect.poll(async () => (await views(page)).length).toBe(2);
  await page.context().addCookies([
    { name: '_ga', value: 'fixture-client', domain: 'courtsimvn.com', path: '/', secure: true },
    { name: '_ga_HFLCZYBCK9', value: 'fixture-session', domain: '.courtsimvn.com', path: '/', secure: true },
    { name: 'courtsim_test_auth', value: 'fixture-auth', domain: 'courtsimvn.com', path: '/', secure: true, httpOnly: true },
  ]);
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('đã từ chối');
  expect(await page.evaluate(() => window['ga-disable-G-HFLCZYBCK9'])).toBe(true);
  const cookies = await page.context().cookies();
  expect(cookies.filter(c => c.name.startsWith('_ga'))).toHaveLength(0);
  expect(cookies.some(c => c.name === 'courtsim_test_auth')).toBe(true);
  await page.getByRole('link', { name: '← Quay lại CourtSim' }).click();
  expect((await views(page)).length).toBe(2);
  await page.reload();
  await expect(page.locator('.privacy-footer a')).toBeVisible();
  expect(await views(page)).toHaveLength(0);
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
  expect((await page.context().cookies()).filter(c => c.name.startsWith('_ga'))).toHaveLength(0);
});

test('từ chối ngay và đổi lựa chọn bằng bàn phím', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await page.locator('.privacy-footer a').click();
  await expect(page.getByRole('status')).toContainText('đã từ chối');
  expect(await views(page)).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('privacy.png'), fullPage: true });
  const accept = page.getByRole('button', { name: 'Đồng ý', exact: true });
  await accept.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('đã đồng ý');
  await expect.poll(async () => (await views(page)).length).toBe(1);
});

test('script bị chặn không làm hỏng trang', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Đồng ý', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window['ga-disable-G-HFLCZYBCK9'])).toBe(true);
  await page.locator('.privacy-footer a').click();
  await expect(page.getByRole('heading', { name: 'Cài đặt quyền riêng tư' })).toBeVisible();
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('đã từ chối');
});

test('rút consent ở tab khác dừng tracking ngay', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đồng ý', exact: true }).click();
  await expect.poll(async () => (await views(page)).length).toBe(1);
  const other = await context.newPage();
  await other.goto('/privacy');
  await expect(other.getByRole('status')).toContainText('đã đồng ý');
  await other.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window['ga-disable-G-HFLCZYBCK9'])).toBe(true);
  await page.locator('.privacy-footer a').click();
  await expect(page.getByRole('status')).toContainText('đã từ chối');
  expect(await views(page)).toHaveLength(1);
});
