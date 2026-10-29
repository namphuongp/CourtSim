import { test, expect } from '@playwright/test';
import { case1Appeal } from '../../backend/src/data/case1Appeal.js';

test('thẻ công cụ, biên bản có bộ lọc, sổ tay lưu bản nháp và trợ lý chọn lịch sử', async ({ page }, info) => {
  let sent = 0;
  const records = [{ _id: 'u1', sender_type: 'user', content: 'Tôi yêu cầu đối chiếu lời khai của các bên.' }, { _id: 'j1', sender_type: 'ai_judge', content: 'Mời luật sư giải thích phạm vi chứng minh của tài liệu.' }];
  const session = { _id: 'continuation', case_id: case1Appeal, user_court_role: 'defense_lawyer', status: 'ongoing', max_turns: 20, case_event_date: '2018-08-07', features: { legalAssistant: true }, conversation: { status: 'learner', current_record_id: 'j1', revision: 2 } };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST') sent++;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'visual-user', role: 'user' } } });
    if (path.endsWith('/records')) return route.fulfill({ json: { data: records } });
    if (path.endsWith('/assistant')) return route.fulfill({ json: { data: [{ _id: 'a1', question: 'Câu hỏi trước về nguồn chứng cứ?', answer: 'Câu trả lời trước đã lưu.', status: 'completed', citations: [] }, { _id: 'a2', question: 'Câu hỏi đang tra cứu?', status: 'pending' }] } });
    return route.fulfill({ json: { data: session } });
  });
  await page.goto('/simulation/continuation');
  const deck = page.getByRole('navigation', { name: 'Thẻ công cụ tranh tụng' });
  await deck.getByRole('button', { name: /^Đưa chứng cứ/ }).click();
  await expect(page.locator('.dossier-evidence')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sổ tay', exact: true }).click();
  await page.getByLabel('Ghi chú cá nhân').fill('Cần đối chiếu phạm vi chứng minh trong hồ sơ.');
  await page.reload();
  await page.getByRole('button', { name: 'Sổ tay', exact: true }).click();
  await expect(page.getByLabel('Ghi chú cá nhân')).toHaveValue(/Cần đối chiếu/);
  await page.getByRole('button', { name: 'Đưa ghi chú vào lập luận →' }).click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Cần đối chiếu/);
  expect(sent).toBe(0);
  await deck.getByRole('button', { name: /^Biên bản/ }).click();
  await expect(page.locator('.transcript-entry')).toHaveCount(2);
  await page.getByLabel('Tìm trong biên bản').fill('đối chiếu');
  await expect(page.locator('.transcript-entry')).toHaveCount(1);
  await page.getByLabel('Tìm trong biên bản').fill('');
  await page.getByRole('button', { name: 'Chủ tọa', exact: true }).click();
  await expect(page.locator('.transcript-entry')).toHaveCount(1);
  await page.screenshot({ path: `../.test-artifacts/design-continuation/transcript-${info.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await deck.getByRole('button', { name: /^Dẫn điều luật/ }).click();
  await expect(page.locator('.assistant-answer')).toContainText('Đang tra cứu');
  await page.getByRole('navigation', { name: 'Lịch sử tra cứu' }).getByRole('button', { name: /Câu hỏi trước/ }).click();
  await expect(page.locator('.assistant-answer')).toContainText('Câu trả lời trước đã lưu.');
  await page.screenshot({ path: `../.test-artifacts/design-continuation/assistant-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('quyền riêng tư: công tắc phân tích lưu lựa chọn, nhóm cần thiết và tiếp thị khóa đúng trạng thái', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/privacy');
  const analytics = page.getByRole('switch', { name: 'Phân tích', exact: true });
  await expect(page.getByRole('switch', { name: 'Cần thiết', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Tiếp thị', exact: true })).toHaveAttribute('aria-checked', 'false');
  await analytics.click();
  await expect(analytics).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(analytics).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(analytics).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courtsim.analytics-consent.v1')).choice)).toBe('denied');
});

test('OTP: dán mã vào một input, lỗi giữ mã và hết hạn không cho xác nhận', async ({ page }, info) => {
  let payload;
  await page.addInitScript(() => { if (!sessionStorage.getItem('courtsim:verification')) sessionStorage.setItem('courtsim:verification', JSON.stringify({ challenge: 'test-challenge', email: 'learner@example.test', expiresAt: new Date(Date.now() + 300000).toISOString(), resendAt: new Date(Date.now() + 30000).toISOString() })); });
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST') { payload = route.request().postDataJSON(); return route.fulfill({ status: 400, json: { error: { message: 'Mã xác thực không đúng.' } } }); }
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/verify-email');
  await page.getByLabel('Mã xác thực').fill('123456');
  await expect(page.locator('.otp-cells')).toHaveText('123456');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Mã xác thực')).toHaveValue('123456');
  expect(payload.otp).toBe('123456');
  await page.screenshot({ path: `../.test-artifacts/design-continuation/otp-error-${info.project.name}.png`, fullPage: true });
  await page.evaluate(() => { const key = 'courtsim:verification'; const value = JSON.parse(sessionStorage.getItem(key)); value.expiresAt = new Date(Date.now() - 1).toISOString(); sessionStorage.setItem(key, JSON.stringify(value)); });
  await page.reload();
  await expect(page.getByText('Mã đã hết hạn. Bạn có thể yêu cầu mã mới.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
});
