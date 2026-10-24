import { scoreSummary } from '../../../shared/scorePresentation.mjs';
import { skillPresentation } from '../services/skillPresentation.js';
import LegalAssistantExchange from '../models/LegalAssistantExchange.js';
import { askLegalAssistant, publicAssistantExchange, validateLegalReferences } from '../services/legalAssistantService.js';
import { validateEvidenceReferences } from '../services/caseEvidence.js';
import { learnerCase, learnerRecord, learnerResearch } from '../services/learnerPresentation.js';
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
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { runConversation } from '../services/conversationService.js';
import { openingStatement } from '../services/casePractice.js';
import { consumeCaseAccess, finishCaseAllocation } from '../services/paymentAccess.js';
import { requireMemberFeature, requireSessionFeature, memberEvaluation } from '../services/membershipAccess.js';
import { sessionFeatures } from '../../../shared/membershipPolicy.mjs';
import { requireSurvey, surveyVerified } from '../services/surveyVerification.js';

const router = Router();
const allowedRoles = ['defense_lawyer', 'plaintiff_lawyer'];
const allowedDifficulties = ['beginner', 'balanced', 'advanced'];
router.use(authenticate);
router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

async function getOwnedSession(sessionId, userId) {
  if (!mongoose.isObjectIdOrHexString(sessionId)) throw new AppError('Mã phiên không hợp lệ.', 400);
  const session = await SimulationSession.findOne({ _id: sessionId, user_id: userId });
  if (!session) throw new AppError('Không tìm thấy phiên mô phỏng.', 404, 'SESSION_NOT_FOUND');
  if (session.access_ready === false) throw new AppError('Phiên đang được cấp quyền. Hãy thử bắt đầu lại với thiết lập đã chọn.', 409, 'SESSION_ACCESS_PENDING');
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
    await consumeAuthLimit(`session-create:${request.auth.userId}`, 20);
    const courtCase = await Case.findById(caseId).lean();
    if (!courtCase) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');
    if (courtCase.reference_date && eventDate !== courtCase.reference_date) {
      throw new AppError(`Hồ sơ lịch sử này dùng mốc tra cứu cố định ${courtCase.reference_date}.`, 400, 'CASE_DATE_MISMATCH');
    }
    const id = new mongoose.Types.ObjectId();
    const opening = record(id, {
      sender_type: 'ai_judge', sender_name: 'Chủ tọa',
      content: openingStatement(courtCase, role) ?? `Hội đồng xét xử tuyên bố mở phiên tòa xét xử sơ thẩm vụ án “${courtCase.title}”. Luật sư tham gia tố tụng bảo vệ quyền và lợi ích hợp pháp cho phía ${/hình sự/iu.test(courtCase.category) ? (role === 'defense_lawyer' ? 'bị cáo' : 'người bị hại') : (role === 'defense_lawyer' ? 'bị đơn' : 'nguyên đơn')}. Tòa án mời Luật sư trình bày yêu cầu, quan điểm bảo vệ và các tài liệu chứng cứ trong hồ sơ.`,
    });
    try {
      session = await SimulationSession.create({ ...filter, _id: id, case_id: caseId, case_snapshot: courtCase,
        user_court_role: role, difficulty, case_event_date: eventDate, opening, access_ready: false });
    } catch (error) {
      if (error.code === 11000) session = await SimulationSession.findOne(filter);
      else throw error;
    }
  }
  if (!session) throw new AppError('Thiết lập phiên đang thay đổi. Hãy thử lại.', 409, 'SESSION_BUSY');
  if (String(session.case_id) !== caseId || session.user_court_role !== role || session.difficulty !== difficulty || session.case_event_date !== eventDate) {
    throw new AppError('Thiết lập phiên đã thay đổi. Hãy chọn lại vụ án hoặc vai rồi thử lại.', 409, 'REQUEST_CONFLICT');
  }
  if (session.access_ready === false) {
    await withSessionLock(session, async (locked, fence) => {
      if (locked.access_ready !== false) return;
      let access;
      try { access = await consumeCaseAccess(request.auth.userId, request.auth.tier, requestId, request.auth.role); }
      catch (error) {
        if (error.code === 'PAYMENT_REQUIRED') await SimulationSession.deleteOne(fence);
        throw error;
      }
      const saved = await SimulationSession.updateOne(fence, { $set: { access_ready: true, access_plan: access.plan } });
      if (!saved.matchedCount) throw new AppError('Chưa xác nhận được quyền mở phiên. Giữ nguyên thiết lập và thử lại.', 409, 'SESSION_ACCESS_PENDING');
      // Cấp quyền xong mới bỏ bản ghi tạm, không hoàn lượt hoặc trừ thêm khi retry.
      await finishCaseAllocation(request.auth.userId, requestId).catch(() => {});
    }, { leaseMs: 15000 });
    session = await SimulationSession.findOne(filter);
  }
  response.status(201).json({ data: { session: publicSession(session, request.authUser), opening: learnerRecord(session.opening, session.case_snapshot ?? {}) } });
}));

router.get('/', asyncHandler(async (request, response) => {
  if (request.query.include !== undefined && request.query.include !== 'skills') throw new AppError('Tùy chọn dữ liệu không hợp lệ.', 400);
  const includeSkills = request.query.include === 'skills';
  if (includeSkills) requireMemberFeature(request.authUser, 'skillAnalytics');
  const canViewResults = await surveyVerified(request.authUser);
  // Tính từ mốc đã lưu để cả phiên cũ cũng có ngày hoạt động, không tải biên bản về client.
  const sessions = await SimulationSession.aggregate([
    { $match: { user_id: new mongoose.Types.ObjectId(request.auth.userId), access_ready: { $ne: false } } },
    { $set: { updated_at: { $max: ['$created_at', '$updated_at', '$completed_at', '$conversation.started_at',
      { $reduce: { input: { $ifNull: ['$turns', []] }, initialValue: '$created_at', in: { $max: ['$$value',
        { $max: { $map: { input: { $ifNull: ['$$this.records', []] }, as: 'record', in: '$$record.created_at' } } }] } } }] } } },
    { $project: { turns: 0, opening: 0, case_snapshot: 0, 'evaluation.fact_analysis': 0,
      ...(!includeSkills ? { 'evaluation.feedback': 0, 'evaluation.criteria': 0 } : {}),
      'evaluation.citations': 0, 'evaluation.rubric_feedback': 0,
      'evaluation.legal_research': 0, 'evaluation.citation_warnings': 0 } },
    { $sort: { created_at: -1 } },
  ]);
  await SimulationSession.populate(sessions, { path: 'case_id', select: 'title category practice_context' });
  const legacyResults = await TrialResult.find({ session_id: { $in: sessions.filter((s) => !s.evaluation).map((s) => s._id) } })
    .select(`session_id score earned_score assessed_max assessment_status legal_assessment_mode rubric_scores improvement_suggestions${includeSkills ? ' criteria feedback' : ''}`).lean();
  const bySession = new Map(legacyResults.map((result) => [String(result.session_id), result]));
  response.json({ data: sessions.map((session) => {
    const result = canViewResults ? session.evaluation ?? bySession.get(String(session._id)) : null;
    return { ...publicSession(session, request.authUser), result: result ? { score: scoreSummary(result).score, earned_score: result.earned_score, assessment_status: result.assessment_status, ...(sessionFeatures(session, request.authUser).detailedScoring ? { rubric_scores: result.rubric_scores } : {}), rubric_version: result.rubric_version, assessed_max: result.assessed_max, score_scope: result.score_scope, legal_assessment_mode: result.legal_assessment_mode, assessment_note: result.assessment_note,
      improvement_suggestions: typeof result.improvement_suggestions === 'string' ? result.improvement_suggestions.trim().slice(0, 1200) : null,
      ...(includeSkills ? { skill_insights: skillPresentation(result) } : {}) } : null };
  }) });
}));

router.get('/:sessionId', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = session.case_snapshot ?? await Case.findById(session.case_id).lean()
    ?? { title: 'Hồ sơ không còn trong thư viện', full_document: 'Không thể tải hồ sơ gốc. Biên bản đã lưu vẫn có thể xem lại.' };
  response.json({ data: { ...publicSession(session, request.authUser), case_id: learnerCase(courtCase) } });
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
  requireSessionFeature(session, request.authUser, 'legalAssistant');
  await consumeAuthLimit(`legal-basis:${request.auth.userId}`, 30);
  await consumeAuthLimit('legal-assistant:outbound', 120);
  const courtCase = await getCase(session);
  response.json({ data: learnerResearch(await researchLegalBasis({ courtCase, eventDate: session.case_event_date, records: await getRecords(session) })) });
}));

router.get('/:sessionId/assistant', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  requireSessionFeature(session, request.authUser, 'legalAssistant');
  const items = await LegalAssistantExchange.find({ session_id: session._id, user_id: session.user_id }).sort({ created_at: 1 }).limit(40).lean();
  response.json({ data: items.map(item => publicAssistantExchange(item)) });
}));

router.post('/:sessionId/assistant', asyncHandler(async (request, response) => {
  const question = typeof request.body?.question === 'string' ? request.body.question.trim() : '';
  if (question.length < 5 || question.length > 1500) throw new AppError('Câu hỏi cần từ 5 đến 1.500 ký tự.');
  const requestId = readRequestId(request.body?.request_id);
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const courtCase = await getCase(session);
  requireSessionFeature(session, request.authUser, 'legalAssistant');
  await consumeAuthLimit(`legal-assistant:${request.auth.userId}`, 30);
  await consumeAuthLimit('legal-assistant:outbound', 120);
  response.json({ data: await askLegalAssistant({ session, courtCase, question, requestId }) });
}));

router.post('/:sessionId/messages', asyncHandler(async (request, response) => {
  const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';
  if (content.length < 1 || content.length > 4_000) throw new AppError('Vui lòng nhập ý kiến, tối đa 4.000 ký tự.');
  const requestId = readRequestId(request.body?.request_id);
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  if (session.conversation && session.conversation.status !== 'learner') throw new AppError('Hãy đọc hết lượt hiện tại trước khi gửi lập luận mới.', 409, 'TURN_NOT_INVITED');
  const caseForReferences = await getCase(session);
  const evidenceIds = validateEvidenceReferences(caseForReferences, content, request.body.evidence_ids);
  const legalCitations = await validateLegalReferences(session, content, request.body.legal_reference_ids);
  const replay = replayTurn(session, requestId, content);
  if (replay) return response.json({ data: replay.map((r) => learnerRecord(r, caseForReferences)) });
  const records = await withSessionLock(session, async (locked, fence) => {
    if (locked.conversation && locked.conversation.status !== 'learner') throw new AppError('Hãy đọc hết lượt hiện tại trước khi gửi lập luận mới.', 409, 'TURN_NOT_INVITED');
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

router.post('/:sessionId/dialogue/seen', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const state = session.conversation;
  const recordId = request.body?.record_id;
  if (state?.status === 'awaiting_continue' && recordId === state.current_record_id && state.cursor > 0) {
    // Chỉ xác nhận lời đang hiện, không thay cursor hoặc gọi model khi xem lịch sử.
    const path = `turns.${state.turn_index}.records.${state.cursor}.displayed_at`;
    await SimulationSession.updateOne({ _id: session._id, user_id: session.user_id,
      'conversation.current_record_id': recordId, [path]: null }, { $set: { [path]: new Date() } });
  }
  response.sendStatus(204);
}));

router.post('/:sessionId/dialogue', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const { action, revision } = request.body ?? {};
  if (!['submit', 'advance', 'resume'].includes(action) || !Number.isSafeInteger(revision) || revision < 0) throw new AppError('Thao tác phiên không hợp lệ.');
  const command = { action, revision };
  if (action === 'submit') {
    const content = typeof request.body.content === 'string' ? request.body.content.trim() : '';
    if (content.length < 1 || content.length > 4000) throw new AppError('Vui lòng nhập ý kiến, tối đa 4.000 ký tự.');
    Object.assign(command, { content, requestId: readRequestId(request.body.request_id),
      evidenceIds: validateEvidenceReferences(await getCase(session), content, request.body.evidence_ids),
      citations: await validateLegalReferences(session, content, request.body.legal_reference_ids) });
  }
  if (!session.case_snapshot) session.case_snapshot = await getCase(session);
  const streaming = request.get('accept')?.includes('text/event-stream');
  const started = performance.now();
  const emit = value => { if (!response.destroyed && !response.writableEnded) response.write(`data: ${JSON.stringify(value)}\n\n`); };
  if (streaming) {
    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
  }
  try {
    const timings = await runConversation(session, command, streaming ? { onProgress: speech => emit({ type: 'speech', ...speech }) } : {});
    const saved = await getOwnedSession(session._id, request.auth.userId);
    const result = { data: { session: publicSession(saved, request.authUser), records: (await getRecords(saved)).map(r => learnerRecord(r, session.case_snapshot)) } };
    if (streaming) { emit({ type: 'complete', result, timings: { ...timings, total_ms: performance.now() - started } }); response.end(); }
    else response.json(result);
  } catch (error) {
    if (!streaming) throw error;
    emit({ type: 'error', error: { code: error.code ?? 'INTERNAL_ERROR', message: error instanceof AppError ? error.message : 'Chưa tạo được lời thoại. Các lượt đã gửi vẫn được giữ lại.' } });
    response.end();
  }
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
  }, { leaseMs: 210_000 });
  if (!await surveyVerified(request.authUser)) return response.json({ data: { status: 'completed', survey_required: true } });
  response.json({ data: memberEvaluation(result, session, request.authUser, session.case_snapshot ?? await Case.findById(session.case_id).lean() ?? {}) });
}));

router.get('/:sessionId/result', asyncHandler(async (request, response) => {
  const session = await getOwnedSession(request.params.sessionId, request.auth.userId);
  const result = session.evaluation ?? await TrialResult.findOne({ session_id: session._id }).lean();
  if (!result) throw new AppError('Phiên chưa có kết quả. Hãy trở lại phiên và chọn Kết thúc.', 404, 'RESULT_NOT_FOUND');
  await requireSurvey(request.authUser);
  response.json({ data: memberEvaluation(result, session, request.authUser) });
}));

export default router;
