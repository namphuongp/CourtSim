import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Case from '../src/models/Case.js';
import {
  sampleCasesCatalog,
  caseAnPhucMai,
  caseLaborSaoKhue,
  caseDepositContractThuDuc,
} from '../src/data/sampleCasesCatalog.js';
import { validateCaseDetails, validateEvidenceReferences } from '../src/services/caseEvidence.js';
import { validateCaseFacts } from '../src/services/caseKnowledge.js';
import { validateTimeline } from '../src/services/legalTimeline.js';
import { validatePracticeContext, openingStatement } from '../src/services/casePractice.js';
import { chooseSpeakingPlan, publicConversation, isExplicitEndByChat } from '../src/services/conversationPolicy.js';
import { hearingState } from '../src/services/hearingState.js';
import { turnTask, roleTask, dialogueProblem, guidedContinuation } from '../src/services/debatePolicy.js';
import { dialogueContext, validateDialogueQuantities } from '../src/services/dialogueContext.js';
import { validateHearingGrounding } from '../src/services/hearingValidation.js';
import { controlTurn } from '../src/services/dialogueInput.js';
import { sanitizeTextForTts, fetchGoogleVietnameseSpeech } from '../src/services/aiVoiceService.js';
import { caseIntroduction } from '../../shared/casePresentation.mjs';
import { learnerText } from '../../shared/learnerText.mjs';

test('Danh mục 5 vụ án mẫu: hợp lệ schema, đầy đủ chứng cứ trực quan và khớp checksum seed', async () => {
  assert.equal(sampleCasesCatalog.length, 5);

  for (const c of sampleCasesCatalog) {
    assert.ok(c._id && mongoose.isObjectIdOrHexString(c._id));
    validateCaseDetails(c);
    validateCaseFacts(c);
    validateTimeline(c.timeline);
    validatePracticeContext(c.practice_context);

    const doc = new Case({ ...c, _id: new mongoose.Types.ObjectId(c._id) });
    await doc.validate();

    const intro = caseIntroduction(c);
    assert.ok(intro.title && intro.summary);
    assert.ok(Array.isArray(intro.developments) && intro.developments.length >= 3, `Thiếu diễn biến tiền tố tụng cho: ${c.title}`);

    for (const val of [
      c.title,
      c.summary,
      c.full_document,
      c.legal_scope_note,
      intro.title,
      intro.summary,
      ...intro.developments.flatMap((d) => [d.title, d.text]),
    ]) {
      assert.doesNotMatch(learnerText(val), /;/);
    }
  }

  // Kiểm tra chi tiết Vụ án Nguyễn Ngọc Mai - Cơ sở lưu trú An Phúc đúng theo mẫu hồ sơ khách hàng
  const maiStatement = caseAnPhucMai.evidence_inventory.find((e) => e.id === 'EV-anphuc-tuongtrinh');
  assert.ok(maiStatement);
  assert.equal(maiStatement.availability, 'provided');
  assert.equal(maiStatement.date, '2026-09-15');
  assert.match(maiStatement.content, /BẢN TƯỜNG TRÌNH CỦA NGUYỄN NGỌC MAI/);
  assert.match(maiStatement.content, /02-BV\/2026/);
  assert.match(maiStatement.content, /Cơ sở lưu trú An Phúc/);
  assert.match(maiStatement.content, /Trương Văn Báu/);
  assert.match(maiStatement.content, /HS-XX-26/);
  assert.deepEqual(validateEvidenceReferences(caseAnPhucMai, '[CC:EV-anphuc-tuongtrinh]'), ['EV-anphuc-tuongtrinh']);

  // Kiểm tra seed/cases.json và seed/manifest.json khớp tuyệt đối
  const casesContent = await readFile(new URL('../src/data/seed/cases.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../src/data/seed/manifest.json', import.meta.url), 'utf8'));
  const sha256 = createHash('sha256').update(casesContent).digest('hex');
  assert.equal(manifest.collections.cases.count, 5);
  assert.equal(manifest.collections.cases.sha256, sha256);
});

test('Kịch bản phiên tòa 4 giai đoạn: khai mạc, đa tranh điểm, phản biện IRAC và kết thúc tự nhiên bằng chat', () => {
  for (const c of [caseAnPhucMai, caseLaborSaoKhue, caseDepositContractThuDuc]) {
    const state = hearingState({ user_court_role: 'plaintiff_lawyer' }, c, []);
    assert.equal(state.issues.length, 3);
    assert.deepEqual(
      state.issues.map((i) => i.id),
      ['issue:conduct_facts', 'issue:evidence_validity', 'issue:legal_liability']
    );

    const open = openingStatement(c, 'plaintiff_lawyer');
    assert.match(open, /khai mạc phiên tòa xét xử sơ thẩm/i);
    assert.match(open, /Trình bày yêu cầu mở đầu, Xét hỏi làm rõ chứng cứ, Tranh luận đối đáp pháp lý và Tổng kết nghị án/);
  }

  // Khi người dùng chủ động đề nghị kết thúc / nghị án bằng chat hoặc phát biểu tổng kết -> chuyển sang summary & Chủ tọa khép lại phiên tòa
  const closingPhrases = [
    'Tóm lại, phía nguyên đơn giữ nguyên yêu cầu bồi thường 45.000.000 đồng.',
    'Thưa Hội đồng xét xử, tôi không còn ý kiến gì thêm, đề nghị HĐXX chuyển sang phần nghị án.',
    'Tôi xin dừng tranh luận và muốn kết thúc phiên tòa để HĐXX phán quyết.',
    'Lời nói sau cùng, kính đề nghị Hội đồng xét xử chấp nhận toàn bộ yêu cầu khởi kiện.',
    'Kết thúc phiên tòa.',
    'Đề nghị HĐXX vào nghị án và chấm điểm.',
  ];
  for (const phrase of closingPhrases) {
    const plan = chooseSpeakingPlan(
      { user_court_role: 'plaintiff_lawyer', turn_count: 1, conversation: { phase: 'debate', last_speaker: 'opponent' } },
      phrase
    );
    assert.equal(plan.phase, 'summary', `Phải chuyển sang summary cho câu: ${phrase}`);
    assert.deepEqual(plan.plan, ['judge']);
  }

  assert.equal(isExplicitEndByChat('Tôi xin kết thúc phiên tòa.'), true);
  assert.equal(isExplicitEndByChat('Đề nghị HĐXX vào nghị án và chấm điểm.'), true);
  assert.equal(isExplicitEndByChat('Kết thúc phiên tòa'), true);
  assert.equal(isExplicitEndByChat('Tôi chưa kết thúc ngay mà cần đối chiếu thêm.'), false);

  // Câu phủ định không bị nhận nhầm là kết thúc phiên
  const nonClosing = chooseSpeakingPlan(
    { user_court_role: 'plaintiff_lawyer', turn_count: 2, conversation: { phase: 'clarification', last_speaker: 'judge' } },
    'Tôi không kết luận ngay mà đề nghị đối chiếu thêm Bản tường trình ngày 15/09/2026.'
  );
  assert.notEqual(nonClosing.phase, 'summary');

  // Kiểm tra trạng thái ready_to_close và auto_complete trả về cho frontend để tự động chấm điểm khi kết thúc bằng chat
  const pubSummary = publicConversation({ conversation: { status: 'learner', phase: 'summary', last_purpose: 'close', revision: 4 } });
  assert.equal(pubSummary.ready_to_close, true);
  assert.equal(pubSummary.auto_complete, true);
  assert.equal(pubSummary.last_purpose, 'close');

  // Kiểm tra chỉ dẫn Chủ tọa ở giai đoạn summary tuyên bố kết thúc phần tranh tụng để vào nghị án
  const records = [
    { _id: 'u1', sender_type: 'user', content: 'Tóm lại, tôi đề nghị Hội đồng xét xử nghị án.' },
  ];
  const ctx = dialogueContext({ user_court_role: 'plaintiff_lawyer', conversation: { phase: 'summary' } }, caseAnPhucMai, records, { citations: [] });
  const judgeSummaryTask = turnTask('judge', ctx);
  assert.match(judgeSummaryTask, /tuyên bố kết thúc phần tranh tụng để Hội đồng xét xử vào Nghị án/i);
});

test('Đọc to (TTS) đa câu: không cắt câu dài của Chủ tọa và ghép nhiều đoạn MP3 sạch metadata', async () => {
  const longJudgeSpeech = [
    'Thay mặt Hội đồng xét xử, Chủ tọa tuyên bố khai mạc phiên tòa xét xử sơ thẩm công khai vụ án yêu cầu bảo vệ danh dự, nhân phẩm tại Cơ sở lưu trú An Phúc.',
    'Căn cứ quy định của Bộ luật Tố tụng dân sự năm 2015, sau khi kiểm tra căn cước và phổ biến quyền, nghĩa vụ của các đương sự, Hội đồng xét xử chuyển sang phần tranh tụng.',
    'Tại phiên tòa hôm nay, mời Luật sư bảo vệ quyền và lợi ích hợp pháp cho nguyên đơn Nguyễn Ngọc Mai trình bày tóm tắt yêu cầu khởi kiện và viện dẫn các chứng cứ trong hồ sơ.',
  ].join(' ');

  const cleaned = sanitizeTextForTts(longJudgeSpeech);
  assert.ok(cleaned.length > 350, 'Văn bản dài của Chủ tọa phải được giữ nguyên vẹn, không bị cắt ngắn');
  assert.match(cleaned, /Nguyễn Ngọc Mai trình bày tóm tắt yêu cầu khởi kiện/);

  const singleSentenceBuffer = await fetchGoogleVietnameseSpeech('Chủ tọa khai mạc phiên tòa.');
  const multiSentenceBuffer = await fetchGoogleVietnameseSpeech(cleaned);
  assert.ok(Buffer.isBuffer(multiSentenceBuffer));
  assert.ok(
    multiSentenceBuffer.length > singleSentenceBuffer.length * 3,
    `Buffer đa câu (${multiSentenceBuffer.length} bytes) phải chứa đầy đủ âm thanh của tất cả các câu so với câu đơn (${singleSentenceBuffer.length} bytes)`
  );
});

test('Chống máy móc cho Chủ tọa & Luật sư AI: chấp nhận xưng hô chuẩn tòa án, định dạng ngày Việt Nam và lời dẫn bám sát tranh điểm', () => {
  const records = [
    {
      _id: 'u1',
      sender_type: 'user',
      content: 'Kính thưa Hội đồng xét xử, phía nguyên đơn yêu cầu bồi thường 80 triệu đồng dựa trên sự việc ngày 14/09/2026 và Bản tường trình ngày 15/09/2026.',
    },
  ];
  const ctx = dialogueContext(
    { user_court_role: 'plaintiff_lawyer', case_event_date: '2026-09-15', conversation: { phase: 'debate' } },
    caseAnPhucMai,
    records,
    { citations: [] }
  );

  // 1. Khi AI dùng xưng hô chuẩn mực ("Luật sư vừa nêu", "Phía nguyên đơn cho rằng", "Vị luật sư đồng nghiệp trình bày") để dẫn lại con số của người học -> Không bị báo lỗi AI_UNGROUNDED_FACT
  assert.doesNotThrow(() =>
    validateDialogueQuantities('Theo lời Luật sư vừa nêu, mức yêu cầu 80 triệu đồng chưa có hóa đơn chứng từ chứng minh thiệt hại thực tế.', ctx)
  );
  assert.doesNotThrow(() =>
    validateDialogueQuantities('Phía nguyên đơn cho rằng mức bồi thường là 80 triệu đồng nhưng chưa đưa ra căn cứ định lượng.', ctx)
  );
  assert.doesNotThrow(() =>
    validateDialogueQuantities('Vị luật sư đồng nghiệp viện dẫn con số 80 triệu đồng song hồ sơ hiện tại chỉ ghi nhận yêu cầu 45.000.000 đồng.', ctx)
  );

  // 2. Khi AI đọc ngày tháng theo chuẩn Việt Nam DD/MM/YYYY từ mốc YYYY-MM-DD trong hồ sơ -> Không bị báo lỗi AI_HEARING_GROUNDING
  assert.doesNotThrow(() =>
    validateHearingGrounding(
      { content: 'Đối chiếu văn bản lập ngày 15/09/2026 và sự việc ngày 14/09/2026, tài liệu này chỉ ghi nhận lời trình bày một phía của chị Mai.' },
      ctx
    )
  );

  // 3. Luật sư AI phản biện tự nhiên (130 từ, có câu hỏi tu từ + câu hỏi chất vấn) -> Không bị dialogueProblem từ chối oan
  const naturalOpponentContent = [
    'Kính thưa Hội đồng xét xử, phía chúng tôi không đồng ý với suy diễn của vị luật sư đồng nghiệp.',
    'Thứ nhất, Bản tường trình lập ngày 15/09/2026 chỉ là lời trình bày đơn phương từ phía nguyên đơn sau khi rời cơ sở lưu trú, hoàn toàn chưa có biên bản kết luận vi phạm của cơ quan có thẩm quyền.',
    'Thứ hai, vi bằng tin nhắn tuyển dụng chỉ ghi nhận việc trao đổi công việc hỗ trợ sự kiện từ trước, không phải chứng cứ trực tiếp chứng minh hành vi giữ người trái ý muốn tại phòng riêng.',
    'Nếu chỉ dựa vào lời khai một phía mà chưa có dữ liệu trích xuất camera gốc, làm sao có thể quy kết trách nhiệm bồi thường cho thân chủ chúng tôi? Phía nguyên đơn còn tài liệu khách quan nào khác ngoài lời tự thuật không?',
  ].join(' ');
  const oppProblem = dialogueProblem(
    {
      content: naturalOpponentContent,
      purpose: 'rebut',
      dialogue_focus: { learner_quote: records[0].content },
    },
    'opponent',
    records,
    caseAnPhucMai,
    'debate',
    'learner'
  );
  assert.equal(oppProblem, null);

  // 4. Lời nối điều hành dự phòng (guidedContinuation) của Chủ tọa gắn trực tiếp với tranh điểm hiện tại và không chứa dấu chấm phẩy
  const fallbackTurn = guidedContinuation('judge', caseAnPhucMai, records, 'opponent', 'debate', ctx);
  assert.equal(fallbackTurn.purpose, 'transition');
  assert.equal(fallbackTurn.next_speaker, 'opponent');
  assert.match(fallbackTurn.content, new RegExp(ctx.state.current_issue.label.toLocaleLowerCase('vi')));
  assert.doesNotMatch(fallbackTurn.content, /;/);

  const closeTurn = guidedContinuation('judge', caseAnPhucMai, records, 'learner', 'summary', ctx);
  assert.equal(closeTurn.purpose, 'close');
  assert.doesNotMatch(closeTurn.content, /;/);

  // 5. Role task của Chủ tọa và Luật sư AI phân hóa rõ theo từng giai đoạn tố tụng
  assert.match(roleTask('judge', 'presentation'), /Mở đầu và Trình bày yêu cầu/);
  assert.match(roleTask('judge', 'clarification'), /Xét hỏi công khai và Kiểm tra chứng cứ/);
  assert.match(roleTask('judge', 'debate'), /Tranh luận và Đối đáp pháp lý/);
  assert.match(roleTask('judge', 'summary'), /purpose=close/);
  assert.match(roleTask('opponent', 'clarification'), /phạm vi chứng minh/);
  assert.match(roleTask('opponent', 'debate'), /nhịp điệu phản biện/);

  // 6. Control turn khi người học chỉ nói ngắn ("Tôi không đồng ý") phản hồi chuẩn mực như Chủ tọa thật
  const briefControl = controlTurn('brief_position');
  assert.match(briefControl.content, /nêu rõ lý do pháp lý và tài liệu, chứng cứ/);
  assert.doesNotMatch(briefControl.content, /;/);
});
