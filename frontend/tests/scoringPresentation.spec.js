import { test, expect } from '@playwright/test';
import { SCORING_RUBRIC } from '../../backend/src/data/scoringRubric.js';
import { calculateEvaluation } from '../../backend/src/services/scoringService.js';

test('kết quả cũ 69/73: không hiện điểm quy đổi, chi tiết đóng, bàn phím và màn hình nhỏ', async ({ page }) => {
  const content = 'Tôi xác định mục tiêu bảo vệ. Tôi phân biệt lời khai với chứng cứ. Tôi điều chỉnh phạm vi yêu cầu.';
  const user = { _id: 'learner-record', sender_type: 'user', content };
  const records = [user, { sender_type: 'ai_prosecutor' }, user, { sender_type: 'ai_prosecutor' }, user];
  const entries = SCORING_RUBRIC.groups.flatMap(g => g.items.map(item => ({ id: item.id,
    score: item.max - ({ '3.1': 2, '4.3': 1, '5.3': 1 }[item.id] ?? 0),
    reason: 'Nhận xét dựa trên phát biểu đã gửi.', strength: `Thể hiện ${item.label.toLocaleLowerCase('vi')}.`, improvement: 'Chọn một chứng cứ rồi giải thích nó hỗ trợ yêu cầu nào.',
    quote: content.split('. ').map(t => t.replace(/\.$/, '')).at(Number(item.id[0]) % 3), record_id: user._id,
  })));
  const result = { ...calculateEvaluation(entries, records, false), score: 94.52, citations: [] };
  expect(result.earned_score).toBe(69); expect(result.assessed_max).toBe(73);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me') ? { user: { id: 'test-user', full_name: 'Người học', role: 'user' } }
      : path.endsWith('/feedback/prompt') ? { data: { show: false } }
        : path.endsWith('/result') ? { data: result } : { data: [] };
    return route.fulfill({ json: data });
  });
  await page.goto('/simulation/test-session/result');
  await expect(page.getByRole('region', { name: 'Kết quả phần đã đánh giá' })).toContainText('69/73');
  await expect(page.getByText('Đã đánh giá 73/100 điểm tiêu chí')).toBeVisible();
  await expect(page.getByText(/chưa đủ nguồn|nguồn phù hợp từ vbpl.vn|CourtSim cần xác minh/)).toHaveCount(0);
  await expect(page.getByText(/94[.,]52/)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Bạn đã làm tốt' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: /^1\.1\./ })).not.toBeVisible();
  const first = page.locator('details > summary').first();
  await first.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^1\.1\./ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^1\.1\./ })).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^1\.1\./ })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem lại toàn bộ biên bản' })).toHaveAttribute('href', '/simulation/test-session#transcript');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('điểm có nguồn web hiển thị tham khảo và không có cảnh báo thiếu nguồn', async ({ page }, testInfo) => {
  const user = { _id: 'record', sender_type: 'user', content: 'Tôi đề nghị đối chiếu lời khai với chứng cứ trong hồ sơ.' };
  const records = [user, { sender_type: 'ai_prosecutor' }, user, { sender_type: 'ai_prosecutor' }, user];
  const entries = SCORING_RUBRIC.groups.flatMap(g => g.items.map(item => ({ id: item.id, score: item.max * 0.8,
    reason: 'Đã có liên hệ với hồ sơ.', strength: 'Phân biệt nguồn chứng cứ.', improvement: 'Giải thích rõ hệ quả của từng chứng cứ.', quote: user.content, record_id: user._id })));
  const result = { ...calculateEvaluation(entries, records, true), legal_assessment_mode: 'web_reference', citations: [] };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/auth/me') ? { user: { id: 'test-user', full_name: 'Người học', role: 'user' } }
      : path.endsWith('/result') ? { data: result } : { data: [] } });
  });
  await page.goto('/simulation/test-session/result');
  await expect(page.getByRole('region', { name: 'Điểm luyện tập · Tham khảo' })).toContainText('80/100');
  await expect(page.getByText(/chưa đủ nguồn|CourtSim cần xác minh|nguồn phù hợp từ vbpl.vn/)).toHaveCount(0);
  const group = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Căn cứ pháp luật' }) }).first();
  await group.locator('summary').click();
  await expect(group).toContainText('Đã có liên hệ với hồ sơ.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.test-artifacts/scoring-web-${testInfo.project.name}.png`, fullPage: true });
});
