import { test, expect } from '@playwright/test';

async function setupFeedback(page, { failPrompt = false, failSubmit = false } = {}) {
  const submissions = [];
  const surveyRequests = [];
  let prompted = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/survey')) surveyRequests.push(path);
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'test-user', full_name: 'Người học', role: 'user' } } });
    if (path.endsWith('/feedback/prompt')) {
      if (failPrompt) return route.fulfill({ status: 503, json: { error: { message: 'Chưa tải được lời mời.' } } });
      const show = !prompted;
      prompted = true;
      return route.fulfill({ json: { data: { show } } });
    }
    if (path.endsWith('/feedback')) {
      submissions.push(route.request().postDataJSON());
      return failSubmit
        ? route.fulfill({ status: 503, json: { error: { message: 'Chưa gửi được góp ý. Vui lòng thử lại.' } } })
        : route.fulfill({ status: 201, json: { data: { submitted: true } } });
    }
    if (path.endsWith('/result')) return route.fulfill({ json: { data: { score: 75, earned_score: 75, assessed_max: 100, feedback: 'Có liên hệ chứng cứ.', improvement_suggestions: 'Giải thích rõ hơn.', citations: [] } } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/simulation/test-session/result');
  return { submissions, surveyRequests };
}

test('bỏ qua góp ý mở kết quả ngay, tải lại không hỏi lần nữa', async ({ page }, testInfo) => {
  const { submissions, surveyRequests } = await setupFeedback(page);
  await expect(page.getByLabel('Góp ý của bạn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi góp ý và xem kết quả' })).toBeDisabled();
  await expect(page.getByText(/Google Forms/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../.test-artifacts/feedback-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Bỏ qua và xem kết quả' }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập', exact: true })).toBeVisible();
  expect(submissions).toEqual([]);
  expect(surveyRequests).toEqual([]);
});

test('gửi góp ý đã bỏ khoảng trắng và mở kết quả', async ({ page }) => {
  const { submissions } = await setupFeedback(page);
  const input = page.getByLabel('Góp ý của bạn');
  await expect(input).toHaveAttribute('maxlength', '2000');
  await input.fill('   ');
  await expect(page.getByRole('button', { name: 'Gửi góp ý và xem kết quả' })).toBeDisabled();
  await input.fill('  Cần giải thích nhận xét rõ hơn.  ');
  await page.getByRole('button', { name: 'Gửi góp ý và xem kết quả' }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập', exact: true })).toBeVisible();
  expect(submissions).toEqual([{ content: 'Cần giải thích nhận xét rõ hơn.' }]);
});

test('gửi lỗi giữ nội dung và vẫn cho bỏ qua', async ({ page }) => {
  await setupFeedback(page, { failSubmit: true });
  const input = page.getByLabel('Góp ý của bạn');
  await input.fill('Tôi muốn giao diện dễ đọc hơn.');
  await page.getByRole('button', { name: 'Gửi góp ý và xem kết quả' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa gửi được góp ý');
  await expect(input).toHaveValue('Tôi muốn giao diện dễ đọc hơn.');
  await expect(page.getByRole('button', { name: 'Gửi góp ý và xem kết quả' })).toBeEnabled();
  await page.getByRole('button', { name: 'Bỏ qua và xem kết quả' }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập', exact: true })).toBeVisible();
});

test('lỗi tải lời mời góp ý không chặn kết quả', async ({ page }) => {
  await setupFeedback(page, { failPrompt: true });
  await expect(page.getByRole('heading', { name: 'Kết quả luyện tập', exact: true })).toBeVisible();
  await expect(page.getByLabel('Góp ý của bạn')).toHaveCount(0);
});
