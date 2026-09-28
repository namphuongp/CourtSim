import { test, expect } from '@playwright/test';

test('OTP: tự focus, dán mã, lỗi giữ nội dung, cooldown, reload và không lưu token', async ({ page }, info) => {
  let user = null; let fail = true; let submits = 0; let lastBody;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return send(user ? { user } : {}, user ? 200 : 401);
    if (path.endsWith('/auth/register')) { lastBody = route.request().postDataJSON(); return send({ data: { challenge: 'test-challenge', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString() } }, 202); }
    if (path.endsWith('/auth/verify-email')) {
      submits++;
      if (fail) { fail = false; return send({ error: { code: 'OTP_INVALID', message: 'Mã xác thực không đúng hoặc đã hết hạn.' } }, 400); }
      user = { id: 'learner', full_name: 'Người học', role: 'user' }; return send({ user });
    }
    if (path.endsWith('/auth/logout')) { user = null; return send({ message: 'Đã đăng xuất.' }); }
    return send({ data: [] });
  });
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Người học');
  await page.getByLabel('Email', { exact: true }).fill('learner@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Passphrase-test-123');
  await page.getByLabel('Nhập lại mật khẩu', {exact:true}).fill('Passphrase-test-123');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByLabel('Mã xác thực')).toBeFocused();
  expect(lastBody.confirm_password).toBe('Passphrase-test-123');
  await expect(page.getByRole('button', { name: /Gửi lại mã sau/ })).toBeDisabled();
  await page.getByLabel('Mã xác thực').fill('123456');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('không đúng');
  await expect(page.getByLabel('Mã xác thực')).toHaveValue('123456');
  await page.screenshot({ path: info.outputPath('verify-email.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Mã xác thực')).toBeVisible();
  await page.getByLabel('Mã xác thực').fill('654321');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  expect(submits).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem('userToken'))).toBeNull();
  await page.reload(); await expect(page).toHaveURL(/dashboard$/);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await page.goto('/dashboard'); await expect(page).toHaveURL(/login/);
});

test('mất kết nối không xóa tài khoản; Google lỗi có thông báo và quên mật khẩu hoạt động', async ({ page }) => {
  let failMe = true;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return send({}, failMe ? 503 : 401);
    if (path.endsWith('/auth/google/start')) return send({ error: { code: 'GOOGLE_UNAVAILABLE' } }, 503);
    if (path.endsWith('/auth/forgot-password')) return send({ data: { challenge: 'reset-test', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date().toISOString() } });
    if (path.endsWith('/auth/reset-password')) return send({ message: 'Đã đổi mật khẩu' });
    return send({});
  });
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('Chưa thể kết nối');
  failMe = false; await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục với Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể đăng nhập Google');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await page.getByLabel('Email').fill('learner@example.com');
  await page.getByRole('button', { name: 'Gửi mã xác thực' }).click();
  await page.getByLabel('Mã xác thực').fill('123456');
  await page.getByLabel('Mật khẩu mới', {exact:true}).fill('New-test-passphrase');
  await page.getByLabel('Nhập lại mật khẩu', {exact:true}).fill('New-test-passphrase');
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã đổi mật khẩu');
});

test('mật khẩu: hiện/ẩn, lỗi nhập lại đúng chỗ; gửi lại OTP theo thời gian thật', async ({ page }) => {
  let registrations = 0, resends = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    if (path.endsWith('/auth/register')) registrations++;
    if (path.endsWith('/auth/resend-verification')) resends++;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { challenge: 'test', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 1000).toISOString() } }) });
  });
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Người học'); await page.getByLabel('Email', { exact: true }).fill('learner@example.com');
  const password = page.getByLabel('Mật khẩu', { exact: true });
  await password.fill('Test-only-passphrase');
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click(); await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click(); await expect(password).toHaveAttribute('type', 'password');
  const confirm = page.getByLabel('Nhập lại mật khẩu', { exact: true });
  await confirm.fill('Different-passphrase'); await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(confirm).toBeFocused(); await expect(confirm).toHaveAttribute('aria-invalid', 'true'); expect(registrations).toBe(0);
  await confirm.fill('Test-only-passphrase'); await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gửi lại mã', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Gửi lại mã', exact: true }).click();
  expect(resends).toBe(1); await expect(page.getByLabel('Mã xác thực')).toBeFocused();
});
