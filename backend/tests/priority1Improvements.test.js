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
import {
  extractAndStructureUserCase,
  extractTextFromUploadedDocument,
  segmentVietnameseJudgment,
} from '../src/services/userCaseUploadService.js';
import { caseIntroduction } from '../../shared/casePresentation.mjs';
import { learnerText } from '../../shared/learnerText.mjs';

function buildMinimalDocxBuffer(text) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  const xmlBytes = Buffer.from(xml, 'utf8');
  const fileNameBytes = Buffer.from('word/document.xml', 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8); // compression = 0 (stored)
  header.writeUInt32LE(xmlBytes.length, 18); // compressed size
  header.writeUInt32LE(xmlBytes.length, 22); // uncompressed size
  header.writeUInt16LE(fileNameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, fileNameBytes, xmlBytes]);
}

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

  assert.doesNotThrow(() =>
    validateDialogueQuantities('Theo lời Luật sư vừa nêu, mức yêu cầu 80 triệu đồng chưa có hóa đơn chứng từ chứng minh thiệt hại thực tế.', ctx)
  );
  assert.doesNotThrow(() =>
    validateDialogueQuantities('Phía nguyên đơn cho rằng mức bồi thường là 80 triệu đồng nhưng chưa đưa ra căn cứ định lượng.', ctx)
  );
  assert.doesNotThrow(() =>
    validateDialogueQuantities('Vị luật sư đồng nghiệp viện dẫn con số 80 triệu đồng song hồ sơ hiện tại chỉ ghi nhận yêu cầu 45.000.000 đồng.', ctx)
  );

  assert.doesNotThrow(() =>
    validateHearingGrounding(
      { content: 'Đối chiếu văn bản lập ngày 15/09/2026 và sự việc ngày 14/09/2026, tài liệu này chỉ ghi nhận lời trình bày một phía của chị Mai.' },
      ctx
    )
  );

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

  const fallbackTurn = guidedContinuation('judge', caseAnPhucMai, records, 'opponent', 'debate', ctx);
  assert.equal(fallbackTurn.purpose, 'transition');
  assert.equal(fallbackTurn.next_speaker, 'opponent');
  assert.match(fallbackTurn.content, new RegExp(ctx.state.current_issue.label.toLocaleLowerCase('vi')));
  assert.doesNotMatch(fallbackTurn.content, /;/);

  const closeTurn = guidedContinuation('judge', caseAnPhucMai, records, 'learner', 'summary', ctx);
  assert.equal(closeTurn.purpose, 'close');
  assert.doesNotMatch(closeTurn.content, /;/);

  assert.match(roleTask('judge', 'presentation'), /Mở đầu và Trình bày yêu cầu/);
  assert.match(roleTask('judge', 'clarification'), /Xét hỏi công khai và Kiểm tra chứng cứ/);
  assert.match(roleTask('judge', 'debate'), /Tranh luận và Đối đáp pháp lý/);
  assert.match(roleTask('judge', 'summary'), /purpose=close/);
  assert.match(roleTask('opponent', 'clarification'), /phạm vi chứng minh/);
  assert.match(roleTask('opponent', 'debate'), /nhịp điệu phản biện/);

  const briefControl = controlTurn('brief_position');
  assert.match(briefControl.content, /nêu rõ lý do pháp lý và tài liệu, chứng cứ/);
  assert.doesNotMatch(briefControl.content, /;/);
});

test('AI phát hiện nội dung & chuẩn hóa bản án thực tế (kể cả tệp .docx/.html, quốc hiệu và lọc phần QUYẾT ĐỊNH) đúng chuẩn CSDL CourtSim', async () => {
  const realVietnameseJudgment = [
    'TÒA ÁN NHÂN DÂN QUẬN 3 - THÀNH PHỐ HỒ CHÍ MINH',
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'Độc lập - Tự do - Hạnh phúc',
    'BẢN ÁN DÂN SỰ SƠ THẨM SỐ 18/2026/DS-ST NGÀY 10/06/2026',
    'Về việc: Tranh chấp hợp đồng thuê mặt bằng kinh doanh và bồi thường thiệt hại.',
    'NỘI DUNG VỤ ÁN:',
    'Nguyên đơn là bà Lê Hoàng Yến khởi kiện yêu cầu Công ty TNHH Thương mại Minh Phát hoàn trả 120.000.000 đồng tiền đặt cọc thuê mặt bằng; đồng thời bồi thường 30.000.000 đồng chi phí cải tạo.',
    'Bị đơn là Công ty TNHH Thương mại Minh Phát không đồng ý trả lại tiền cọc và cho rằng bà Yến tự ý chấm dứt hợp đồng trước thời hạn.',
    'Ngày 05/01/2026, hai bên ký Hợp đồng thuê mặt bằng số 05/HĐMB-2026 tại Quận 3, thời hạn thuê 24 tháng, tiền đặt cọc 120.000.000 đồng đã chuyển khoản qua ngân hàng.',
    'Ngày 18/03/2026, hệ thống cấp thoát nước tại mặt bằng bị sự cố ngập úng nghiêm trọng, bà Yến lập Biên bản hiện trạng sự cố ngập úng có xác nhận của Tổ trưởng dân phố.',
    'Ngày 02/04/2026, do mặt bằng vẫn không thể kinh doanh, bà Lê Hoàng Yến gửi Thông báo chấm dứt hợp đồng thuê mặt bằng.',
    'QUYẾT ĐỊNH:',
    'Chấp nhận một phần yêu cầu khởi kiện của nguyên đơn bà Lê Hoàng Yến, buộc Công ty Minh Phát trả lại 120.000.000 đồng.',
  ].join('\n');

  // 0. Kiểm thử tách phần QUYẾT ĐỊNH và trích xuất tệp .docx / .html
  const segmented = segmentVietnameseJudgment(realVietnameseJudgment);
  assert.doesNotMatch(segmented.bodyWithoutVerdict, /Chấp nhận một phần yêu cầu khởi kiện/);
  assert.match(segmented.verdictSection, /QUYẾT ĐỊNH:/);

  const docxBuffer = buildMinimalDocxBuffer(realVietnameseJudgment);
  const extractedDocxText = await extractTextFromUploadedDocument({
    fileName: 'BanAn18_2026.docx',
    fileBase64: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuffer.toString('base64')}`,
  });
  assert.match(extractedDocxText, /Tranh chấp hợp đồng thuê mặt bằng kinh doanh/);

  // 1. Kiểm thử với AI trả về bản nháp (có cả trích đoạn lệch hoặc phân loại recorded_event chứa từ "cho rằng" cần tự động sửa)
  const structuredWithAi = await extractAndStructureUserCase(
    { rawText: realVietnameseJudgment },
    {
      complete: async () =>
        JSON.stringify({
          title: 'Vụ án tranh chấp hợp đồng thuê mặt bằng giữa bà Lê Hoàng Yến và Công ty Minh Phát',
          category: 'dân sự',
          reference_date: '2026-04-02',
          summary: 'Tranh chấp tiền đặt cọc 120.000.000 đồng và chi phí sửa chữa mặt bằng do sự cố ngập úng.',
          parties: [
            { side: 'plaintiff', name: 'Bà Lê Hoàng Yến', claims: ['Yêu cầu hoàn trả 120.000.000 đồng tiền đặt cọc'] },
            { side: 'defendant', name: 'Công ty TNHH Thương mại Minh Phát', claims: ['Từ chối hoàn trả tiền cọc do chấm dứt trước hạn'] },
          ],
          timeline: [
            {
              kind: 'transaction',
              date: '2026-01-05',
              description: 'Ký hợp đồng thuê mặt bằng số 05/HĐMB-2026',
              source_quote: 'Hai bên ký Hợp đồng thuê mặt bằng số 05/HĐMB-2026 ngày 05/01/2026.',
            },
          ],
          case_facts: [
            {
              kind: 'recorded_event',
              quote: 'Công ty TNHH Thương mại Minh Phát cho rằng bà Yến tự ý chấm dứt hợp đồng trước thời hạn.',
            },
          ],
          evidence_inventory: [
            {
              name: 'Hợp đồng thuê mặt bằng số 05/HĐMB-2026',
              date: '2026-01-05',
              provided_by: 'Bà Lê Hoàng Yến',
              summary: 'Ghi nhận thỏa thuận thuê 24 tháng và tiền đặt cọc 120.000.000 đồng.',
            },
          ],
        }),
    }
  );

  validateTimeline(structuredWithAi.timeline);
  validateCaseDetails(structuredWithAi);
  validateCaseFacts(structuredWithAi);
  const caseDocAi = new Case(structuredWithAi);
  await caseDocAi.validate();
  assert.equal(structuredWithAi.case_facts[0].kind, 'party_statement', 'Câu có từ "cho rằng" phải tự động chuyển thành party_statement');
  assert.ok(structuredWithAi.full_document.includes(structuredWithAi.timeline[0].source_quote));
  assert.doesNotMatch(structuredWithAi.summary, /;/);

  // 2. Kiểm thử chế độ NLP dự phòng trực tiếp từ tệp .docx khi AI không phản hồi
  const structuredFallback = await extractAndStructureUserCase(
    {
      fileName: 'BanAn18_2026.docx',
      fileBase64: docxBuffer.toString('base64'),
    },
    { complete: async () => { throw new Error('AI offline'); } }
  );
  validateTimeline(structuredFallback.timeline);
  validateCaseDetails(structuredFallback);
  validateCaseFacts(structuredFallback);
  const caseDocFallback = new Case(structuredFallback);
  await caseDocFallback.validate();
  assert.equal(structuredFallback.category, 'dân sự');
  // Tên vụ án tự động bỏ qua quốc hiệu/tiêu ngữ và lấy đúng quan hệ tranh chấp + tên các bên
  assert.match(structuredFallback.title, /Vụ án tranh chấp hợp đồng thuê mặt bằng kinh doanh/i);
  assert.doesNotMatch(structuredFallback.title, /CỘNG HÒA XÃ HỘI/i);
  // Không lộ phán quyết thắng thua trong phần tóm tắt
  assert.doesNotMatch(structuredFallback.summary, /Chấp nhận một phần yêu cầu khởi kiện/);
  // Tự động bóc tách được các bút lục chứng cứ thực tế được nhắc trong bản án (Hợp đồng, Biên bản, Thông báo)
  assert.ok(structuredFallback.evidence_inventory.length >= 3);
  assert.ok(structuredFallback.evidence_inventory.some((e) => /Hợp đồng thuê mặt bằng/i.test(e.name)));
  assert.ok(structuredFallback.evidence_inventory.some((e) => /Biên bản hiện trạng/i.test(e.name)));
  assert.equal(caseIntroduction(structuredFallback).developments.length, 4);
});
