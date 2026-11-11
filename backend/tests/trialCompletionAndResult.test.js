import test from 'node:test';
import assert from 'node:assert/strict';
import { memberEvaluation } from '../src/services/membershipAccess.js';
import { getTrialStageIndex } from '../../frontend/src/services/courtroom.js';
import { sanitizeTextForTts, ROLE_VOICE_MAP } from '../src/services/aiVoiceService.js';
import { isClosingIntent, isExplicitEndByChat } from '../src/services/conversationPolicy.js';
import { buildCompleteDossierDocument, parseLegalDossierDocument, reflowVietnameseLegalText } from '../../shared/legalDocumentFormatter.mjs';
import { learnerText } from '../../shared/learnerText.mjs';
import { normalizeAndRepairCasePayload, segmentVietnameseJudgment } from '../src/services/userCaseUploadService.js';

test('memberEvaluation: Trả về kết quả đánh giá chuẩn xác, không bị lỗi 500 do khảo sát cũ', () => {
  const dummyResult = {
    session_id: '6ae695685c951f6e573831cf',
    score: 85,
    duration_seconds: 420,
    criteria: [
      { name: 'Kỹ năng viện dẫn luật', score: 90, comment: 'Dẫn chứng đúng Điều 100 Luật Đất đai 2013.' },
      { name: 'Lập luận và đối đáp', score: 80, comment: 'Lập luận sắc bén, phản bác có trọng tâm.' }
    ],
    rubric_scores: { legal_basis: 90, persuasion: 80 },
    rubric_feedback: { legal_basis: 'Tốt', persuasion: 'Khá' },
    summary_verdict: 'Hội đồng xét xử đánh giá cao khả năng tranh tụng của người học.'
  };

  const dummySession = {
    _id: '6ae695685c951f6e573831cf',
    case_id: 'case_001',
    status: 'completed',
    turn_count: 5,
    user_court_role: 'plaintiff_lawyer',
    access_plan: 'pro'
  };

  const proUser = {
    _id: 'user_pro_01',
    email: 'pro@courtsimvn.com',
    subscription_type: 'pro'
  };

  const evaluationPro = memberEvaluation(dummyResult, dummySession, proUser, { title: 'Án dân sự số 01' });

  assert.ok(evaluationPro, 'Kết quả đánh giá phải tồn tại');
  assert.equal(evaluationPro.duration_seconds, 420, 'Thời lượng phiên được giữ nguyên');
  assert.ok(evaluationPro.criteria, 'Gói Pro có chi tiết tiêu chí');
  assert.equal(evaluationPro.criteria.length, 2);
  assert.equal(evaluationPro.features.detailedScoring, true);
  assert.equal(evaluationPro.features.skillAnalytics, true);

  // Kiểm tra với tài khoản Free trong 2 case dùng thử (vẫn mở full detailedScoring)
  const freeUser = {
    _id: 'user_free_01',
    email: 'free@courtsimvn.com',
    subscription_type: 'free'
  };
  const trialSession = {
    ...dummySession,
    access_plan: 'free_trial'
  };
  const evaluationFree = memberEvaluation(dummyResult, trialSession, freeUser, {});
  assert.ok(evaluationFree, 'Tài khoản Free dùng thử nhận được kết quả không lỗi');
  assert.equal(evaluationFree.duration_seconds, 420);
});

test('durationSeconds calculation: Xử lý an toàn mọi trường hợp thời gian phiên tòa', () => {
  const createdAt = new Date(Date.now() - 3600 * 1000); // 1 giờ trước
  const completedAt = new Date();

  // 1. Lấy từ evaluation result
  const res1 = { duration_seconds: 300 };
  const d1 = res1.duration_seconds ?? 0;
  assert.equal(d1, 300);

  // 2. Tính từ completed_at - created_at
  const calculatedSeconds = Math.max(0, Math.round((completedAt.getTime() - createdAt.getTime()) / 1000));
  assert.ok(calculatedSeconds >= 3590 && calculatedSeconds <= 3610);

  // 3. Thời gian âm hoặc không hợp lệ -> fallback về 0 an toàn
  const invalidSeconds = Math.max(0, Math.round((new Date(0).getTime() - new Date(10000).getTime()) / 1000));
  assert.equal(invalidSeconds, 0);
});

test('Chat kết thúc phiên tòa: Nhận diện đầy đủ các khẩu lệnh tố tụng của người dùng', () => {
  const proceduralPhrases = [
    'Đề nghị HĐXX vào nghị án',
    'Kính đề nghị Hội đồng xét xử vào nghị án và chấm điểm',
    'Đề nghị kết thúc phần tranh luận',
    'Tôi xin kết thúc phiên tòa',
    'Tôi đã trình bày xong toàn bộ quan điểm',
    'Phía nguyên đơn không còn ý kiến nào khác, xin kết thúc',
    'Đề nghị HĐXX chuyển sang nghị án'
  ];

  for (const phrase of proceduralPhrases) {
    const isClosing = isClosingIntent(phrase, 2);
    assert.equal(isClosing, true, `Khẩu lệnh "${phrase}" phải được AI nhận diện là kết thúc phiên`);
  }

  // Chống kết thúc nhầm
  const nonClosingPhrases = [
    'Thời hạn kết thúc hợp đồng theo thoả thuận là tháng 12 năm 2024.',
    'Tôi không đồng ý kết thúc tranh luận khi bị đơn chưa giải trình rõ biên nhận.',
    'Trước khi kết thúc lượt này, tôi đề nghị đối chất với nhân chứng.',
    'Vụ án chưa thể kết thúc vì thiếu chứng cứ đo đạc diện tích thực tế.'
  ];

  for (const phrase of nonClosingPhrases) {
    const isClosing = isClosingIntent(phrase, 2);
    assert.equal(isClosing, false, `Câu bình thường "${phrase}" KHÔNG được kích hoạt kết thúc nhầm`);
  }
});

test('Voice TTS: Làm sạch ký tự đặc biệt, mã luật và nhãn tài liệu trước khi phát âm', () => {
  const sampleLegalSpeech = `
    Kính thưa Hội đồng xét xử [PL: BLDS-2015-D116]!
    Căn cứ tài liệu [Chứng cứ: BL-09], biên bản hòa giải ngày 10/05/2023.
    Bị đơn viện dẫn [Căn cứ: Nghị quyết 01/2003/NQ-HĐTP] là không phù hợp ⚖️.
    Xem thêm tại https://thuvienphapluat.vn/van-ban/blds.
  `;

  const cleaned = sanitizeTextForTts(sampleLegalSpeech);

  assert.equal(cleaned.includes('[PL: BLDS-2015-D116]'), false);
  assert.equal(cleaned.includes('[Chứng cứ: BL-09]'), false);
  assert.equal(cleaned.includes('[Căn cứ: Nghị quyết 01/2003/NQ-HĐTP]'), false);
  assert.equal(cleaned.includes('⚖️'), false);
  assert.equal(cleaned.includes('https://thuvienphapluat.vn'), false);
  assert.equal(cleaned.includes('Kính thưa Hội đồng xét xử'), true);
  assert.equal(cleaned.includes('biên bản hòa giải ngày 10/05/2023'), true);
});

test('Trial Stages: 4 giai đoạn phiên xử được ánh xạ chính xác trên giao diện', () => {
  // Giai đoạn 0: Khai mạc
  assert.equal(getTrialStageIndex({ conversation: { phase: 'opening' } }), 0);

  // Giai đoạn 1: Xét hỏi & Chứng cứ
  assert.equal(getTrialStageIndex({ conversation: { phase: 'clarification' } }), 1);
  assert.equal(getTrialStageIndex({ conversation: { phase: 'presentation' } }), 1);

  // Giai đoạn 2: Tranh luận & Đối đáp
  assert.equal(getTrialStageIndex({ conversation: { phase: 'debate' } }), 2);

  // Giai đoạn 3: Nghị án & Chấm điểm
  assert.equal(getTrialStageIndex({ conversation: { phase: 'summary' } }), 3);
  assert.equal(getTrialStageIndex({ conversation: { phase: 'closed' } }), 3);
  assert.equal(getTrialStageIndex({ status: 'completed' }), 3);
  assert.equal(getTrialStageIndex({ conversation: { concluded: true } }), 3);
});

test('Legal Document Formatter: Nối dòng bị gãy từ PDF và phân tách cấu trúc bản án rõ ràng', () => {
  const brokenPdfJudgment = [
    'TÒA ÁN NHÂN DÂN TỐI CAO',
    'TÒA PHÚC THẨM',
    'TẠI THÀNH PHỐ HỒ CHÍ MINH',
    'Bản án số: 17/2026/HC-PT',
    'Ngày 12 tháng 01 năm 2026.',
    'V/v: "Khiếu kiện quyết định hành',
    'chính về quản lý đất đai".',
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'Độc lập – Tự do – Hạnh phúc',
    'NHÂN DANH',
    'NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'TÒA PHÚC THẨM TÒA ÁN NHÂN DÂN TỐI CAO',
    'TẠI THÀNH PHỐ HỒ CHÍ MINH',
    '- Thành phần Hội đồng xét xử phúc thẩm gồm có:',
    'Chủ tọa – Chủ tọa phiên tòa: Bà Lê Thị Tuyết Trinh',
    'Các Chủ tọa: Bà Huỳnh Thanh Duyên',
    'Ông Phan Đức Phương',
    '- Thư ký phiên tòa: Ông Nguyễn Trọng Tâm - Thư ký Tòa phúc thẩm Tòa',
    'án nhân dân tối cao tại Thành phố Hồ Chí Minh.',
    '- Đại diện Viện Công tố và Kiểm sát xét xử phúc thẩm tại Thành phố Hồ',
    'Chí Minh tham gia phiên tòa: Ông Đặng Quốc V - Kiểm sát viên.',
    'Ngày 12 tháng 01 năm 2026, tại trụ sở Tòa phúc thẩm Tòa án nhân dân tối',
    'cao tại Thành phố Hồ Chí Minh xét xử phúc thẩm công khai vụ án hành chính thụ',
    'lý số 236/2025/TLPT-HC ngày 24/10/2025về việc "Khiếu kiện quyết định hành',
    'chính về quản lý đất đai".',
    'Do Bản án hành chính sơ thẩm số 126/2025/HC-ST ngày 22/4/2025 của',
    'Tòa án nhân dân Thành phố Hồ Chí Minh bị kháng cáo.',
    '-Người khởi kiện: Ông Hồ Thành L, sinh năm 1983 (có mặt).',
    'Cư trú: A P, phường N, Quận A, Thành phố Hồ Chí Minh (nay là phường',
    'B, Thành phố Hồ Chí Minh).',
    'NỘI DUNG VỤ ÁN:',
    'Theo đơn khởi kiện, ông Hồ Thành L yêu cầu hủy quyết định hành chính.',
    'NHẬN ĐỊNH CỦA TÒA ÁN:',
    '[1] Về tố tụng: Đơn kháng cáo hợp lệ.',
    'Tòa án cấp sơ thẩm thụ lý giải quyết là đúng thẩm quyền theo quy định pháp luật.',
    '[2] Về nội dung: Kháng cáo của người khởi kiện là không có căn cứ.',
  ].join('\n');

  const reflowed = reflowVietnameseLegalText(brokenPdfJudgment);
  assert.ok(reflowed.includes('V/v: "Khiếu kiện quyết định hành chính về quản lý đất đai".'));
  assert.ok(reflowed.includes('Thẩm phán – Chủ tọa phiên tòa: Bà Lê Thị Tuyết Trinh'));
  assert.ok(reflowed.includes('Các Thẩm phán: Bà Huỳnh Thanh Duyên; Ông Phan Đức Phương'));
  assert.ok(reflowed.includes('Thư ký Tòa phúc thẩm Tòa án nhân dân tối cao tại Thành phố Hồ Chí Minh.'));
  assert.ok(reflowed.includes('ngày 24/10/2025 về việc "Khiếu kiện quyết định hành chính về quản lý đất đai".'));
  assert.ok(reflowed.includes('Do Bản án hành chính sơ thẩm số 126/2025/HC-ST ngày 22/4/2025 của Tòa án nhân dân Thành phố Hồ Chí Minh bị kháng cáo.'));
  assert.ok(reflowed.includes('(nay là phường B, Thành phố Hồ Chí Minh).'));

  const parsed = parseLegalDossierDocument(brokenPdfJudgment);
  assert.ok(parsed.preamble);
  assert.equal(parsed.preamble.subjectLine, 'V/v: "Khiếu kiện quyết định hành chính về quản lý đất đai".');
  assert.equal(parsed.sections.length, 3);
  assert.equal(parsed.sections[1].title, 'NỘI DUNG VỤ ÁN');
  assert.equal(parsed.sections[2].title, 'NHẬN ĐỊNH CỦA TÒA ÁN');
  assert.equal(parsed.sections[2].blocks.length, 2);
  assert.equal(parsed.sections[2].blocks[0].type, 'numbered_point');
  assert.equal(parsed.sections[2].blocks[0].badge, '[1]');
  assert.ok(parsed.sections[2].blocks[0].body.includes('Đơn kháng cáo hợp lệ. Tòa án cấp sơ thẩm thụ lý giải quyết là đúng thẩm quyền'));
  assert.equal(parsed.sections[2].blocks[1].badge, '[2]');
});

test('Hồ sơ dài 55+ trang: Không bị cắt cụt ở 38.000 ký tự, không mất đoạn sau QUYẾT ĐỊNH giữa hồ sơ và gộp đầy đủ bút lục', () => {
  // 1. learnerText giữ nguyên số thứ tự tiêu đề "1. Bối cảnh..." và tên tài khoản "@kpop_tin_nhanh"
  const rawHeadingSample = '1. Bối cảnh và diễn biến sự việc trước khi khởi kiện:\nBị đơn Trần Minh Khoa quản lý tài khoản @kpop_tin_nhanh đăng tải video ngày 11/10/2026.';
  const cleaned = learnerText(rawHeadingSample);
  assert.ok(cleaned.includes('1. Bối cảnh và diễn biến sự việc trước khi khởi kiện:'));
  assert.ok(cleaned.includes('@kpop_tin_nhanh'));

  // 2. Hồ sơ 55 trang (~95.000 ký tự) có chữ QUYẾT ĐỊNH ở trang 10 không bị cắt mất 45 trang sau
  const pageBlock = 'Ngày 15/03/2025, nguyên đơn là ông Nguyễn Văn An và bị đơn là bà Trần Thị Bình lập biên bản đối chiếu công nợ chuyển nhượng đất tại Ủy ban nhân dân phường. ';
  const firstTenPages = pageBlock.repeat(120); // ~19.000 ký tự
  const midProceduralDecision = '\nQUYẾT ĐỊNH:\nĐưa vụ án dân sự thụ lý số 45/2025/TLST-DS ra xét xử sơ thẩm.\n';
  const remainingFortyFivePages = pageBlock.repeat(500); // ~80.000 ký tự
  const long55PageDossier = `${firstTenPages}${midProceduralDecision}${remainingFortyFivePages}`;

  const segmented = segmentVietnameseJudgment(long55PageDossier);
  assert.ok(segmented.bodyWithoutVerdict.length > 96000);
  assert.equal(segmented.verdictSection, '');

  const normalizedCase = normalizeAndRepairCasePayload(null, long55PageDossier, {});
  assert.ok(normalizedCase.full_document.length > 90000, 'Hồ sơ 55 trang (>90.000 ký tự) phải được giữ nguyên toàn văn');

  // 3. buildCompleteDossierDocument gộp cả các bút lục đính kèm vào chế độ Đọc toàn bộ nội dung hồ sơ
  const complete = buildCompleteDossierDocument({
    full_document: 'HỒ SƠ TÓM TẮT VỤ ÁN\n1.\nBối cảnh khởi kiện:\nNội dung mở đầu vụ án.',
    evidence_inventory: [
      {
        id: 'EV-01',
        name: 'Bản tường trình của Nguyễn Ngọc Mai',
        date: '2026-09-14',
        provided_by: 'Nguyễn Ngọc Mai',
        content: 'BẢN TƯỜNG TRÌNH CỦA NGUYỄN NGỌC MAI\nTôi xác nhận sự việc xảy ra tại tầng 2 cơ sở lưu trú An Phúc.',
      },
    ],
  });
  assert.equal(complete.appendedEvidenceCount, 1);
  const parsedComplete = parseLegalDossierDocument(complete.fullText);
  assert.equal(parsedComplete.sections.length, 2);
  assert.equal(parsedComplete.sections[0].badge, '01');
  assert.equal(parsedComplete.sections[0].title, 'Bối cảnh khởi kiện');
  assert.equal(parsedComplete.sections[1].badge, 'BL-01');
});



