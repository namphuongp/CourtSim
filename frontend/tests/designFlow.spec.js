import { test, expect } from '@playwright/test';
import { case1Appeal } from '../../backend/src/data/case1Appeal.js';

// API fixtures stay in tests. The product always reads its own API responses.
const caseId = '111111111111111111111111';
const courtCase = { ...case1Appeal, _id: caseId };
const membership = { id: 'lite', name: 'Lite', freeLimit: 2, freeRemaining: 2, caseCredits: 5, canCreateSession: true, legalAssistant: true, detailedScoring: true, skillAnalytics: false };
const records = [{ _id: 'r1', sender_type: 'user', content: 'Tôi đề nghị đối chiếu phạm vi chứng minh của giấy chứng nhận.' }, { _id: 'r2', sender_type: 'ai_judge', content: 'Mời luật sư làm rõ chứng cứ nào hỗ trợ lập luận vừa trình bày.' }];
const session = { _id: 'design-session', case_id: courtCase, user_court_role: 'defense_lawyer', case_event_date: '2018-08-07', status: 'ongoing', max_turns: 20, features: { legalAssistant: true }, conversation: { status: 'learner', current_record_id: 'r2', revision: 2 } };

async function noOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

test('thư viện công khai lỗi 401 không điều hướng nền sang đăng nhập', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Thử lại thư viện' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('thư viện thật qua API: bộ lọc, đọc hồ sơ và điều hướng đăng nhập', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({ json: path.endsWith('/cases') ? { data: [courtCase], pagination: { total: 1 } } : { data: courtCase } });
  });
  await page.goto('/');
  await expect(page.locator('.landing-case-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sơ thẩm', exact: true }).click();
  await expect(page.getByText('Chưa có hồ sơ phù hợp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Tóm tắt diễn biến');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await noOverflow(page);
  await page.locator('.case-card-actions').getByRole('link', { name: 'Chọn vụ án' }).click();
  await expect(page).toHaveURL(/login\?returnTo=.*case/);
});

test('thiết lập 5 bước: xác nhận mới gửi API, lỗi giữ lựa chọn và mã yêu cầu qua reload', async ({ page }) => {
  const sent = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'design-user', full_name: 'Người học', role: 'user' } } });
    if (path.endsWith('/auth/membership')) return route.fulfill({ json: { data: membership } });
    if (path.endsWith('/cases')) return route.fulfill({ json: { data: [courtCase], pagination: { total: 1 } } });
    if (path.endsWith('/sessions') && request.method() === 'POST') { sent.push(request.postDataJSON()); return route.fulfill({ status: 503, json: { error: { message: 'Chưa khởi tạo được phiên.' } } }); }
    return route.fulfill({ json: { data: courtCase } });
  });
  await page.goto(`/dashboard/setup?case=${caseId}`);
  await expect(page.locator('.setup-option').first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tiếp: Hồ sơ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tóm tắt diễn biến' })).toBeVisible();
  await page.getByRole('button', { name: /Tài liệu gốc/ }).click();
  await page.locator('[data-evidence-select="EV-case1-nguyen"]').click();
  await expect(page.locator('#evidence-EV-case1-nguyen')).toBeVisible();
  await page.getByRole('button', { name: 'Các bên & yêu cầu', exact: true }).click();
  await expect(page.locator('.dossier-parties')).toBeVisible();
  await page.getByRole('button', { name: 'Hồ sơ tố tụng', exact: true }).click();
  await expect(page.locator('.dossier-procedure')).toBeVisible();
  await page.getByRole('button', { name: 'Căn cứ pháp lý', exact: true }).click();
  await expect(page.locator('.dossier-law')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp: Vai', exact: true }).click();
  await page.locator('.setup-role').first().click();
  await page.getByRole('button', { name: 'Tiếp: Mốc tra cứu', exact: true }).click();
  await expect(page.getByLabel('3. Mốc tra cứu của bài tập')).toHaveValue('2018-08-07');
  await expect(page.getByLabel('3. Mốc tra cứu của bài tập')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Tiếp: Chuẩn bị', exact: true }).click();
  await page.locator('.setup-aside').getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Tiếp tục chuẩn bị' }).click();
  expect(sent).toHaveLength(0);
  await page.locator('.setup-aside').getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Chưa thể bắt đầu phiên');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ case_id: caseId, user_court_role: 'defense_lawyer', case_event_date: '2018-08-07', difficulty: 'balanced' });
  await page.reload();
  await page.locator('.setup-aside').getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].request_id).toBe(sent[0].request_id);
  await noOverflow(page);
});

test('phòng xử án: draft, chèn chứng cứ, trợ lý lỗi giữ câu hỏi, hướng dẫn và hủy kết thúc', async ({ page }) => {
  let completed = 0;
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'design-user', role: 'user' } } });
    if (path.endsWith('/records')) return route.fulfill({ json: { data: records } });
    if (path.endsWith('/assistant')) return route.fulfill(request.method() === 'POST' ? { status: 503, json: { error: { message: 'Tra cứu đang tạm dừng.' } } } : { json: { data: [] } });
    if (path.endsWith('/complete')) { completed++; return route.fulfill({ status: 503, json: {} }); }
    return route.fulfill({ json: { data: session } });
  });
  await page.goto('/simulation/design-session');
  await page.getByRole('button', { name: 'Xem vai bạn', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Vai trò: Bạn');
  await page.getByRole('button', { name: 'Quay lại phiên tòa →' }).click();
  await page.getByLabel('Lập luận của bạn').fill('Bản nháp cần giữ lại.');
  await page.getByRole('button', { name: 'Mở rộng trình bày' }).click();
  await expect(page.getByLabel('Nội dung lập luận')).toHaveValue('Bản nháp cần giữ lại.');
  await page.getByLabel('Nội dung lập luận').fill('Bản nháp cần giữ lại. Bổ sung trong chế độ mở rộng.');
  await page.getByRole('button', { name: 'Quay lại ô lập luận →' }).click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bổ sung trong chế độ mở rộng/);
  await page.getByRole('button', { name: 'Hồ sơ phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: /Tài liệu gốc/ }).click();
  await page.getByRole('button', { name: /^Đưa vào lập luận:/ }).first().click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bản nháp cần giữ lại/);
  expect(await page.getByLabel('Lập luận của bạn').inputValue()).toContain('[Chứng cứ:');
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bản nháp cần giữ lại/);
  await page.getByRole('button', { name: 'Trợ lý luật', exact: true }).click();
  await page.getByLabel('Câu hỏi tra cứu luật').fill('Phạm vi chứng minh của giấy chứng nhận?');
  await page.getByRole('button', { name: 'Hỏi trợ lý' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa nhận được câu trả lời');
  await expect(page.getByLabel('Câu hỏi tra cứu luật')).toHaveValue('Phạm vi chứng minh của giấy chứng nhận?');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Xem hồ sơ vụ án' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp theo →' }).click();
  await expect(page.getByRole('dialog')).toContainText('Đọc và xem lại lời thoại');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Bạn còn bản nháp chưa gửi');
  await page.getByRole('button', { name: 'Tiếp tục tranh luận', exact: true }).click();
  expect(completed).toBe(0);
  await noOverflow(page);
  expect(browserErrors).toEqual([]);
});

test('menu tài khoản và trang gói giữ thông tin quyền lợi từ API', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'design-user', full_name: 'Người học', role: 'user' } } });
    if (path.endsWith('/auth/membership')) return route.fulfill({ json: { data: membership } });
    if (path.endsWith('/auth/account')) return route.fulfill({ json: { data: { full_name: 'Người học', email: 'learner@example.test', emailVerified: true, hasPassword: true } } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/account');
  const trigger = page.getByRole('button', { name: 'Người học', exact: true });
  await trigger.click();
  await expect(page.getByRole('navigation', { name: 'Menu tài khoản' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('navigation', { name: 'Menu tài khoản' }).getByRole('link', { name: 'Gói & lượt luyện tập' }).click();
  await expect(page).toHaveURL(/account\/membership$/);
  await expect(page.getByRole('region', { name: 'Gói và lượt luyện tập' })).toContainText('Lượt đã mua còn 5');
  await page.getByRole('link', { name: 'Tính năng & lượt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kho tính năng & lượt' })).toBeVisible();
  await expect(page.locator('.account-feature-card')).toHaveCount(4);
  await noOverflow(page);
  await page.getByRole('navigation', { name: 'Cài đặt tài khoản' }).getByRole('link', { name: 'Gói và lượt', exact: true }).click();
  await page.getByRole('link', { name: 'Xem bảng giá', exact: true }).click();
  await expect(page.locator('.pricing-card')).toHaveCount(4);
  await expect(page.locator('.pricing-card').nth(2)).toContainText('99.000đ');
  await noOverflow(page);
});
