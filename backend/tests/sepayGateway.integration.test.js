import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createSepayFixture } from './helpers/sepayFixture.mjs';

test('SePay polling: xác minh API, giới hạn tần suất và cấp quyền đúng một lần', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'sepay-test-isolated-secret-at-least-32', CLIENT_ORIGIN: 'http://localhost:5173',
    PAYMENT_PROVIDER: 'sepay_gateway', PAYMENT_RETURN_ORIGIN: 'http://localhost:5173', SEPAY_ENV: 'sandbox',
    SEPAY_MERCHANT_ID: 'TEST_MERCHANT', SEPAY_SECRET_KEY: 'test-merchant-key', SEPAY_PAYMENT_METHOD: 'BANK_TRANSFER', SEPAY_POLL_INTERVAL_MS: '10000' });
  delete process.env.SEPAY_IPN_SECRET;
  const { createApp } = await import('../src/app.js');
  const { createPaymentOrder, pollGatewayPayment } = await import('../src/services/paymentService.js');
  const { pollDuePayments, startPaymentPolling } = await import('../src/services/paymentPolling.js');
  const { default: Payment } = await import('../src/models/PaymentTransaction.js');
  const { default: Quota } = await import('../src/models/UserUsageQuota.js');
  const { default: User } = await import('../src/models/User.js');
  const { AuthSession } = await import('../src/models/AuthState.js');
  const { hash } = await import('../src/services/authSession.js');
  const fixture = createSepayFixture('TEST_MERCHANT', 'test-merchant-key');
  const dependencies = { fetchImpl: fixture.fetchImpl };
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Payment, Quota, User, AuthSession].map(model => model.init()));
  const user = await User.create({ username: 'SePay test', email: 'sepay@example.test', email_verified: true });
  const other = await User.create({ username: 'Other test', email: 'other@example.test', email_verified: true });
  const token = randomUUID().replaceAll('-', '');
  await AuthSession.create({ userId: user._id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) });
  server = createApp(undefined, dependencies).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = (path, data) => fetch(base + path, { method: data ? 'POST' : 'GET',
    headers: { Cookie: `courtsim=${token}`, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}) });
  const status = async order => (await browser(`/api/payments/${order.orderCode}/status`).then(response => response.json())).payment;
  const credits = async () => (await Quota.findOne({ user_id: user._id }))?.case_credits ?? 0;
  const due = order => Payment.updateOne({ _id: order.id }, { $set: { next_poll_at: null } });
  const create = type => createPaymentOrder({ userId: user._id, type });

  await t.test('tạo đơn không cần IPN, giá do server tính và chỉ chủ đơn mới được tra cứu', async () => {
    const response = await browser('/api/payments/create', { type: 'case', amount: 1, success_url: 'https://attacker.example' });
    assert.equal(response.status, 201);
    const { payment } = await response.json();
    assert.equal(payment.amount, 30000);
    assert.equal(payment.checkout.fields.order_amount, 30000);
    assert.equal(new URL(payment.checkout.fields.success_url).origin, 'http://localhost:5173');
    assert.ok(!JSON.stringify(payment).includes('test-merchant-key'));
    assert.equal((await browser(`/api/payments/${payment.orderCode}/checkout`, {})).status, 200);
    const foreign = await createPaymentOrder({ userId: other._id, type: 'case' });
    const before = fixture.calls.length;
    assert.equal((await browser(`/api/payments/${foreign.orderCode}/status`)).status, 404);
    assert.equal((await browser(`/api/payments/${foreign.orderCode}/checkout`, {})).status, 404);
    assert.equal(fixture.calls.length, before);
    const fake = await browser(`/api/payments/${payment.orderCode}/status?payment=success`);
    assert.equal((await fake.json()).payment.status, 'pending');
    assert.equal(await credits(), 0);
    assert.equal((await browser('/api/payments/sepay/ipn', {})).status, 404);
  });
  await t.test('đơn chưa có trên SePay, pending, sai số tiền và lỗi mạng không cấp lượt', async () => {
    const order = await create('case');
    assert.equal((await status(order)).status, 'pending');
    const before = fixture.calls.length;
    await Promise.all(Array.from({ length: 4 }, () => status(order)));
    assert.equal(fixture.calls.length, before, 'Không gọi lại SePay trước hạn polling.');
    const remote = fixture.pending(order);
    await due(order);
    assert.equal((await status(order)).status, 'pending');
    fixture.paid(remote); remote.order_amount = '1.00';
    await due(order);
    assert.equal((await status(order)).verification.available, false);
    assert.equal((await Payment.findById(order.id)).status, 'pending');
    fixture.control.status = 429;
    await due(order);
    assert.equal((await status(order)).verification.available, false);
    const stored = await Payment.findById(order.id);
    assert.ok(stored.next_poll_at > new Date(Date.now() + 10000), 'Lỗi API cần backoff.');
    fixture.control.status = 200;
    assert.equal(await credits(), 0);
    fixture.orders.delete(order.orderCode);
  });
  await t.test('poll đồng thời và lặp chỉ cộng 5 lượt Lite một lần', async () => {
    const order = await create('lite');
    const remote = fixture.paid(fixture.pending(order));
    const before = fixture.calls.length;
    const responses = await Promise.all(Array.from({ length: 6 }, () => status(order)));
    assert.ok(responses.every(response => ['pending', 'processing', 'paid'].includes(response.status)));
    assert.equal(fixture.calls.length - before, 1, 'Một lần lấy chi tiết theo invoice dù nhiều request đồng thời.');
    assert.equal(await credits(), 5);
    assert.equal((await User.findById(user._id)).subscription_type, 'lite');
    assert.equal((await status(order)).status, 'paid');
    assert.equal(await credits(), 5);
    assert.equal((await browser(`/api/payments/${order.orderCode}/checkout`, {})).status, 409);
    const another = await create('lite');
    fixture.paid(fixture.pending(another), remote.transactions[0].id);
    assert.equal((await status(another)).verification.available, false);
    assert.equal((await Payment.findById(another.id)).status, 'pending');
    assert.equal(await credits(), 5);
    fixture.orders.delete(another.orderCode);
  });
  await t.test('polling nền vẫn xác nhận đơn expired sau khi khách đóng trang', async () => {
    const order = await create('case');
    fixture.paid(fixture.pending(order));
    await Payment.updateOne({ _id: order.id }, { $set: { status: 'expired', expires_at: new Date(Date.now() - 1000) } });
    await pollDuePayments(dependencies);
    assert.equal((await Payment.findById(order.id)).status, 'paid');
    assert.equal(await credits(), 6);
  });
  await t.test('lỗi sau khi cộng lượt phục hồi ở poll tiếp theo mà không cộng lại', async () => {
    const order = await create('case');
    fixture.paid(fixture.pending(order));
    const update = Payment.findOneAndUpdate;
    Payment.findOneAndUpdate = function (filter, ...args) {
      if (filter.status === 'processing') throw new Error('Simulated DB failure after entitlement');
      return update.call(this, filter, ...args);
    };
    try { await assert.rejects(pollGatewayPayment(await Payment.findById(order.id), dependencies)); }
    finally { Payment.findOneAndUpdate = update; }
    assert.equal((await Payment.findById(order.id)).status, 'processing');
    assert.equal(await credits(), 7);
    await due(order);
    assert.equal((await status(order)).status, 'paid');
    assert.equal(await credits(), 7);
    assert.equal((await Payment.findById(order.id)).provider_payload.paid_by, 'sepay_polling');
  });
  await t.test('CANCELLED từ API hủy đơn; callback cancel không tự hủy đơn pending', async () => {
    const order = await create('case');
    const remote = fixture.pending(order);
    assert.equal((await browser(`/api/payments/${order.orderCode}/status?payment=cancel`).then(res => res.json())).payment.status, 'pending');
    remote.order_status = 'CANCELLED';
    await due(order);
    assert.equal((await status(order)).status, 'cancelled');
    assert.equal(await credits(), 7);
  });
  await t.test('Pro kích hoạt qua API và worker dừng được', async () => {
    const order = await create('pro');
    fixture.paid(fixture.pending(order));
    await pollDuePayments(dependencies);
    assert.equal((await User.findById(user._id)).subscription_type, 'pro');
    assert.equal((await status(order)).status, 'paid');
    assert.equal(await credits(), 7);
    const stop = startPaymentPolling(dependencies);
    await stop();
  });
  await t.test('lease chặn poll trùng và tự phục hồi khi process cũ đã dừng', async () => {
    const order = await create('case');
    fixture.paid(fixture.pending(order));
    await Payment.updateOne({ _id: order.id }, { $set: { poll_lease_until: new Date(Date.now() + 30000), poll_lease_token: 'old-worker' } });
    const before = fixture.calls.length;
    assert.equal((await status(order)).status, 'pending');
    assert.equal(fixture.calls.length, before);
    await Payment.updateOne({ _id: order.id }, { $set: { poll_lease_until: new Date(Date.now() - 1000) } });
    await pollDuePayments(dependencies);
    assert.equal((await Payment.findById(order.id)).status, 'paid');
    assert.equal(await credits(), 8);
  });
  await t.test('lỗi một đơn không chặn đơn khác; đơn quá 24 giờ vẫn đối soát được khi mở lại', async () => {
    const bad = await create('case');
    const old = await create('case');
    fixture.paid(fixture.pending(bad)).order_currency = 'USD';
    fixture.paid(fixture.pending(old));
    // created_at is immutable in Mongoose; set the test clock fixture via the native collection.
    await Payment.collection.updateOne({ _id: new mongoose.Types.ObjectId(old.id) },
      { $set: { created_at: new Date(Date.now() - 25 * 60 * 60 * 1000), status: 'expired' } });
    await pollDuePayments(dependencies);
    assert.equal((await Payment.findById(bad.id)).provider_payload.poll_status, 'error');
    assert.equal((await Payment.findById(old.id)).status, 'expired');
    assert.equal((await status(old)).status, 'paid');
    assert.equal(await credits(), 9);
    const good = await create('case');
    fixture.paid(fixture.pending(good));
    await due(bad);
    await pollDuePayments(dependencies);
    assert.equal((await Payment.findById(good.id)).status, 'paid');
    assert.equal(await credits(), 10);
  });
  await t.test('CAPTURED với lịch sử rỗng như API thật vẫn xác nhận đơn một lần', async () => {
    const order = await create('case');
    const remote = fixture.pending(order);
    remote.order_status = 'CAPTURED';
    assert.deepEqual(remote.transactions, []);
    const results = await Promise.all(Array.from({ length: 4 }, () => status(order)));
    assert.ok(results.every(result => ['pending', 'processing', 'paid'].includes(result.status)));
    const saved = await Payment.findById(order.id);
    assert.equal(saved.status, 'paid');
    assert.equal(saved.raw_transaction.verification, 'captured_order');
    assert.equal(saved.raw_transaction.transaction, null);
    assert.equal(await credits(), 11);
    assert.equal((await status(order)).status, 'paid');
    assert.equal(await credits(), 11);
  });
});
