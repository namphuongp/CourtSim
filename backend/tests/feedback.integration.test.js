import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';

test('góp ý: một lần, gửi trùng, riêng tư, phân quyền và quản trị', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 60000 }, async t => {
  process.env.JWT_SECRET = 'feedback-test-secret-isolated-database';
  const { createApp } = await import('../src/app.js');
  const { User, SimulationSession } = await import('../src/models/index.js');
  const db = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === db && /^courtsim_test_[a-f0-9]{32}$/.test(db)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName: db, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), SimulationSession.init()]);
  const users = await User.create(['user', 'user', 'admin'].map((role, i) => ({ username: `Người ${i}`, email: `feedback${i}@example.com`, password_hash: 'test-only', email_verified: true, system_role: role })));
  const { AuthSession } = await import('../src/models/AuthState.js');
  const tokens = await Promise.all(users.map(async user => { const token = randomBytes(32).toString('base64url'); await AuthSession.create({tokenHash:createHash('sha256').update(token).digest('hex'),userId:user._id,expiresAt:new Date(Date.now()+3600000),idleExpiresAt:new Date(Date.now()+1800000)}); return `courtsim=${token}`; }));
  const session = await SimulationSession.create({ user_id: users[0]._id, case_id: new mongoose.Types.ObjectId(), user_court_role: 'defense_lawyer', status: 'completed', evaluation: { score: 70, feedback: 'Không sao chép' }, turns: [{ content: 'Riêng tư' }] });
  const ongoing = await SimulationSession.create({ user_id: users[0]._id, case_id: new mongoose.Types.ObjectId(), user_court_role: 'defense_lawyer' });
  server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function request(path, method = 'GET', body, token = tokens[0]) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', 'X-CourtSim-Request':'1', ...(token ? { Cookie: token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json() };
  }
  const path = `/sessions/${session._id}/feedback`;
  const adminPath = `/admin/feedback/${session._id}`;
  assert.equal((await request(path + '/prompt', 'POST', {}, '')).status, 401);
  assert.equal((await request(path + '/prompt', 'POST', {}, tokens[1])).status, 404);
  assert.equal((await request(`/sessions/${ongoing._id}/feedback/prompt`, 'POST', {})).status, 409);
  assert.equal((await request(`/sessions/${ongoing._id}/feedback`, 'POST', { content: 'Không được gửi' })).status, 409);
  await SimulationSession.updateOne({ _id: ongoing._id }, { $set: { status: 'completed' } });
  assert.equal((await request(`/sessions/${ongoing._id}/feedback/prompt`, 'POST')).status, 409);
  const claims = await Promise.all([request(path + '/prompt', 'POST', {}), request(path + '/prompt', 'POST', {})]);
  assert.deepEqual(claims.map(r => r.body.data.show).sort(), [false, true]);
  assert.equal((await request(path + '/prompt', 'POST', {})).body.data.show, false);
  for (const content of ['', '   ', 'x'.repeat(2001), { $ne: '' }]) assert.equal((await request(path, 'POST', { content })).status, 400);
  assert.equal((await request(path, 'POST', { content: 'Từ tài khoản khác' }, tokens[1])).status, 404);
  const content = '<script>alert(1)</script> Luật [.*] — góp ý tiếng Việt';
  const submissions = await Promise.all([request(path, 'POST', { content, evaluation: 'không lưu', notes: 'không lưu', status: 'resolved' }), request(path, 'POST', { content })]);
  assert.deepEqual(submissions.map(r => r.status).sort(), [200, 201]);
  assert.equal((await request(path, 'POST', { content: 'Nội dung khác' })).status, 409);
  const saved = await SimulationSession.findById(session._id).lean();
  assert.deepEqual(Object.keys(saved.feedback).sort(), ['content', 'created_at', 'notes', 'status', 'updated_at']);
  assert.equal(saved.feedback.status, 'new');
  const publicSession = (await request(`/sessions/${session._id}`)).body.data;
  assert.equal(publicSession.feedback, undefined);
  assert.equal(publicSession.feedback_submitted_at, undefined);
  for (const [url, method, body] of [['/admin/feedback', 'GET'], [adminPath, 'GET'], [adminPath, 'PATCH', { status: 'resolved', notes: '' }], [adminPath, 'DELETE']]) {
    assert.equal((await request(url, method, body)).status, 403);
  }
  const admin = (url, method = 'GET', body) => request(url, method, body, tokens[2]);
  const list = (await admin('/admin/feedback?status=new&limit=1&page=1')).body;
  assert.equal(list.pagination.total, 1); assert.equal(list.data[0].user.full_name, 'Người 0');
  assert.equal(list.data[0].evaluation, undefined); assert.equal(list.data[0].turns, undefined); assert.equal(list.data[0].user.email, undefined);
  assert.equal((await admin('/admin/feedback?q=' + encodeURIComponent('[.*]'))).body.pagination.total, 1);
  assert.equal((await admin('/admin/feedback?q=' + encodeURIComponent('.*'))).body.pagination.total, 1);
  assert.equal((await admin('/admin/feedback?q=' + encodeURIComponent('^'))).body.pagination.total, 0);
  assert.equal((await admin('/admin/feedback?page=2&limit=1')).body.data.length, 0);
  assert.equal((await admin('/admin/feedback?status=bad')).status, 400);
  assert.equal((await admin(adminPath, 'PATCH', { status: 'bad', notes: '' })).status, 400);
  assert.equal((await admin(adminPath, 'PATCH', { status: 'viewed', notes: 'x'.repeat(2001) })).status, 400);
  assert.equal((await admin(adminPath, 'PATCH', { status: 'viewed', notes: 'Ghi chú nội bộ <b>nguyên văn</b>' })).status, 200);
  assert.equal((await admin(adminPath)).body.data.notes, 'Ghi chú nội bộ <b>nguyên văn</b>');
  assert.equal((await admin('/admin/feedback?status=new')).body.pagination.total, 0);
  assert.equal((await request(`/sessions/${session._id}`)).body.data.feedback, undefined);
  assert.ok(!JSON.stringify((await request('/sessions')).body).includes('Ghi chú nội bộ'));
  assert.equal((await admin(adminPath, 'PATCH', { status: 'resolved', notes: 'Đã xử lý' })).status, 200);
  assert.equal((await admin(adminPath, 'DELETE')).status, 200);
  assert.equal((await admin(adminPath)).status, 404);
  assert.equal((await request(path + '/prompt', 'POST')).body.data.show, false);
  assert.equal((await request(path, 'POST', { content })).status, 409);
  assert.equal((await SimulationSession.findById(session._id)).evaluation.score, 70);
});
