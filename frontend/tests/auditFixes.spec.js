import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

test('AUD-01 deployment CSP permits both SePay forms and blocks other destinations', async ({ page }) => {
  const nginx = readFileSync(new URL('../../deploy/nginx.conf.example', import.meta.url), 'utf8');
  const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': csp });
    res.end('<!doctype html><title>Deployment CSP fixture</title>');
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const host of ['pay.sepay.vn', 'pay-sandbox.sepay.vn']) {
      const url = `https://${host}/v1/checkout/init`;
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>SePay fixture</title>' }));
      await page.goto(origin);
      const submitted = page.waitForRequest(url);
      await page.evaluate(url => {
        const form = document.createElement('form'); form.method = 'POST'; form.action = url;
        document.body.append(form); HTMLFormElement.prototype.submit.call(form);
      }, url);
      expect((await submitted).method()).toBe('POST');
      await expect(page).toHaveURL(url);
    }
    await page.goto(origin);
    let unexpected = 0;
    await page.route('https://untrusted.example/**', route => { unexpected++; return route.abort(); });
    const directive = await page.evaluate(() => new Promise(resolve => {
      document.addEventListener('securitypolicyviolation', event => resolve(event.effectiveDirective), { once: true });
      const form = document.createElement('form'); form.method = 'POST'; form.action = 'https://untrusted.example/pay';
      document.body.append(form); HTMLFormElement.prototype.submit.call(form);
      setTimeout(() => resolve('no-violation'), 1000);
    }));
    expect(directive).toBe('form-action'); expect(unexpected).toBe(0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('AUD-05 checkout always uses the saved plan, price and quantity even on a different plan URL', async ({ page }) => {
  const order = { id: '123456789012345678901234', orderCode: 'CS123456789012345678901234', status: 'pending', provider: 'sepay_gateway', type: 'case', amount: 25000,
    plan: { id: 'pay-per-use', name: 'Pay-per-use', amount: 25000, cadence: 'Mua từng case', entitlement: { type: 'case_credit', quantity: 2 }, features: { legalAssistant: true, detailedScoring: true, skillAnalytics: false } },
    verification: { available: true }, expiresAt: new Date(Date.now() + 600000).toISOString() };
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/auth/me')
    ? { user: { id: 'audit-user', role: 'user', tier: 'free' } } : { payment: order } }));
  for (const plan of ['pro', 'lite', 'freemium', 'missing-plan']) {
    await page.goto(`/checkout/${plan}?order=${order.orderCode}`);
    await expect(page.getByRole('heading', { name: 'Thanh toán gói Pay-per-use', exact: true })).toBeVisible();
    await expect(page.locator('.checkout-total')).toContainText('25.000 VNĐ');
    await expect(page.locator('.checkout-includes')).toContainText('Cộng 2 lượt mô phỏng');
    await expect(page.locator('.checkout-hero')).toContainText('cộng 2 lượt mô phỏng');
    await expect(page.locator('.checkout-includes')).not.toContainText('Phân tích kỹ năng');
    await expect(page.locator('.checkout-hero')).not.toContainText('249.000');
  }
});

test('AUD-04 exhausted user can resume the saved creation request after reload', async ({ page }) => {
  const saved = { request_id: 'audit-existing-request-1234', case_id: '123456789012345678901234', user_court_role: 'defense_lawyer', difficulty: 'balanced', case_event_date: '2023-01-01' };
  const courtCase = { _id: saved.case_id, title: 'Hồ sơ phục hồi', category: 'dân sự', summary: 'Tình huống thử nghiệm', full_document: 'Dữ liệu giả lập.' };
  await page.addInitScript(saved => sessionStorage.setItem('courtsim:draft:audit-user:setup', JSON.stringify(saved)), saved);
  const sent = [];
  await page.route('**/api/**', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'audit-user', role: 'user', tier: 'free' } } });
    if (url.pathname.endsWith('/auth/membership')) return route.fulfill({ json: { data: { id: 'freemium', name: 'Freemium', freeLimit: 2, freeRemaining: 0, caseCredits: 0, canCreateSession: false,
      resumeRequestId: url.searchParams.get('creation_request_id') === saved.request_id ? saved.request_id : null } } });
    if (url.pathname.endsWith('/cases')) return route.fulfill({ json: { data: [courtCase], pagination: { total: 1 } } });
    if (url.pathname.endsWith(`/cases/${courtCase._id}`)) return route.fulfill({ json: { data: courtCase } });
    if (url.pathname.endsWith('/sessions') && request.method() === 'POST') {
      sent.push(request.postDataJSON());
      return route.fulfill({ status: 503, json: { error: { message: 'Lỗi thử nghiệm để giữ màn hình thiết lập.' } } });
    }
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto('/dashboard/setup');
  await page.reload();
  const resume = page.getByRole('button', { name: 'Tiếp tục khởi tạo phiên', exact: true });
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual(saved);
  // Changing the setup creates a new request; exhausted users must not start a new session.
  await page.getByRole('button', { name: 'Luật sư bảo vệ nguyên đơn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu phiên tòa', exact: true })).toBeDisabled();
});
