import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfficialLawUrl, hasVerifiedSource } from '../../shared/legalSourcePolicy.mjs';
import { parseWebLawPage } from '../src/services/webLawParser.js';
import { assessVersion } from '../src/services/legalTimeline.js';
import { validateVersionReview } from '../src/services/legalVersionReview.js';

process.env.JWT_SECRET ||= 'multi-source-test-secret-at-least-32-characters';
const { webReferenceCitations, legalWebQuery } = await import('../src/services/webLegalResearch.js');
const now = new Date();
const number = '999/2020/QH14';
const html = '<title>Luật kiểm thử đất đai</title><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p>Số: 999/2020/QH14</p><p>Điều 1. Chứng cứ đất đai</p><p>Văn bản hoàn toàn hư cấu dùng kiểm thử phần mềm, không phải luật thật.</p>';
const officialUrl = 'https://congbao.chinhphu.vn/fixture-only';
const official = parseWebLawPage({ url: officialUrl, content: html }, now);
const query = legalWebQuery({ courtCase: { category: 'đất đai' }, question: `Điều 1 ${number}` });

test('nguồn Chính phủ, bộ, Quốc hội được kiểm tra nội dung ngoài VBPL, không nhận tên miền giả', () => {
  for (const url of [officialUrl, 'https://moj.gov.vn/fixture', 'https://quochoi.vn/fixture']) assert.equal(isOfficialLawUrl(url), true);
  for (const url of ['https://chinhphu.vn.evil.test/x', 'https://fakegov.vn/x', 'http://moj.gov.vn/x', 'https://moj.gov.vn@evil.test/x']) assert.equal(isOfficialLawUrl(url), false);
  assert.equal(hasVerifiedSource(official), true);
  assert.equal(parseWebLawPage({ url: officialUrl, content: '<title>Luật đất đai</title>' }), null);
  assert.equal(parseWebLawPage({ url: officialUrl, content: html.replace('Luật kiểm thử', 'Dự thảo luật') }), null);
  assert.doesNotMatch(query.query, /site:|trên vbpl/);
});

test('bản đăng lại chỉ xác minh điều khớp nguyên văn bản chính thức, không tự nâng hiệu lực', () => {
  const mirror = parseWebLawPage({ url: 'https://example.org/fixture', content: html }, now);
  const alone = webReferenceCitations([mirror], query, now)[0];
  assert.equal(hasVerifiedSource(alone), false);
  const matched = webReferenceCitations([mirror, official], query, now).find(c => c.source_url === mirror.source_url);
  assert.equal(hasVerifiedSource(matched), true);
  assert.equal(matched.application_status, 'unverified');
  const changed = parseWebLawPage({ url: mirror.source_url, content: html.replace('hoàn toàn hư cấu', 'có nội dung bị sửa đổi') }, now);
  assert.equal(hasVerifiedSource(webReferenceCitations([changed, official], query, now).find(c => c.source_url === mirror.source_url)), false);
});

test('đối chiếu hiệu lực ngoài VBPL vẫn cần bằng chứng nội dung, lịch sử, chuyển tiếp và đúng thời kỳ', () => {
  const quote = 'Trích đoạn hư cấu để kiểm thử đối chiếu nguồn, không phải pháp luật thật.';
  const rule = { from: '2020-01-01', to: '2021-12-31', reviewed_at: '2026-01-01', version: 'fixture',
    source_checked: true, history_checked: true, transition_status: 'reviewed', event_kinds: ['transaction'],
    review_sources: [officialUrl], application_note: quote,
    evidence: ['text', 'history'].map(kind => ({ kind, url: officialUrl, sha256: 'a'.repeat(64), quote })) };
  const document = { law_number: number, source_fingerprint: 'fixture', version_rules: [rule] };
  const manifest = { ...document, rules: [rule] };
  assert.doesNotThrow(() => validateVersionReview(manifest, document, [{ url: officialUrl, sha256: 'a'.repeat(64), content: quote }]));
  assert.throws(() => validateVersionReview(manifest, document, [{ url: officialUrl, sha256: 'a'.repeat(64), content: 'khác' }]));
  const plan = { kind: 'transaction', status: 'reported', date: '2021-01-01', date_to: '2021-01-01' };
  assert.equal(assessVersion(document, { article: '1' }, plan).verified, true);
  assert.equal(assessVersion(document, { article: '1' }, { ...plan, date: '2024-01-01', date_to: '2024-01-01' }).verified, false);
  assert.equal(assessVersion({ ...document, version_rules: [{ ...rule, history_checked: false }] }, { article: '1' }, plan).verified, false);
});
