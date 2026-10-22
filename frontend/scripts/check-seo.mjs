import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const output = resolve(root, '../.test-artifacts/seo');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
const origin = 'https://www.courtsimvn.com';
const title = 'CourtSim – Nền tảng AI mô phỏng phiên tòa';
const description = 'CourtSim giúp sinh viên luật luyện tập tranh tụng qua phiên tòa mô phỏng với AI, rèn luyện kỹ năng lập luận, phản biện và áp dụng pháp luật.';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };
const privatePaths = ['/login', '/register', '/auth', '/auth/callback?code=secret', '/verify-email', '/forgot-password', '/reset-password?token=secret', '/account', '/account/security', '/checkout/pro', '/admin', '/admin/users/123', '/dashboard', '/dashboard/history', '/simulation/private-id', '/simulation/private-id/result', '/unknown-page'];

await mkdir(output, { recursive: true });
const icon = await readFile(resolve(dist, 'courtsim-favicon.png'));
assert.equal(icon.readUInt32BE(16), 512);
assert.equal(icon.readUInt32BE(20), 512);
assert.deepEqual(icon, await readFile(resolve(root, 'public/courtsim-favicon.png')));
const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8');
assert.match(robots, /Sitemap: https:\/\/www\.courtsimvn\.com\/sitemap\.xml/);
assert.doesNotMatch(robots, /^Disallow:\s*\//m);
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [origin + '/', origin + '/guide', origin + '/privacy']);
assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: 'https://courtsim-api.onrender.com/api/:path*' });

// Giả lập quy tắc deploy bằng file build; không truy cập backend hay gửi dữ liệu GA thật.
async function serve(route) {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated fixture' } });
  const redirect = config.redirects.find(rule => rule.source === url.pathname);
  if (redirect) return route.fulfill({ status: 308, headers: { location: redirect.destination + url.search } });
  const file = resolve(dist, '.' + decodeURIComponent(url.pathname));
  if (file !== dist && !file.startsWith(dist + sep)) return route.abort();
  let body;
  let target = file;
  try { body = await readFile(file); } catch {
    const rewrite = config.rewrites.find(rule => rule.source === url.pathname || rule.source === '/(.*)');
    assert.ok(rewrite, `Missing route ${url.pathname}`);
    target = resolve(dist, '.' + rewrite.destination);
    body = await readFile(target);
  }
  const headers = {};
  for (const rule of config.headers) {
    const matches = rule.source.startsWith('/:path(')
      ? new RegExp('^/' + rule.source.slice(7, -1) + '$').test(url.pathname)
      : rule.source === url.pathname;
    if (matches) for (const header of rule.headers) headers[header.key] = header.value;
  }
  return route.fulfill({ body, contentType: mime[extname(target)] || 'application/octet-stream', headers });
}

const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  const raw = await browser.newContext({ javaScriptEnabled: false });
  await raw.route('**/*', serve);
  const page = await raw.newPage();
  await page.goto(origin + '/?utm_source=test');
  assert.equal(await page.title(), title);
  assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), description);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), origin + '/');
  assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute('content'), 'CourtSim');
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), title);
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary');
  const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.equal(structured['@graph'][0].name, 'CourtSim');
  for (const path of ['/guide', '/privacy']) {
    await page.goto(origin + path);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), origin + path);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /^index,/);
    assert.notEqual(await page.title(), title);
  }
  for (const path of privatePaths) {
    const response = await page.goto(origin + path);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /^noindex,/);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0);
    if (path !== '/unknown-page') assert.equal(response.headers()['x-robots-tag'], 'noindex, follow');
  }
  for (const path of ['/courtsim-favicon.png', '/robots.txt', '/sitemap.xml']) {
    const response = await page.goto(origin + path);
    assert.equal(response.status(), 200);
    assert.ok(response.headers()['content-type'].startsWith(mime[extname(path)]));
  }
  await raw.close();

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', serve);
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await tab.goto(origin + '/');
    await tab.locator('.landing-header').waitFor();
    assert.equal(await tab.title(), title);
    assert.doesNotMatch(await tab.locator('body').innerText(), /Penetration Pricing|Bundle Pricing/i);
    assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await tab.locator('.landing-header').getByRole('link', { name: 'Bảng giá', exact: true }).click();
    await tab.waitForURL('**/pricing');
    await tab.locator('.pricing-card').first().waitFor();
    assert.equal(await tab.locator('.pricing-card').count(), 4);
    await tab.locator('.pricing-grid').screenshot({ path: resolve(output, `pricing-${viewport.width}.png`) });
    await tab.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
    await tab.waitForURL('**/login');
    await tab.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content.startsWith('noindex'));
    assert.equal(await tab.locator('link[rel="canonical"]').count(), 0);
    await tab.goBack();
    await tab.waitForURL('**/pricing');
    await tab.goBack();
    await tab.waitForFunction(expected => document.title === expected, title);
    assert.equal(await tab.locator('link[rel="canonical"]').getAttribute('href'), origin + '/');
    await tab.locator('.privacy-footer a').click();
    await tab.waitForFunction(expected => document.querySelector('link[rel="canonical"]')?.href === expected, origin + '/privacy');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`SEO OK: static metadata without JS, ${privatePaths.length} noindex routes, sitemap/robots/icon, SPA navigation, desktop/mobile layout. Vercel routing and auth are mocked.`);
} finally {
  await browser.close();
}
