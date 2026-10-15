import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readSse } from '../../shared/readSse.mjs';
import { readDialoguePreview } from '../src/services/dialoguePreview.js';

test('SSE: UTF-8 chia giữa byte, nhiều frame, giới hạn tải', async () => {
  const encoded = new TextEncoder().encode('data: {"text":"Chủ tọa"}\r\n\r\ndata: [DONE]\n\n');
  const stream = () => new ReadableStream({ start(controller) { for (const byte of encoded) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const frames = []; for await (const frame of readSse(stream())) frames.push(frame);
  assert.deepEqual(frames, ['{"text":"Chủ tọa"}', '[DONE]']);
  await assert.rejects(async () => { for await (const frame of readSse(stream(), 5)) void frame; }, /SSE_SIZE_LIMIT/);
});

test('chỉ mở câu hoàn chỉnh sau metadata, không thực thi nội dung; chưa có metadata thì đợi', () => {
  assert.equal(readDialoguePreview('{"content":"Một câu đã xong.'), null);
  const start = '{"focus":{"learner":"L1","dossier":["D1"]},"citation_ids":[],"content":"';
  assert.equal(readDialoguePreview(start + 'Chưa xong'), null);
  assert.equal(readDialoguePreview(start + 'Một câu hoàn chỉnh. Câu tiếp').content, 'Một câu hoàn chỉnh.');
  assert.equal(readDialoguePreview(start + 'Trích \\"lời nói\\". Câu tiếp').content, 'Trích "lời nói".');
});

test('model stream thực: delta/usage, đứt luồng và cắt vì token không được xem là thành công', async t => {
  let finish = 'stop', payload;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    payload = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const part of ['Xin ', 'chào.']) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
    if (finish) res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\n`);
    res.end('data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3}}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  Object.assign(process.env, { JWT_SECRET: 'test-only-secret-that-is-long-enough', AI_BASE_URL: `http://127.0.0.1:${server.address().port}`, AI_USAGE_TRACKING: 'false' });
  const { createChatCompletion } = await import('../src/services/aiClient.js');
  const chunks = []; let metrics;
  const input = { model: 'test', systemPrompt: 'Test', messages: [], maxAttempts: 1, onDelta: raw => chunks.push(raw), onMetrics: value => { metrics = value; } };
  assert.equal(await createChatCompletion(input), 'Xin chào.');
  assert.deepEqual(chunks, ['Xin ', 'Xin chào.']);
  assert.equal(payload.stream, true); assert.equal(payload.stream_options.include_usage, true);
  assert.equal(metrics.usage.completion_tokens, 3);
  assert.ok(metrics.first_token_ms >= 0);
  finish = 'length'; await assert.rejects(createChatCompletion(input), { code: 'AI_TRUNCATED_RESPONSE' });
  finish = null; await assert.rejects(createChatCompletion(input), { code: 'AI_UNAVAILABLE' });
});
