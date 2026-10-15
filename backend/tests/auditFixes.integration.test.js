import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createSepayFixture } from './helpers/sepayFixture.mjs';

test('audit regressions: claims, audit outbox, strict money and last-session recovery',
  { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
    Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'audit-fixes-isolated-secret-at-least-32', CLIENT_ORIGIN: 'http://localhost:5173',
      PAYMENT_PROVIDER: 'sepay_gateway', PAYMENT_RETURN_ORIGIN: 'http://localhost:5173', SEPAY_ENV: 'sandbox',
      SEPAY_MERCHANT_ID: 'AUDIT_FIX', SEPAY_SECRET_KEY: 'fixture-only', SEPAY_PAYMENT_METHOD: 'BANK_TRANSFER', SEPAY_BANK_ACCOUNT: '' });
    const { createApp } = await import('../src/app.js');
    const { createPaymentOrder, pollGatewayPayment, manuallySetPaymentStatus, handleSepayWebhook } = await import('../src/services/paymentService.js');
    const { pollDuePayments } = await import('../src/services/paymentPolling.js');
    const { flushAdminAuditOutbox, flushPendingAdminAudits } = await import('../src/services/adminAuditOutbox.js');
    const { User, Case, SimulationSession, PaymentTransaction: Payment } = await import('../src/models/index.js');
    const { default: Quota } = await import('../src/models/UserUsageQuota.js');
    const { default: AdminAudit } = await import('../src/models/AdminAudit.js');
    const { AuthSession } = await import('../src/models/AuthState.js');
    const { hash } = await import('../src/services/authSession.js');
    const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
    let server;
    t.after(async () => {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
    await Promise.all([User, Case, SimulationSession, Payment, Quota, AdminAudit, AuthSession].map(model => model.init()));
    async function account(role = 'user') {
      const user = await User.create({ username: 'Audit fixture', email: `${randomUUID()}@example.test`, email_verified: true, system_role: role });
      const token = randomUUID();
      await AuthSession.create({ userId: user._id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) });
      return { user, cookie: `courtsim=${token}` };
    }
    const owner = await account(), admin = await account('admin');
    const fixture = createSepayFixture('AUDIT_FIX', 'fixture-only'), dependencies = { fetchImpl: fixture.fetchImpl };
    server = createApp(undefined, dependencies).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    async function request(path, body, actor = admin, method = body ? 'POST' : 'GET') {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
        headers: { Cookie: actor.cookie, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    }
    const create = () => createPaymentOrder({ userId: owner.user._id, type: 'case' });
    const credits = async () => (await Quota.findOne({ user_id: owner.user._id }))?.case_credits ?? 0;
    async function failFulfillment(stage, action) {
      const Model = stage === 'before_credit' ? Quota : Payment;
      const original = Model.findOneAndUpdate;
      Model.findOneAndUpdate = function (filter, update, ...args) {
        if (stage === 'before_credit' ? update.$inc?.case_credits : filter.status === 'processing') throw new Error('INJECTED_FULFILLMENT_FAILURE');
        return original.call(this, filter, update, ...args);
      };
      try { await assert.rejects(action, /INJECTED_FULFILLMENT_FAILURE/); }
      finally { Model.findOneAndUpdate = original; }
    }

    for (const direction of ['empty-to-full', 'full-to-empty']) for (const stage of ['before_credit', 'after_credit']) {
      await t.test(`AUD-02 ${direction}, ${stage}: keep verified claim, no external call or duplicate credit`, async () => {
        const order = await create(), remote = fixture.paid(fixture.pending(order));
        const transactions = remote.transactions;
        if (direction === 'empty-to-full') remote.transactions = [];
        const before = await credits();
        await failFulfillment(stage, async () => pollGatewayPayment(await Payment.findById(order.id), dependencies));
        const claim = await Payment.findById(order.id);
        assert.equal(claim.status, 'processing');
        assert.equal(await credits(), before + (stage === 'after_credit' ? 1 : 0));
        remote.transactions = direction === 'empty-to-full' ? transactions : [];
        const calls = fixture.calls.length;
        await Payment.updateOne({ _id: order.id }, { $set: { next_poll_at: null } });
        await Promise.all(Array.from({ length: 4 }, async () => pollGatewayPayment(await Payment.findById(order.id), dependencies)));
        const paid = await Payment.findById(order.id);
        assert.equal(paid.status, 'paid');
        assert.equal(paid.sepay_transaction_id, claim.sepay_transaction_id);
        assert.equal(fixture.calls.length, calls);
        assert.equal(await credits(), before + 1);
        // A transaction receipt already claimed for this order must still reject reuse elsewhere.
        if (direction === 'full-to-empty') {
          const reused = await create(); fixture.paid(fixture.pending(reused), transactions[0].id);
          await assert.rejects(async () => pollGatewayPayment(await Payment.findById(reused.id), dependencies), { code: 'SEPAY_TRANSACTION_REUSED' });
          assert.equal(await credits(), before + 1);
          await Payment.updateOne({ _id: reused.id }, { $set: { status: 'cancelled' } });
        }
      });
    }
    await t.test('AUD-02 corrupted processing receipt cannot grant access', async () => {
      const order = await create(), before = await credits();
      await Payment.updateOne({ _id: order.id }, { $set: { status: 'processing', sepay_transaction_id: 'unverified', raw_transaction: { source: 'sepay_polling', order: { order_status: 'CAPTURED', order_invoice_number: 'wrong' } } } });
      await assert.rejects(async () => pollGatewayPayment(await Payment.findById(order.id), dependencies));
      assert.equal(await credits(), before);
      await Payment.updateOne({ _id: order.id }, { $set: { status: 'cancelled' } });
    });

    for (const provider of ['manual', 'legacy']) for (const stage of ['before_credit', 'after_credit']) {
      await t.test(`AUD-03 ${provider}, ${stage}: worker and retry recover claims after 24h`, async () => {
        process.env.PAYMENT_PROVIDER = provider === 'legacy' ? 'sepay_bank_transfer' : 'sepay_gateway';
        const order = await create(), before = await credits();
        const body = { id: randomUUID(), code: order.orderCode, transferType: 'in', transferAmount: 30000 };
        await failFulfillment(stage, () => provider === 'manual'
          ? manuallySetPaymentStatus({ transactionId: order.orderCode, status: 'paid', adminUserId: admin.user._id }) : handleSepayWebhook(body));
        if (stage === 'before_credit') {
          // User/admin retries work too; the second set exercises unattended recovery.
          if (provider === 'manual') await manuallySetPaymentStatus({ transactionId: order.orderCode, status: 'paid', adminUserId: admin.user._id });
          else assert.equal((await handleSepayWebhook(body)).processed, true);
        } else {
          await Payment.collection.updateOne({ _id: new mongoose.Types.ObjectId(order.id) }, { $set: { created_at: new Date(Date.now() - 48 * 3600000) } });
          await pollDuePayments(dependencies);
        }
        assert.equal((await Payment.findById(order.id)).status, 'paid');
        assert.equal(await credits(), before + 1);
        assert.equal((await Payment.findById(order.id)).provider_payload.paid_by, provider === 'manual' ? 'manual' : 'sepay_webhook');
        if (provider === 'legacy') assert.equal((await handleSepayWebhook(body)).duplicate, true);
      });
    }
    process.env.PAYMENT_PROVIDER = 'sepay_gateway';

    await t.test('AUD-06 committed payment/user mutations return success while durable audit delivery fails', async () => {
      const order = await create(), before = await credits();
      const original = AdminAudit.updateOne;
      AdminAudit.updateOne = async () => { throw new Error('INJECTED_AUDIT_FAILURE'); };
      try {
        const result = await request(`/v1/admin/payments/${order.orderCode}`, { status: 'paid', note: 'Fixture' }, admin, 'PATCH');
        assert.equal(result.status, 200); assert.equal(result.body.data.status, 'paid');
        assert.doesNotMatch(JSON.stringify(result.body), /admin_audit_outbox/);
        assert.equal((await Payment.findById(order.id).select('+admin_audit_outbox')).admin_audit_outbox.length, 1);
        assert.equal(await AdminAudit.countDocuments({ target_id: order.id }), 0);
        const banned = await request(`/v1/admin/users/${owner.user._id}`, { status: 'banned' }, admin, 'PATCH');
        assert.equal(banned.status, 200);
        assert.equal((await User.findById(owner.user._id).select('+admin_audit_outbox')).admin_audit_outbox.length, 1);
      } finally { AdminAudit.updateOne = original; }
      assert.equal(await credits(), before + 1);
      await Promise.all([flushPendingAdminAudits(), flushPendingAdminAudits()]);
      await flushPendingAdminAudits();
      assert.equal(await AdminAudit.countDocuments({ target_id: order.id, action: 'PAYMENT_APPROVED' }), 1);
      assert.equal(await AdminAudit.countDocuments({ target_id: owner.user._id, action: 'USER_DISABLED' }), 1);
      assert.equal((await Payment.findById(order.id).select('+admin_audit_outbox')).admin_audit_outbox.length, 0);
      await User.updateOne({ _id: owner.user._id }, { $set: { status: 'active' } });
    });
    await t.test('AUD-06 delivery followed by crash before removal replays the same audit ID', async () => {
      const order = await create();
      const original = Payment.updateOne;
      Payment.updateOne = function (filter, update, ...args) {
        if (update.$pull?.admin_audit_outbox) throw new Error('INJECTED_OUTBOX_ACK_FAILURE');
        return original.call(this, filter, update, ...args);
      };
      try { await manuallySetPaymentStatus({ transactionId: order.orderCode, status: 'cancelled', adminUserId: admin.user._id }); }
      finally { Payment.updateOne = original; }
      assert.equal(await AdminAudit.countDocuments({ target_id: order.id }), 1);
      await flushAdminAuditOutbox(Payment, order.id);
      assert.equal(await AdminAudit.countDocuments({ target_id: order.id }), 1);
      assert.equal((await Payment.findById(order.id).select('+admin_audit_outbox')).admin_audit_outbox.length, 0);
    });
    await t.test('AUD-07 legacy money rejects fractional/malformed/unsafe amounts and accepts exact VND', async () => {
      process.env.PAYMENT_PROVIDER = 'sepay_bank_transfer';
      const order = await create(), before = await credits();
      for (const amount of [29999.6, '30000.4', '30,000', 'VND30000', '30000abc', '', null, -30000, 0, '9007199254740993']) {
        assert.equal((await handleSepayWebhook({ id: randomUUID(), code: order.orderCode, transferAmount: amount })).processed, false);
        assert.equal((await Payment.findById(order.id)).status, 'pending');
      }
      assert.equal(await credits(), before);
      assert.equal((await handleSepayWebhook({ id: randomUUID(), code: order.orderCode, transferAmount: '30000.00' })).processed, true);
      assert.equal(await credits(), before + 1);
      process.env.PAYMENT_PROVIDER = 'sepay_gateway';
    });
    await t.test('AUD-05 public order keeps the purchased price/name/quantity snapshot', async () => {
      const order = await create();
      await Payment.updateOne({ _id: order.id }, { $set: { amount: 25000, 'provider_payload.plan_name': 'Gói cũ',
        'provider_payload.entitlement.quantity': 2 } });
      const { publicPayment } = await import('../src/services/paymentService.js');
      const result = publicPayment(await Payment.findById(order.id));
      assert.equal(result.plan.name, 'Gói cũ'); assert.equal(result.plan.amount, 25000);
      assert.equal(result.plan.price, '25.000 VNĐ'); assert.equal(result.plan.entitlement.quantity, 2);
    });

    for (const source of ['free', 'credit']) await t.test(`AUD-04 last ${source}: membership exposes only the owner's resumable request`, async () => {
      const actor = await account(), other = await account();
      await Quota.create({ user_id: actor.user._id, free_cases_used: source === 'free' ? 1 : 2, case_credits: source === 'credit' ? 1 : 0, reset_date: new Date('2030-01-01') });
      const courtCase = await Case.create({ title: 'Fixture', summary: 'Fictional', full_document: 'Fictional', category: 'dân sự' });
      const body = { request_id: randomUUID(), case_id: String(courtCase._id), user_court_role: 'defense_lawyer', case_event_date: '2023-01-01' };
      const original = SimulationSession.updateOne;
      SimulationSession.updateOne = function (filter, update, ...args) {
        if (update.$set?.access_ready === true) throw new Error('INJECTED_ACCESS_READY_FAILURE');
        return original.call(this, filter, update, ...args);
      };
      try { assert.equal((await request('/v1/sessions', body, actor)).status, 500); }
      finally { SimulationSession.updateOne = original; }
      const path = `/auth/membership?creation_request_id=${body.request_id}`;
      const membership = (await request(path, undefined, actor)).body.data;
      assert.equal(membership.canCreateSession, false); assert.equal(membership.remainingSessions, 0);
      assert.equal(membership.resumeRequestId, body.request_id);
      assert.equal((await request(path, undefined, other)).body.data.resumeRequestId, null);
      assert.equal((await request('/auth/membership?creation_request_id[x]=bad', undefined, actor)).status, 400);
      assert.equal((await request('/v1/sessions', body, actor)).status, 201);
      assert.equal(await SimulationSession.countDocuments({ user_id: actor.user._id }), 1);
      assert.equal((await Quota.findOne({ user_id: actor.user._id })).cases_played, 1);
    });
  });
