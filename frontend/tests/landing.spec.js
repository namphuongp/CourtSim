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
  await page.getByRole('link', { name: 'Bắt đầu luyện tập', exact: true }).click();
  await expect(page).toHaveURL(/login\?returnTo=%2Fdashboard%2Fsetup$/);
});
