import { test, expect } from '@playwright/test';
import { case1Appeal } from '../../backend/src/data/case1Appeal.js';

// API fixtures stay in tests. The product always reads its own API responses.
const caseId = '111111111111111111111111';
const courtCase = { ...case1Appeal, _id: caseId };
const membership = { id: 'lite', name: 'Lite', freeLimit: 2, freeRemaining: 2, caseCredits: 5, canCreateSession: true, legalAssistant: true, detailedScoring: true, skillAnalytics: false };
const records = [{ _id: 'r1', sender_type: 'user', content: 'Tôi đề nghị đối chiếu phạm vi chứng minh của giấy chứng nhận.' }, { _id: 'r2', sender_type: 'ai_judge', content: 'Mời luật sư làm rõ chứng cứ nào hỗ trợ lập luận vừa trình bày.' }];
const session = { _id: 'design-session', case_id: courtCase, user_court_role: 'defense_lawyer', case_event_date: '2018-08-07', status: 'ongoing', max_turns: 20, features: { legalAssistant: true }, conversation: { status: 'learner', current_record_id: 'r2', revision: 2 } };

async function noOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

async function mockRoomGuide(page, projectName) {
  await page.setViewportSize(projectName === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'guide-user', role: 'user' } } });
    if (path.endsWith('/records')) return route.fulfill({ json: { data: records } });
    const id = path.split('/').at(-1);
    return route.fulfill({ json: { data: { ...session, _id: id, status: id === 'guide-completed' ? 'completed' : 'ongoing' } } });
  });
}

test('thư viện công khai lỗi 401 không điều hướng nền sang đăng nhập', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Thử lại thư viện' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('thư viện thật qua API: bộ lọc, đọc hồ sơ và điều hướng đăng nhập', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({ json: path.endsWith('/cases') ? { data: [courtCase], pagination: { total: 1 } } : { data: courtCase } });
  });
  await page.goto('/');
  await expect(page.locator('.landing-case-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Luyện tranh tụng qua phiên tòa mô phỏng' })).toBeVisible();
  const sampleLink = page.getByRole('link', { name: 'Xem hồ sơ mẫu', exact: true });
  await expect(sampleLink).toBeInViewport({ ratio: 1 });
  await sampleLink.click();
  await expect(page).toHaveURL(/\/#cases$/);
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
  const setupActions = page.getByRole('navigation', { name: 'Chuyển bước thiết lập' });
  const start = page.getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true });
  await expect(page.locator('.setup-option').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(start).toHaveCount(0);
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
  await expect(page.getByLabel('Ngày dùng để tra cứu luật')).toHaveValue('2018-08-07');
  await expect(page.getByLabel('Ngày dùng để tra cứu luật')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Tiếp: Chuẩn bị', exact: true }).click();
  await expect(start).toHaveCount(1);
  await setupActions.getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Tiếp tục chuẩn bị' }).click();
  expect(sent).toHaveLength(0);
  await start.click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Chưa thể bắt đầu phiên');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ case_id: caseId, user_court_role: 'defense_lawyer', case_event_date: '2018-08-07', difficulty: 'balanced' });
  await page.reload();
  await start.click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].request_id).toBe(sent[0].request_id);
  await noOverflow(page);
});

test('phòng xử án: chuyển lượt, gửi và thử lại với thanh điều khiển luôn trong màn hình', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  let currentSession = { ...session };
  let currentRecords = [...records];
  const commands = [];
  const argumentText = 'Tôi đề nghị đối chiếu phạm vi chứng minh của lời khai với các tài liệu trong hồ sơ.';
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { user: { id: 'design-user', role: 'user' } } });
    }
    if (path.endsWith('/records')) return route.fulfill({ json: { data: currentRecords } });
    if (path.endsWith('/dialogue/seen')) return route.fulfill({ json: {} });
    if (path.endsWith('/dialogue')) {
      const command = request.postDataJSON();
      commands.push(command);
      if (command.action === 'advance' && currentSession.conversation.next_speaker === 'opponent') {
        currentSession = { ...currentSession, conversation: { ...currentSession.conversation, status: 'failed' } };
        return route.fulfill({ status: 502, json: { error: { message: 'Không tạo được lời thoại.' } } });
      }
      const conversation = { status: 'learner', revision: currentSession.conversation.revision + 1 };
      if (command.action === 'submit') {
        currentRecords = [...currentRecords, { _id: 'r3', sender_type: 'user', content: command.content }];
        Object.assign(conversation, { status: 'awaiting_continue', next_speaker: 'opponent' });
      }
      if (command.action === 'resume') {
        currentRecords = [...currentRecords, { _id: 'r4', sender_type: 'ai_opponent', content: 'Tôi đề nghị xác minh phạm vi người khai trực tiếp biết.' }];
        Object.assign(conversation, { status: 'awaiting_continue', next_speaker: 'learner' });
      }
      currentSession = { ...currentSession, conversation: { ...conversation, current_record_id: currentRecords.at(-1)._id } };
      return route.fulfill({ json: { data: { session: currentSession, records: currentRecords } } });
    }
    return route.fulfill({ json: { data: currentSession } });
  });
  await page.goto('/simulation/design-session');
  await page.getByRole('button', { name: 'Bỏ qua các lần sau', exact: true }).click();

  const toolbar = page.getByRole('navigation', { name: 'Điều khiển phiên tòa' });
  const evidence = toolbar.getByRole('button', { name: 'Hồ sơ chứng cứ', exact: true });
  const transcript = toolbar.getByRole('button', { name: 'Biên bản', exact: true });
  const send = page.getByRole('button', { name: 'Gửi lập luận', exact: true });
  const dialogue = page.getByRole('log', { name: 'Danh sách tin nhắn phát biểu trong phiên tòa' });
  await expect(dialogue).toBeInViewport({ ratio: 0.5 });
  await expect(dialogue.getByText(records.at(-1).content, { exact: true })).toBeInViewport({ ratio: 0.5 });
  expect((await dialogue.boundingBox()).height).toBeGreaterThanOrEqual(80);
  await expect(evidence).toBeInViewport({ ratio: 1 });
  await expect(transcript).toBeInViewport({ ratio: 1 });
  await expect(send).toBeInViewport({ ratio: 1 });
  await evidence.click();
  await expect(page.locator('.dossier-evidence')).toBeVisible();
  await page.keyboard.press('Escape');
  await transcript.click();
  await expect(page.locator('.transcript-entry')).toHaveCount(records.length);
  await page.keyboard.press('Escape');

  const argument = page.getByLabel('Lập luận của bạn');
  await argument.fill(argumentText);
  await send.click();
  const advance = page.getByRole('button', { name: 'Tiếp tục: Bên đối lập', exact: true });
  await expect(advance).toHaveCount(1);
  await expect(advance).toBeInViewport({ ratio: 1 });
  await advance.click();
  const retry = page.getByRole('button', { name: 'Thử lại lời thoại', exact: true });
  await expect(retry).toHaveCount(1);
  await expect(retry).toBeInViewport({ ratio: 1 });
  await retry.click();
  const speak = page.getByRole('button', { name: 'Trình bày ý kiến', exact: true });
  await expect(speak).toHaveCount(1);
  await expect(speak).toBeInViewport({ ratio: 1 });
  await expect(send).toHaveCount(0);
  await speak.click();
  await expect(argument).toBeEnabled();
  await expect(argument).toHaveValue('');
  await expect(send).toBeInViewport({ ratio: 1 });
  expect(commands.map(command => command.action)).toEqual(['submit', 'advance', 'resume', 'advance']);
  expect(commands[0].content).toBe(argumentText);
  await noOverflow(page);
});

test('phòng xử án: thông tin phiên và âm thanh mở riêng từ đầu trang và khung hội thoại', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'design-user', role: 'user' } } });
    if (path.endsWith('/records')) return route.fulfill({ json: { data: records } });
    return route.fulfill({ json: { data: session } });
  });
  await page.goto('/simulation/design-session');
  await page.getByRole('button', { name: 'Bỏ qua các lần sau', exact: true }).click();

  const header = page.locator('.room-header');
  const infoButton = header.getByRole('button', { name: 'Thông tin vụ án', exact: true });
  await expect(header.getByRole('heading', { level: 1, name: courtCase.title })).toBeVisible();
  await expect(header).toContainText(/Giai đoạn \d\/4.*1\/20 lượt/);
  await expect(infoButton).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('timer', { name: /^Thời lượng phiên tòa/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true })).toBeHidden();
  await infoButton.click();
  const caseInfo = page.getByRole('dialog', { name: 'Thông tin vụ án' });
  await expect(caseInfo.getByText('2018-08-07', { exact: true })).toBeVisible();
  await expect(caseInfo.getByRole('timer', { name: /^Thời lượng phiên tòa/ })).toBeVisible();
  const progress = caseInfo.getByRole('region', { name: 'Tiến trình phiên tòa' });
  await expect(progress.getByRole('listitem')).toHaveCount(4);
  await expect(progress.locator('[aria-current=step]')).toContainText('Xét hỏi');
  await page.keyboard.press('Escape');
  await expect(caseInfo).toBeHidden();
  await expect(infoButton).toBeFocused();

  const audio = page.getByRole('button', { name: 'Âm thanh', exact: true });
  const speed = page.getByRole('combobox', { name: 'Tốc độ đọc' });
  await expect(audio).toBeInViewport({ ratio: 1 });
  await expect(speed).toBeHidden();
  await audio.click();
  await expect(audio).toHaveAttribute('aria-expanded', 'true');
  await expect(speed).toBeInViewport({ ratio: 1 });
  await speed.selectOption('1.25');
  await expect(speed).toHaveValue('1.25');
  await page.getByRole('button', { name: 'Tắt âm thanh phiên tòa' }).click();
  await expect(page.getByRole('button', { name: 'Bật âm thanh phiên tòa' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(audio).toHaveAttribute('aria-expanded', 'false');
  await expect(audio).toBeFocused();
  await audio.click();
  await header.getByRole('heading', { level: 1 }).click();
  await expect(audio).toHaveAttribute('aria-expanded', 'false');
  await noOverflow(page);
});

test('phòng xử án: hướng dẫn tự mở từ bước đầu và có thể tắt cho các lần sau', async ({ page }, info) => {
  await mockRoomGuide(page, info.project.name);
  const guide = page.getByRole('dialog', { name: 'Xem hồ sơ vụ án', exact: true });
  await page.goto('/simulation/guide-completed');
  await expect(page.getByRole('link', { name: 'Xem kết quả', exact: true })).toBeVisible();
  await expect(guide).toBeHidden();
  await page.goto('/simulation/guide-history#transcript');
  await expect(page.locator('.transcript-entry')).toHaveCount(records.length);
  await expect(guide).toBeHidden();

  await page.goto('/simulation/guide-first');
  await expect(guide).toBeInViewport({ ratio: 1 });
  await expect(guide.getByText(/^Bước 1\s*\//)).toBeVisible();
  const skip = guide.getByRole('button', { name: 'Bỏ qua các lần sau', exact: true });
  await skip.click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hồ sơ chứng cứ', exact: true })).toBeVisible();
  await expect(guide).toBeHidden();

  await page.goto('/simulation/guide-next');
  const tools = page.getByRole('button', { name: 'Công cụ khác', exact: true });
  await expect(tools).toBeVisible();
  await expect(guide).toBeHidden();
  await tools.click();
  await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Đóng hướng dẫn', exact: true }).click();
  await expect(tools).toBeFocused();
});

test('phòng xử án: đóng hướng dẫn chỉ tạm thời và hoàn tất được ghi nhớ', async ({ page }, info) => {
  await mockRoomGuide(page, info.project.name);
  await page.goto('/simulation/guide-close');
  const guide = page.getByRole('dialog', { name: 'Xem hồ sơ vụ án', exact: true });
  await expect(guide).toBeVisible();
  const close = guide.getByRole('button', { name: 'Đóng hướng dẫn', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeVisible();
  await close.click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Đọc và xem lại lời thoại', exact: true });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: /^Bước \d+: Kết thúc và chấm điểm$/ }).click();
  const last = page.getByRole('dialog', { name: 'Kết thúc và chấm điểm', exact: true });
  await last.getByRole('button', { name: 'Hoàn tất hướng dẫn', exact: true }).click();
  await expect(last).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hồ sơ chứng cứ', exact: true })).toBeVisible();
  await expect(guide).toBeHidden();
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
  await page.getByRole('button', { name: 'Bỏ qua các lần sau', exact: true }).click();
  await page.getByRole('button', { name: 'Xem vai bạn', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Vai trò: Bạn');
  await page.getByRole('button', { name: 'Quay lại phiên tòa →' }).click();
  await page.getByLabel('Lập luận của bạn').fill('Bản nháp cần giữ lại.');
  await page.getByRole('button', { name: 'Mở rộng trình bày' }).click();
  await expect(page.getByLabel('Nội dung lập luận')).toHaveValue('Bản nháp cần giữ lại.');
  await page.getByLabel('Nội dung lập luận').fill('Bản nháp cần giữ lại. Bổ sung trong chế độ mở rộng.');
  await page.getByRole('button', { name: 'Quay lại ô lập luận →' }).click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bổ sung trong chế độ mở rộng/);
  const tools = page.getByRole('button', { name: 'Công cụ khác', exact: true });
  await tools.click();
  await page.getByRole('button', { name: 'Hồ sơ phiên tòa', exact: true }).click();
  await page.getByRole('button', { name: /Tài liệu gốc/ }).click();
  await page.getByRole('button', { name: /^Đưa vào lập luận:/ }).first().click();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bản nháp cần giữ lại/);
  expect(await page.getByLabel('Lập luận của bạn').inputValue()).toContain('[Chứng cứ:');
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/Bản nháp cần giữ lại/);
  await tools.click();
  await page.getByRole('button', { name: 'Trợ lý luật', exact: true }).click();
  await page.getByLabel('Câu hỏi tra cứu luật').fill('Phạm vi chứng minh của giấy chứng nhận?');
  await page.getByRole('button', { name: 'Hỏi trợ lý' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa nhận được câu trả lời');
  await expect(page.getByLabel('Câu hỏi tra cứu luật')).toHaveValue('Phạm vi chứng minh của giấy chứng nhận?');
  await page.keyboard.press('Escape');
  await tools.click();
  await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Xem hồ sơ vụ án' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp theo →' }).click();
  await expect(page.getByRole('dialog')).toContainText('Đọc và xem lại lời thoại');
  await page.keyboard.press('Escape');
  await tools.click();
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
