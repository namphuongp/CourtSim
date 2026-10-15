import { test, expect } from '@playwright/test';

test('admin tạo hồ sơ: giữ dữ liệu khi lỗi, chứng cứ, phân trang và xem hồ sơ', async ({ page }) => {
  const existing = { _id: 'existing', title: 'Hồ sơ đã có', category: 'dân sự', summary: 'Tình huống kiểm thử.', full_document: 'Nội dung hồ sơ.', evidence_inventory: [] };
  let created, attempts = 0;
  await page.route('**/api/**', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'admin', full_name: 'Quản trị viên', role: 'admin' } } });
    if (request.method() === 'POST') {
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { message: 'Chưa tạo được vụ án.' } });
      created = { ...request.postDataJSON(), _id: 'created' };
      return route.fulfill({ status: 201, json: { data: created } });
    }
    if (url.pathname.endsWith('/cases/existing')) return route.fulfill({ json: { data: existing } });
    const pageNumber = Number(url.searchParams.get('page'));
    return route.fulfill({ json: { data: pageNumber === 2 ? [existing] : created ? [created] : [], pagination: { page: pageNumber, limit: 10, total: 11 } } });
  });
  await page.goto('/admin/cases');
  await page.getByLabel('Tên vụ án', { exact: true }).fill('Vụ án mới');
  await page.getByLabel('Tóm tắt vụ án').fill('Tranh chấp hư cấu dùng kiểm thử.');
  await page.getByLabel('Nội dung hồ sơ').fill('Có hợp đồng vay được cung cấp. Biên nhận chỉ được nhắc đến.');
  await page.getByRole('button', { name: 'Thêm chứng cứ' }).click();
  await page.getByLabel('Tên chứng cứ 1', { exact: true }).fill('Hợp đồng vay');
  await page.getByLabel('Nội dung chứng cứ 1').fill('Nguyên văn hợp đồng kiểm thử.');
  await page.getByRole('button', { name: 'Thêm chứng cứ' }).click();
  await page.getByLabel('Tên chứng cứ 2', { exact: true }).fill('Biên nhận');
  await page.getByLabel('Trạng thái chứng cứ 2').selectOption('mentioned_only');
  await page.getByRole('button', { name: 'Tạo vụ án', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Tên vụ án', { exact: true })).toHaveValue('Vụ án mới');
  await expect(page.getByLabel('Nội dung chứng cứ 1')).toHaveValue('Nguyên văn hợp đồng kiểm thử.');
  await page.getByRole('button', { name: 'Tạo vụ án', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo vụ án' })).toBeVisible();
  expect(created.evidence_inventory[0].content).toBe('Nguyên văn hợp đồng kiểm thử.');
  expect(created.evidence_inventory[1].availability).toBe('mentioned_only');
  await expect(page.getByLabel('Tên vụ án', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await page.getByRole('button', { name: 'Xem hồ sơ: Hồ sơ đã có', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Chi tiết hồ sơ' })).toContainText('Nội dung hồ sơ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
