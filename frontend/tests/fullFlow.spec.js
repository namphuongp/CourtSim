import { test, expect } from '@playwright/test';
import { startBrowserHarness } from '../../backend/tests/helpers/browserHarness.mjs';

let harness;
test.beforeAll(async () => { harness = await startBrowserHarness({ localLaw: true }); });
test.afterAll(async () => { await harness?.close(); });

test('trình duyệt → API thật → MongoDB riêng: tài khoản, hồ sơ, trợ lý, phiên, góp ý, điểm và đăng xuất', async ({ page, browser }, info) => {
  const browserErrors = [];
  let expectedFailures = 0;
  page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) browserErrors.push(message.text()); });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', async response => {
    if (response.status() === 403 && response.url().endsWith('/result')) {
      const payload = await response.json().catch(() => null);
      if (payload?.error?.code === 'SURVEY_REQUIRED') return;
    }
    if (response.url().endsWith('/dialogue') && response.status() === 502 && expectedFailures) { expectedFailures--; return; }
    if ((response.url().endsWith('/complete') || response.url().endsWith('/feedback')) && response.status() >= 500 && expectedFailures) { expectedFailures--; return; }
    if (response.url().includes('/api/') && response.status() >= 400 && !(response.url().endsWith('/auth/me') && response.status() === 401)) browserErrors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  const email = `browser-${info.project.name}@example.test`, password = 'Test-only-password-123';
  await page.goto('/');
  await expect(page.getByText(/Chỉ có điểm toàn bài khi đủ dữ liệu/)).toBeAttached();
  await page.getByRole('link', { name: 'Bắt đầu miễn phí', exact: true }).first().click();
  await expect(page).toHaveURL(/register|login/);
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Người kiểm thử');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByLabel('Mã xác thực')).toBeVisible();
  await page.getByLabel('Mã xác thực').fill(harness.emails.at(-1).otp);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await harness.grantPlan(email, 'case');
  await page.reload();
  await page.getByRole('link', { name: 'Tạo phiên mới', exact: true }).click();
  await page.getByRole('button', { name: /Hồ sơ kiểm thử trình duyệt/ }).click();
  const plaintiff = info.project.name === 'mobile';
  await page.getByRole('button', { name: '3 Vai', exact: true }).click();
  await page.getByRole('button', { name: plaintiff ? 'Luật sư bảo vệ nguyên đơn' : 'Luật sư bảo vệ bị đơn', exact: true }).click();
  await page.getByRole('button', { name: '4 Mốc tra cứu', exact: true }).click();
  await page.getByLabel('3. Ngày sự kiện làm phát sinh tranh chấp').fill('2023-01-01');
  await page.getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu', exact: true }).click();
  await expect(page).toHaveURL(/simulation\/[a-f0-9]{24}$/);
  const room = page.url();
  const sessionId = room.split('/').at(-1);
  const draft = 'Tôi căn cứ hợp đồng trong hồ sơ để đề nghị kiểm tra chứng cứ thanh toán.';
  await page.getByLabel('Lập luận của bạn').fill(draft);
  await page.getByRole('button', { name: 'Trợ lý luật', exact: true }).click();
  await page.getByLabel('Câu hỏi tra cứu luật').fill('Luật lao động');
  await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  await expect(page.getByText(/Bạn muốn tìm về hợp đồng lao động/)).toBeVisible();
  await page.getByLabel('Câu hỏi tra cứu luật').fill('Điều 1 Bộ luật Dân sự 91/2015/QH13');
  await page.getByRole('button', { name: 'Hỏi trợ lý', exact: true }).click();
  const sourceLink = page.getByRole('link', { name: 'Mở tệp nguồn' });
  await expect(sourceLink).toHaveAttribute('href', /\/api\/v1\/legal-sources\/[a-f0-9]{64}\/files\/0$/);
  const source = await page.request.get(await sourceLink.getAttribute('href'));
  expect(source.status()).toBe(200);
  expect(await source.text()).toContain('chỉ dùng kiểm thử nguồn cục bộ');
  expect(harness.calls()).toBe(0);
  await page.getByRole('button', { name: 'Đưa trích dẫn vào lập luận' }).click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/91\/2015\/QH13/);
  await page.reload();
  await page.getByRole('button', { name: 'Trợ lý luật', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Mở tệp nguồn' })).toBeVisible();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Tôi căn cứ hợp đồng/);
  await expect(page.getByLabel('Lập luận của bạn')).not.toHaveValue(/\[PL:|LAW-/);
  // Đóng bảng nổi trước khi thao tác với vùng soạn thảo phía sau.
  await page.getByRole('button', { name: 'Đóng trợ lý luật', exact: true }).click();
  await page.getByRole('button', { name: 'Gửi lập luận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true })).toBeEnabled();
  await expect.poll(harness.calls).toBe(1);
  const nextRole = plaintiff ? 'Tiếp tục: Chủ tọa' : 'Tiếp tục: Bên đối lập';
  await expect(page.getByRole('button', { name: nextRole })).toBeVisible();
  const firstActor = page.locator(`[data-actor="${plaintiff ? 'opponent' : 'judge'}"]`);
  await expect(firstActor).toHaveAttribute('data-state', 'speaking');
  await expect(firstActor.locator('.state-speaking')).toHaveCSS('opacity', '1');
  expect(await firstActor.locator('.state-speaking').evaluate(el => getComputedStyle(el).filter)).toContain('drop-shadow');
  await page.reload();
  await expect(page.getByRole('button', { name: nextRole })).toBeVisible();
  expect(harness.calls()).toBe(1);
  await expect(page.getByRole('button', { name: 'Lời thoại sau', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lời thoại trước', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Nội dung lời thoại' })).toContainText('Tôi căn cứ hợp đồng');
  await expect(page.getByRole('button', { name: nextRole })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lời thoại trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lời thoại trước', exact: true })).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Duyệt lời thoại' })).toContainText('1 / 3');
  await page.getByRole('button', { name: 'Lời thoại sau', exact: true }).click();
  await page.getByRole('button', { name: 'Lời thoại sau', exact: true }).click();
  await expect(page.getByRole('button', { name: nextRole })).toBeVisible();
  expect(harness.calls()).toBe(1);
  await page.screenshot({ path: `../.test-artifacts/dialogue-navigation-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Biên bản phiên', exact: true }).click();
  await page.getByRole('button', { name: 'Xem tại phiên tòa: 01 · Chủ tọa', exact: true }).click();
  await expect(page.getByRole('button', { name: nextRole })).toHaveCount(0);
  await page.getByRole('button', { name: 'Trở về lượt hiện tại', exact: true }).click();
  await expect(page.getByRole('button', { name: nextRole })).toBeVisible();
  expect(harness.calls()).toBe(1);
  harness.control.delayMs = 1800;
  await page.getByRole('button', { name: nextRole }).click();
  await expect(page.locator(`[data-actor="${plaintiff ? 'judge' : 'opponent'}"]`)).toHaveAttribute('data-state', 'preparing', { timeout: 1000 });
  await expect(page.getByRole('button', { name: 'Trình bày ý kiến' })).toBeVisible();
  await page.getByRole('button', { name: 'Trình bày ý kiến' }).click();
  const beforeControl = harness.calls();
  for (const content of ['Xin chào', 'abc']) {
    await page.getByLabel('Lập luận của bạn').fill(content);
    await page.getByRole('button', { name: 'Gửi lập luận', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Trình bày ý kiến' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Trình bày ý kiến' })).toBeVisible();
    expect(harness.calls()).toBe(beforeControl);
    await page.getByRole('button', { name: 'Trình bày ý kiến' }).click();
  }
  harness.control.delayMs = 0;
  expect(harness.calls()).toBe(2);
  await expect(page.getByLabel('Lập luận của bạn')).toBeEnabled();
  await expect(page.locator('[data-actor="learner"]')).toHaveAttribute('data-state', 'invited');
  await expect(page.locator('.is-speaking')).toHaveCount(0);
  harness.control.delayMs = 4000;
  await page.getByLabel('Lập luận của bạn').fill('Tôi phân biệt việc có hợp đồng với việc đã trả tiền. Hồ sơ chưa có biên nhận nên cần đối chiếu diễn biến thanh toán.');
  await page.getByRole('button', { name: 'Gửi lập luận', exact: true }).click();
  let preparingActor;
  await expect.poll(async () => {
    const { data } = await page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${sessionId}`).then(r => r.json());
    preparingActor = data.conversation.next_speaker;
    return data.processing && ['judge', 'opponent'].includes(preparingActor);
  }).toBe(true);
  // Vai tiếp theo tùy lời vừa trình bày và trạng thái điều hành, lấy từ backend đã lưu.
  await expect(page.locator(`[data-actor="${preparingActor}"]`)).toHaveAttribute('data-state', 'preparing');
  await expect(page.locator(`[data-actor="${preparingActor}"] .state-listening`)).toHaveCSS('opacity', '1');
  await expect(page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Tiếp tục:/ })).toBeVisible({ timeout: 20000 });
  harness.control.delayMs = 0;
  harness.control.failNext = true; expectedFailures++;
  await page.getByRole('button', { name: /^Tiếp tục:/ }).click();
  await expect(page.getByRole('button', { name: 'Thử lại lời thoại' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại lời thoại' }).click();
  await expect(page.getByRole('button', { name: 'Trình bày ý kiến' })).toBeVisible();
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  harness.control.failNext = true; expectedFailures++;
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true })).toBeEnabled();
  const failedCompletion = await page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${sessionId}`).then(r => r.json());
  expect(failedCompletion.data.status).toBe('ongoing');
  expect(failedCompletion.data.processing).toBe(false);
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('khảo sát Google Forms');
  await expect(page.getByRole('dialog').locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bỏ qua và xem kết quả' })).toHaveCount(0);
  const survey = page.getByRole('link', { name: /Điền khảo sát Google Forms/ });
  await expect(survey).toBeVisible();
  const gated = await page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${sessionId}/result`);
  expect(gated.status()).toBe(403);
  expect((await gated.json()).error.code).toBe('SURVEY_REQUIRED');
  await harness.submitSurvey(await survey.getAttribute('href'));
  await page.getByRole('button', { name: 'Mình đã gửi xong', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  const completedCalls = harness.calls();
  const getResult = () => page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${sessionId}/result`).then(r => r.json());
  const before = await getResult();
  expect(before.data.criteria.every(group => Boolean(group.id))).toBe(true);
  expect(new Set(before.data.criteria.map(group => group.id)).size).toBe(6);
  const history = await page.request.get('http://127.0.0.1:5019/api/v1/sessions').then(r => r.json());
  expect(history.data.find(s => s._id === sessionId).result.score).toBe(before.data.score);
  const records = await page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${sessionId}/records`).then(r => r.json());
  expect(records.data[1].legal_reference_ids).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  expect(await getResult()).toEqual(before);
  await page.getByRole('link', { name: 'Xem lại toàn bộ biên bản' }).click();
  await expect(page.getByText('Phiên đã kết thúc. Đây là biên bản chỉ đọc.')).toBeVisible();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveCount(0);
  expect(harness.calls()).toBe(completedCalls);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Đăng xuất/ }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  // Quên mật khẩu chạy qua API/OTP thật của harness, tránh chỉ kiểm tra một màn hình mock.
  await page.getByRole('button', { name: /Đăng xuất/ }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Gửi mã xác thực' }).click();
  await expect(page).toHaveURL(/reset-password$/);
  await page.getByLabel('Mã xác thực').fill(harness.emails.at(-1).otp);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('New-test-password-456');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('New-test-password-456');
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await expect(page).toHaveURL(/login\?reset=1$/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('New-test-password-456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);

  // Tài khoản thứ hai không được đọc/ghi phiên, điểm hoặc góp ý của chủ phiên.
  const other = await browser.newContext();
  try {
    const base = 'http://127.0.0.1:5019/api';
    const headers = { Origin: 'http://127.0.0.1:4175', 'X-CourtSim-Request': '1' };
    const otherEmail = 'other-' + info.project.name + '@example.test';
    const register = await other.request.post(base + '/auth/register', { headers, data: { full_name: 'Người học khác', email: otherEmail, password, confirm_password: password } });
    expect(register.status()).toBe(202);
    const challenge = (await register.json()).data.challenge;
    const verify = await other.request.post(base + '/auth/verify-email', { headers, data: { challenge, otp: harness.emails.at(-1).otp } });
    expect(verify.ok()).toBe(true);
    for (const suffix of ['', '/records', '/result', '/assistant']) {
      expect((await other.request.get(base + '/v1/sessions/' + sessionId + suffix)).status()).toBe(404);
    }
    for (const suffix of ['/complete', '/feedback', '/dialogue']) {
      const response = await other.request.post(base + '/v1/sessions/' + sessionId + suffix, { headers, data: { content: 'Không được sửa phiên người khác.', action: 'advance', revision: 0 } });
      expect(response.status()).toBe(404);
    }
    expect((await other.request.get(base + '/v1/admin/users')).status()).toBe(403);
  } finally { await other.close(); }
  await page.goto('/account');
  await page.getByLabel('Họ và tên').fill('Người kiểm thử cập nhật');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Đã lưu hồ sơ.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Người kiểm thử cập nhật');
  for (const section of ['security', 'linked']) {
    await page.goto('/account/' + section);
    await expect(page.locator('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await harness.makeAdmin(email);
  for (const route of ['admin', 'admin/users', 'admin/cases', 'admin/sessions', 'admin/feedback', 'admin/payments', 'admin/ai', 'admin/system', 'admin/audit']) {
    await page.goto('/' + route);
    await expect(page.locator('#admin-content h1')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  // Tạo hồ sơ qua giao diện, lưu MongoDB riêng và dùng được ở màn hình luyện tập.
  await page.goto('/admin/cases');
  await page.getByLabel('Tên vụ án', { exact: true }).fill('Vụ án được admin tạo');
  await page.getByLabel('Tóm tắt vụ án').fill('Tình huống hư cấu kiểm thử tạo hồ sơ.');
  await page.getByLabel('Nội dung hồ sơ').fill('Hai bên có hợp đồng vay. Nội dung chỉ dùng kiểm thử.');
  await page.getByRole('button', { name: 'Thêm chứng cứ' }).click();
  await page.getByLabel('Tên chứng cứ 1', { exact: true }).fill('Hợp đồng kiểm thử');
  await page.getByLabel('Nội dung chứng cứ 1').fill('Hai bên có hợp đồng vay.');
  await page.getByRole('button', { name: 'Tạo vụ án', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã tạo vụ án' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Xem hồ sơ: Vụ án được admin tạo', exact: true }).click();
  await page.getByRole('button', { name: 'Mở rộng chứng cứ' }).click();
  await expect(page.getByRole('region', { name: 'Chi tiết hồ sơ' })).toContainText('Hợp đồng kiểm thử');
  await page.goto('/dashboard/setup');
  await expect(page.getByRole('button', { name: /Vụ án được admin tạo/ })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
