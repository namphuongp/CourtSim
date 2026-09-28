import { Router } from 'express';
import { Case, CourtRecord, SimulationSession, TrialResult } from '../models/index.js';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { evaluateSession, generateDebateTurn } from '../services/simulationService.js';
import { getLegalCoverageWarnings, isValidDateOnly } from '../services/legalRetrievalService.js';

const router = Router();
const allowedRoles = ['defense_lawyer', 'plaintiff_lawyer'];
const allowedDifficulties = ['beginner', 'balanced', 'advanced'];
router.use(authenticate);

async function getOwnedSession(sessionId, userId) {
  const session = await SimulationSession.findOne({ _id: sessionId, user_id: userId });
  if (!session) throw new AppError('Không tìm thấy phiên mô phỏng.', 404, 'SESSION_NOT_FOUND');
  return session;
}

router.post('/', asyncHandler(async (request, response) => {
  const caseId = request.body?.case_id;
  const role = request.body?.user_court_role;
  const difficulty = request.body?.difficulty ?? 'balanced';
  const eventDate = request.body?.case_event_date;
  if (typeof caseId !== 'string' || !allowedRoles.includes(role) || !allowedDifficulties.includes(difficulty) || !isValidDateOnly(eventDate)) {
    throw new AppError('case_id, user_court_role, difficulty hợp lệ và case_event_date theo YYYY-MM-DD là bắt buộc.');
  }
  const courtCase = await Case.findById(caseId).lean();
  if (!courtCase) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');

  const session = await SimulationSession.create({
    user_id: request.auth.userId,
    case_id: caseId,
    user_court_role: role,
    difficulty,
    case_event_date: eventDate,
  });
  const opening = await CourtRecord.create({
    session_id: session._id,
    sender_type: 'ai_judge',
    sender_name: 'Thẩm phán AI',
    content: `Phiên tòa mô phỏng “${courtCase.title}” bắt đầu. Mời luật sư trình bày luận điểm mở đầu, yêu cầu bảo vệ và căn cứ từ hồ sơ.`,
  });
  response.status(201).json({ data: { session, opening } });
}));

router.get('/', asyncHandler(async (request, response) => {
  const sessions = await SimulationSession.find({ user_id: request.auth.userId }).sort({ created_at: -1 }).populate('case_id', 'title category').lean();
  response.json({ data: sessions });
}));

router.get('/:sessionId', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  await session.populate('case_id');
  const legalCoverageWarnings = await getLegalCoverageWarnings(session.case_event_date);
  response.json({ data: { ...session.toObject(), legal_coverage_warnings: legalCoverageWarnings } });
}));

router.get('/:sessionId/records', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const records = await CourtRecord.find({ session_id: session._id }).sort({ created_at: 1 }).lean();
  response.json({ data: records });
}));

router.post('/:sessionId/messages', asyncHandler(async (request, response) => {
  const content = request.body?.content?.trim();
  if (!content || content.length < 10 || content.length > 4_000) throw new AppError('Lập luận phải có từ 10 đến 4.000 ký tự.');
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  if (session.status !== 'ongoing') throw new AppError('Phiên mô phỏng đã kết thúc.', 409, 'SESSION_COMPLETED');
  const courtCase = await Case.findById(session.case_id).lean();

  const history = await CourtRecord.find({ session_id: session._id }).sort({ created_at: 1 }).lean();
  // Chỉ ghi DB khi AI phản hồi thành công, tránh tạo lượt tranh luận dở dang.
  const aiMessages = await generateDebateTurn({
    session,
    courtCase,
    records: [...history, { sender_name: 'Luật sư', content }],
  });
  const userRecord = await CourtRecord.create({ session_id: session._id, sender_type: 'user', sender_name: 'Luật sư', content });
  const createdAiMessages = await CourtRecord.insertMany(aiMessages.map((message) => ({ ...message, session_id: session._id })));
  session.turn_count += 1;
  await session.save();
  response.status(201).json({ data: [userRecord, ...createdAiMessages] });
}));

router.post('/:sessionId/complete', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  if (session.status === 'completed') {
    const existing = await TrialResult.findOne({ session_id: session._id }).lean();
    return response.json({ data: existing });
  }
  if (session.turn_count < 1) throw new AppError('Cần ít nhất một lượt tranh luận trước khi kết thúc phiên.');
  const [courtCase, records] = await Promise.all([
    Case.findById(session.case_id).lean(),
    CourtRecord.find({ session_id: session._id }).sort({ created_at: 1 }).lean(),
  ]);
  const result = await evaluateSession({ session, courtCase, records });
  session.status = 'completed';
  session.completed_at = new Date();
  await session.save();
  response.json({ data: result });
}));

router.get('/:sessionId/result', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const result = await TrialResult.findOne({ session_id: session._id }).lean();
  if (!result) throw new AppError('Phiên chưa có kết quả.', 404, 'RESULT_NOT_FOUND');
  response.json({ data: result });
}));

export default router;
