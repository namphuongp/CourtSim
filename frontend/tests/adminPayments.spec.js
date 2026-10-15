import { test, expect } from '@playwright/test';

test('admin thanh toán: tổng tiền, lịch sử người dùng, chi tiết và đối soát', async ({ page }, info) => {
  const user = { _id: 'user-one', username: 'Nguyễn Thị Ánh', email: 'anh@example.test' };
  const timestamp = '2026-10-15T03:00:00.000Z';
  const paid = { id: 'paid', transaction_id: 'CS1234567890ABCDEF12345678', order_code: 'CS1234567890ABCDEF12345678',
    amount: 99000, status: 'paid', user, plan: { name: 'Lite' }, created_at: timestamp, paid_at: timestamp, verification: { source: 'sepay_polling' } };
  const pending = { ...paid, id: 'pending', transaction_id: 'CS1234567890ABCDEF12345679', order_code: 'CS1234567890ABCDEF12345679',
    amount: 30000, status: 'pending', provider: 'sepay_gateway', plan: { name: 'Pay-per-use' }, paid_at: null, verification: { checked_at: timestamp }, audits: [] };
  const requests = [];
  let manualAttempts = 0;
  const summary = () => ({ totalOrders: 2, paidCount: pending.status === 'paid' ? 2 : 1, paidAmount: pending.status === 'paid' ? 129000 : 99000,
    pendingCount: pending.status === 'paid' ? 0 : 1, pendingAmount: pending.status === 'paid' ? 0 : 30000 });
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ path: url.pathname, method: request.method(), query: url.search });
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'admin', full_name: 'Quản trị viên', role: 'admin' } } });
    if (request.method() === 'POST' && url.pathname.endsWith('/reconcile')) {
      pending.status = 'paid'; pending.paid_at = timestamp; pending.verification = { source: 'sepay_polling', checked_at: timestamp };
      pending.audits = [{ _id: 'audit', action: 'payment_paid', created_at: timestamp }];
      return route.fulfill({ json: { data: pending } });
    }
    if (request.method() === 'PATCH') {
      manualAttempts++;
      return route.fulfill({ status: 503, json: { error: { message: 'Chưa thể xử lý yêu cầu.' } } });
    }
    if (url.pathname.endsWith('/users/user-one')) return route.fulfill({ json: { data: { ...user, system_role: 'user', status: 'active', email_verified: true,
      sessions: [], sessionCount: 0, feedback: [], payments: { summary: summary(), data: [paid, pending] } } } });
    if (url.pathname.endsWith('/payments')) {
      const byUser = url.searchParams.get('view') === 'users';
      return route.fulfill({ json: { data: byUser ? [{ _id: user._id, user, ...summary(), lastPaymentAt: timestamp }] : [paid, pending], summary: summary(), pagination: { total: byUser ? 1 : 2, page: 1, limit: 20 } } });
    }
    return route.fulfill({ json: { data: pending } });
  });
  await page.goto('/admin/payments');
  await expect(page.getByRole('heading', { name: 'Quản lý thanh toán' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Trạng thái', exact: true })).toHaveValue('');
  await expect(page.getByLabel('Tổng hợp thanh toán')).toContainText('99.000');
  await expect(page.getByRole('cell', { name: 'Nguyễn Thị Ánh anh@example.test' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Theo người dùng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng thanh toán theo người dùng' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem lịch sử', exact: true }).click();
  await expect(page).toHaveURL(/user=user-one/);
  await expect(page.getByRole('heading', { name: 'Lịch sử thanh toán', exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Xem thanh toán ${pending.order_code}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Chi tiết thanh toán' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Xác nhận thủ công', exact: true }).click();
  await expect(dialog.getByLabel('Xác nhận xử lý thanh toán')).toContainText('30.000');
  expect(manualAttempts).toBe(0, 'Không gửi xác nhận chỉ bằng bước mở hộp thoại.');
  await dialog.getByLabel('Ghi chú đối soát').fill('Đối chiếu giao dịch chuyển khoản.');
  await dialog.getByRole('button', { name: 'Xác nhận xử lý', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Ghi chú đối soát')).toHaveValue('Đối chiếu giao dịch chuyển khoản.');
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await dialog.getByRole('button', { name: 'Đối soát với SePay', exact: true }).click();
  await expect(dialog.getByText('Đã kiểm tra trạng thái đối soát hiện tại.')).toBeVisible();
  await expect(dialog.getByText('Đã thanh toán', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page.getByLabel('Tổng hợp thanh toán')).toContainText('129.000');
  expect(requests.some(request => request.query.includes('user_id=user-one'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.test-artifacts/admin-payments-${info.project.name}.png`, fullPage: true });
  await page.goto('/admin/users/user-one');
  await expect(page.getByRole('region', { name: 'Thanh toán của người dùng' })).toContainText('129.000');
  await page.getByRole('link', { name: 'Xem toàn bộ lịch sử và đối soát →' }).click();
  await expect(page).toHaveURL(/admin\/payments\?user=user-one/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
