import LegalAssistantExchange from '../models/LegalAssistantExchange.js';
import { askLegalAssistant, publicAssistantExchange, validateLegalReferences } from '../services/legalAssistantService.js';
import { validateEvidenceReferences } from '../services/caseEvidence.js';
import { learnerCase, learnerRecord, learnerEvaluation, learnerResearch } from '../services/learnerPresentation.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import { Case, SimulationSession, TrialResult } from '../models/index.js';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { evaluateSession, generateDebateTurn } from '../services/simulationService.js';
import { isValidDateOnly } from '../services/legalRetrievalService.js';
import { MAX_TURNS, getRecords, publicSession, readRequestId, replayTurn, withSessionLock } from '../services/sessionStore.js';
import { researchLegalBasis } from '../services/legalResearchService.js';

const router = Router();
const allowedRoles = ['defense_lawyer', 'plaintiff_lawyer'];
const allowedDifficulties = ['beginner', 'balanced', 'advanced'];
router.use(authenticate);

async function getOwnedSession(sessionId, userId) {
  if (!mongoose.isObjectIdOrHexString(sessionId)) throw new AppError('Mã phiên không hợp lệ.', 400);
  const session = await SimulationSession.findOne({ _id: sessionId, user_id: userId });
  if (!session) throw new AppError('Không tìm thấy phiên mô phỏng.', 404, 'SESSION_NOT_FOUND');
  return session;
}

async function getCase(session) {
  const courtCase = session.case_snapshot ?? await Case.findById(session.case_id).lean();
  if (!courtCase) throw new AppError('Hồ sơ của phiên này không còn tồn tại.', 409, 'CASE_UNAVAILABLE');
  return courtCase;
}

function record(sessionId, value) {
  return { ...value, _id: new mongoose.Types.ObjectId(), session_id: sessionId, created_at: new Date() };
}

router.post('/', asyncHandler(async (request, response) => {
  const { case_id: caseId, user_court_role: role, difficulty = 'balanced', case_event_date: eventDate } = request.body ?? {};
  const requestId = readRequestId(request.body?.request_id);
  if (!mongoose.isObjectIdOrHexString(caseId) || !allowedRoles.includes(role) || !allowedDifficulties.includes(difficulty) || !isValidDateOnly(eventDate)) {
    throw new AppError('Vui lòng kiểm tra hồ sơ, vai luật sư và ngày sự kiện.');
  }
  const filter = { user_id: request.auth.userId, creation_request_id: requestId };
  let session = await SimulationSession.findOne(filter);
  if (!session) {
    const courtCase = await Case.findById(caseId).lean();
    if (!courtCase) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');
    if (courtCase.reference_date && eventDate !== courtCase.reference_date) {
      throw new AppError(`Hồ sơ lịch sử này dùng mốc tra cứu cố định ${courtCase.reference_date}.`, 400, 'CASE_DATE_MISMATCH');
    }
    const id = new mongoose.Types.ObjectId();
    const opening = record(id, {
      sender_type: 'ai_judge', sender_name: 'Chủ tọa',
      content: `Phiên mô phỏng “${courtCase.title}” bắt đầu. Bạn bảo vệ phía ${/hình sự/iu.test(courtCase.category) ? (role === 'defense_lawyer' ? 'bị cáo' : 'người bị hại') : (role === 'defense_lawyer' ? 'bị đơn' : 'nguyên đơn')}. Mời trình bày yêu cầu, luận điểm mở đầu và chứng cứ có trong hồ sơ.`,
    });
    try {
      session = await SimulationSession.create({ ...filter, _id: id, case_id: caseId, case_snapshot: courtCase,
        user_court_role: role, difficulty, case_event_date: eventDate, opening });
    } catch (error) {
      if (error.code !== 11000) throw error;
      session = await SimulationSession.findOne(filter);
    }
  }
  if (String(session.case_id) !== caseId || session.user_court_role !== role || session.difficulty !== difficulty || session.case_event_date !== eventDate) {
    throw new AppError('Thiết lập phiên đã thay đổi. Hãy chọn lại vụ án hoặc vai rồi thử lại.', 409, 'REQUEST_CONFLICT');
  }
  response.status(201).json({ data: { session: publicSession(session), opening: learnerRecord(session.opening, session.case_snapshot ?? {}) } });
}));

router.get('/', asyncHandler(async (request, response) => {
  const sessions = await SimulationSession.find({ user_id: request.auth.userId })
    .select('-turns -opening -case_snapshot -evaluation.feedback -evaluation.fact_analysis -evaluation.citations -evaluation.rubric_feedback -evaluation.criteria -evaluation.legal_research -evaluation.citation_warnings -evaluation.improvement_suggestions')
    .sort({ created_at: -1 }).populate('case_id', 'title category').lean();
  const legacyResults = await TrialResult.find({ session_id: { $in: sessions.filter((s) => !s.evaluation).map((s) => s._id) } }).select('session_id score rubric_scores').lean();
  const bySession = new Map(legacyResults.map((result) => [String(result.session_id), result]));
  response.json({ data: sessions.map((session) => {
    const result = session.evaluation ?? bySession.get(String(session._id));
    return { ...publicSession(session), result: result ? { score: result.score, rubric_scores: result.rubric_scores, rubric_version: result.rubric_version, assessed_max: result.assessed_max, score_scope: result.score_scope } : null };
  }) });
}));

router.get('/:sessionId', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = session.case_snapshot ?? await Case.findById(session.case_id).lean()
    ?? { title: 'Hồ sơ không còn trong thư viện', full_document: 'Không thể tải hồ sơ gốc. Biên bản đã lưu vẫn có thể xem lại.' };
  response.json({ data: { ...publicSession(session), case_id: learnerCase(courtCase) } });
}));

router.patch('/:sessionId', asyncHandler(async (request, response) => {
  const eventDate = request.body?.case_event_date;
  if (!isValidDateOnly(eventDate)) throw new AppError('Ngày tra cứu không hợp lệ.');
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  await withSessionLock(session, async (locked, fence) => {
    if (locked.status !== 'ongoing' || locked.case_event_date) throw new AppError('Chỉ bổ sung ngày cho phiên cũ đang học và chưa có ngày tra cứu.', 409, 'SESSION_DATE_LOCKED');
    const saved = await SimulationSession.updateOne(fence, { $set: { case_event_date: eventDate } });
    if (!saved.matchedCount) throw new AppError('Phiên đã thay đổi. Vui lòng tải lại.', 409);
  });
  response.json({ data: { case_event_date: eventDate } });
}));

router.get('/:sessionId/records', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = session.case_snapshot ?? await Case.findById(session.case_id).lean() ?? {};
  response.json({ data: (await getRecords(session)).map((r) => learnerRecord(r, courtCase)) });
}));

router.get('/:sessionId/legal-basis', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = await getCase(session);
  response.json({ data: learnerResearch(await researchLegalBasis({ courtCase, eventDate: session.case_event_date, records: await getRecords(session) })) });
}));

router.get('/:sessionId/assistant', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const items = await LegalAssistantExchange.find({ session_id: session._id, user_id: session.user_id }).sort({ created_at: 1 }).limit(40).lean();
  response.json({ data: items.map(publicAssistantExchange) });
}));

router.post('/:sessionId/assistant', asyncHandler(async (request, response) => {
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  if (question.length < 5 || question.length > 1500) throw new AppError('Câu hỏi cần từ 5 đến 1.500 ký tự.');
  const requestId = readRequestId(request.body?.request_id);
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = await getCase(session);
  response.json({ data: await askLegalAssistant({ session, courtCase, question, requestId }) });
}));

router.post('/:sessionId/messages', asyncHandler(async (request, response) => {
  const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';
  if (content.length < 10 || content.length > 4_000) throw new AppError('Lập luận phải có từ 10 đến 4.000 ký tự.');
  const requestId = readRequestId(request.body?.request_id);
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const caseForReferences = await getCase(session);
  const evidenceIds = validateEvidenceReferences(caseForReferences, content, request.body.evidence_ids);
  const legalCitations = await validateLegalReferences(session, content, request.body.legal_reference_ids);
  const replay = replayTurn(session, requestId, content);
  if (replay) return response.json({ data: replay.map((r) => learnerRecord(r, caseForReferences)) });
  const records = await withSessionLock(session, async (locked, fence) => {
    const existing = replayTurn(locked, requestId, content);
    if (existing) return existing;
    if (locked.status !== 'ongoing') throw new AppError('Phiên đã kết thúc. Bạn có thể xem lại biên bản và kết quả.', 409, 'SESSION_COMPLETED');
    if (request.body.expected_turn_count !== undefined && request.body.expected_turn_count !== locked.turn_count) {
      throw new AppError('Phiên đã có lượt mới ở cửa sổ khác. Hãy xem lại biên bản trước khi gửi.', 409, 'STALE_TURN');
    }
    if (locked.turn_count >= MAX_TURNS) throw new AppError(`Phiên đã đủ ${MAX_TURNS} lượt. Hãy kết thúc để nhận đánh giá.`, 409, 'TURN_LIMIT');
    const courtCase = await getCase(locked);
    const history = await getRecords(locked);
    const userRecord = record(locked._id, { sender_type: 'user', sender_name: 'Luật sư (người học)', content, request_id: requestId, evidence_ids: evidenceIds, legal_reference_ids: legalCitations.map((c) => c.reference_id), citations: legalCitations });
    const generated = await generateDebateTurn({ session: locked, courtCase, records: [...history, userRecord] });
    const completeTurn = [userRecord, ...generated.map((message) => record(locked._id, message))];
    const saved = await SimulationSession.updateOne(fence, {
      $push: { turns: { request_id: requestId, records: completeTurn } }, $inc: { turn_count: 1 },
    });
    if (!saved.matchedCount) throw new AppError('Yêu cầu đã hết thời gian xử lý. Vui lòng tải lại phiên.', 409, 'SESSION_LOCK_EXPIRED');
    return completeTurn;
  });
  response.status(201).json({ data: records.map((r) => learnerRecord(r, caseForReferences)) });
}));

router.post('/:sessionId/complete', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const result = await withSessionLock(session, async (locked, fence) => {
    if (locked.evaluation) return locked.evaluation;
    if (locked.status === 'completed') {
      const existing = await TrialResult.findOne({ session_id: locked._id }).lean();
      if (!existing) throw new AppError('Chưa tải được kết quả của phiên này. Vui lòng thử lại sau.', 409, 'RESULT_UNAVAILABLE');
      return existing;
    }
    if (locked.turn_count < 1) throw new AppError('Cần ít nhất một lượt tranh luận trước khi kết thúc phiên.');
    const [courtCase, records] = await Promise.all([getCase(locked), getRecords(locked)]);
    const evaluation = await evaluateSession({ session: locked, courtCase, records });
    const result = { ...evaluation, session_id: locked._id, created_at: new Date() };
    const saved = await SimulationSession.updateOne(fence, { $set: { evaluation: result, status: 'completed', completed_at: new Date() } });
    if (!saved.matchedCount) throw new AppError('Yêu cầu đã hết thời gian xử lý. Vui lòng tải lại phiên.', 409, 'SESSION_LOCK_EXPIRED');
    return result;
  });
  response.json({ data: learnerEvaluation(result, session.case_snapshot ?? await Case.findById(session.case_id).lean() ?? {}) });
}));

router.get('/:sessionId/result', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const result = session.evaluation ?? await TrialResult.findOne({ session_id: session._id }).lean();
  if (!result) throw new AppError('Phiên chưa có kết quả. Hãy trở lại phiên và chọn Kết thúc.', 404, 'RESULT_NOT_FOUND');
  response.json({ data: learnerEvaluation(result) });
}));

export default router;
