import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

test('thanh toán: webhook xác thực, alias, replay, số tiền và xử lý đồng thời', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  process.env.JWT_SECRET = 'payment-test-isolated-secret-at-least-32';
  process.env.NODE_ENV = 'test';
  process.env.SEPAY_WEBHOOK_SECRET = 'payment-test-webhook-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = '';
  process.env.SEPAY_BANK_ACCOUNT = 'test-account';
  const { createApp } = await import('../src/app.js');
  const { createPaymentOrder, manuallySetPaymentStatus } = await import('../src/services/paymentService.js');
  const { default: Payment } = await import('../src/models/PaymentTransaction.js');
  const { default: Quota } = await import('../src/models/UserUsageQuota.js');
  const { default: User } = await import('../src/models/User.js');
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Payment, Quota, User].map(model => model.init()));
  const user = await User.create({ username: 'Kiểm thử thanh toán', email: 'payment@example.test', email_verified: true });
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (path, body = {}, authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Apikey payment-test-webhook-secret' } : {}) }, body: JSON.stringify(body),
  });
  const transfer = (order, overrides = {}) => ({ id: randomUUID(), transferType: 'in', accountNumber: 'test-account', content: order.orderCode, transferAmount: order.amount, ...overrides });

  await t.test('mọi alias webhook nhận yêu cầu máy chủ nhưng vẫn bắt buộc xác thực', async () => {
    for (const prefix of ['/api/v1/checkout', '/api/payment', '/api/payments']) {
      for (const suffix of ['/sepay/webhook', '/webhook/bank-transfer']) {
        assert.equal((await request(prefix + suffix, {}, false)).status, 401);
        assert.equal((await request(prefix + suffix)).status, 200);
      }
    }
    assert.equal((await request('/api/payments/create')).status, 403, 'API có cookie vẫn cần chống CSRF.');
    process.env.SEPAY_WEBHOOK_SECRET = '';
    assert.equal((await request('/api/payments/sepay/webhook', {}, false)).status, 503, 'Không bỏ xác thực webhook khi thiếu secret ở development/test.');
    process.env.SEPAY_WEBHOOK_SECRET = 'payment-test-webhook-secret';
  });

  await t.test('sai số tiền, tài khoản hoặc giao dịch hết hạn không cấp lượt', async () => {
    const order = await createPaymentOrder({ userId: user._id, type: 'case' });
    for (const overrides of [{ transferAmount: order.amount - 1 }, { accountNumber: 'wrong' }, { transferType: 'out' }]) {
      assert.equal((await request('/api/payments/sepay/webhook', transfer(order, overrides))).status, 200);
      assert.equal((await Payment.findById(order.id)).status, 'pending');
      assert.equal(await Quota.countDocuments({ user_id: user._id }), 0);
    }
    await Payment.updateOne({ _id: order.id }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    await request('/api/payments/sepay/webhook', transfer(order));
    assert.equal((await Payment.findById(order.id)).status, 'expired');
    assert.equal(await Quota.countDocuments({ user_id: user._id }), 0);
  });

  await t.test('webhook gửi lại đồng thời chỉ cấp quyền một lần', async () => {
    const order = await createPaymentOrder({ userId: user._id, type: 'lite' });
    const body = transfer(order);
    const responses = await Promise.all(Array.from({ length: 6 }, () => request('/api/payments/sepay/webhook', body)));
    assert.ok(responses.every(response => response.status === 200));
    assert.equal((await Payment.findById(order.id)).status, 'paid');
    assert.equal((await Quota.findOne({ user_id: user._id })).case_credits, 5);
    await request('/api/payment/webhook/bank-transfer', body);
    assert.equal((await Quota.findOne({ user_id: user._id })).case_credits, 5);
  });

  await t.test('xác nhận và từ chối đồng thời không ghi đè giao dịch đã xử lý', async () => {
    const before = (await Quota.findOne({ user_id: user._id })).case_credits;
    let approved = 0;
    for (let index = 0; index < 8; index++) {
      const order = await createPaymentOrder({ userId: user._id, type: 'case' });
      const results = await Promise.allSettled(['paid', 'cancelled'].map(status => manuallySetPaymentStatus({ transactionId: order.orderCode, status, adminUserId: String(user._id) })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const state = (await Payment.findById(order.id)).status;
      assert.ok(['paid', 'cancelled'].includes(state));
      if (state === 'paid') approved++;
    }
    assert.equal((await Quota.findOne({ user_id: user._id })).case_credits, before + approved);
  });
});
