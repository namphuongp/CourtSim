import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
test('AI tracking: mọi lần gọi và retry, token/cache/cost, thiếu usage, lỗi, không lưu prompt', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 30000 }, async t => {
  const db = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let attempt = 0, mode = 'retry';
  const server = createServer((req, res) => {
    req.resume();
    if (mode === 'retry' && attempt++ === 0) { res.writeHead(429, { 'Retry-After': '0' }); res.end('{}'); return; }
    if (mode === 'invalid') { res.end('not json'); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'Phản hồi kiểm thử' } }], ...(mode === 'retry' ? { usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 } } } : {}) }));
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(async () => { await new Promise(r => server.close(r)); if (mongoose.connection.name === db && /^courtsim_test_[a-f0-9]{32}$/.test(db)) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  process.env.JWT_SECRET = 'ai-tracking-test-secret-not-for-production';
  process.env.AI_USER_CALLS_PER_15_MIN = '4';
  process.env.AI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.AI_MODEL_PRICING_JSON = JSON.stringify({ 'openai-compatible:test': { inputPerMillion: 2, cachedInputPerMillion: 1, outputPerMillion: 4, version: 'test-only' } });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName: db });
  const { createChatCompletion } = await import('../src/services/aiClient.js');
  const { default: AiUsage } = await import('../src/models/AiUsage.js');
  const userId = new mongoose.Types.ObjectId(), sessionId = new mongoose.Types.ObjectId();
  const input = { model: 'test', usageContext: { userId, sessionId, role: 'judge' }, systemPrompt: 'PRIVATE_PROMPT_DO_NOT_STORE', messages: [{ role: 'user', content: 'PRIVATE_INPUT' }] };
  await createChatCompletion(input);
  let rows = await AiUsage.find().sort({ created_at: 1 }).lean();
  assert.equal(rows.length, 2); assert.equal(rows[0].error_type, 'HTTP_429'); assert.equal(rows[0].estimated_cost, null);
  assert.equal(rows[1].estimated_cost, 0.0024); assert.equal(rows[1].cached_input_tokens, 400); assert.equal(String(rows[1].session_id), String(sessionId));
  assert.ok(!JSON.stringify(rows).match(/PRIVATE_PROMPT|PRIVATE_INPUT|messages|systemPrompt|Authorization/));
  mode = 'no-usage'; await createChatCompletion(input); rows = await AiUsage.find().sort({ created_at: -1 }).lean(); assert.equal(rows[0].estimated_cost, null); assert.equal(rows[0].input_tokens, null);
  mode = 'invalid'; await assert.rejects(createChatCompletion(input)); assert.equal(await AiUsage.countDocuments({ error_type: 'INVALID_RESPONSE' }), 1);
  const countBeforeLimit = await AiUsage.countDocuments();
  await assert.rejects(createChatCompletion(input), { code: 'RATE_LIMITED' });
  assert.equal(await AiUsage.countDocuments(), countBeforeLimit, 'Hạn mức chặn trước khi gọi provider; không phát sinh chi phí mới.');
  const { consumeAuthLimit } = await import('../src/middlewares/rateLimit.js');
  const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => consumeAuthLimit('concurrent-budget', 3)));
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 3);
  assert.ok(concurrent.filter(r => r.status === 'rejected').every(r => r.reason.code === 'RATE_LIMITED'));
});
