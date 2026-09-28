import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegalResearch } from './legalResearchService.js';
import { assessVersion, buildLegalPlan, validateTimeline } from './legalTimeline.js';
import { inspectOfficialSources, fetchOfficialPage } from './officialLegalSources.js';
import { getLegalSearchTerms } from './legalTextSearch.js';
import { validateVersionReview } from './legalVersionReview.js';

const timeline = [{ kind: 'dispute', date: '2017-01-01', date_to: '2017-12-31', status: 'reported', description: 'Tranh chấp đất', source_quote: 'năm 2017' }];
const courtCase = { title: 'Tranh chấp quyền sử dụng đất', category: 'đất đai', summary: 'Quyền sử dụng đất tranh chấp', timeline };
// Nội dung hư cấu chỉ để thử thuật toán; không nhập vào kho luật thật.
const text = 'Điều 1. Quyền sử dụng đất tranh chấp (nội dung kiểm thử).';
const provision = { _id: 'p', document_id: 'd', article: '1', paragraph: null, point: null, text, search_tokens: getLegalSearchTerms(text), locator: 'Điều 1' };
const rule = { version: 'bản kiểm thử', from: '2014-07-01', to: '2018-12-31', source_checked: true, history_checked: true, transition_status: 'reviewed', review_sources: ['https://vbpl.vn/'], event_kinds: ['dispute'], application_note: 'Phạm vi nội dung và thời kỳ đã đối chiếu trong fixture.' };
const document = { _id: 'd', law_number: '45/2013/QH13', version_rules: [rule], source_files: [] };
const resolve = (overrides = {}) => resolveLegalResearch({ courtCase, documents: [document], provisions: [provision], ...overrides });

test('vụ án thời kỳ 2013: chọn đúng phiên bản theo mốc tranh chấp, không dùng ngày xét xử làm tất cả', () => {
  const result = resolve();
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].application_date, '2017-01-01');
  assert.equal(result.citations[0].version, 'bản kiểm thử');
  assert.equal(result.legal_assessment_available, false); // Các mốc khác còn thiếu.
});
test('cần luật khác chưa lưu: không thay bằng luật 2013', () => {
  const result = resolve({ courtCase: { ...courtCase, timeline: [{ ...timeline[0], date: '2025-01-01', date_to: '2025-01-01' }] } });
  assert.equal(result.citations.length, 0);
  assert.ok(result.warnings.some((w) => w.includes('31/2024/QH15')));
});
test('điều bị sửa, thiếu chuyển tiếp, khoảng năm vượt phiên bản và mốc giả định đều không được viện dẫn', () => {
  for (const change of [{ excluded_articles: ['1'] }, { transition_status: 'unresolved' }, { to: '2017-06-01' }, { history_checked: false }]) {
    assert.equal(resolve({ documents: [{ ...document, version_rules: [{ ...rule, ...change }] }] }).citations.length, 0);
  }
  assert.equal(assessVersion(document, provision, { ...timeline[0], status: 'assumed' }).verified, false);
  assert.equal(buildLegalPlan({ ...courtCase, timeline: [] }, '2024-03-29').at(-1).status, 'assumed');
  assert.throws(() => validateTimeline([{ ...timeline[0], date: '2025-02-29' }]));
});
test('nguồn chính thức mất mạng hoặc trả 403: giữ trạng thái chưa xác minh', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => new Response('', { status: 403 })]) {
    const result = await inspectOfficialSources('45/2013/QH13', { fetcher, enabled: true });
    assert.equal(result.status, 'unavailable'); assert.match(result.message, /Chưa xác minh được/);
  }
  const pending = await inspectOfficialSources('45/2013/QH13', { enabled: true, fetcher: async () => new Response('45/2013/QH13', { headers: { 'content-type': 'text/html' } }) });
  assert.equal(pending.status, 'pending_review');
  await assert.rejects(fetchOfficialPage('http://127.0.0.1/private'));
  await assert.rejects(fetchOfficialPage('https://vbpl.vn.attacker.example/'));
});

test('không duyệt phiên bản thiếu bằng chứng nguồn hoặc không khớp fingerprint', () => {
  assert.throws(() => validateVersionReview({ law_number: '45/2013/QH13', source_fingerprint: 'bad', rules: [rule] }, { ...document, source_fingerprint: 'real' }, []));
  assert.throws(() => validateVersionReview({ law_number: '45/2013/QH13', source_fingerprint: 'real', rules: [rule] }, { ...document, source_fingerprint: 'real' }, []));
});
