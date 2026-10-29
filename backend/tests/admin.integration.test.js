import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { dateRange, queryOptions } from '../src/services/adminQuery.js';
import { estimateCost, readPricing } from '../src/config/aiPricing.js';

test('admin: ngày Việt Nam, giới hạn phân trang và bảng giá không tính trùng cached token', () => {
  const range = dateRange({ range: 'today' }, new Date('2026-09-28T01:00:00Z'));
  assert.equal(range.from.toISOString(), '2026-09-27T17:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-09-28T17:00:00.000Z');
  for (const q of [{ limit: '101' }, { page: '-1' }, { q: {} }, { sort: 'password_hash' }]) assert.throws(() => queryOptions(q));
  for (const q of [{ range: 'custom', from: '2026-02-30', to: '2026-03-01' }, { range: 'custom', from: '2026-99-99', to: '2026-03-01' }, { range: 'custom', from: '2026-09-30', to: '2026-09-28' }]) assert.throws(() => dateRange(q));
  const pricing = { 'test:model': { inputPerMillion: 2, cachedInputPerMillion: 1, outputPerMillion: 4, version: 'test-only' } };
  assert.equal(estimateCost('test', 'model', { prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 400 }, completion_tokens: 200 }, pricing).cost, 0.0024);
  assert.equal(estimateCost('test', 'missing', { prompt_tokens: 1000, completion_tokens: 200 }, pricing), null);
  assert.equal(estimateCost('test', 'model', undefined, pricing), null);
  assert.equal(estimateCost('test', 'model', { prompt_tokens: 10, completion_tokens: 1, prompt_tokens_details: { cached_tokens: 11 } }, pricing), null);
  assert.throws(() => readPricing('{"model":{"inputPerMillion":-1}}'));
});

test('admin API: MongoDB thật, phân quyền, số liệu, tìm kiếm, chi tiết, khóa và audit', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  process.env.JWT_SECRET = 'admin-test-isolated-secret-not-production';
  process.env.AUTH_EMAIL_VERIFICATION_DISABLED = 'false';
  const { createApp } = await import('../src/app.js');
  const { User, SimulationSession, Case, TrialResult, CourtRecord } = await import('../src/models/index.js');
  const { AuthSession } = await import('../src/models/AuthState.js');
  const { default: AiUsage } = await import('../src/models/AiUsage.js');
  const { default: AdminAudit } = await import('../src/models/AdminAudit.js');
  const db = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => { if (server) await new Promise(r => server.close(r)); if (mongoose.connection.name === db && /^courtsim_test_[a-f0-9]{32}$/.test(db)) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName: db, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User, SimulationSession, Case, TrialResult, CourtRecord, AuthSession, AiUsage, AdminAudit].map(m => m.init()));
  const [admin, user, unverified] = await User.create(['admin', 'user', 'user'].map((role, i) => ({ username: `Người ${i}`, email: `admin-test-${i}@example.com`, email_verified: i !== 2, system_role: role, password_hash: 'SECRET_HASH', google_id: `PRIVATE_GOOGLE_${i}` })));
  const cookies = await Promise.all([admin, user, unverified].map(async u => { const token = randomBytes(32).toString('hex'); await AuthSession.create({ userId: u._id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000), idleExpiresAt: new Date(Date.now() + 1800000) }); return `courtsim=${token}`; }));
  const courtCase = await Case.create({ title: 'Hồ sơ [.*] kiểm thử', category: 'dân sự', summary: 'Tranh chấp thử nghiệm', full_document: 'Hồ sơ kiểm thử' });
  const now = new Date();
  const [modern, legacy] = await SimulationSession.create([
    { user_id: user._id, case_id: courtCase._id, user_court_role: 'defense_lawyer', status: 'completed', created_at: new Date(now - 10000), completed_at: now, evaluation: { score: 75, feedback: 'Góp ý chấm điểm', system_prompt: 'SECRET_PROMPT' }, operation: { token: 'SECRET_LOCK' }, turns: [{ records: [{ content: '<script>không render</script> nguyên văn đầy đủ', sender_type: 'user', created_at: now }] }], feedback: { content: 'Góp ý', status: 'new', created_at: now, updated_at: now } },
    { user_id: user._id, case_id: courtCase._id, user_court_role: 'plaintiff_lawyer', status: 'completed' },
  ]);
  await TrialResult.create({ session_id: legacy._id, score: 60, verdict: 'Hoàn thành', feedback: 'Cũ', improvement_suggestions: 'Luyện tập' });
  await CourtRecord.create({ session_id: legacy._id, sender_type: 'user', sender_name: 'Người học', content: 'Biên bản cũ đầy đủ' });
  await AiUsage.create([{ session_id: modern._id, role: 'judge', model: 'test', input_tokens: 100, output_tokens: 50, estimated_cost: 0.01, success: true, latency_ms: 100 }, { session_id: legacy._id, role: 'opponent', model: 'test', success: false, latency_ms: 200 }]);
  server = createApp().listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  async function request(path, { cookie = cookies[0], method = 'GET', body } = {}) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin${path}`, { method, headers: { Cookie: cookie, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await res.json();
    assert.ok(!JSON.stringify(value).match(/SECRET_HASH|PRIVATE_GOOGLE|SECRET_PROMPT|SECRET_LOCK|tokenHash|password_hash|system_prompt/));
    return { status: res.status, ...value };
  }
  await t.test('tạo vụ án chỉ cho admin, kiểm tra nội dung và chứng cứ', async () => {
    const body = { title: 'Hồ sơ mới', category: 'dân sự', summary: 'Tình huống kiểm thử.', full_document: 'Hai bên có hợp đồng vay.' };
    async function create(cookie, payload) {
      return fetch(`http://127.0.0.1:${server.address().port}/api/v1/cases`, { method: 'POST', headers: { Cookie: cookie, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    assert.equal((await create('', body)).status, 401);
    assert.equal((await create(cookies[1], body)).status, 403);
    assert.equal((await create(cookies[0], { ...body, evidence_inventory: [{ name: 'Hợp đồng', availability: 'provided' }] })).status, 400);
    const valid = { ...body, evidence_inventory: [{ name: 'Hợp đồng', availability: 'provided', content: body.full_document }, { name: 'Biên nhận', availability: 'mentioned_only' }] };
    const response = await create(cookies[0], valid);
    assert.equal(response.status, 201);
    const result = (await response.json()).data;
    assert.equal(result.evidence_inventory.length, 2);
    assert.equal(result.evidence_inventory[0].content, body.full_document);
    assert.equal(result.evidence_inventory[1].availability, 'mentioned_only');
    assert.equal((await Case.findById(result._id)).title, body.title);

    // Chỉnh sửa vụ án (PUT /api/v1/cases/:id)
    async function updateCase(cookie, id, payload) {
      return fetch(`http://127.0.0.1:${server.address().port}/api/v1/cases/${id}`, { method: 'PUT', headers: { Cookie: cookie, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    assert.equal((await updateCase('', result._id, valid)).status, 401);
    assert.equal((await updateCase(cookies[1], result._id, valid)).status, 403);
    const updatedRes = await updateCase(cookies[0], result._id, { ...valid, title: 'Hồ sơ đã cập nhật' });
    assert.equal(updatedRes.status, 200);
    assert.equal((await Case.findById(result._id)).title, 'Hồ sơ đã cập nhật');

    // Xóa vụ án (DELETE /api/v1/cases/:id)
    async function deleteCase(cookie, id) {
      return fetch(`http://127.0.0.1:${server.address().port}/api/v1/cases/${id}`, { method: 'DELETE', headers: { Cookie: cookie, Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1' } });
    }
    assert.equal((await deleteCase('', result._id)).status, 401);
    assert.equal((await deleteCase(cookies[1], result._id)).status, 403);
    const deleteRes = await deleteCase(cookies[0], result._id);
    assert.equal(deleteRes.status, 200);
    assert.equal(await Case.findById(result._id), null);
  });
  await t.test('tất cả API chặn user thường, chưa xác minh và chưa đăng nhập', async () => {
    for (const path of ['/dashboard', '/users', `/users/${user._id}`, '/sessions', `/sessions/${modern._id}`, '/ai/usage', '/ai/cost', '/system/health', '/audit', '/analytics/activity']) {
      assert.equal((await request(path, { cookie: '' })).status, 401);
      assert.equal((await request(path, { cookie: cookies[1] })).status, 403);
      assert.equal((await request(path, { cookie: cookies[2] })).status, 403);
    }
    assert.equal((await request(`/users/${user._id}`, { cookie: cookies[1], method: 'PATCH', body: { status: 'banned' } })).status, 403);
  });
  await t.test('thống kê và khoảng ngày từ dữ liệu thật', async () => {
    const result = await request('/dashboard?range=30d'); assert.equal(result.status, 200);
    assert.equal(result.data.users.total, 3); assert.equal(result.data.sessions.total, 2); assert.equal(result.data.feedback.unresolved, 1);
    assert.equal(result.data.chart.reduce((sum, row) => sum + row.sessions, 0), 2);
    assert.equal(result.data.selected.completionRate, 1); assert.equal(result.data.selected.averageDurationMs, 10000);
    const empty = await request('/dashboard?range=custom&from=2000-01-01&to=2000-01-02'); assert.equal(empty.data.selected.sessions, 0); assert.equal(empty.data.ai.estimatedCost, null);
    assert.equal((await request('/dashboard?range=custom&from=bad&to=2026-01-01')).status, 400);
  });
  await t.test('pagination, tìm literal, sort, filter, bảo toàn kết quả cũ và biên bản', async () => {
    assert.equal((await request('/users?limit=1&page=2')).data.length, 1);
    assert.equal((await request('/users?role=admin')).pagination.total, 1);
    assert.equal((await request('/users?verified=false')).pagination.total, 1);
    assert.equal((await request('/users?q=' + encodeURIComponent('.*'))).pagination.total, 0);
    assert.equal((await request('/sessions?q=' + encodeURIComponent('[.*]'))).pagination.total, 2);
    assert.equal((await request('/sessions?q=admin-test-1')).pagination.total, 2);
    assert.equal((await request('/sessions?status=ongoing')).pagination.total, 0);
    const result = await request('/sessions?sort=created_at&order=asc'); assert.equal(result.data.find(s => s._id === String(legacy._id)).score, 60);
    assert.equal((await request(`/sessions/${legacy._id}`)).data.transcript[0].content, 'Biên bản cũ đầy đủ');
    assert.match((await request(`/sessions/${modern._id}`)).data.transcript[0].content, /nguyên văn đầy đủ/);
    assert.equal((await request(`/users/${user._id}`)).data.sessionCount, 2);
    for (const path of ['/users?limit=101', '/users?sort=password_hash', '/users?page=-1', '/users?q[x]=a', '/users/bad', '/sessions?status=failed']) assert.equal((await request(path)).status, 400);
  });
  await t.test('điểm cũ 69/73 không xuất thành điểm toàn bài ở admin', async () => {
    await SimulationSession.updateOne({ _id: modern._id }, { $set: { 'evaluation.score': 94.52, 'evaluation.earned_score': 69, 'evaluation.assessed_max': 73 } });
    const row = (await request('/sessions')).data.find(s => s._id === String(modern._id));
    assert.equal(row.score, null); assert.equal(row.earned_score, 69); assert.equal(row.assessed_max, 73);
    const detail = (await request(`/sessions/${modern._id}`)).data.evaluation;
    assert.equal(detail.score, null); assert.equal(detail.assessed_max, 73);
    assert.equal((await SimulationSession.findById(modern._id)).evaluation.score, 94.52, 'Không ghi đè kết quả lịch sử.');
  });
  await t.test('AI không tính thiếu giá thành 0; health không lộ cấu hình bí mật', async () => {
    const { data } = await request('/ai/usage?range=month'); assert.equal(data.requests, 2); assert.equal(data.priced, 1); assert.equal(data.estimatedCost, 0.01); assert.equal(data.completeCost, false); assert.equal(data.costPerSession, 0.01); assert.equal(data.errorRate, 0.5);
    assert.equal((await request('/system/health')).data.mongo, true);
  });
  await t.test('khóa người học thu hồi phiên; không khóa admin; audit có thật', async () => {
    assert.equal((await request(`/users/${admin._id}`, { method: 'PATCH', body: { status: 'banned' } })).status, 409);
    assert.equal((await request(`/users/${user._id}`, { method: 'PATCH', body: { status: 'banned', system_role: 'admin' } })).status, 400);
    assert.equal((await request(`/users/${user._id}`, { method: 'PATCH', body: { status: 'banned' } })).status, 200);
    assert.equal(await AuthSession.countDocuments({ userId: user._id }), 0);
    assert.equal((await request(`/users/${user._id}`, { method: 'PATCH', body: { status: 'active' } })).status, 200);
    assert.equal((await request('/audit')).pagination.total, 2);
  });
});
