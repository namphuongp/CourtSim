import { test, expect } from '@playwright/test';

// Fixture chỉ nằm trong test; dashboard lấy dữ liệu từ API của tài khoản đang đăng nhập.
const sessions = [
  { _id: 'graded-a', status: 'completed', created_at: '2026-01-01', completed_at: '2026-01-02', case_id: { title: 'Vụ án đất đai' }, user_court_role: 'defense_lawyer', turn_count: 2, result: { earned_score: 57, assessed_max: 70, improvement_suggestions: 'Luyện phân tích chứng cứ.' } },
  { _id: 'graded-b', status: 'completed', created_at: '2026-01-03', completed_at: '2026-01-04', case_id: { title: 'Vụ án vay' }, turn_count: 4, result: { earned_score: 67, assessed_max: 73, rubric_scores: { evidence_analysis: 60 } } },
  { _id: 'resume', status: 'ongoing', created_at: '2026-01-01', updated_at: '2026-02-01', case_id: { title: 'Phiên cập nhật mới' }, turn_count: 3 },
  { _id: 'other', status: 'ongoing', created_at: '2026-01-10', case_id: { title: 'Phiên khác' }, turn_count: 0 },
];

async function api(page, data, failed = false, userId = 'test') {
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: userId, full_name: 'Người học', role: 'user' } } });
    return route.fulfill(failed ? { status: 503, json: { message: 'Chưa tải được dữ liệu.' } } : { json: { data } });
  });
}

function seedGuideDismissal(page) {
  return page.addInitScript(() => localStorage.setItem('courtsim.dashboard-guide.v1:test', '1'));
}

test('dashboard: điểm thật theo API, chart, tiếp tục, bộ lọc và responsive', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  await seedGuideDismissal(page);
  await api(page, sessions);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Không gian luyện tập của bạn' })).toBeVisible();
  const metrics = page.locator('.dashboard-metrics');
  await expect(metrics).toContainText('86,6/100');
  await expect(page.getByRole('dialog', { name: 'Chọn vụ án', exact: true })).toHaveCount(0);
  await expect(metrics).toContainText('Tổng lượt tranh tụng9');
  await expect(page.getByRole('img', { name: /Biểu đồ điểm của 2 phiên/ })).toBeVisible();
  const resume = page.getByRole('region', { name: 'Tiếp tục luyện tập', exact: true });
  await expect(resume.getByRole('link', { name: 'Tiếp tục tranh tụng' })).toHaveAttribute('href', '/simulation/resume');
  expect((await resume.boundingBox()).y).toBeLessThan((await metrics.boundingBox()).y);
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
  await seedGuideDismissal(page);
  await api(page, [], true);
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/**');
  await api(page, []);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('link', { name: 'Chọn vụ án', exact: true })).toHaveAttribute('href', '/dashboard/setup?start=cases');
  await expect(page.getByRole('button', { name: 'Hướng dẫn nhanh', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-metrics')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Biểu đồ điểm/ })).toHaveCount(0);
});

test('dashboard: hướng dẫn tự mở lúc đăng nhập, có thể tắt tự mở và vẫn xem lại trước khi chọn vụ án', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  const user = { id: 'first-learner', full_name: 'Người học mới', role: 'user' };
  const courtCase = { _id: '123456789012345678901234', title: 'Hồ sơ luyện tập đầu tiên', category: 'dân sự', summary: 'Tình huống kiểm thử.' };
  let authenticated = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill(authenticated ? { json: { user } } : { status: 401, json: {} });
    if (path.endsWith('/auth/login')) {
      authenticated = true;
      return route.fulfill({ json: { user } });
    }
    if (path.endsWith('/cases')) return route.fulfill({ json: { data: [courtCase], pagination: { total: 1 } } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('first-learner@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Fixture-only-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const guide = page.getByRole('dialog', { name: 'Chọn vụ án', exact: true });
  const close = guide.getByRole('button', { name: 'Đóng hướng dẫn', exact: true });
  const next = guide.getByRole('button', { name: 'Tiếp theo →', exact: true });
  const skipLabel = 'Không hiện lại hướng dẫn này';
  const skip = guide.getByRole('checkbox', { name: skipLabel, exact: true });
  await expect(guide).toBeInViewport({ ratio: 1 });
  await expect(close).toBeFocused();
  await expect(skip).not.toBeChecked();
  await page.keyboard.press('Shift+Tab');
  await expect(next).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await skip.focus();
  await page.keyboard.press('Space');
  await expect(skip).toBeChecked();
  await expect(guide).toBeVisible();
  await next.click();
  const resume = page.getByRole('dialog', { name: 'Tiếp tục phiên đang luyện', exact: true });
  await expect(resume.getByRole('checkbox', { name: skipLabel, exact: true })).toBeChecked();
  await resume.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
  const results = page.getByRole('dialog', { name: 'Xem kết quả đã lưu', exact: true });
  await expect(results.getByRole('checkbox', { name: skipLabel, exact: true })).toBeChecked();
  await results.getByRole('button', { name: 'Đóng hướng dẫn', exact: true }).click();
  await expect(results).toBeHidden();
  await page.reload();

  const replay = page.getByRole('button', { name: 'Hướng dẫn nhanh', exact: true });
  await expect(replay).toBeVisible();
  await expect(guide).toBeHidden();
  await replay.click();
  await expect(guide).toBeVisible();
  await expect(skip).toBeChecked();
  await skip.uncheck();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  await expect(replay).toBeFocused();
  await page.reload();
  await close.click();
  await page.getByRole('link', { name: 'Chọn vụ án', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/setup\?start=cases$/);
  await expect(page.locator('.setup-case-card')).toHaveAttribute('aria-pressed', 'false');
});

test('dashboard: đóng tạm thời, hoàn tất được ghi nhớ riêng theo tài khoản', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile'
    ? { width: 390, height: 664 }
    : { width: 1440, height: 900 });
  await api(page, sessions);
  await page.goto('/dashboard');
  const first = page.getByRole('dialog', { name: 'Chọn vụ án', exact: true });
  await expect(first).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(first).toBeHidden();
  await page.reload();
  await first.getByRole('button', { name: 'Đóng hướng dẫn', exact: true }).click();
  await expect(first).toBeHidden();
  await page.reload();
  await expect(first).toBeVisible();
  await first.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
  const resume = page.getByRole('dialog', { name: 'Tiếp tục phiên đang luyện', exact: true });
  await resume.getByRole('button', { name: 'Tiếp theo →', exact: true }).click();
  const results = page.getByRole('dialog', { name: 'Xem kết quả đã lưu', exact: true });
  await expect(results.getByRole('checkbox', { name: 'Không hiện lại hướng dẫn này', exact: true })).not.toBeChecked();
  await results.getByRole('button', { name: 'Hoàn tất hướng dẫn', exact: true }).click();
  await expect(results).toBeHidden();
  await page.reload();
  await expect(page.locator('.dashboard-metrics')).toBeVisible();
  await expect(first).toBeHidden();

  await page.unroute('**/api/**');
  await api(page, sessions, false, 'other-learner');
  await page.reload();
  await expect(first).toBeVisible();
});
