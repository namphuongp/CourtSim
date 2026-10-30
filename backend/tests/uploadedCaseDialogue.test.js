import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueContext, extractQuantities, resolveDialogueFocus, validateDialogueQuantities } from '../src/services/dialogueContext.js';
import { validateCitationIds } from '../src/services/legalRetrievalService.js';

process.env.JWT_SECRET ||= 'uploaded-case-test-only-secret-at-least-32-characters';

// Hồ sơ người dùng tải lên: số tiền viết tắt, toàn văn dài hơn phần trích đoạn đưa vào prompt.
const filler = Array.from({ length: 40 }, (_, i) => `Bút lục ${i + 1} ghi nhận quá trình trao đổi giữa các bên về khoản vay.`).join(' ');
const uploadedCase = {
  title: 'Tranh chấp hợp đồng vay tài sản', category: 'dân sự',
  summary: 'Ông Đ cho rằng khoản vay ngày 18/12/2015 là khoản độc lập với các khoản đã chốt.',
  full_document: `${filler} Theo giấy vay ngày 18/12/2015, bị đơn nhận 1.600.000.000 đồng, lãi suất 2%/tháng. Tổng gốc các khoản trước là 4 tỷ, lãi 1,631 tỷ.`,
  parties: [{ side: 'plaintiff', name: 'Ông Đoàn Văn Đ', claims: ['Yêu cầu trả 1,6 tỷ đồng tiền gốc.'] }],
  case_facts: [], evidence_inventory: [],
};
const session = { user_court_role: 'plaintiff_lawyer', case_event_date: '2025-03-21', conversation: { phase: 'debate' } };
const learnerCitation = { id: 'c192', reference_id: 'PL-1', law_number: '92/2015/QH13', locator: 'Điều 192', title: 'Bộ luật Tố tụng dân sự',
  source_url: 'https://vbpl.vn/bltds', text: 'Điều 192. Trả lại đơn khởi kiện', source_status: 'verified_current',
  source_verification: 'verified', checked_at: '2025-01-01T00:00:00.000Z', source_sha256: 'a'.repeat(64), version: '2015' };
const records = [
  { _id: 'u1', sender_type: 'user', content: '[Căn cứ: 92/2015/QH13, Điều 192] Cần đối chiếu thời điểm áp dụng.', citations: [learnerCitation] },
  { _id: 'j1', sender_type: 'ai_judge', next_speaker: 'opponent', content: 'Mời luật sư bị đơn đối đáp.' },
  { _id: 'u2', sender_type: 'user', content: 'Chưa đúng.' },
];

test('số tiền viết tắt và viết đầy đủ được coi là cùng một số liệu', () => {
  assert.deepEqual(extractQuantities('1,6 tỷ đồng'), extractQuantities('1.600.000.000 đồng'));
  assert.deepEqual(extractQuantities('4 tỷ'), extractQuantities('4.000.000.000 đồng'));
  assert.deepEqual(extractQuantities('500 triệu đồng'), extractQuantities('500.000.000 đồng'));
  assert.deepEqual(extractQuantities('229,7 m2'), extractQuantities('229,7 m²'));
  assert.notDeepEqual(extractQuantities('1,6 tỷ đồng'), extractQuantities('1,7 tỷ đồng'));
});

test('số liệu có trong toàn văn bản án được chấp nhận, số liệu bịa vẫn bị chặn', () => {
  const context = dialogueContext(session, uploadedCase, records, { citations: [] });
  assert.ok(!JSON.stringify(context).includes('Bút lục 40'), 'Toàn văn không bị đưa vào prompt');
  assert.doesNotThrow(() => validateDialogueQuantities('Giấy vay ghi nhận khoản 1,6 tỷ đồng với lãi suất 2%/tháng.', context));
  assert.doesNotThrow(() => validateDialogueQuantities('Các khoản trước có tổng gốc 4.000.000.000 đồng.', context));
  assert.throws(() => validateDialogueQuantities('Bị đơn đã trả 900 triệu đồng.', context), { code: 'AI_UNGROUNDED_FACT' });
});

test('mã hồ sơ không tồn tại bị loại bỏ thay vì làm hỏng cả lượt', () => {
  const context = dialogueContext(session, uploadedCase, records, { citations: [] });
  const valid = context.dossier[0].id;
  const resolved = resolveDialogueFocus({ purpose: 'rebut', content: 'Lời đối đáp.', focus: { learner: 'L1', dossier: [valid, 'D999', valid, 'X1'] } }, context);
  assert.deepEqual(resolved.source_anchors.map(s => s.id), [valid]);
  assert.ok(resolved.normalizations.includes('focus_dossier_filtered'));
  const defaulted = resolveDialogueFocus({ purpose: 'rebut', content: 'Lời đối đáp.', focus: { dossier: [] } }, context);
  assert.ok(defaulted.normalizations.includes('focus_learner_default'));
  assert.throws(() => resolveDialogueFocus({ purpose: 'clarify_evidence', content: 'Hỏi.', focus: { learner: 'L1', dossier: ['D999'] } }, context), { code: 'AI_UNGROUNDED_FACT' });
});

test('được nhắc lại điều luật người học đã viện dẫn có nguồn, điều luật khác vẫn bị chặn', async () => {
  const { learnerAcknowledgedReferences } = await import('../src/services/simulationService.js');
  const acknowledgedReferences = learnerAcknowledgedReferences(records);
  const check = content => validateCitationIds({ content, citationIds: [], availableCitations: [], acknowledgedReferences }).valid;
  assert.equal(check('Luật sư phía nguyên đơn viện dẫn Điều 192 nhưng chưa chỉ ra liên hệ với yêu cầu trả nợ.'), true);
  assert.equal(check('Theo khoản 1 Điều 192 Bộ luật Tố tụng dân sự 92/2015/QH13, cần xét sự việc đã giải quyết.'), true);
  assert.equal(check('Điều 463 Bộ luật Dân sự quy định về hợp đồng vay.'), false);
  assert.equal(validateCitationIds({ content: 'Luật sư viện dẫn Điều 192.', citationIds: [], availableCitations: [] }).valid, false);
});

test('lượt bên đối lập tự bỏ câu chưa đối chiếu được thay vì báo lỗi kẹt phiên', async () => {
  const { generateDebateTurn } = await import('../src/services/simulationService.js');
  let calls = 0;
  const [turn] = await generateDebateTurn({ session, courtCase: uploadedCase, records, speakers: ['opponent'] }, {
    persona: async () => ({ model_id: 'fixture' }),
    research: async () => ({ citations: [], candidates: [], issues: [], warnings: [], legal_assessment_available: false }),
    complete: async input => {
      calls++;
      const context = JSON.parse(input.systemPrompt.split('<UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[1].split('</UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[0]);
      return JSON.stringify({ role: 'opponent', purpose: 'rebut', issue: context.state.current_issue.id, next_speaker: 'learner',
        focus: { learner: 'L1', dossier: [] }, citation_ids: [],
        content: 'Kính thưa Hội đồng xét xử, luật sư phía nguyên đơn chỉ nói chưa đúng mà chưa chỉ ra nhận định nào về nghĩa vụ chứng minh là không chính xác. Theo Điều 463 Bộ luật Dân sự, bên vay phải hoàn trả. Phía chúng tôi giữ quan điểm nguyên đơn vẫn phải chứng minh khoản vay ngày 18/12/2015 độc lập với các khoản đã được giải quyết trước đây.' });
    },
  });
  assert.equal(calls, 2);
  assert.equal(turn.generation_mode, 'model');
  assert.doesNotMatch(turn.content, /Điều 463/);
  assert.match(turn.content, /nghĩa vụ chứng minh/);
  assert.ok(turn.generation_metrics.salvaged);
});
