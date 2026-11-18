import { test, expect } from '@playwright/test';

test('trang chủ: liên kết nội bộ, FAQ, thông tin điểm và đăng nhập để luyện tập', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await expect(page.getByText(/Chỉ có điểm toàn bài khi đủ dữ liệu/)).toBeVisible();
  await expect(page.getByText(/Speech.to.Text|Trở thành Thẩm phán/)).toHaveCount(0);
  const fragments = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href').slice(1)));
  for (const id of fragments) expect(await page.evaluate(id => Boolean(document.getElementById(id)), id)).toBe(true);
  await page.getByRole('link', { name: 'Câu hỏi thường gặp', exact: true }).click();
  await expect(page).toHaveURL(/guide#faq$/);
  await page.getByText('Tôi có thể chọn những vai nào?', { exact: true }).click();
  await expect(page.locator('#faq')).toContainText('luật sư bảo vệ nguyên đơn');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await page.getByRole('link', { name: 'Bắt đầu miễn phí', exact: true }).first().click();
  await expect(page).toHaveURL(/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/dashboard/setup?start=cases');
});

for (const role of ['admin', 'user']) {
  test(`trang chủ đã đăng nhập: menu tài khoản ${role}`, async ({ page }, info) => {
    await page.setViewportSize(info.project.name === 'mobile'
      ? { width: 390, height: 664 }
      : { width: 1440, height: 900 });
    const fullName = 'Nguyễn Minh Anh, người dùng kiểm thử có tên dài';
    let signedIn = true;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/logout')) {
        signedIn = false;
        return route.fulfill({ json: {} });
      }
      if (path.endsWith('/auth/me')) return route.fulfill(signedIn
        ? { json: { user: { id: 'landing-user', role, full_name: fullName } } }
        : { status: 401, json: {} });
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto('/');
    const header = page.locator('.landing-header');
    const account = header.getByRole('button', { name: 'Tài khoản', exact: true });
    const admin = header.getByRole('link', { name: 'Quản trị', exact: true });
    await expect(header.getByRole('link', { name: 'Tổng quan', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(account).toBeInViewport({ ratio: 1 });
    await expect(header.getByText(fullName, { exact: true })).toBeHidden();
    await expect(admin).toBeHidden();
    await expect(header.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Chọn vụ án', exact: true })).toHaveCount(0);
    await expect(page.locator('.landing-hero').getByRole('link', { name: 'Chọn vụ án', exact: true })).toHaveAttribute('href', '/dashboard/setup?start=cases');

    await account.click();
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await expect(header.getByText(fullName, { exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Hồ sơ cá nhân', exact: true })).toHaveAttribute('href', '/account');
    if (role === 'admin') await expect(admin).toHaveAttribute('href', '/admin');
    else await expect(admin).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Thư viện vụ án', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(account).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await account.click();
    await header.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(signedIn).toBe(false);
  });
}
