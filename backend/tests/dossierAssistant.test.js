import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceInventory, validateEvidenceReferences, validateCaseDetails } from '../src/services/caseEvidence.js';
import { learnerCase, learnerRecord, learnerEvaluation, learnerCitation } from '../src/services/learnerPresentation.js';
import { learnerPayload } from '../../shared/learnerText.mjs';

const courtCase = { _id: 'case-a', summary: 'Tranh chấp vay.', full_document: 'Có hợp đồng vay. Cấu hình chấm điểm nội bộ.', legal_scope_note: 'Bài tập ưu tiên lập luận', evidence_inventory: [{ name: 'Hợp đồng', availability: 'provided', content: 'Khoản vay chưa thanh toán.', summary: 'Hợp đồng hai bên ký.' }, { name: 'Biên nhận', availability: 'mentioned_only', source_quote: 'Bản án đề cập, chưa có bản gốc.' }] };

test('ID chứng cứ ổn định, theo đúng vụ án; provided cần nội dung thực', () => {
  const inventory = evidenceInventory(courtCase);
  assert.deepEqual(inventory, evidenceInventory(courtCase));
  assert.notEqual(inventory[0].id, evidenceInventory({ ...courtCase, _id: 'case-b' })[0].id);
  assert.equal(inventory[1].availability, 'mentioned_only');
  assert.equal(evidenceInventory({ evidence_inventory: [{ name: 'X', availability: 'provided' }] })[0].availability, 'mentioned_only');
  const text = `[CC:${inventory[0].id}] Hợp đồng`;
  assert.deepEqual(validateEvidenceReferences(courtCase, text, [inventory[0].id]), [inventory[0].id]);
  assert.throws(() => validateEvidenceReferences(courtCase, text, []));
  assert.throws(() => validateEvidenceReferences({ ...courtCase, _id: 'case-b' }, text), /không thuộc/);
  assert.throws(() => validateCaseDetails({ evidence_inventory: [{ name: 'X', availability: 'provided' }] }));
});

test('API hồ sơ, biên bản cũ và kết quả không xuất ghi chú nội bộ; giữ nguyên bài người học và nguồn luật', () => {
  const presented = learnerCase(courtCase);
  assert.equal(presented.legal_scope_note, undefined);
  assert.equal(presented.full_document, 'Có hợp đồng vay.');
  const content = 'Cần kiểm tra chứng cứ. Hướng dẫn cho AI: đọc kho dữ liệu.';
  assert.equal(learnerRecord({ sender_type: 'ai_judge', content }).content, 'Cần kiểm tra chứng cứ.');
  assert.equal(learnerRecord({ sender_type: 'user', content }).content, content);
  assert.equal(learnerEvaluation({ feedback: content, citation_warnings: ['version_rules'] }).feedback, 'Cần kiểm tra chứng cứ.');
  assert.equal(learnerPayload({ source_note: 'nội bộ', content }).source_note, undefined);
  assert.equal(learnerPayload({ content }).content, 'Cần kiểm tra chứng cứ.');
  const rawLaw = 'Cơ sở dữ liệu đất đai được quản lý theo quy định.';
  const citation = learnerCitation({ text: rawLaw, source_url: 'https://vbpl.vn/', verification_status: 'pending_review', application_reason: 'version_rules chưa duyệt' });
  assert.equal(citation.text, rawLaw);
  assert.equal(citation.verification_status, 'unverified');
  assert.equal(citation.application_reason, 'Cần kiểm tra hiệu lực của điều luật này.');
});

process.env.JWT_SECRET ||= 'unit-test-only-secret-32-characters-long';
const { answerLegalQuestion, publicAssistantExchange } = await import('../src/services/legalAssistantService.js');
const citation = { id: 'law-test-id', law_number: '45/2013/QH13', title: 'Luật Đất đai', article: '202', paragraph: null, point: null, locator: 'Điều 202', text: 'Văn bản giả định chỉ dùng cho kiểm thử.', source_url: 'https://vbpl.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=32833', version: 'Bản kiểm thử', application_date: '2023-01-01', application_reason: 'Đối chiếu mốc tranh chấp.', verification_status: 'verified' };
const args = { session: { case_event_date: '2023-01-01' }, courtCase, question: 'Cần xem xét căn cứ nào?' };

test('trợ lý dẫn đúng nguồn đã truy xuất, phiên bản và thời điểm; từ chối viện dẫn bịa', async () => {
  let prompt;
  const dependencies = { research: async () => ({ citations: [citation], issues: [] }), persona: { model_id: 'test' }, complete: async (input) => { prompt = input; return JSON.stringify({ answer: 'Cần xem xét Điều 202 của Luật số 45/2013/QH13.', citation_ids: [citation.id] }); } };
  const answer = await answerLegalQuestion(args, dependencies);
  assert.equal(answer.verification_status, 'verified');
  assert.deepEqual(answer.citations, [citation]);
  assert.match(prompt.systemPrompt, /độc lập với bên đối lập/);
  assert.equal(JSON.parse(prompt.messages[0].content).sources[0].application_date, '2023-01-01');
  await assert.rejects(answerLegalQuestion(args, { ...dependencies, complete: async () => JSON.stringify({ answer: 'Áp dụng Điều 999.', citation_ids: [citation.id] }) }), /kiểm tra thêm nguồn/);
  await assert.rejects(answerLegalQuestion(args, { ...dependencies, complete: async () => JSON.stringify({ answer: 'Căn cứ không có thật.', citation_ids: ['invented'] }) }), /kiểm tra thêm nguồn/);
  await assert.rejects(answerLegalQuestion(args, { ...dependencies, complete: async () => JSON.stringify({ answer: 'Xem https://invented.example/nguon', citation_ids: [citation.id] }) }), /kiểm tra thêm liên kết/);
});

test('thiếu nguồn hoặc mất mạng: trả trạng thái chưa xác minh, không gọi AI để tạo luật', async () => {
  let called = false;
  for (const warnings of [['Thiếu phiên bản'], ['Không truy cập được nguồn chính thức']]) {
    const answer = await answerLegalQuestion(args, { research: async () => ({ citations: [], candidates: [citation], warnings }), complete: async () => { called = true; } });
    assert.equal(answer.verification_status, 'unverified');
    assert.deepEqual(answer.citations, []);
    assert.match(answer.answer, /chưa xác minh/);
    assert.equal(answer.sources[0].url, citation.source_url);
  }
  assert.equal(called, false);
  assert.equal(publicAssistantExchange({ status: 'pending', expires_at: new Date(0) }).status, 'failed');
});
