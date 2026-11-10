import { test, expect } from '@playwright/test';

test('Excel downloads preserve filters for users and both payment views; errors allow retry', async ({ page }) => {
  const queries = [];
  let fail = false;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'admin', full_name: 'Admin', role: 'admin' } } });
    if (url.pathname.endsWith('/export')) {
      queries.push(url);
      if (fail) return route.fulfill({ status: 400, json: { error: { code: 'EXPORT_TOO_LARGE' } } });
      return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'fixture' });
    }
    return route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0 }, summary: { totalOrders: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0 } } });
  });
  async function download() {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click();
    expect((await pending).suggestedFilename()).toMatch(/\.xlsx$/);
    expect(queries.at(-1).searchParams.has('page')).toBe(false);
    expect(queries.at(-1).searchParams.has('limit')).toBe(false);
  }
  await page.goto('/admin/users');
  await page.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('admin');
  await download();
  expect(queries.at(-1).searchParams.get('role')).toBe('admin');
  await page.goto('/admin/payments?user=user-one');
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('paid');
  await download();
  expect(queries.at(-1).searchParams.get('status')).toBe('paid');
  expect(queries.at(-1).searchParams.get('user_id')).toBe('user-one');
  await page.getByRole('button', { name: 'Theo người dùng', exact: true }).click();
  await download();
  expect(queries.at(-1).searchParams.get('view')).toBe('users');
  fail = true;
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('10.000');
  fail = false;
  await download();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
