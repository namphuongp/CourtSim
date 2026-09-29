import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { inspectLawText, hash, inventoryFiles } from '../src/services/legalFileInventory.js';
import { prepareCorpusImport, commitCorpusImport } from '../src/services/legalCorpusImport.js';
import { resolveCorpusResults, researchCorpus } from '../src/services/legalCorpusRetrieval.js';
import { permittedLegalSource } from '../src/services/legalUsagePolicy.js';
import { parseLegalArticles } from '../src/services/legalTextParser.js';
import LegalCorpusVersion from '../src/models/LegalCorpusVersion.js';
import LegalCorpusProvision from '../src/models/LegalCorpusProvision.js';
import { planAssistantSearch } from '../src/services/vbplResearch.js';

const url = 'https://vbpl.vn/van-ban/chi-tiet/synthetic-test-only';
const law = '45/2013/QH13';
const rule = (from, to, extra = {}) => ({ from, to, version: 'Fixture', articles: ['1'], event_kinds: ['transaction'],
  history_checked: true, source_checked: true, transition_status: 'reviewed', review_sources: [url], application_note: 'Chỉ dữ liệu kiểm thử.', ...extra });
const doc = (id, rules, extra = {}) => ({ _id: id, law_number: law, title: 'Luật Đất đai', document_kind: 'original',
  status: 'verified', permission_status: 'allowed', source_url: url, source_verification: 'verified',
  source_sha256: 'a'.repeat(64), checked_at: '2026-09-29', version: id, fingerprint: 'b'.repeat(64), version_rules: rules, ...extra });
const unit = (id, text) => ({ _id: id, document_id: id, article: '1', paragraph: null, point: null, text, locator: 'Điều 1', search_tokens: ['dat', 'dai'] });
const courtCase = date => ({ title: 'Tranh chấp đất đai', category: 'đất đai', timeline: [{ kind: 'transaction', date, date_to: date, status: 'reported', description: 'Mốc fixture' }] });

test('cùng điều nhưng hai thời kỳ chọn đúng phiên bản; ngoại lệ và chuyển tiếp không được suy đoán', () => {
  const documents = [doc('old', [rule('2014-07-01', '2019-12-31')]), doc('new', [rule('2020-01-01', '2026-09-29')])];
  const provisions = [unit('old', 'Điều 1. Đất đai\nPhiên bản cũ giả định.'), unit('new', 'Điều 1. Đất đai\nPhiên bản mới giả định.')];
  for (const [date, id] of [['2018-01-01', 'old'], ['2021-01-01', 'new']]) {
    const found = resolveCorpusResults({ documents, provisions, question: `Điều 1 ${law}`, courtCase: courtCase(date) });
    assert.equal(found.results.length, 1); assert.equal(found.results[0].id, id); assert.equal(found.results[0].application_status, 'verified');
  }
  for (const extra of [{ excluded_articles: ['1'] }, { transition_status: 'unresolved' }]) {
    const found = resolveCorpusResults({ documents: [doc('old', [rule('2014-07-01', '2019-12-31', extra)])], provisions, question: `Điều 1 ${law}`, courtCase: courtCase('2018-01-01') });
    assert.equal(found.results[0].application_status, 'unverified');
  }
});

test('hợp nhất không có hiệu lực độc lập; xung đột bản cùng thời kỳ không được xác nhận', () => {
  const documents = [doc('a', [rule('2014-07-01', '2026-09-29')], { document_kind: 'consolidated' })];
  const query = { documents, provisions: [unit('a', 'Điều 1. Đất đai\nNội dung giả định.')], question: `Điều 1 ${law}`, courtCase: courtCase('2018-01-01') };
  assert.equal(resolveCorpusResults(query).results[0].application_status, 'unverified');
  documents[0].document_kind = 'original';
  documents.push(doc('b', [rule('2014-07-01', '2026-09-29')])); query.provisions.push(unit('b', 'Điều 1. Đất đai\nNội dung khác.'));
  assert.ok(resolveCorpusResults(query).results.every(r => r.application_status === 'unverified'));
});

test('pending_permission và bản thu hồi không lọt vào tìm kiếm hoặc đầu ra', () => {
  const secret = 'QUARANTINED_CONTENT_MUST_NOT_LEAK';
  for (const extra of [{ status: 'pending_permission' }, { permission_status: 'pending_permission' }, { retired_at: '2026-09-29' }]) {
    const found = resolveCorpusResults({ documents: [doc('x', [], extra)], provisions: [unit('x', secret)], question: `Điều 1 ${law}` });
    assert.equal(found.results.length, 0); assert.ok(!JSON.stringify(found).includes(secret));
  }
  assert.equal(permittedLegalSource('https://thuvienphapluat.vn/van-ban/x'), true);
  assert.equal(permittedLegalSource('https://example.org/law'), true);
  assert.equal(permittedLegalSource(url), true);
});

test('kiểm kê scan, số hiệu sai tên, thiếu điều, bản sửa đổi và cấu trúc điều kiểu cũ', () => {
  assert.deepEqual(planAssistantSearch('Điều 1 Luật đất đai 1987').numbers, ['3-LCT/HĐNN8']);
  assert.deepEqual(planAssistantSearch('Điều 1 24-L/CTN').explicit, ['24-L/CTN']);
  const sample = { format: 'pdf', pages: [{ pageNumber: 1, text: '' }], text: 'Số: 45/2013/QH13\nLUẬT\nĐiều 1. Đất đai\nNội dung.\nĐiều 3. Thi hành\nNội dung.' };
  const item = inspectLawText(sample, 'https://files.thuvienphapluat.vn/test', '31_2024_QH15.doc');
  assert.equal(item.status, 'pending_permission');
  for (const reason of ['filename_identity_mismatch', 'article_gaps_or_partial_document', 'ocr_or_page_review_required']) assert.ok(item.reasons.includes(reason));
  assert.equal(parseLegalArticles('Chương I\nĐiều 1\nNội dung giả lập.\nĐiều 2: Nội dung khác.').length, 2);
  assert.equal(parseLegalArticles('\n\u00a0Điều 104. Tiêu đề\nNội dung giả lập.')[0].article, '104');
  assert.equal(inspectLawText({ text: 'VĂN BẢN HỢP NHẤT\nSố: 1/VBHN-VPQH\nĐiều 1. Nội dung' }).document_kind, 'consolidated');
});

test('dry-run đối chiếu nguyên văn; thay byte, thiếu quyền, thiếu điều và nguồn 403 đều chặn trước ghi', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtsim-corpus-'));
  const text = `Số: ${law}\nLUẬT ĐẤT ĐAI\nĐiều 1. Đất đai\nNội dung tổng hợp dùng kiểm thử, không phải luật thật.`;
  await writeFile(join(directory, 'fixture.txt'), text);
  const review = { law_number: law, title: 'Luật Đất đai fixture', document_kind: 'original', expected_articles: 1,
    completeness_reviewed: true, permission: { status: 'allowed', basis: 'official_original', evidence: 'Dữ liệu tổng hợp chỉ dùng kiểm thử nội bộ, không phải văn bản luật.' },
    official_url: url, files: [{ path: 'fixture.txt', sha256: hash(text) }] };
  const page = { url, content: `<h1>Luật Đất đai fixture</h1><p>Số: ${law}</p><article><p>Điều 1. Đất đai</p><p>Nội dung tổng hợp dùng kiểm thử, không phải luật thật.</p></article>` };
  const dependencies = { fetchPage: async () => page };
  try {
    const prepared = await prepareCorpusImport(review, directory, dependencies);
    assert.equal(prepared.document.status, 'verified'); assert.equal(prepared.provisions.length, 1);
    assert.deepEqual(prepared.document.version_rules, []);
    assert.equal((await prepareCorpusImport(review, directory, dependencies)).document.fingerprint, prepared.document.fingerprint);
    const binaryReview = { ...review, files: [{ ...review.files[0], official_file_url: 'https://vbpl.vn/files/fixture.pdf' }] };
    assert.equal((await prepareCorpusImport(binaryReview, directory, { fetchFile: async () => ({ sha256: hash(text) }) })).provisions.length, 1);
    await assert.rejects(prepareCorpusImport(binaryReview, directory, { fetchFile: async () => ({ sha256: 'a'.repeat(64) }) }), /OFFICIAL_FILE_MISMATCH/);
    await assert.rejects(prepareCorpusImport({ ...review, permission: null }, directory, dependencies), /PERMISSION/);
    await assert.rejects(prepareCorpusImport({ ...review, expected_articles: 2 }, directory, dependencies), /INCOMPLETE/);
    await assert.rejects(prepareCorpusImport(review, directory, { fetchPage: async () => ({ url, content: '403 Forbidden' }) }), /UNAVAILABLE/);
    await writeFile(join(directory, 'fixture.txt'), `${text}\nThay đổi`);
    await assert.rejects(prepareCorpusImport(review, directory, dependencies), /SOURCE_CHANGED/);
  } finally { await unlink(join(directory, 'fixture.txt')); await rmdir(directory); }
});

test('tệp trùng byte được nhận diện nhưng không gộp tệp chỉ trùng số hiệu', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'courtsim-duplicates-'));
  const text = `Số: ${law}\nLUẬT ĐẤT ĐAI\nĐiều 1. Nội dung giả lập.`;
  try {
    for (const [name, body] of [['a.txt', text], ['b.txt', text], ['c.txt', `${text}\nBản thay đổi.`]]) await writeFile(join(directory, name), body);
    const { entries } = await inventoryFiles(directory);
    assert.equal(entries[1].duplicate_of, 'a.txt'); assert.equal(entries[2].duplicate_of, null);
    assert.equal(entries[0].same_number_as.length, 2);
    assert.ok(!JSON.stringify(entries).includes('Nội dung giả lập'));
  } finally { for (const name of ['a.txt', 'b.txt', 'c.txt']) await unlink(join(directory, name)); await rmdir(directory); }
});

test('kho xác minh được ưu tiên; nguồn thiếu và câu rộng không bịa luật', async () => {
  process.env.JWT_SECRET ||= 'corpus-test-secret-at-least-32-characters';
  const { answerLegalQuestion } = await import('../src/services/legalAssistantService.js');
  const result = resolveCorpusResults({ documents: [doc('x', [])], provisions: [unit('x', 'Điều 1. Đất đai\nNội dung giả định.')], question: `Điều 1 ${law}` });
  const answer = await answerLegalQuestion({ session: {}, courtCase: {}, question: `Điều 1 ${law}` }, {
    corpus: async () => result, official: async () => { throw Error('must not request network'); } });
  assert.equal(answer.citations[0].source_url, url);
  const broad = await answerLegalQuestion({ session: {}, courtCase: {}, question: 'Luật đất đai' });
  assert.match(broad.answer, /năm/); assert.equal(broad.citations.length, 0);
  assert.equal(resolveCorpusResults({ documents: [], provisions: [], question: 'Điều 99 999/2026/QH15' }).results.length, 0);
});

test('nhập lại không nhân đôi; thu hồi giữ nguyên unit nhưng loại khỏi tìm kiếm', { skip: !process.env.COURTSIM_TEST_MONGO_URI }, async () => {
  const dbName = `courtsim_test_corpus_${Date.now()}`;
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName });
  try {
    await Promise.all([LegalCorpusVersion.init(), LegalCorpusProvision.init()]);
    const { _id, ...document } = doc('unused', []);
    const prepared = { document, provisions: [{ article: '1', paragraph: null, point: null, locator_key: 'A:1|P:|D:', locator: 'Điều 1', text: 'Đất đai fixture', search_tokens: ['dat', 'dai'] }] };
    const first = await commitCorpusImport(prepared), second = await commitCorpusImport(prepared);
    assert.equal(second.status, 'unchanged'); assert.equal(first.id, second.id);
    assert.equal(await LegalCorpusProvision.countDocuments(), 1);
    assert.equal((await researchCorpus({ question: `Điều 1 ${law}`, courtCase: {} })).results.length, 1);
    await LegalCorpusVersion.updateOne({ fingerprint: document.fingerprint }, { $set: { retired_at: new Date(), status: 'needs_review' } });
    assert.equal((await researchCorpus({ question: `Điều 1 ${law}`, courtCase: {} })).results.length, 0);
    assert.equal(await LegalCorpusProvision.countDocuments(), 1);
  } finally {
    if (mongoose.connection.name === dbName && /^courtsim_test_corpus_\d+$/u.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
