import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareLocalLaw, localLawArticles } from '../src/services/localLegalImport.js';
import { hash } from '../src/services/legalFileInventory.js';
import { hasReadableLawSource, hasVerifiedSource, isLocalLawUrl } from '../../shared/legalSourcePolicy.mjs';
import { resolveCorpusResults } from '../src/services/legalCorpusRetrieval.js';

process.env.JWT_SECRET ||= 'local-law-test-only-secret-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.AI_USAGE_TRACKING = 'false';
process.env.AI_BASE_URL = 'https://api.openai.com/v1';

test('tệp được người dùng cho phép dùng không phụ thuộc VBPL; archive bất biến và nhãn nguồn chính xác', async () => {
  const root = await mkdtemp(join(tmpdir(), 'courtsim-local-'));
  const archiveRoot = join(root, 'archive');
  const text = 'Số: 45/2013/QH13\nLUẬT ĐẤT ĐAI\nĐiều 1. Hòa giải đất đai\nNội dung hư cấu dùng kiểm thử, không phải pháp luật thật.';
  const file = { path: 'law.txt', sha256: hash(text) };
  await writeFile(join(root, file.path), text);
  const review = { law_number: '45/2013/QH13', title: 'Luật Đất đai fixture', files: [file], permission: {
    status: 'allowed', basis: 'user_authorized_simulation', evidence: 'Người dùng cho phép dùng tài liệu này trong mô phỏng và trợ lý AI.' } };
  try {
    const prepared = await prepareLocalLaw(review, root, { archive: true, archiveRoot });
    assert.equal(prepared.document.status, 'reference');
    assert.equal(hasReadableLawSource(prepared.document), true); assert.equal(hasVerifiedSource(prepared.document), false);
    const repeated = await prepareLocalLaw(review, root, { archive: true, archiveRoot });
    assert.equal(repeated.document.fingerprint, prepared.document.fingerprint);
    const archived = join(archiveRoot, prepared.document.source_files[0].archive_file);
    assert.equal(await readFile(archived, 'utf8'), text);
    const source = resolveCorpusResults({ documents: [{ ...prepared.document, _id: 'd1' }], provisions: prepared.provisions.map((p, i) => ({ ...p, document_id: 'd1', _id: String(i) })), question: 'Điều 1 45/2013/QH13' });
    assert.equal(source.results.length, 1); assert.equal(source.results[0].source_verification, 'local_read');
    const { learnerCitation } = await import('../src/services/learnerPresentation.js');
    const shown = learnerCitation(source.results[0]);
    assert.equal(shown.source_verification, 'local_read'); assert.equal(shown.source_url, prepared.document.source_url);
    const { answerLegalQuestion, publicAssistantExchange } = await import('../src/services/legalAssistantService.js');
    const answer = await answerLegalQuestion({ session: {}, courtCase: {}, question: 'Điều 1 45/2013/QH13' }, { corpus: async () => source, official: async () => { throw Error('must not call VBPL'); } });
    assert.equal(answer.citations.length, 1); assert.match(answer.answer, /kho mô phỏng/);
    assert.equal(publicAssistantExchange({ ...answer, question: 'Điều 1' }).citations[0].source_url, prepared.document.source_url);
    await writeFile(join(root, file.path), 'Thay byte tệp gốc');
    assert.equal(await readFile(archived, 'utf8'), text);
    await assert.rejects(prepareLocalLaw(review, root), /SOURCE_CHANGED/);
    await unlink(archived);
  } finally { await unlink(join(root, file.path)); await rmdir(archiveRoot); await rmdir(root); }
});

test('luật sửa đổi giữ nguyên điều lồng, phụ lục không trở thành điều của văn bản chính', () => {
  const text = 'Điều 1\nSửa quy định sau:\n"Điều 7. Nội dung\nĐiều 8. Nội dung tiếp theo."\nĐiều 2. Thi hành\nÁp dụng theo điều kiện của fixture.\nPHỤ LỤC\nĐiều 1. Mẫu khác.';
  const articles = localLawArticles(text);
  assert.deepEqual(articles.map(a => a.article), ['1', '2']);
  assert.match(articles[0].text, /Điều 8/); assert.doesNotMatch(articles[1].text, /Mẫu khác/);
  for (const url of ['/api/v1/legal-sources/../../secret/files/0', 'https://evil.test/api/v1/legal-sources/x/files/0', '/api/v1/legal-sources/' + 'a'.repeat(64) + '/files/0?path=secret']) assert.equal(isLocalLawUrl(url), false);
});

test('hội thoại nhận nguồn cục bộ và web dự phòng, không tự nâng hiệu lực', async () => {
  const { researchLegalBasis } = await import('../src/services/legalResearchService.js');
  const local = { source_verification: 'local_read' };
  const base = { citations: [local], warnings: [], legal_assessment_available: false };
  process.env.LEGAL_WEB_REFERENCE_SCORING = 'true';
  let searched = false;
  assert.equal((await researchLegalBasis({}, { corpus: async () => base, web: async () => { searched = true; return { citations: [], warnings: [] }; } })).citations[0], local);
  assert.equal(searched, true);
  const result = await researchLegalBasis({}, { corpus: async () => ({ ...base, citations: [] }), web: async () => ({ citations: [{ source_verification: 'web_read' }], warnings: [] }) });
  assert.equal(result.citations[0].source_verification, 'web_read'); assert.equal(result.legal_assessment_available, false);
  delete process.env.LEGAL_WEB_REFERENCE_SCORING;
});

test('native web search không có bộ lọc tên miền', async () => {
  const { searchLegalWeb } = await import('../src/services/aiClient.js');
  let body;
  await searchLegalWeb({ model: 'fixture', query: 'Pháp luật Việt Nam về tranh chấp đất đai' }, { fetcher: async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'web_search_call', status: 'completed', action: { sources: [{ url: 'https://example.org/law' }] } }] }));
  } });
  assert.equal(body.tools[0].type, 'web_search'); assert.equal(body.tools[0].filters, undefined);
});
