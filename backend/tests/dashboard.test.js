import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { dashboardSummary, normalizedScore, practiceSuggestion, recentSessions } from '../../frontend/src/components/dashboard/dashboardData.mjs';

test('dashboard: chuẩn hóa từng thang điểm, không bỏ điểm 0 hay dùng lại score đã quy đổi', () => {
  const sessions = [57 / 70, 67 / 73];
  const data = [{ status: 'completed', result: { earned_score: 57, assessed_max: 70, score: 81.43 } }, { status: 'completed', result: { earned_score: 67, assessed_max: 73 } }];
  assert.ok(Math.abs(dashboardSummary(data).average - sessions.reduce((a, b) => a + b) * 50) < 1e-10);
  assert.equal(normalizedScore({ score: 0 }), 0);
  for (const result of [null, {}, { earned_score: 0, assessed_max: 0 }, { score: 90, assessed_max: 70 }, { earned_score: 75, assessed_max: 70 }, { score: -1 }]) assert.equal(normalizedScore(result), null);
  assert.equal(dashboardSummary([]).average, null);
});

test('dashboard: tiếp tục phiên cập nhật mới, lọc/sort, gợi ý từ dữ liệu đã lưu', () => {
  const data = [
    { _id: 'old', status: 'ongoing', created_at: '2026-01-01', updated_at: '2026-03-01', turn_count: 4, case_id: { title: 'Đất' } },
    { _id: 'new', status: 'ongoing', created_at: '2026-02-01', turn_count: 1, case_id: { title: 'Vay' } },
    { _id: 'zero', status: 'completed', created_at: '2026-01-01', result: { score: 0, rubric_scores: { evidence_analysis: 0 } }, case_id: { title: 'Đất' } },
  ];
  assert.equal(dashboardSummary(data).ongoing[0]._id, 'old');
  assert.equal(dashboardSummary(data).totalTurns, 5);
  assert.equal(recentSessions(data, { search: ' đất ', status: 'all', sort: 'low' })[0]._id, 'zero');
  assert.match(practiceSuggestion(data.filter(s => s.status === 'completed')).text, /phân tích chứng cứ/);
  assert.equal(practiceSuggestion([]), null);
});

test('dashboard API: ngày hoạt động, kết quả legacy, gợi ý và quyền sở hữu', { skip: !process.env.COURTSIM_TEST_MONGO_URI }, async t => {
  process.env.JWT_SECRET = 'dashboard-isolated-test-secret-32-characters';
  const { createApp } = await import('../src/app.js');
  const { SimulationSession, TrialResult, User } = await import('../src/models/index.js');
  const { AuthSession } = await import('../src/models/AuthState.js');
  const { secret, hash } = await import('../src/services/authSession.js');
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => { if (server) await new Promise(r => server.close(r)); if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName });
  const user = await User.create({ username: 'Dashboard test', email: 'dashboard@example.test', email_verified: true });
  const token = secret();
  await AuthSession.create({ tokenHash: hash(token), userId: user._id, authVersion: user.auth_version ?? 0, expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) });
  const session = await SimulationSession.create({ user_id: user._id, case_id: new mongoose.Types.ObjectId(), user_court_role: 'defense_lawyer', created_at: new Date('2026-01-01'), turns: [{ records: [{ created_at: new Date('2026-02-02'), content: 'private transcript' }] }] });
  await SimulationSession.create({ user_id: new mongoose.Types.ObjectId(), case_id: new mongoose.Types.ObjectId(), user_court_role: 'defense_lawyer' });
  await TrialResult.create({ session_id: session._id, score: 81.43, earned_score: 57, assessed_max: 70, verdict: 'test', feedback: 'test', improvement_suggestions: 'Luyện phân tích chứng cứ.',
    criteria: [{ id: 'evidence_analysis', items: [{ status: 'assessed', score: 3, max: 5, strength: 'Nhận diện đúng chứng cứ.', improvement: 'Nêu tài liệu cụ thể.', reason: 'Còn thiếu liên kết.' }] }] });
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/sessions`;
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, { headers: { Cookie: `courtsim=${token}` } });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.length, 1);
  assert.equal(data[0].updated_at, '2026-02-02T00:00:00.000Z');
  assert.equal(data[0].result.earned_score, 57);
  assert.equal(data[0].result.assessed_max, 70);
  assert.equal(data[0].result.improvement_suggestions, 'Luyện phân tích chứng cứ.');
  assert.equal(data[0].turns, undefined);
  assert.equal(data[0].result.skill_insights, undefined);
  const enriched = await fetch(`${url}?include=skills`, { headers: { Cookie: `courtsim=${token}` } }).then(r => r.json());
  assert.equal(enriched.data.length, 1);
  assert.deepEqual(enriched.data[0].result.skill_insights.strengths, ['Nhận diện đúng chứng cứ.']);
  assert.equal(enriched.data[0].result.skill_insights.details[0].id, 'evidence_analysis');
  assert.equal((await fetch(`${url}?include=invalid`, { headers: { Cookie: `courtsim=${token}` } })).status, 400);
});
