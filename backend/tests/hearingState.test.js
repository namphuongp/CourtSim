import test from 'node:test';
import assert from 'node:assert/strict';
import { hearingState, roleMismatch } from '../src/services/hearingState.js';
import { hearingProblem, validateHearingGrounding } from '../src/services/hearingValidation.js';
import { dialogueContext, validateDialogueQuantities } from '../src/services/dialogueContext.js';
import { chooseSpeakingPlan } from '../src/services/conversationPolicy.js';
import { validateCaseDetails } from '../src/services/caseEvidence.js';
import { readDialoguePreview } from '../src/services/dialoguePreview.js';

process.env.JWT_SECRET ||= 'hearing-test-only-secret-at-least-32-characters';
const session = { user_court_role: 'defense_lawyer', case_event_date: '2024-03-29', turn_count: 2, conversation: { phase: 'debate' } };
const fact = 'Diện tích đất đang tranh chấp là 229,7 m².';
const courtCase = { title: 'Hồ sơ đất đai giả định', category: 'dân sự', summary: fact,
  full_document: fact + ' Các bên tranh luận về phạm vi giấy chứng nhận. Nguồn gốc sử dụng đất và quá trình quản lý còn tranh chấp.',
  case_facts: [{ kind: 'recorded_event', quote: fact, source_type: 'case_outline' }], evidence_inventory: [] };
const user = content => ({ _id: 'u1', sender_type: 'user', content });
const question = { _id: 'j1', sender_type: 'ai_judge', next_speaker: 'opponent', content: 'Nguyên đơn dựa vào tài liệu nào chứng minh phần đất nằm trong giấy chứng nhận?' };
const records = [user('Nguyên đơn chưa chứng minh phần đất thuộc phạm vi giấy chứng nhận.'), question];
const contextFor = (c = courtCase, r = records) => {
  const context = dialogueContext(session, c, r, { citations: [] });
  context.state.invited_next = 'learner';
  return context;
};
const response = (context, content, extra = {}) => ({ role: 'opponent', purpose: 'rebut', issue: context.state.current_issue.id,
  next_speaker: 'learner', focus: { learner: 'L1', dossier: [] }, citation_ids: [], content, ...extra });

test('1 role drift: sửa tự xưng sai phe mà không gọi model hoặc đổi session', async () => {
  const { generateDebateTurn } = await import('../src/services/simulationService.js');
  const input = 'Tôi bảo vệ nguyên đơn A.';
  assert.deepEqual(chooseSpeakingPlan(session, input).plan, ['judge']);
  const [turn] = await generateDebateTurn({ session, courtCase, records: [user(input)] }, { complete: () => assert.fail('Không gọi model') });
  assert.equal(session.user_court_role, 'defense_lawyer');
  assert.equal(turn.generation_mode, 'role_correction');
  assert.match(turn.content, /đang bảo vệ phía bị đơn/);
  assert.deepEqual(hearingState(session, courtCase, []).participants, { player: 'defendant', opponent: 'plaintiff', source: 'session.user_court_role' });
  assert.equal(roleMismatch(session, 'Tôi không bảo vệ nguyên đơn.'), false);
  assert.equal(roleMismatch(session, 'Người kia nói: “Tôi bảo vệ nguyên đơn.”'), false);
});

test('2 missing evidence: phải trả lời trực tiếp với giới hạn, chặn giả thiết và tài liệu bịa', () => {
  const context = contextFor();
  const content = 'Trong dữ liệu hiện được cung cấp, chưa xác định được tài liệu đối chiếu trực tiếp.';
  const turn = response(context, content, { answer: { question_id: 'question:j1', status: 'not_determined', evidence_ids: [], direct_answer: content } });
  assert.equal(hearingProblem(turn, 'opponent', context, records), null);
  assert.match(hearingProblem({ ...turn, answer: { ...turn.answer, evidence_ids: ['fake'] } }, 'opponent', context, records), /thuộc hồ sơ/);
  const indirect = 'Kết quả đối chiếu nếu được làm rõ có thể chứng minh yêu cầu.';
  assert.ok(hearingProblem({ ...turn, content: indirect, answer: { ...turn.answer, direct_answer: indirect } }, 'opponent', context, records));
  assert.throws(() => validateHearingGrounding({ content: 'Theo biên bản ngày 12/03/2020, thửa đất số 123 thuộc A.' }, context), { code: 'AI_HEARING_GROUNDING' });
});

const evidence = [
  { id: 'EV-certificate', name: 'Giấy chứng nhận được cung cấp', availability: 'provided', content: 'Giấy chứng nhận mô tả ranh giới đất.' },
  { id: 'EV-map', name: 'Bản đồ địa chính được cung cấp', availability: 'provided', content: 'Bản đồ địa chính thể hiện phạm vi phần đất.' },
  { id: 'EV-survey', name: 'Kết quả trích đo được cung cấp', availability: 'provided', content: 'Kết quả trích đo xác định phần đất trùng phạm vi giấy chứng nhận.' },
];

test('3 evidence exists: tên, mã và đoạn chứng cứ khớp hồ sơ; giữ qua parse output', async () => {
  const { readGeneratedTurn } = await import('../src/services/simulationService.js');
  const c = { ...courtCase, evidence_inventory: evidence };
  const context = contextFor(c);
  const content = 'Nguyên đơn dựa vào Kết quả trích đo được cung cấp, xác định phần đất trùng phạm vi giấy chứng nhận.';
  const focus = context.dossier.find(d => d.evidence_id === 'EV-survey');
  const turn = response(context, content, { focus: { learner: 'L1', dossier: [focus.id] },
    answer: { question_id: 'question:j1', status: 'supported', evidence_ids: ['EV-survey'], direct_answer: content } });
  assert.equal(hearingProblem(turn, 'opponent', context, records), null);
  const saved = readGeneratedTurn(JSON.stringify(turn), 'opponent', [], c, records, context);
  assert.deepEqual(saved.evidence_ids, ['EV-survey']);
  assert.equal(saved.answer.question_id, 'question:j1');
  assert.deepEqual(hearingState(session, c, [...records, { ...saved, sender_type: 'ai_prosecutor' }]).presented_evidence.map(e => e.id), ['EV-survey']);
});

test('4 available khác presented, mentioned khác confirmed absent; không suy từ hội thoại thiếu', () => {
  const c = { ...courtCase, evidence_inventory: [...evidence, { id: 'EV-mentioned', name: 'Biên bản chỉ được nhắc đến', availability: 'mentioned_only' }] };
  const state = hearingState(session, c, records);
  assert.equal(state.available_evidence[0].evidence_state, 'available_not_presented');
  assert.equal(state.available_evidence[3].evidence_state, 'not_determined');
  assert.deepEqual(state.absent_evidence, []);
  const presented = hearingState(session, c, [user('[Chứng cứ: Bản đồ địa chính được cung cấp]')]);
  assert.equal(presented.available_evidence[1].evidence_state, 'available_presented');
  const context = contextFor(c, [user('Tôi chưa nhắc tài liệu nào.')]);
  assert.ok(hearingProblem(response(context, 'Hồ sơ không có Bản đồ địa chính được cung cấp.'), 'opponent', context, []));
  assert.ok(hearingProblem(response(context, 'Vì bạn chưa nhắc tài liệu nên cho thấy không có chứng cứ.'), 'opponent', context, []));
  const absentCase = { ...courtCase, full_document: 'Theo danh mục được kiểm tra, hồ sơ không có biên bản hòa giải.',
    evidence_absences: [{ title: 'Biên bản hòa giải', source_quote: 'hồ sơ không có biên bản hòa giải.' }] };
  assert.equal(hearingState(session, absentCase, []).absent_evidence[0].evidence_state, 'confirmed_absent');
  assert.doesNotThrow(() => validateCaseDetails(absentCase));
  assert.throws(() => validateCaseDetails({ ...courtCase, evidence_absences: absentCase.evidence_absences }));
});

test('5 burden of proof: chặn biến chưa chứng minh thành chứng minh phủ định và giả thiết một nhánh', () => {
  const context = contextFor(courtCase, records.slice(0, 1));
  assert.ok(hearingProblem(response(context, 'Nguyên đơn chưa chứng minh đất nằm trong giấy chứng nhận đồng nghĩa bị đơn đã chứng minh đất nằm ngoài.'), 'opponent', context, []));
  assert.equal(hearingProblem(response(context, 'Nguyên đơn chưa chứng minh phần đất nằm trong giấy chứng nhận không đồng nghĩa bị đơn đã chứng minh phần đất nằm ngoài.'), 'opponent', context, []), null);
  assert.ok(hearingProblem(response(context, 'Nếu phần đất trùng giấy chứng nhận thì yêu cầu của bị đơn sẽ bị bác.'), 'opponent', context, []));
  assert.equal(hearingProblem(response(context, 'Nếu phần đất trùng giấy chứng nhận thì yêu cầu được củng cố; ngược lại, nếu không trùng, cần đánh giá lại yêu cầu.'), 'opponent', context, []), null);
});

test('6 repetition: tranh điểm ổn định, ba lượt không nguồn mới chuyển ý; nguồn mới đặt lại bộ đếm', () => {
  const history = Array.from({ length: 3 }, (_, i) => ({ ...user(`Tôi đề nghị đối chiếu giấy chứng nhận lần ${i + 1}.`), _id: `u${i}` }));
  const state = hearingState(session, courtCase, history);
  assert.equal(state.current_issue.id, 'issue:overlap');
  assert.equal(state.stalled, true);
  assert.equal(state.next_issue.id, 'issue:burden');
  assert.deepEqual(state.resolved_issues, []);
  assert.deepEqual(hearingState(session, courtCase, JSON.parse(JSON.stringify(history))), state);
  const fresh = hearingState(session, { ...courtCase, evidence_inventory: evidence }, [...history, { ...user('Tôi viện dẫn giấy chứng nhận.'), evidence_ids: ['EV-certificate'] }]);
  assert.equal(fresh.stalled, false);
  const context = contextFor(courtCase, history);
  assert.ok(hearingProblem({ ...response(context, 'Bạn có tài liệu đối chiếu nào?'), role: 'judge' }, 'judge', context, history));
});

test('7 né câu hỏi: retry đúng nguyên nhân, không stream câu trả lời chưa đạt', async () => {
  const { generateDebateTurn } = await import('../src/services/simulationService.js');
  let calls = 0;
  const previews = [];
  const [turn] = await generateDebateTurn({ session, courtCase, records, speakers: ['opponent'] }, {
    persona: async () => ({ model_id: 'fixture' }), onProgress: value => previews.push(value),
    complete: async input => {
      calls++;
      const context = JSON.parse(input.systemPrompt.split('<UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[1].split('</UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[0]);
      if (calls === 1) {
        const bad = response(context, 'Giấy chứng nhận có thể chứng minh nếu sau này được làm rõ.');
        const raw = JSON.stringify(bad);
        input.onDelta?.(raw);
        assert.ok(readDialoguePreview(raw));
        return raw;
      }
      assert.match(input.messages[0].content, /Trả lời câu hỏi tài liệu/);
      const content = 'Trong dữ liệu hiện được cung cấp, chưa xác định được tài liệu đối chiếu trực tiếp.';
      return JSON.stringify(response(context, content, { answer: { question_id: 'question:j1', status: 'not_determined', evidence_ids: [], direct_answer: content } }));
    },
  });
  assert.equal(calls, 2);
  assert.equal(turn.generation_mode, 'model');
  assert.ok(previews.every(p => !p.content));
  const evasion = [...records, { sender_type: 'ai_prosecutor', content: 'Các tài liệu có thể liên kết khi làm rõ.' }];
  const state = hearingState(session, courtCase, evasion);
  assert.equal(state.judge_intervention, 'request_direct_answer');
  assert.deepEqual(chooseSpeakingPlan({ ...session, conversation: { hearing_state: state } }, 'Tôi giữ ý kiến.').plan, ['judge', 'opponent']);
});

test('8 conflicting claim: dữ kiện chính thức không bị lời người học/luật ghi đè', () => {
  const context = contextFor(courtCase, [user('Diện tích đất là 500 m².')]);
  assert.equal(context.hearing.case_facts[0].quote, fact);
  assert.equal(context.learner[0].text, 'Diện tích đất là 500 m².');
  assert.throws(() => validateDialogueQuantities('Diện tích đất là 500 m².', context));
  assert.doesNotThrow(() => validateDialogueQuantities('Bạn cho rằng diện tích đất là 500 m².', context));
  context.retrievedLaw = [{ text: 'Quy định giả định đề cập diện tích 900 m².' }];
  assert.throws(() => validateDialogueQuantities('Diện tích tranh chấp là 900 m².', context));
  assert.doesNotThrow(() => validateDialogueQuantities(fact, context));
});
