import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { memberFeatures, normalizeMembership, sessionFeatures } from '../../shared/membershipPolicy.mjs';

test('quyền thành viên: free, gói cũ, gói trả phí, Pro và quyền của phiên đã mua', () => {
  assert.equal(normalizeMembership('plus'), 'lite');
  assert.equal(normalizeMembership('unknown'), 'freemium');
  assert.equal(memberFeatures({ tier: 'free' }).legalAssistant, false);
  for (const tier of ['pay-per-use', 'lite', 'plus']) {
    assert.equal(memberFeatures({ tier }).detailedScoring, true);
    assert.equal(memberFeatures({ tier }).skillAnalytics, false);
  }
  assert.equal(memberFeatures({ tier: 'pro' }).skillAnalytics, true);
  assert.equal(memberFeatures({ tier: 'free', role: 'admin' }).unlimitedSessions, true);
  const purchased = sessionFeatures({ access_plan: 'pay-per-use' }, { tier: 'free' });
  assert.equal(purchased.legalAssistant, true);
  assert.equal(purchased.detailedScoring, true);
  assert.equal(purchased.skillAnalytics, false);
});

test('API thành viên: hạn lượt, chống giả gói, quyền API và tạo phiên đồng thời', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  process.env.JWT_SECRET = 'membership-test-isolated-secret-32-characters';
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../src/app.js');
  const { User, Case, SimulationSession } = await import('../src/models/index.js');
  const { AuthSession } = await import('../src/models/AuthState.js');
  const { secret, hash } = await import('../src/services/authSession.js');
  const { default: Quota } = await import('../src/models/UserUsageQuota.js');
  const { applyPaymentEntitlement, consumeCaseAccess } = await import('../src/services/paymentAccess.js');
  const { PAYMENT_PRODUCTS } = await import('../src/services/pricingPlans.js');
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User, Case, SimulationSession, Quota, AuthSession].map(model => model.init()));
  const courtCase = await Case.create({ title: 'Tình huống kiểm thử gói', category: 'dân sự', summary: 'Tranh chấp hư cấu.', full_document: 'Hai bên có hợp đồng vay.' });
  const users = {}, cookies = {}, completed = {};
  for (const tier of ['free', 'pay-per-use', 'lite', 'pro', 'plus']) {
    const user = await User.create({ username: `Người học ${tier}`, email: `${tier}@example.test`, email_verified: true, subscription_type: tier });
    users[tier] = user;
    const token = secret();
    await AuthSession.create({ userId: user._id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) });
    cookies[tier] = `courtsim=${token}`;
    if (tier !== 'free') await Quota.create({ user_id: user._id, free_cases_used: 2, cases_played: 2, case_credits: tier === 'lite' || tier === 'plus' ? 5 : tier === 'pay-per-use' ? 1 : 0, reset_date: new Date('2030-01-01') });
    completed[tier] = await SimulationSession.create({ user_id: user._id, case_id: courtCase._id, case_snapshot: courtCase.toObject(), user_court_role: 'defense_lawyer', status: 'completed',
      evaluation: { score: 75, earned_score: 75, assessed_max: 100, feedback: 'Nhận xét tổng quan.', improvement_suggestions: 'Luyện thêm chứng cứ.',
        criteria: [{ id: 'evidence_analysis', label: 'Chứng cứ', items: [{ id: '3.1', status: 'assessed', score: 3, max: 5, reason: 'Có căn cứ.', quote: 'Hai bên có hợp đồng vay.', record_id: 'test', strength: 'Bám hồ sơ.', improvement: 'Làm rõ phạm vi.' }] }],
        rubric_scores: { evidence_analysis: 60 }, citations: [] } });
  }
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function request(path, tier = 'free', method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
      headers: { Cookie: cookies[tier], Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  const setup = (request_id = randomUUID()) => ({ request_id, case_id: String(courtCase._id), user_court_role: 'defense_lawyer', case_event_date: '2023-01-01', tier: 'pro', subscription_type: 'pro', features: { legalAssistant: true }, case_credits: 999 });

  await t.test('Freemium: đúng 2 lượt, không thể giả gói; vẫn đọc phiên và kết quả tổng quan', async () => {
    assert.equal((await request('/auth/membership')).body.data.remainingSessions, 2);
    let sessionId;
    for (let index = 0; index < 2; index++) {
      const result = await request('/v1/sessions', 'free', 'POST', setup());
      assert.equal(result.status, 201);
      assert.equal(result.body.data.session.features.legalAssistant, false);
      sessionId = result.body.data.session._id;
    }
    assert.equal((await request('/v1/sessions', 'free', 'POST', setup())).status, 402);
    assert.equal((await request(`/v1/sessions/${sessionId}`)).status, 200);
    assert.equal((await request('/auth/membership')).body.data.canCreateSession, false);
    for (const suffix of ['/assistant', '/legal-basis']) assert.equal((await request(`/v1/sessions/${sessionId}${suffix}`)).status, 403);
    assert.equal((await request(`/v1/sessions/${sessionId}/assistant`, 'free', 'POST', { question: 'Điều 1 Bộ luật Dân sự', request_id: randomUUID() })).status, 403);
    assert.equal((await request('/v1/sessions?include=skills')).status, 403);
    for (const [suffix, method] of [['/result', 'GET'], ['/complete', 'POST']]) {
      const result = await request(`/v1/sessions/${completed.free._id}${suffix}`, 'free', method, method === 'POST' ? {} : undefined);
      assert.equal(result.status, 200);
      assert.equal(result.body.data.earned_score, 75);
      for (const field of ['criteria', 'rubric_scores', 'rubric_feedback', 'legal_research']) assert.equal(result.body.data[field], undefined);
    }
    assert.equal((await SimulationSession.findById(completed.free._id)).evaluation.criteria.length, 1, 'Không xóa điểm chi tiết đã lưu.');
    assert.equal(await SimulationSession.countDocuments({ user_id: users.free._id, access_ready: false }), 0);
  });

  await t.test('mua lẻ và Lite: mở trợ lý và điểm chi tiết, chưa có phân tích Pro', async () => {
    for (const tier of ['pay-per-use', 'lite', 'plus']) {
      assert.equal((await request(`/v1/sessions/${completed[tier]._id}/assistant`, tier)).status, 200);
      assert.equal((await request(`/v1/sessions/${completed[tier]._id}/result`, tier)).body.data.criteria.length, 1);
      assert.equal((await request('/v1/sessions?include=skills', tier)).status, 403);
      assert.equal((await request('/auth/membership', tier)).body.data.caseCredits, tier === 'pay-per-use' ? 1 : 5);
    }
    assert.equal((await request('/v1/sessions', 'pay-per-use', 'POST', setup())).status, 201);
    assert.equal((await request('/v1/sessions', 'pay-per-use', 'POST', setup())).status, 402);
    for (let index = 0; index < 5; index++) assert.equal((await request('/v1/sessions', 'lite', 'POST', setup())).status, 201);
    assert.equal((await request('/v1/sessions', 'lite', 'POST', setup())).status, 402);
  });

  await t.test('Pro: không trừ lượt, mở phân tích kỹ năng; server đọc gói mới từ DB', async () => {
    const status = (await request('/auth/membership', 'pro')).body.data;
    assert.equal(status.unlimitedSessions, true);
    assert.equal(status.remainingSessions, null);
    for (let index = 0; index < 3; index++) assert.equal((await request('/v1/sessions', 'pro', 'POST', setup())).status, 201);
    assert.equal((await Quota.findOne({ user_id: users.pro._id })).case_credits, 0);
    assert.equal((await request('/v1/sessions?include=skills', 'pro')).status, 200);
    await User.updateOne({ _id: users.free._id }, { $set: { subscription_type: 'pro' } });
    assert.equal((await request('/v1/sessions?include=skills')).status, 200, 'Không cần đăng nhập lại sau nâng gói.');
    await User.updateOne({ _id: users.free._id }, { $set: { subscription_type: 'free' } });
  });

  await t.test('retry và yêu cầu trùng chỉ trừ một lượt, không cấp phiên chưa sẵn sàng', async () => {
    const body = setup();
    const responses = await Promise.all(Array.from({ length: 5 }, () => request('/v1/sessions', 'plus', 'POST', body)));
    assert.ok(responses.some(result => result.status === 201));
    assert.ok(responses.every(result => [201, 409].includes(result.status)));
    assert.equal((await Quota.findOne({ user_id: users.plus._id })).case_credits, 4);
    const replay = await request('/v1/sessions', 'plus', 'POST', body);
    assert.equal(replay.status, 201);
    assert.equal((await Quota.findOne({ user_id: users.plus._id })).case_credits, 4);
    const pending = await SimulationSession.create({ user_id: users.plus._id, case_id: courtCase._id, user_court_role: 'defense_lawyer', access_ready: false });
    assert.equal((await request(`/v1/sessions/${pending._id}`, 'plus')).status, 409);
    assert.ok(!(await request('/v1/sessions', 'plus')).body.data.some(session => session._id === String(pending._id)));
  });

  await t.test('gói thanh toán tăng đúng quyền, không hạ gói và giữ lượt cũ', async () => {
    await applyPaymentEntitlement({ userId: users.free._id, entitlement: PAYMENT_PRODUCTS.lite.entitlement });
    assert.equal((await User.findById(users.free._id)).subscription_type, 'lite');
    await applyPaymentEntitlement({ userId: users.free._id, entitlement: PAYMENT_PRODUCTS.case.entitlement });
    assert.equal((await User.findById(users.free._id)).subscription_type, 'lite');
    assert.equal((await Quota.findOne({ user_id: users.free._id })).case_credits, 6);
    await applyPaymentEntitlement({ userId: users.pro._id, entitlement: PAYMENT_PRODUCTS.lite.entitlement });
    assert.equal((await User.findById(users.pro._id)).subscription_type, 'pro');
    await Quota.collection.updateOne({ user_id: users['pay-per-use']._id }, { $unset: { free_cases_used: '' }, $set: { cases_played: 6, case_credits: 1 } });
    assert.equal((await request('/auth/membership', 'pay-per-use')).body.data.freeRemaining, 0);
    const recoveryId = randomUUID();
    const access = await consumeCaseAccess(users['pay-per-use']._id, 'pay-per-use', recoveryId);
    assert.equal(access.source, 'credit');
    assert.deepEqual(await consumeCaseAccess(users['pay-per-use']._id, 'pay-per-use', recoveryId), access, 'Cấp lượt dở dang có thể phục hồi mà không trừ tiếp.');
    assert.equal((await Quota.findOne({ user_id: users['pay-per-use']._id })).case_credits, 0);
    assert.equal((await Quota.findOne({ user_id: users['pay-per-use']._id })).free_cases_used, 2);
  });
});
