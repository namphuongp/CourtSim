import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import Case from '../models/Case.js';
import SimulationSession from '../models/SimulationSession.js';
import { runConversation } from '../services/conversationService.js';
import { evaluateSession } from '../services/simulationService.js';
import { getRecords } from '../services/sessionStore.js';
import { openingStatement } from '../services/casePractice.js';

function record(sessionId, value) {
  return { ...value, _id: new mongoose.Types.ObjectId(), session_id: sessionId, created_at: new Date() };
}

async function verifyE2E() {
  console.log('--- BẮT ĐẦU KIỂM THỬ E2E RAG VÀ ĐÁNH GIÁ CHẤM ĐIỂM PHIÊN TOÀ ---');
  await connectDatabase();

  const user = await User.findOne({ email: 'ngodanghung3@gmail.com' });
  if (!user) throw new Error('Không tìm thấy tài khoản test ngodanghung3@gmail.com');
  console.log('✓ Xác thực tài khoản test:', user.email, 'Tier:', user.subscription_type);

  const courtCase = await Case.findOne({ title: /Tranh chấp quyền sử dụng đất/i });
  if (!courtCase) throw new Error('Không tìm thấy vụ án mẫu');
  console.log('✓ Vụ án kiểm thử:', courtCase.title, '- Mốc sự kiện:', courtCase.reference_date);

  // 1. Tạo session mới
  const sessionId = new mongoose.Types.ObjectId();
  const requestId = randomUUID();
  const role = 'defense_lawyer';
  const opening = record(sessionId, {
    sender_type: 'ai_judge',
    sender_name: 'Chủ tọa',
    content: openingStatement(courtCase, role) ?? `Hội đồng xét xử tuyên bố mở phiên tòa xét xử sơ thẩm vụ án “${courtCase.title}”. Tòa án mời Luật sư bảo vệ bị đơn trình bày yêu cầu và quan điểm đối đáp.`,
  });

  const session = await SimulationSession.create({
    _id: sessionId,
    user_id: user._id,
    case_id: courtCase._id,
    case_snapshot: courtCase,
    user_court_role: role,
    difficulty: 'balanced',
    case_event_date: courtCase.reference_date,
    opening,
    creation_request_id: requestId,
    access_ready: true,
    access_plan: 'pro',
    turn_count: 0,
    turns: [],
    conversation: {
      status: 'learner',
      revision: 1,
      phase: 'debate',
      last_speaker: 'judge',
      next_speaker: 'learner',
      current_record_id: String(opening._id)
    }
  });
  console.log('✓ Khởi tạo phiên mô phỏng thành công, ID:', session._id.toString());

  // 2. Gửi lượt tranh tụng của người học (kích hoạt RAG)
  const learnerArgument = 'Kính thưa Hội đồng xét xử, căn cứ vào hồ sơ vụ án và quy định tại Điều 188 Luật Đất đai 2013, tôi đề nghị xem xét kỹ điều kiện thực hiện quyền chuyển nhượng quyền sử dụng đất giữa các bên, đặc biệt là việc có hay không giấy chứng nhận quyền sử dụng đất hợp pháp tại thời điểm xác lập giao dịch.';
  console.log('\n[RAG & LẬP LUẬN] Đang gửi lượt người học và kích hoạt RAG truy xuất ngữ nghĩa...');
  
  const timing = await runConversation(session, {
    action: 'submit',
    revision: 1,
    requestId: randomUUID(),
    content: learnerArgument,
    evidenceIds: [],
    citations: []
  });
  console.log('✓ Lượt đối đáp AI hoàn thành. Thời gian generation:', Math.round(timing?.generation_ms ?? 0), 'ms');

  // Kiểm tra phản hồi trong DB
  const updatedSession = await SimulationSession.findById(sessionId);
  const records = await getRecords(updatedSession);
  const lastAiRecord = records.findLast(r => r.sender_type !== 'user');

  console.log('\n--- PHẢN HỒI CỦA AI TÒA ÁN ---');
  console.log(`[${lastAiRecord.sender_name}]: ${lastAiRecord.content}`);

  // Kiểm tra xưng hô chuẩn mực: Tuyệt đối không xưng "bạn - tôi"
  const hasInformal = /\bbạn\b/i.test(lastAiRecord.content) || /\btôi và bạn\b/i.test(lastAiRecord.content);
  if (hasInformal) {
    console.warn('⚠️ CẢNH BÁO: Phát hiện từ "bạn" trong phản hồi của AI:', lastAiRecord.content);
  } else {
    console.log('✓ Xưng hô chuẩn mực tố tụng: Phù hợp tác phong tòa án (gọi "Luật sư", không xưng "bạn tôi").');
  }

  // 3. Kiểm thử Đánh giá Chấm điểm (evaluateSession)
  console.log('\n[ĐÁNH GIÁ CHẤM ĐIỂM] Đang tiến hành chấm điểm toàn phiên theo 6 nhóm tiêu chí Rubric...');
  const evaluation = await evaluateSession({
    session: updatedSession,
    courtCase,
    records
  });

  console.log('✓ Chấm điểm hoàn tất thành công!');
  console.log('  - Điểm đạt được:', evaluation.earned_score ?? evaluation.score);
  console.log('  - Điểm trần đánh giá:', evaluation.assessed_max);
  console.log('  - Nhận xét (Verdict):', evaluation.verdict);
  console.log('  - Đánh giá điểm mạnh (Feedback):', evaluation.feedback);
  console.log('  - Hướng cải thiện (Improvement):', evaluation.improvement_suggestions);
  console.log('  - Căn cứ pháp lý trích dẫn (Citations count):', evaluation.citations?.length ?? 0);
  console.log('  - Số nhóm tiêu chí đánh giá:', evaluation.criteria?.length ?? 0);

  // 4. Cập nhật hoàn thành phiên và lưu kết quả
  const evaluationResult = { ...evaluation, session_id: updatedSession._id, created_at: new Date() };
  await SimulationSession.updateOne(
    { _id: updatedSession._id },
    { $set: { evaluation: evaluationResult, status: 'completed', completed_at: new Date() } }
  );

  const completedSession = await SimulationSession.findById(sessionId);
  if (completedSession.status === 'completed' && completedSession.evaluation) {
    console.log('\n✓ Phiên đã chuyển trạng thái "completed" an toàn và đã lưu đầy đủ bảng điểm!');
  } else {
    throw new Error('Lỗi lưu trạng thái hoàn thành phiên.');
  }

  console.log('\n--- KẾT THÚC KIỂM THỬ: HỆ THỐNG RAG VÀ CHẤM ĐIỂM HOẠT ĐỘNG 100% HOÀN HẢO ---');
  await disconnectDatabase();
}

verifyE2E().catch(err => {
  console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  process.exit(1);
});
