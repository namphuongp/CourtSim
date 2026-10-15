import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';
import { test, expect } from '@playwright/test';
import { startBrowserHarness } from '../../backend/tests/helpers/browserHarness.mjs';
import { createSepayFixture } from '../../backend/tests/helpers/sepayFixture.mjs';

let harness;
const sepay = createSepayFixture('BROWSER_TEST', 'browser-test-merchant-secret');
test.beforeAll(async () => {
  Object.assign(process.env, { PAYMENT_PROVIDER: 'sepay_gateway', PAYMENT_RETURN_ORIGIN: 'http://127.0.0.1:4175',
    SEPAY_ENV: 'sandbox', SEPAY_MERCHANT_ID: 'BROWSER_TEST', SEPAY_SECRET_KEY: 'browser-test-merchant-secret',
    SEPAY_POLL_INTERVAL_MS: '5000', SEPAY_PAYMENT_METHOD: 'BANK_TRANSFER' });
  delete process.env.SEPAY_IPN_SECRET;
  harness = await startBrowserHarness({ paymentDependencies: { fetchImpl: sepay.fetchImpl } });
});
test.afterAll(async () => { await harness?.close(); });

async function register(page, name) {
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Kiểm thử SePay');
  await page.getByLabel('Email').fill(`payment-${name}-${randomUUID()}@example.test`);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Test-only-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('Test-only-password-123');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByLabel('Mã xác thực')).toBeVisible();
  await page.getByLabel('Mã xác thực').fill(harness.emails.at(-1).otp);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

async function checkout(page) {
  // Intercept only the external SePay page; the CourtSim API and MongoDB are real.
  await page.route('https://pay-sandbox.sepay.vn/v1/checkout/init', route => route.fulfill({ contentType: 'text/html', body: '<h1>SePay fixture</h1>' }));
  await page.goto('/checkout/lite');
  const request = page.waitForRequest('https://pay-sandbox.sepay.vn/v1/checkout/init');
  await page.getByRole('button', { name: 'Thanh toán qua SePay', exact: true }).click();
  const posted = await request;
  expect(posted.method()).toBe('POST');
  await expect(page).toHaveURL('https://pay-sandbox.sepay.vn/v1/checkout/init');
  const fields = new URLSearchParams(posted.postData());
  expect(fields.get('order_amount')).toBe('99000');
  const signature = fields.get('signature'); fields.delete('signature');
  expect(signature).toBe(createHmac('sha256', 'browser-test-merchant-secret').update([...fields].map(([key, value]) => `${key}=${value}`).join(',')).digest('base64'));
  expect(posted.postData()).not.toContain('browser-test-merchant-secret');
  sepay.pending({ orderCode: fields.get('order_invoice_number'), amount: Number(fields.get('order_amount')) });
  return fields;
}

test('SePay: form đã ký, polling API cập nhật quyền lợi và reload giữ đơn, không dùng IPN', async ({ page }) => {
  await register(page, 'success');
  const fields = await checkout(page);
  await page.goto(fields.get('success_url'));
  await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tiếp tục luyện tập', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đang chờ xác nhận thanh toán' })).toBeVisible();
  sepay.paid(sepay.orders.get(fields.get('order_invoice_number')));
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Quyền lợi thành viên đã được cập nhật.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Tiếp tục luyện tập', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Gói và lượt luyện tập' })).toContainText('Lượt đã mua còn 5');
});

test('SePay: callback lỗi và hủy giữ đơn chưa thanh toán, có thể tiếp tục đúng đơn', async ({ page }) => {
  await register(page, 'cancel');
  const fields = await checkout(page);
  await page.goto(fields.get('error_url'));
  await expect(page.getByRole('heading', { name: 'Thanh toán chưa hoàn tất' })).toBeVisible();
  await page.goto(fields.get('cancel_url'));
  await expect(page.getByRole('heading', { name: 'Bạn đã hủy thao tác thanh toán' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tiếp tục luyện tập', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const request = page.waitForRequest('https://pay-sandbox.sepay.vn/v1/checkout/init');
  await page.getByRole('button', { name: 'Tiếp tục thanh toán trên SePay' }).click();
  const posted = new URLSearchParams((await request).postData());
  expect(posted.get('order_invoice_number')).toBe(fields.get('order_invoice_number'));
  expect(posted.get('order_amount')).toBe('99000');
});
