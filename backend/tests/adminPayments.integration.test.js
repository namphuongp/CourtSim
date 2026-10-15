import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { createSepayFixture } from './helpers/sepayFixture.mjs';

test('admin thanh toán: tổng tiền, lịch sử người dùng, đối soát và phân quyền', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'admin-payment-isolated-secret-at-least-32', CLIENT_ORIGIN: 'http://localhost:5173',
    PAYMENT_PROVIDER: 'sepay_gateway', PAYMENT_RETURN_ORIGIN: 'http://localhost:5173', SEPAY_ENV: 'sandbox', SEPAY_MERCHANT_ID: 'TEST_ADMIN', SEPAY_SECRET_KEY: 'test-admin-secret' });
  const { createApp } = await import('../src/app.js');
  const { createPaymentOrder } = await import('../src/services/paymentService.js');
  const { User, PaymentTransaction: Payment } = await import('../src/models/index.js');
  const { AuthSession } = await import('../src/models/AuthState.js');
  const { default: Quota } = await import('../src/models/UserUsageQuota.js');
  const { default: AdminAudit } = await import('../src/models/AdminAudit.js');
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User, Payment, AuthSession, Quota, AdminAudit].map(model => model.init()));
  const [admin, alice, bob] = await User.create(['admin', 'Alice', 'Bob'].map((name, i) => ({ username: name, email: `${name.toLowerCase()}@example.test`, email_verified: true, system_role: i ? 'user' : 'admin' })));
  const cookies = await Promise.all([admin, alice].map(async user => {
    const token = randomBytes(32).toString('hex');
    await AuthSession.create({ userId: user._id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) });
    return `courtsim=${token}`;
  }));
  const fixture = createSepayFixture('TEST_ADMIN', 'test-admin-secret');
  server = createApp(undefined, { fetchImpl: fixture.fetchImpl }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/admin`;
  async function request(path, { method = 'GET', body, cookie = cookies[0], csrf = true } = {}) {
    const response = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(csrf ? { Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_CUSTOMER|SECRET_CARD|SECRET_PROVIDER_KEY|test-admin-secret|password_hash|tokenHash/);
    return { status: response.status, ...result };
  }
  const history = await Payment.create([
    [alice, 'paid', 30000], [alice, 'success', 99000], [bob, 'paid', 249000], [bob, 'pending', 30000],
    [bob, 'processing', 99000], [bob, 'expired', 30000], [bob, 'refunded', 30000], [bob, 'cancelled', 30000],
  ].map(([user, status, amount]) => {
    const code = `CS${randomBytes(12).toString('hex').toUpperCase()}`;
    return { user_id: user._id, transaction_id: code, order_code: code, type: 'case', amount, status,
      provider: 'sepay_gateway', expires_at: new Date(Date.now() + 60000),
      provider_payload: { plan_name: 'Pay-per-use', secret: 'SECRET_PROVIDER_KEY' }, raw_transaction: { customer: 'PRIVATE_CUSTOMER', card_number: 'SECRET_CARD' } };
  }));

  await t.test('summary tính mọi trang, giữ paid/success và loại hủy, hết hạn, hoàn tiền khỏi doanh thu', async () => {
    const result = await request('/payments?limit=1');
    assert.equal(result.status, 200);
    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.total, 8);
    assert.deepEqual(result.summary, { totalOrders: 8, paidCount: 3, paidAmount: 378000, pendingCount: 2, pendingAmount: 129000 });
    const paid = await request('/payments?status=paid');
    assert.equal(paid.pagination.total, 3);
    assert.ok(paid.data.every(payment => payment.status === 'paid'));
    const empty = await request('/payments?range=custom&from=2000-01-01&to=2000-01-02');
    assert.equal(empty.summary.paidAmount, 0);
    assert.equal(empty.pagination.total, 0);
  });
  await t.test('tổng tiền theo người dùng, lọc chính xác và lịch sử trong tài khoản', async () => {
    const users = await request('/payments?view=users&sort=paidAmount');
    assert.equal(users.pagination.total, 2);
    assert.equal(users.data[0].user.username, 'Bob');
    assert.equal(users.data[0].paidAmount, 249000);
    const alicePayments = await request(`/payments?user_id=${alice._id}`);
    assert.equal(alicePayments.pagination.total, 2);
    assert.equal(alicePayments.summary.paidAmount, 129000);
    assert.equal((await request('/payments?q=alice')).summary.paidAmount, 129000);
    assert.equal((await request('/payments?q=' + encodeURIComponent('.*'))).pagination.total, 0);
    const profile = await request(`/users/${alice._id}`);
    assert.equal(profile.data.payments.summary.paidAmount, 129000);
    assert.equal(profile.data.payments.data.length, 2);
    assert.equal((await request(`/payments/${history[0].transaction_id}`)).data.amount, 30000);
  });
  await t.test('bộ lọc sai, truy cập thường và yêu cầu thiếu CSRF bị từ chối', async () => {
    for (const path of ['/payments', '/payments?view=users', `/payments/${history[0].transaction_id}`]) {
      assert.equal((await request(path, { cookie: '' })).status, 401);
      assert.equal((await request(path, { cookie: cookies[1] })).status, 403);
    }
    for (const query of ['view=invalid', 'user_id=bad', 'user_id[x]=bad', 'sort=paidAmount', 'view=users&sort=amount', 'status=invalid', 'q[x]=bad']) {
      assert.equal((await request('/payments?' + query)).status, 400);
    }
    assert.equal((await request(`/payments/${history[0].transaction_id}/reconcile`, { method: 'POST', body: {}, cookie: cookies[1] })).status, 403);
    assert.equal((await request(`/payments/${history[0].transaction_id}/reconcile`, { method: 'POST', body: {}, csrf: false })).status, 403);
  });
  await t.test('admin đối soát qua SePay, cấp lượt một lần và ghi lịch sử quản trị', async () => {
    const payment = await createPaymentOrder({ userId: alice._id, type: 'case' });
    const remote = fixture.pending(payment); remote.order_status = 'CAPTURED';
    for (let retry = 0; retry < 2; retry++) {
      const result = await request(`/payments/${payment.transaction_id}/reconcile`, { method: 'POST', body: {} });
      assert.equal(result.status, 200);
      assert.equal(result.data.status, 'paid');
      assert.equal(result.data.verification.source, 'sepay_polling');
    }
    assert.equal((await Quota.findOne({ user_id: alice._id })).case_credits, 1);
    assert.equal(await AdminAudit.countDocuments({ target_id: payment.id, action: 'PAYMENT_RECONCILED' }), 2);
    const detail = await request(`/payments/${payment.transaction_id}`);
    assert.ok(detail.data.audits.some(event => event.action === 'payment_paid'));
  });
  await t.test('xác nhận thủ công có ghi chú, không sửa giá đơn hoặc xác nhận lại đơn đã trả', async () => {
    const payment = await createPaymentOrder({ userId: alice._id, type: 'case' });
    assert.equal((await request(`/payments/${payment.transaction_id}`, { method: 'PATCH', body: { status: 'paid', amount: 1 } })).status, 400);
    const result = await request(`/payments/${payment.transaction_id}`, { method: 'PATCH', body: { status: 'paid', note: 'Đã đối chiếu tiền nhận.' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.amount, 30000);
    assert.equal(result.data.note, 'Đã đối chiếu tiền nhận.');
    assert.equal(result.data.verification.source, 'manual');
    assert.equal((await request(`/payments/${payment.transaction_id}`, { method: 'PATCH', body: { status: 'paid' } })).status, 409);
    assert.equal((await Quota.findOne({ user_id: alice._id })).case_credits, 2);
  });
});
