import { caseRoleLabel } from '../../shared/casePresentation.mjs';
import { test, expect } from '@playwright/test';
import { startBrowserHarness } from '../../backend/tests/helpers/browserHarness.mjs';
import { case1Appeal } from '../../backend/src/data/case1Appeal.js';

let harness;
test.beforeAll(async () => { harness = await startBrowserHarness({ courtCase: case1Appeal, webReference: false }); });
test.afterAll(async () => { await harness?.close(); });

test('Case1: chọn vai, hồ sơ, kéo thả, đối đáp, tải lại, chấm điểm và lịch sử', async ({ page }, info) => {
  const role = info.project.name === 'mobile' ? 'plaintiff_lawyer' : 'defense_lawyer';
  const label = caseRoleLabel(role, case1Appeal);
  const email = `case1-${info.project.name}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Kiểm thử Case1');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Test-only-password-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('Test-only-password-123');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByLabel('Mã xác thực')).toBeVisible();
  await page.getByLabel('Mã xác thực').fill(harness.emails.at(-1).otp);
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await harness.grantPlan(email, 'lite');
  await page.reload();
  await page.getByRole('link', { name: 'Tạo phiên mới', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('Phúc thẩm tranh chấp đất') }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tóm tắt diễn biến' })).toBeVisible();
  await expect(page.getByText('Giấy chứng nhận và quá trình sử dụng được nhắc đến chứng minh được gì khi chưa có bản gốc?')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Thông tin được hồ sơ ghi nhận' })).toHaveCount(0);
  await expect(page.locator('#evidence-EV-case1-nguyen')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Mở rộng chứng cứ' })).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: `../.test-artifacts/case1-setup-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Mở rộng chứng cứ' }).click();
  await expect(page.locator('#evidence-EV-case1-nguyen')).toBeVisible();
  await expect(page.getByLabel('3. Mốc tra cứu của bài tập')).toHaveValue('2018-08-07');
  await page.getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  await expect(page).toHaveURL(/simulation\/[a-f0-9]{24}$/);
  const room = page.url();
  await expect(page.locator('.courtroom-meta')).toContainText(label);
  await page.getByRole('button', { name: 'Hồ sơ phiên tòa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tóm tắt diễn biến' })).toBeVisible();
  await page.getByRole('button', { name: 'Mở rộng chứng cứ' }).click();
  await expect(page.locator('article[draggable="true"]')).toHaveCount(14);
  await expect(page.locator('article[draggable="false"]')).toHaveCount(0);
  const card = page.locator('#evidence-EV-case1-nguyen');
  await card.locator('summary').click();
  await expect(card).not.toContainText('không phải tài liệu gốc');
  await page.screenshot({ path: `../.test-artifacts/case1-dossier-${info.project.name}.png`, fullPage: true });
  // Dùng DataTransfer thật để kiểm tra payload kéo thả, kể cả màn hình cảm ứng.
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.getByLabel('Lập luận của bạn').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Nguồn:.*Nguyên/);
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Anh Nguyên/);
  for (let turn = 0; turn < 3; turn++) {
    if (turn) await page.getByLabel('Lập luận của bạn').fill(turn === 1
      ? 'Tôi phân biệt lời trực tiếp gánh gạch với việc chỉ nghe kể về thỏa thuận. Chưa có giấy giao nhận để xác định mục đích.'
      : 'Tôi chưa kết luận ai có quyền sử dụng đất từ lời kể. Cần đối chiếu tài liệu gốc về giấy chứng nhận và căn cứ bồi thường.');
    await page.getByRole('button', { name: 'Gửi lập luận', exact: true }).click();
    await expect(page.getByRole('button', { name: /Tiếp tục:|Trình bày ý kiến/ })).toBeEnabled();
    while (await page.getByRole('button', { name: /^Tiếp tục:/ }).count()) {
      await page.getByRole('button', { name: /^Tiếp tục:/ }).click();
      await expect(page.getByRole('button', { name: /Tiếp tục:|Trình bày ý kiến/ })).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Trình bày ý kiến' }).click();
    await expect(page.getByLabel('Lập luận của bạn')).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận kết thúc', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ qua và xem kết quả', exact: true })).toHaveCount(0);
  const survey = page.getByRole('link', { name: /Điền khảo sát Google Forms/ });
  await expect(survey).toBeVisible();
  await harness.submitSurvey(await survey.getAttribute('href'));
  await page.getByRole('button', { name: 'Mình đã gửi xong', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Điểm tham khảo từ nguồn web' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();

  const result = await page.request.get(`http://127.0.0.1:5019/api/v1/sessions/${room.split('/').at(-1)}/result`).then(r => r.json());
  expect(result.data.criteria.find(g => g.id === 'legal_application').items.every(i => i.status === 'not_assessed')).toBe(true);
  expect(result.data.citations).toEqual([]);
  const history = await page.request.get('http://127.0.0.1:5019/api/v1/sessions').then(r => r.json());
  const saved = history.data.find(s => room.endsWith(s._id));
  expect(saved.status).toBe('completed');
  expect(saved.result.legal_assessment_mode).toBe('verified_or_unassessed');
  expect(saved.turn_count).toBe(3);
  expect(caseRoleLabel(role, saved.case_id)).toBe(label);
  await page.goto('/dashboard/history');
  await expect(page.getByText(label, { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Xem kết quả', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  await page.getByRole('link', { name: 'Xem lại toàn bộ biên bản' }).click();
  await expect(page.getByText('Phiên đã kết thúc. Đây là biên bản chỉ đọc.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('hướng dẫn chỉ hiển thị thao tác và thông tin luyện tập', async ({ page }, info) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'Hướng dẫn luyện tập tranh tụng' })).toBeVisible();
  await expect(page.getByText(/được giả định có bản gốc/)).toBeVisible();
  await expect(page.getByText(/Kết quả gồm 6 nhóm|không quy đổi|trọng số/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../.test-artifacts/guide-' + info.project.name + '.png', fullPage: true });
});
