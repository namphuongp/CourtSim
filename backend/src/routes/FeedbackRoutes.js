import AdminAudit from '../models/AdminAudit.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import { SimulationSession, TrialResult } from '../models/index.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSurvey, surveyLink, surveyVerified } from '../services/surveyVerification.js';

const statuses = ['new', 'viewed', 'resolved'];
const id = value => {
  if (!mongoose.isObjectIdOrHexString(value)) throw new AppError('Không tìm thấy góp ý hoặc phiên luyện tập.', 404);
  return value;
};
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AppError(`Nội dung cần ${required ? 'từ 1 đến' : 'không quá'} ${max} ký tự.`);
  return value.trim();
};
async function completedSession(request) {
  const session = await SimulationSession.findOne({ _id: id(request.params.sessionId), user_id: request.auth.userId }).select('user_id status evaluation.score survey_receipt feedback feedback_prompted_at feedback_submitted_at').lean();
  if (!session) throw new AppError('Không tìm thấy phiên luyện tập.', 404);
  if (session.status !== 'completed' || (!session.evaluation && !await TrialResult.exists({ session_id: session._id }))) throw new AppError('Phiên chưa có kết quả chấm điểm. Hãy quay lại phiên để kiểm tra.', 409);
  return session;
}

export const learnerFeedbackRoutes = Router({ mergeParams: true });
learnerFeedbackRoutes.use(authenticate);
learnerFeedbackRoutes.get('/survey', asyncHandler(async (request, response) => {
  const session = await completedSession(request);
  const verified = await surveyVerified(request.authUser);
  response.set('Cache-Control', 'no-store').json({ data: { verified, form_url: verified ? null : surveyLink(session) } });
}));
learnerFeedbackRoutes.post('/prompt', asyncHandler(async (request, response) => {
  const session = await completedSession(request);
  await requireSurvey(request.authUser);
  // Đánh dấu trước khi hiển thị: tải lại hoặc mở tab khác không hỏi thêm lần nữa.
  const claimed = await SimulationSession.updateOne({ _id: session._id, feedback_prompted_at: null, feedback_submitted_at: null }, { $set: { feedback_prompted_at: new Date() } });
  let formUrl = null;
  if (claimed.modifiedCount === 1) {
    try { formUrl = surveyLink(session); }
    catch (error) { if (error.code !== 'SURVEY_UNAVAILABLE') throw error; }
  }
  response.json({ data: { show: claimed.modifiedCount === 1, form_url: formUrl } });
}));
learnerFeedbackRoutes.post('/', asyncHandler(async (request, response) => {
  const content = text(request.body?.content, 2000, true);
  const session = await completedSession(request);
  const now = new Date();
  const saved = await SimulationSession.updateOne({ _id: session._id, feedback_submitted_at: null }, { $set: {
    feedback_prompted_at: session.feedback_prompted_at ?? now, feedback_submitted_at: now,
    feedback: { content, status: 'new', notes: '', created_at: now, updated_at: now },
  } }, { runValidators: true });
  // Mất phản hồi rồi gửi lại vẫn chỉ có một góp ý; không ghi đè nội dung đã nhận.
  if (!saved.modifiedCount) {
    const existing = await SimulationSession.findById(session._id).select('feedback.content').lean();
    if (existing?.feedback?.content !== content) throw new AppError('Phiên này đã gửi góp ý. Bạn có thể xem kết quả.', 409, 'FEEDBACK_ALREADY_SENT');
  }
  response.status(saved.modifiedCount ? 201 : 200).json({ data: { submitted: true } });
}));

export const adminFeedbackRoutes = Router();
adminFeedbackRoutes.use(authenticate, requireAdmin);
const selection = '_id user_id feedback';
const present = session => ({
  id: session._id, session_id: session._id,
  user: session.user_id ? { id: session.user_id._id, full_name: session.user_id.username } : null,
  ...session.feedback,
});
const adminQuery = filter => SimulationSession.find(filter).select(selection).populate('user_id', 'username').lean();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
adminFeedbackRoutes.get('/', asyncHandler(async (request, response) => {
  const { status, q = '', page = '1', limit = '20' } = request.query;
  if (typeof page !== 'string' || typeof limit !== 'string' || typeof q !== 'string' || q.length > 100 || (status && !statuses.includes(status)) || !/^\d{1,6}$/.test(String(page)) || !/^\d{1,2}$/.test(String(limit))) throw new AppError('Bộ lọc góp ý không hợp lệ.');
  const pageNumber = Math.max(1, Number(page));
  const pageSize = Math.min(50, Math.max(1, Number(limit)));
  const filter = { 'feedback.created_at': { $exists: true } };
  if (status) filter['feedback.status'] = status;
  if (q.trim()) {
    filter.$or = [{ 'feedback.content': { $regex: escapeRegex(q.trim()), $options: 'i' } }];
    if (mongoose.isObjectIdOrHexString(q.trim())) filter.$or.push({ _id: q.trim() });
  }
  const [items, total] = await Promise.all([adminQuery(filter).sort({ 'feedback.created_at': -1, _id: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize), SimulationSession.countDocuments(filter)]);
  response.json({ data: items.map(present), pagination: { page: pageNumber, limit: pageSize, total } });
}));
adminFeedbackRoutes.get('/:id', asyncHandler(async (request, response) => {
  const [item] = await adminQuery({ _id: id(request.params.id), 'feedback.created_at': { $exists: true } });
  if (!item) throw new AppError('Góp ý không còn tồn tại.', 404);
  response.json({ data: present(item) });
}));
adminFeedbackRoutes.patch('/:id', asyncHandler(async (request, response) => {
  const { status, notes } = request.body ?? {};
  if (!statuses.includes(status)) throw new AppError('Trạng thái góp ý không hợp lệ.');
  const result = await SimulationSession.updateOne({ _id: id(request.params.id), 'feedback.created_at': { $exists: true } }, { $set: { 'feedback.status': status, 'feedback.notes': text(notes, 2000), 'feedback.updated_at': new Date() } }, { runValidators: true });
  if (!result.matchedCount) throw new AppError('Góp ý không còn tồn tại.', 404);
  await AdminAudit.create({ admin_user_id: request.auth.userId, action: 'FEEDBACK_STATUS_CHANGED', target_type: 'feedback', target_id: request.params.id });
  response.json({ data: { updated: true } });
}));
adminFeedbackRoutes.delete('/:id', asyncHandler(async (request, response) => {
  const removed = await SimulationSession.updateOne({ _id: id(request.params.id) }, { $unset: { feedback: 1 } });
  // Giữ dấu đã gửi để không hỏi lại hoặc khôi phục góp ý bị quản trị viên xóa.
  if (removed.modifiedCount) await AdminAudit.create({ admin_user_id: request.auth.userId, action: 'FEEDBACK_DELETED', target_type: 'feedback', target_id: request.params.id });
  response.json({ data: { deleted: true } });
}));
