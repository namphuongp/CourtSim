import { test, expect } from '@playwright/test';

const rows = [80, 90].map((score, i) => ({
  _id: `skill-${i}`, status: 'completed', completed_at: `2026-01-0${i + 1}`, case_id: { title: `Phiên chứng cứ ${i + 1}` }, user_court_role: 'defense_lawyer',
  result: { earned_score: 57, assessed_max: 70, rubric_scores: { evidence_analysis: score, adaptation: 60, legal_reasoning: null }, skill_insights: {
    strengths: ['Nhận diện tốt khoảng trống chứng cứ.'], improvements: ['Chỉ rõ tài liệu hỗ trợ kết luận.'], goal: 'Phân biệt chưa chứng minh và đã bác bỏ.',
    details: [{ id: 'evidence_analysis', feedback: ['Nhận xét chi tiết đã lưu.'], strengths: [], improvements: ['Chỉ rõ tài liệu hỗ trợ kết luận.'] }],
  } },
}));

async function mock(page, data, fail = false) {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'skill-user', role: 'user', tier: 'pro', full_name: 'Người học' } } });
    if (url.pathname.endsWith('/auth/membership')) return route.fulfill({ json: { data: { id: 'pro', skillAnalytics: true } } });
    expect(url.searchParams.get('include')).toBe('skills');
    return route.fulfill(fail ? { status: 503, json: { message: 'Không tải được đánh giá.' } } : { json: { data } });
  });
}

test('hồ sơ năng lực: điểm/nhận xét, biểu đồ riêng từng kỹ năng, chi tiết và responsive', async ({ page }, info) => {
  await mock(page, rows);
  await page.goto('/dashboard/analytics');
  const metrics = page.locator('.skill-metrics');
  await expect(metrics).toContainText('72,5/100');
  await expect(metrics).toContainText('Phân tích chứng cứ · 85/100');
  await expect(metrics).toContainText('Ứng biến · 60/100');
  await expect(page.getByRole('progressbar', { name: 'Phân tích chứng cứ', exact: true })).toHaveAttribute('value', '85');
  await expect(page.getByRole('progressbar', { name: 'Lập luận pháp lý', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Chưa đủ dữ liệu');
  await page.getByLabel('Nhóm kỹ năng', { exact: true }).selectOption('evidence');
  await expect(page.getByRole('img', { name: 'Tiến bộ Phân tích chứng cứ qua 2 phiên' })).toBeVisible();
  await page.getByLabel('Kỹ năng cụ thể', { exact: true }).selectOption('evidence_use');
  await expect(page.getByRole('img', { name: /Tiến bộ/ })).toHaveCount(0);
  await page.getByLabel('Kỹ năng cụ thể', { exact: true }).selectOption('evidence_analysis');
  const details = page.getByRole('region', { name: 'Phân tích chi tiết' });
  const evidence = details.locator('details').filter({ has: page.locator('summary', { hasText: 'Phân tích chứng cứ' }) });
  await evidence.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(evidence.getByText('Nhận xét chi tiết đã lưu.').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(evidence.getByText('Nhận xét chi tiết đã lưu.').first()).not.toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Nhận xét của CourtSim' })).toContainText('Phân biệt chưa chứng minh và đã bác bỏ.');
  await expect(page.getByRole('region', { name: 'Phiên đánh giá gần đây' }).getByRole('article')).toHaveCount(2);
  await page.screenshot({ path: `../.test-artifacts/skills-${info.project.name}.png`, fullPage: true });
  for (const width of [768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('hồ sơ năng lực: lỗi API, thử lại và dữ liệu rỗng không có điểm/biểu đồ giả', async ({ page }) => {
  await mock(page, [], true);
  await page.goto('/dashboard/analytics');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/**');
  await mock(page, []);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan kỹ năng' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Tiến bộ/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Phiên đánh giá gần đây' })).toContainText('Chưa có phiên đánh giá');
});
