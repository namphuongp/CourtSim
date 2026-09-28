import { test, expect } from '@playwright/test';

async function mockFeedback(page, { failSend = false, failGrade = false } = {}) {
  await page.addInitScript(() => { localStorage.setItem('userToken', 'feedback-test'); localStorage.setItem('userRole', 'user'); localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' })); });
  let completed = false;
  let prompted = false;
  let gradeCalls = 0;
  const sent = [];
  const calls = { sent, prompts: 0 };
  const courtCase = { title: 'Bài luyện lập luận', category: 'dân sự', evidence_inventory: [] };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/feedback/prompt')) { calls.prompts++; const show = !prompted; prompted = true; return send({ data: { show } }); }
    if (path.endsWith('/feedback')) {
      sent.push(route.request().postDataJSON());
      if (failSend && sent.length === 1) return send({ error: { message: 'Chưa gửi được góp ý. Nội dung vẫn được giữ lại. Vui lòng thử lại.' } }, 503);
      return send({ data: { submitted: true } }, 201);
    }
    if (path.endsWith('/complete')) {
      gradeCalls++;
      if (failGrade && gradeCalls === 1) return send({ error: { message: 'Chưa thể chấm điểm. Vui lòng thử lại.' } }, 503);
      completed = true; return send({ data: { score: 75 } });
    }
    if (path.endsWith('/result')) return completed ? send({ data: { score: 75, feedback: 'Nhận xét đã sẵn sàng', citations: [] } }) : send({ error: { message: 'Phiên chưa có kết quả.' } }, 404);
    if (path.endsWith('/records')) return send({ data: [{ _id: 'r1', sender_type: 'user', content: 'Tôi đề nghị xem xét chứng cứ trong hồ sơ.' }] });
    if (path.endsWith('/session-feedback')) return send({ data: { _id: 'session-feedback', status: completed ? 'completed' : 'ongoing', case_id: courtCase, case_event_date: '2024-01-01', turn_count: 1, max_turns: 20 } });
    return send({ data: [] });
  });
  return calls;
}
async function end(page) {
  await page.goto('/simulation/session-feedback');
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận kết thúc' }).click();
}
const dialog = page => page.getByRole('dialog', { name: 'Phiên luyện tập của bạn thế nào?' });

test('kết thúc → góp ý lỗi giữ nội dung → gửi → kết quả, không hỏi lại', async ({ page }, testInfo) => {
  const calls = await mockFeedback(page, { failSend: true });
  await end(page);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toHaveCount(0);
  await expect(dialog(page)).toContainText('Admin CourtSim có thể đọc');
  await page.screenshot({ path: testInfo.outputPath('feedback-dialog.png'), scale: 'css' });
  await page.getByLabel('Góp ý của bạn').fill('Tôi muốn câu hỏi rõ hơn. <b>Nội dung nguyên văn</b>');
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa gửi được góp ý');
  await expect(page.getByLabel('Góp ý của bạn')).toHaveValue('Tôi muốn câu hỏi rõ hơn. <b>Nội dung nguyên văn</b>');
  await page.getByRole('button', { name: 'Gửi góp ý', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  expect(calls.sent.length).toBe(2);
  expect(Object.keys(calls.sent[0])).toEqual(['content']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});

for (const action of ['skip', 'escape', 'close', 'reload']) test(`góp ý một lần: ${action} mở kết quả`, async ({ page }) => {
  const calls = await mockFeedback(page);
  await end(page);
  await expect(dialog(page)).toBeVisible();
  if (action === 'skip') await page.getByRole('button', { name: 'Bỏ qua và xem kết quả' }).click();
  if (action === 'escape') await page.keyboard.press('Escape');
  if (action === 'close') await dialog(page).getByRole('button', { name: 'Đóng', exact: true }).click();
  if (action === 'reload') await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập' })).toBeVisible();
  expect(calls.sent).toHaveLength(0);
});

test('chấm điểm thất bại không mời góp ý, thử chấm lại thành công mới hỏi', async ({ page }) => {
  const calls = await mockFeedback(page, { failGrade: true });
  await end(page);
  await expect(page.getByRole('alert')).toContainText('Chưa thể chấm điểm');
  await expect(dialog(page)).toHaveCount(0);
  expect(calls.prompts).toBe(0);
  await page.getByRole('button', { name: 'Kết thúc và chấm điểm', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận kết thúc' }).click();
  await expect(dialog(page)).toBeVisible();
});

test('admin tìm, lọc, phân trang, cập nhật ghi chú và xác nhận xóa; HTML chỉ là văn bản', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('userToken', 'admin-test'); localStorage.setItem('userRole', 'admin'); });
  let items = Array.from({ length: 21 }, (_, i) => ({ id: `session-${i}`, session_id: `session-${i}`, user: { full_name: 'Người học' }, content: i === 0 ? '<img src=x onerror=alert(1)> Góp ý đầu tiên' : `Góp ý ${i}`, status: 'new', notes: '', created_at: '2026-09-28T10:00:00Z' }));
  let deleted = 0;
  await page.route('**/api/v1/admin/feedback**', async route => {
    const url = new URL(route.request().url()); const method = route.request().method();
    const send = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    const id = url.pathname.split('/').at(-1);
    if (method === 'DELETE') { deleted++; items = items.filter(item => item.id !== id); return send({ data: { deleted: true } }); }
    if (method === 'PATCH') { Object.assign(items.find(item => item.id === id), route.request().postDataJSON()); return send({ data: { updated: true } }); }
    if (id !== 'feedback') return send({ data: items.find(item => item.id === id) });
    const filtered = items.filter(item => (!url.searchParams.get('status') || item.status === url.searchParams.get('status')) && item.content.includes(url.searchParams.get('q') || ''));
    const pageNo = Number(url.searchParams.get('page') || 1);
    return send({ data: filtered.slice((pageNo - 1) * 20, pageNo * 20), pagination: { total: filtered.length } });
  });
  await page.goto('/admin/feedback');
  await expect(page.locator('.feedback-list article')).toHaveCount(20);
  await expect(page.locator('.feedback-list img')).toHaveCount(0);
  await expect(page.locator('.feedback-list')).toContainText('<img src=x onerror=alert(1)> Góp ý đầu tiên');
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.locator('.feedback-list article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Trước', exact: true }).click();
  await page.getByLabel('Tìm nội dung hoặc mã phiên').fill('đầu tiên');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.locator('.feedback-list article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('dialog').getByLabel('Trạng thái').selectOption('resolved');
  await page.getByLabel('Ghi chú nội bộ').fill('Đã cải thiện giao diện.');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.locator('.feedback-success')).toContainText('Đã lưu');
  await page.locator('.feedback-filters').getByLabel('Trạng thái').selectOption('resolved');
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByLabel('Ghi chú nội bộ')).toHaveValue('Đã cải thiện giao diện.');
  await page.getByRole('button', { name: 'Xóa góp ý', exact: true }).click();
  expect(deleted).toBe(0);
  await page.getByRole('button', { name: 'Giữ lại' }).click();
  expect(deleted).toBe(0);
  await page.getByRole('button', { name: 'Xóa góp ý', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(page.locator('.feedback-success')).toContainText('Đã xóa');
  expect(deleted).toBe(1);
});

test('người học không vào được màn hình admin góp ý', async ({ page }) => {
  await mockFeedback(page);
  await page.goto('/admin/feedback');
  await expect(page).toHaveURL(/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Góp ý của người học' })).toHaveCount(0);
});
