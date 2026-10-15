import { test, expect } from '@playwright/test';

// Fixture chỉ nằm trong test; dashboard lấy dữ liệu từ API của tài khoản đang đăng nhập.
const sessions = [
  { _id: 'graded-a', status: 'completed', created_at: '2026-01-01', completed_at: '2026-01-02', case_id: { title: 'Vụ án đất đai' }, user_court_role: 'defense_lawyer', turn_count: 2, result: { earned_score: 57, assessed_max: 70, improvement_suggestions: 'Luyện phân tích chứng cứ.' } },
  { _id: 'graded-b', status: 'completed', created_at: '2026-01-03', completed_at: '2026-01-04', case_id: { title: 'Vụ án vay' }, turn_count: 4, result: { earned_score: 67, assessed_max: 73, rubric_scores: { evidence_analysis: 60 } } },
  { _id: 'resume', status: 'ongoing', created_at: '2026-01-01', updated_at: '2026-02-01', case_id: { title: 'Phiên cập nhật mới' }, turn_count: 3 },
  { _id: 'other', status: 'ongoing', created_at: '2026-01-10', case_id: { title: 'Phiên khác' }, turn_count: 0 },
];

async function api(page, data, failed = false) {
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'test', full_name: 'Người học', role: 'user' } } });
    return route.fulfill(failed ? { status: 503, json: { message: 'Chưa tải được dữ liệu.' } } : { json: { data } });
  });
}

test('dashboard: điểm thật theo API, chart, tiếp tục, bộ lọc và responsive', async ({ page }, info) => {
  await api(page, sessions);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Không gian luyện tập của bạn' })).toBeVisible();
  await expect(page.locator('.dashboard-metrics')).toContainText('86,6/100');
  await expect(page.locator('.dashboard-metrics')).toContainText('Tổng lượt tranh tụng9');
  await expect(page.getByRole('img', { name: /Biểu đồ điểm của 2 phiên/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tiếp tục luyện tập', exact: true }).getByRole('link', { name: 'Tiếp tục tranh tụng' })).toHaveAttribute('href', '/simulation/resume');
  await expect(page.getByRole('region', { name: 'Gợi ý luyện tập' })).toContainText('phân tích chứng cứ');
  const recent = page.getByRole('region', { name: 'Các phiên gần đây' });
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('completed');
  await expect(recent.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Sắp xếp').selectOption('high');
  await expect(recent.getByRole('article').first()).toContainText('Vụ án vay');
  await page.getByLabel('Tìm phiên theo tên vụ án').fill('đất');
  await expect(recent.getByRole('article')).toHaveCount(1);
  await expect(recent).toContainText('57/70');
  await page.getByLabel('Tìm phiên theo tên vụ án').fill('');
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('all');
  await page.screenshot({ path: `../.test-artifacts/dashboard-upgraded-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dashboard: không fake chart khi rỗng, báo lỗi và thử lại', async ({ page }) => {
  await api(page, [], true);
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/**');
  await api(page, []);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Chưa có điểm', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Biểu đồ điểm/ })).toHaveCount(0);
  await expect(page.getByText(/Bạn chưa có phiên luyện tập/)).toBeVisible();
});
