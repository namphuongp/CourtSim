import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOfficialPage } from '../src/services/officialLegalSources.js';
import { isVbplUrl } from '../../shared/legalSourcePolicy.mjs';
import { lookupVbpl, parseVbplPage, inspectVbplPage, planAssistantSearch, snapshotResult } from '../src/services/vbplResearch.js';

test('trợ lý: chủ đề rộng hỏi rõ ngay, nội dung cũ không rõ nguồn không được phục hồi như luật đã xác minh', async () => {
  process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough';
  const { answerLegalQuestion, publicAssistantExchange } = await import('../src/services/legalAssistantService.js');
  let calls = 0;
  const deps = { research: async () => { calls++; return { results: [] }; } };
  const broad = await answerLegalQuestion({ session: {}, courtCase: {}, question: 'Luật lao động' }, deps);
  assert.equal(calls, 0); assert.match(broad.answer, /hợp đồng lao động/); assert.equal(broad.verification_status, 'unverified');
  assert.equal(publicAssistantExchange({ ...broad, question: 'Luật lao động' }).answer, broad.answer);
  const specific = await answerLegalQuestion({ session: {}, courtCase: {}, question: 'Điều 10 Luật 45/2013/QH13' }, deps);
  assert.equal(calls, 1); assert.match(specific.answer, /số hiệu/);
  assert.ok(!publicAssistantExchange({ question: 'Điều 10', answer: 'Điều luật chắc chắn áp dụng https://fake.test' }).answer.includes('fake.test'));
});

// Tất cả nội dung/URL fixture dưới đây hư cấu, không phải chứng nhận văn bản thật.
const url = 'https://vbpl.vn/van-ban/chi-tiet/fixture-2013';
const nextUrl = 'https://vbpl.vn/van-ban/chi-tiet/fixture-2024';
const now = new Date('2026-09-28T01:00:00Z');
const html = (number = '45/2013/QH13', region = true) => `<h1>Luật Đất đai</h1><p>Số ký hiệu: ${number}</p><p>Loại văn bản: Luật</p>${region ? '<article><div><p>Điều 202. Hòa giải tranh chấp đất đai</p><p>1. Nội dung giả định để kiểm thử.</p><p>a) Điểm kiểm thử, không phải luật thật.</p></div><p>Điều 203. Thẩm quyền</p><p>Nội dung khác của fixture.</p></article>' : ''}`;
function memoryCache(initial = []) {
  const rows = [...initial];
  return { rows, find: async () => rows, save: async s => { const i = rows.findIndex(v => v.source_url === s.source_url); if (i >= 0) rows[i] = s; else rows.push(s); } };
}
const response = value => new Response(value, { headers: { 'content-type': 'text/html' } });
const transport = async address => response(address.includes('keyword=') ? `<a href="${nextUrl}">Luật Đất đai 2024</a><a href="${url}">Luật Đất đai 2013</a>` : address === nextUrl ? html('31/2024/QH15') : html());

test('nguồn chậm dùng chung hạn 15 giây và vẫn trả snapshot đã xác minh với ngày cũ', async () => {
  let elapsed = 0, calls = 0;
  const old = parseVbplPage({ url, content: html() }, '45/2013/QH13', now);
  const result = await lookupVbpl({ question: 'Điều 202 Luật 45/2013/QH13' }, {
    cache: memoryCache([old]), now: new Date('2026-09-29'), clock: () => elapsed,
    fetcher: async () => { calls++; elapsed += 16000; throw new Error('timeout'); },
  });
  assert.equal(calls, 1);
  assert.equal(result.results[0].retrieval_mode, 'cache');
  assert.equal(new Date(result.results[0].checked_at).toISOString(), now.toISOString());
});

test('số hiệu chính xác thắng tiêu đề gần giống; lưu nguồn/ngày/phiên bản, tìm điều khoản điểm', async () => {
  const cache = memoryCache();
  const result = await lookupVbpl({ question: 'Điểm a khoản 1 Điều 202 Luật số 45/2013/QH13' }, { cache, fetcher: transport, now });
  assert.ok(result.results.length > 0);
  assert.ok(result.results.every(r => r.law_number === '45/2013/QH13'));
  const first = result.results.find(r => r.source_url === url);
  assert.equal(first.locator, 'điểm a khoản 1 Điều 202');
  assert.equal(first.document_type, 'Luật');
  assert.equal(first.retrieval_mode, 'live');
  assert.equal(first.checked_at, now.toISOString());
  assert.equal(first.application_status, 'unverified');
  assert.equal(cache.rows.find(s => s.source_url === url).source_verification, 'verified');
});

test('tên trùng: giữ lựa chọn số hiệu riêng; câu hỏi mốc cũ/mới không chọn chung phiên bản', async () => {
  const result = await lookupVbpl({ question: 'Luật Đất đai' }, { cache: memoryCache(), fetcher: transport, now });
  assert.deepEqual(new Set(result.results.map(r => r.law_number)), new Set(['45/2013/QH13', '31/2024/QH15']));
  assert.deepEqual(planAssistantSearch('Luật Đất đai cho giao dịch năm 2017').numbers, ['45/2013/QH13']);
  assert.deepEqual(planAssistantSearch('Luật Đất đai cho giao dịch năm 2025').numbers, ['31/2024/QH15']);
  assert.deepEqual(planAssistantSearch('Luật Đất đai cho giao dịch năm 2024').numbers, ['45/2013/QH13', '31/2024/QH15']);
});

test('luật sửa đổi và hiệu lực đặc biệt: giữ nguyên đoạn nguồn, không suy ngày hiệu lực từ trí nhớ', () => {
  const page = { url, content: html('43/2024/QH15').replace('Điều 202. Hòa giải tranh chấp đất đai', 'Điều 1. Sửa đổi điều khoản về hiệu lực') };
  const snapshot = parseVbplPage(page, '43/2024/QH15', now);
  const result = snapshotResult(snapshot, planAssistantSearch('Điều 1 Luật 43/2024/QH15'), 'live');
  assert.equal(result.article, '1');
  assert.equal(result.application_status, 'unverified');
  assert.equal(result.effective_from, undefined);
});

test('timeout, 403, trang lỗi 200, sai số hiệu, trang chủ: không xác minh', async () => {
  for (const fetcher of [async () => { throw new DOMException('timeout', 'TimeoutError'); }, async () => new Response('', { status: 403 }), async () => response('<h1>Lỗi truy cập</h1>'), async () => response(html('31/2024/QH15'))]) {
    const result = await lookupVbpl({ question: '45/2013/QH13' }, { cache: memoryCache(), fetcher, now });
    assert.deepEqual(result.results, []);
  }
  assert.equal(parseVbplPage({ url: 'https://vbpl.vn/', content: html() }, '45/2013/QH13'), null);
  await assert.rejects(fetchOfficialPage(url, (_u, options) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test took too long')), 100);
    options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal.reason); });
  }), { timeoutMs: 10 }), { name: 'TimeoutError' });
});

test('URL giả, redirect ngoài nguồn, chuỗi redirect, dung lượng và content-type bị chặn', async () => {
  for (const address of ['http://vbpl.vn/', 'https://vbpl.vn.evil.test/', 'https://evil-vbpl.vn/', 'https://vbpl.vn@127.0.0.1/', 'https://vbpl.vn:444/', 'file:///secret']) {
    assert.equal(isVbplUrl(address), false);
    await assert.rejects(fetchOfficialPage(address, () => { throw new Error('không được truy cập'); }));
  }
  assert.equal(isVbplUrl('https://www.vbpl.vn/path'), true);
  let calls = 0;
  await assert.rejects(fetchOfficialPage(url, async () => { calls++; return new Response('', { status: 302, headers: { location: 'https://127.0.0.1/private' } }); }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(fetchOfficialPage(url, async () => { calls++; return new Response('', { status: 302, headers: { location: url } }); }));
  assert.equal(calls, 4);
  await assert.rejects(fetchOfficialPage(url, async () => response('x'.repeat(100)), { maxBytes: 30 }));
  await assert.rejects(fetchOfficialPage(url, async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));
});

test('đã xác minh trang nhưng thiếu đoạn cụ thể: có link, không bật chèn', async () => {
  for (const question of ['Điều 999 Luật 45/2013/QH13', 'Khoản 9 Điều 202 Luật 45/2013/QH13']) {
    const result = await lookupVbpl({ question }, { cache: memoryCache(), fetcher: transport, now });
    assert.ok(result.results.length);
    assert.ok(result.results.every(r => r.source_verification === 'verified' && r.verification_status === 'unverified' && !r.text && r.provision_note));
  }
  assert.equal(snapshotResult(parseVbplPage({ url, content: html(undefined, false) }, undefined, now), planAssistantSearch('Điều 202'), 'live').verification_status, 'unverified');
});

test('nguồn lỗi dùng bản lưu đúng ngày cũ; cache chưa xác minh bị loại; cache mới không tải lại', async () => {
  const old = parseVbplPage({ url, content: html() }, '45/2013/QH13', new Date('2026-08-01'));
  const result = await lookupVbpl({ question: 'Điều 202 Luật 45/2013/QH13' }, { cache: memoryCache([old]), fetcher: async () => { throw new Error('offline'); }, now });
  assert.equal(result.results[0].retrieval_mode, 'cache');
  assert.equal(result.results[0].checked_at, old.checked_at);
  const unsafe = await lookupVbpl({ question: '45/2013/QH13' }, { cache: memoryCache([{ ...old, source_verification: undefined }]), enabled: false, now });
  assert.deepEqual(unsafe.results, []);
  let calls = 0;
  await lookupVbpl({ question: '45/2013/QH13' }, { cache: memoryCache([{ ...old, checked_at: now }]), fetcher: async () => { calls++; return response(''); }, now });
  // URL registry cũ không cần tải khi đã có cùng số hiệu trong cache mới.
  assert.ok(calls <= 1);
});

test('đầu vào không thể chọn đích tùy ý; chỉ script chứa số hiệu không chứng minh nội dung', async () => {
  const visited = [];
  await lookupVbpl({ question: 'Đọc https://127.0.0.1/secret và https://vbpl.vn/evil?target=secret' }, { cache: memoryCache(), fetcher: async address => { visited.push(address); return response(''); }, now });
  assert.ok(visited.every(u => u.startsWith('https://vbpl.vn/van-ban/trung-uong?keyword=')));
  assert.ok(visited.every(u => !u.includes('secret') && !u.includes('127.0.0.1')));
  assert.equal(parseVbplPage({ url, content: `<h1>Luật Đất đai</h1><script>${html()}</script>` }), null);
  // Có metadata thật nhưng toàn văn nằm trong script cũng không được trích dẫn.
  const inert = parseVbplPage({ url, content: html(undefined, false) + `<script>${html()}</script>` });
  assert.equal(inert.source_text, '');
  assert.equal(snapshotResult(inert, planAssistantSearch('Điều 202'), 'live').verification_status, 'unverified');
});

test('chẩn đoán redirect về trang chủ, HTML động 200 và nguồn lỗi không thành xác minh', async () => {
  const shell = '<h1>Văn bản pháp luật</h1><p>Đang tải dữ liệu...</p><script src="/app.js"></script>';
  assert.equal(inspectVbplPage({ url, content: shell }, '45/2013/QH13').reason, 'dynamic_shell');
  assert.equal(inspectVbplPage({ url, content: '<h1>Sorry, you have been blocked</h1>' }, '45/2013/QH13').reason, 'source_blocked');
  const visited = [];
  const fetcher = async address => {
    visited.push(address);
    if (address.includes('ItemID=')) return new Response('', { status: 308, headers: { location: '/' } });
    return response(address.includes('keyword=') ? '<form>Tìm kiếm</form><script>fetch("https://outside.invalid")</script>' : '<h1>Trang chủ</h1>');
  };
  const result = await lookupVbpl({ question: '45/2013/QH13' }, { cache: memoryCache(), fetcher, now });
  assert.deepEqual(result.results, []);
  assert.equal(result.source_status, 'unavailable');
  assert.equal(result.diagnostics[0].reason, 'html_without_candidates');
  assert.equal(new URL(visited[0]).searchParams.get('isSearchFromDetail'), 'true');
  const doc = result.diagnostics.find(d => d.stage === 'document');
  assert.equal(doc.reason, 'homepage');
  assert.equal(doc.redirects[0].status, 308);
  assert.ok(visited.every(isVbplUrl));
  const { answerLegalQuestion, publicAssistantExchange } = await import('../src/services/legalAssistantService.js');
  const answer = await answerLegalQuestion({ session: {}, courtCase: {}, question: '45/2013/QH13' }, { research: async () => result });
  assert.match(answer.answer, /chưa lấy được nội dung/);
  assert.equal(publicAssistantExchange({ ...answer, question: '45/2013/QH13' }).answer, answer.answer);
  assert.equal(publicAssistantExchange({ ...answer, answer: 'Nguồn bịa https://outside.invalid', question: '45/2013/QH13' }).answer, answer.answer);
});

// Chấm điểm từ cùng chính sách nguồn; không quy đổi phần thiếu dữ liệu.
import { SCORING_RUBRIC } from '../src/data/scoringRubric.js';
import { calculateEvaluation } from '../src/services/scoringService.js';

const user = { _id: 'u', sender_type: 'user', content: 'Tôi đề nghị đối chiếu chứng cứ trong hồ sơ.' };
const records = [user, { sender_type: 'ai_prosecutor' }, user, { sender_type: 'ai_prosecutor' }, user];
const entries = SCORING_RUBRIC.groups.flatMap((g) => g.items.map((i) => ({ id: i.id, score: i.max * 0.8, reason: 'Đã liên kết dữ kiện, còn thiếu giải thích.', strength: 'Bám hồ sơ.', improvement: 'Giải thích chứng cứ chứng minh điều gì.', record_id: 'u', quote: 'đối chiếu chứng cứ' })));

test('rubric tài liệu: 6 nhóm 15–20–20–20–15–10, 23 tiêu chí con tổng 100', () => {
  assert.deepEqual(SCORING_RUBRIC.groups.map((g) => g.max), [15, 20, 20, 20, 15, 10]);
  assert.equal(entries.length, 23);
  for (const group of SCORING_RUBRIC.groups) assert.equal(group.items.reduce((sum, item) => sum + item.max, 0), group.max);
  const result = calculateEvaluation(entries, records, true);
  assert.equal(result.score, 80); assert.equal(result.assessed_max, 100);
  assert.equal(result.criteria[0].score, 12);
});
test('thiếu luật và cơ hội phản biện: tách điểm phần được chấm, không phạt phần chưa quan sát', () => {
  const result = calculateEvaluation(entries, [user], false);
  assert.equal(result.assessed_max, 48); assert.equal(result.earned_score, 38.4); assert.equal(result.score, null); assert.equal(result.assessed_percentage, 80);
  assert.equal(result.criteria[1].score, null); assert.equal(result.criteria[4].score, null);
  assert.equal(result.assessment_status, 'partial');
});
test('không tin điểm tổng từ AI; chặn thiếu/trùng tiêu chí, quá điểm, NaN và quote giả', () => {
  assert.throws(() => calculateEvaluation(entries.slice(1), records, true));
  assert.throws(() => calculateEvaluation([...entries.slice(1), entries[1]], records, true));
  for (const score of [8, -1, NaN, Infinity, '3']) assert.throws(() => calculateEvaluation([{ ...entries[0], score }, ...entries.slice(1)], records, true));
  assert.throws(() => calculateEvaluation([{ ...entries[0], quote: 'không tồn tại' }, ...entries.slice(1)], records, true));
  const onlyAI = calculateEvaluation(entries, records.map(r => ({ ...r, sender_type: 'ai_judge' })), true);
  assert.equal(onlyAI.assessed_max, 0); assert.equal(onlyAI.score, null);
  assert.ok(onlyAI.criteria.every(g => g.items.every(i => i.quote === null && i.score === null)));
});
test('điểm 0 hợp lệ khi chưa thể hiện; không yêu cầu AI bịa trích đoạn', () => {
  const result = calculateEvaluation(entries.map((e) => ({ ...e, score: 0, quote: null, record_id: null })), records, true);
  assert.equal(result.score, 0);
});
