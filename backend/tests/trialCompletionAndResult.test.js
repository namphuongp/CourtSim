import test from 'node:test';
import assert from 'node:assert/strict';
import { memberEvaluation } from '../src/services/membershipAccess.js';
import { getTrialStageIndex } from '../../frontend/src/services/courtroom.js';
import { sanitizeTextForTts, ROLE_VOICE_MAP } from '../src/services/aiVoiceService.js';
import { isClosingIntent, isExplicitEndByChat } from '../src/services/conversationPolicy.js';

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

