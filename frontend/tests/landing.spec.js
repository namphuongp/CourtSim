import { test, expect } from '@playwright/test';
import { sampleLandCase } from '../../backend/src/data/sampleLandCase.js';

test('trang chủ gọn, footer đủ liên kết, không còn ví dụ hoặc cảnh phiên tòa', async ({ page }) => {
  const sceneRequests = [];
  const sessionRequests = [];
  page.on('request', request => {
    if (/courtsim-characters|courtroom-background/.test(request.url())) sceneRequests.push(request.url());
    if (request.method() === 'POST' && request.url().includes('/sessions')) sessionRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('main img,main video,main canvas')).toHaveCount(0);
  await expect(page.locator('#sample-case')).toHaveCount(0);
  await expect(page.locator('.landing-criteria')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('Điểm quy đổi về thang 100 từ phần đủ dữ liệu');
  await expect(page.getByRole('contentinfo')).toContainText('không thay thế đánh giá chuyên môn');
  await expect(page.getByRole('contentinfo')).not.toContainText('Tiếng Việt');
  await expect(page.getByRole('navigation', { name: 'Hỗ trợ', exact: true }).getByRole('link', { name: 'Hướng dẫn sử dụng' })).toHaveAttribute('href', '/guide');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Chọn vụ án' })).toHaveAttribute('href', '/dashboard/setup');
  await expect(page.getByRole('contentinfo').getByRole('navigation', { name: 'CourtSim', exact: true })).toHaveCount(0);
  const pending = page.getByRole('contentinfo').getByRole('link', { name: 'Chính sách bảo mật', exact: true });
  await expect(pending).toHaveAttribute('aria-disabled', 'true');
  await expect(pending).not.toHaveAttribute('href');
  await pending.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main')).not.toContainText('mentioned_only');
  expect(sceneRequests).toEqual([]);
  expect(sessionRequests).toEqual([]);
  for (const href of await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
    await expect(page.locator(href)).toHaveCount(1);
  }
  for (const link of await page.getByRole('link', { name: 'Bắt đầu luyện tập', exact: false }).all()) {
    await expect(link).toHaveAttribute('href', '/dashboard/setup');
  }
  await expect(page.locator('.landing-header').getByRole('link', { name: 'Đăng nhập', exact: false })).toHaveAttribute('href', '/login');
});

test('CTA đi qua đăng nhập đến danh sách vụ án, không tạo phiên', async ({ page }) => {
  let creations = 0;
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const send = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'POST' && path.includes('/sessions')) creations++;
    if (path.endsWith('/auth/register')) return send({ message: 'Đã tạo tài khoản' });
    if (path.endsWith('/auth/login')) return send({ token: 'landing-test', user: { id: 'user-1', full_name: 'Người học', role: 'user' } });
    if (path.endsWith('/cases')) return send({ data: [{ ...sampleLandCase, _id: 'sample-land' }], pagination: { total: 1 } });
    return send({ data: [] });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Bắt đầu luyện tập' }).first().click();
  await expect(page).toHaveURL(/login\?returnTo=%2Fdashboard%2Fsetup/);
  await page.getByRole('link', { name: 'Đăng ký', exact: true }).click();
  await expect(page).toHaveURL(/register\?returnTo=%2Fdashboard%2Fsetup/);
  await page.getByLabel('Họ và tên').fill('Người học');
  await page.getByLabel('Email').fill('learner@example.com');
  await page.getByLabel('Mật khẩu').fill('Password123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page).toHaveURL(/login\?registered=1&returnTo=%2Fdashboard%2Fsetup/);
  await page.getByLabel('Email').fill('learner@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/dashboard\/setup$/);
  await expect(page.getByText(sampleLandCase.title, { exact: true })).toBeVisible();
  expect(creations).toBe(0);
});

test('trang chủ dùng bàn phím, giảm chuyển động và không tràn ngang', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Đến nội dung chính' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Bắt đầu luyện tập' }).first()).toBeFocused();
  await page.getByRole('heading', { name: 'Đến lượt bạn xây dựng lập luận.' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.landing-reveal').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).animationName === 'none'))).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('landing-full.png'), fullPage: true, scale: 'css' });
});

test('chuyển động chạy một lần, footer mở được hướng dẫn', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#skills').scrollIntoViewIfNeeded();
  await expect(page.locator('.landing-skills')).toHaveClass(/landing-entered/);
  await expect.poll(() => page.locator('.landing-skills').evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished'))).toBe(true);
  await page.locator('.landing-header').scrollIntoViewIfNeeded();
  await page.locator('#skills').scrollIntoViewIfNeeded();
  expect(await page.locator('.landing-skills').evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished'))).toBe(true);
  expect(await page.locator('.landing-page *').evaluateAll(nodes => nodes.some(node => getComputedStyle(node).animationIterationCount === 'infinite'))).toBe(false);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Hướng dẫn sử dụng' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
