import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Case, SimulationSession, TrialResult, AiPersonal, PaymentTransaction } from '../models/index.js';
import { AuthSession } from '../models/AuthState.js';
import AiUsage from '../models/AiUsage.js';
import AdminAudit from '../models/AdminAudit.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { modelPricing } from '../config/aiPricing.js';
import { objectId, queryOptions, literalRegex, dateRange } from '../services/adminQuery.js';
import { dashboard, activity, aiAnalytics } from '../services/adminAnalytics.js';
import { getRecords } from '../services/sessionStore.js';
import { learnerCase, learnerRecord, learnerEvaluation } from '../services/learnerPresentation.js';
import { scoreSummary } from '../../../shared/scorePresentation.mjs';
import { manuallySetPaymentStatus } from '../services/paymentService.js';
const router = Router();
router.use(authenticate, requireAdmin);
const userFields = '_id username email email_verified system_role status auth_providers created_at';
const pageResult = (data, total, opts) => ({ data, pagination: { total, page: opts.page, limit: opts.limit } });
const run = handler => asyncHandler(async (req, res) => res.json(await handler(req)));
const timed = query => { queryOptions(query); return dateRange(query); };
router.get('/dashboard', run(async req => { queryOptions(req.query); return { data: await dashboard(req.query) }; }));
router.get('/analytics/activity', run(async req => ({ data: await activity(timed(req.query)) })));
router.get('/ai/usage', run(async req => ({ data: await aiAnalytics(timed(req.query)) })));
router.get('/ai/cost', run(async req => ({ data: await aiAnalytics(timed(req.query)) })));

function publicPayment(transaction) {
  return {
    _id: transaction._id,
    id: transaction._id,
    transaction_id: transaction.transaction_id,
    orderCode: transaction.order_code ?? transaction.provider_payload?.order_code ?? transaction.transaction_id,
    order_code: transaction.order_code ?? transaction.provider_payload?.order_code ?? transaction.transaction_id,
    amount: transaction.amount,
    status: transaction.status === 'success' ? 'paid' : transaction.status === 'failed' ? 'cancelled' : transaction.status,
    provider: transaction.provider,
    type: transaction.type,
    paid_at: transaction.paid_at,
    expires_at: transaction.expires_at,
    reference_code: transaction.reference_code,
    sepay_transaction_id: transaction.sepay_transaction_id,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
    user: transaction.user,
    plan: {
      id: transaction.provider_payload?.plan_id,
      name: transaction.provider_payload?.plan_name,
      payment_purpose: transaction.provider_payload?.payment_purpose,
      entitlement: transaction.provider_payload?.entitlement,
    },
    payment: transaction.provider_payload?.payment,
    user_confirmed_at: transaction.provider_payload?.user_confirmed_at,
    verified_at: transaction.provider_payload?.verified_at,
  };
}

router.get('/payments', run(async req => {
  const opts = queryOptions(req.query, ['created_at', 'updated_at', 'amount', 'status']);
  const filter = {};
  if (req.query.status) {
    if (!['pending', 'processing', 'paid', 'expired', 'cancelled', 'submitted', 'success', 'failed', 'refunded'].includes(req.query.status)) throw new AppError('Trang thai thanh toan khong hop le.');
    filter.status = req.query.status === 'success' ? { $in: ['paid', 'success'] } : req.query.status === 'failed' ? { $in: ['cancelled', 'failed'] } : req.query.status;
  }
  if (req.query.range) filter.created_at = dateRange(req.query).match;
  const joins = [{ $lookup: { from: User.collection.name, localField: 'user_id', foreignField: '_id', pipeline: [{ $project: { username: 1, email: 1 } }], as: 'user' } }];
  const search = opts.search ? { $match: { $or: [{ transaction_id: { $regex: literalRegex(opts.search), $options: 'i' } }, { order_code: { $regex: literalRegex(opts.search), $options: 'i' } }, { 'user.username': { $regex: literalRegex(opts.search), $options: 'i' } }, { 'user.email': { $regex: literalRegex(opts.search), $options: 'i' } }] } } : null;
  const [result] = await PaymentTransaction.aggregate([{ $match: filter }, ...joins, ...(search ? [search] : []), { $facet: {
    total: [{ $count: 'count' }],
    items: [{ $sort: opts.sort }, { $skip: opts.skip }, { $limit: opts.limit }, { $set: { user: { $arrayElemAt: ['$user', 0] } } }],
  } }]);
  return pageResult(result.items.map(publicPayment), result.total[0]?.count ?? 0, opts);
}));

router.patch('/payments/:transactionId', run(async req => {
  const status = req.body?.status;
  if (!['paid', 'cancelled', 'success', 'failed'].includes(status)) throw new AppError('Trang thai xac nhan khong hop le.');
  const transaction = await manuallySetPaymentStatus({ transactionId: req.params.transactionId, status, adminUserId: req.auth.userId, note: req.body?.note });
  await AdminAudit.create({ admin_user_id: req.auth.userId, action: ['paid', 'success'].includes(status) ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED', target_type: 'payment', target_id: transaction._id });
  await transaction.populate('user_id', 'username email');
  return { data: publicPayment({ ...transaction.toObject(), user: transaction.user_id }) };
}));

async function sessionList(query, userId) {
  const opts = queryOptions(query, ['created_at', 'completed_at', 'status']);
  const filter = userId ? { user_id: userId } : {};
  if (query.status) { if (!['ongoing', 'completed'].includes(query.status)) throw new AppError('Trạng thái phiên không hợp lệ.'); filter.status = query.status; }
  if (query.range) filter.created_at = dateRange(query).match;
  // Join để tìm theo tên/email và hồ sơ, không tải danh sách ID không giới hạn vào Node.
  const joins = [
    { $lookup: { from: User.collection.name, localField: 'user_id', foreignField: '_id', pipeline: [{ $project: { username: 1, email: 1 } }], as: 'user' } },
    { $lookup: { from: Case.collection.name, localField: 'case_id', foreignField: '_id', pipeline: [{ $project: { title: 1, category: 1 } }], as: 'courtCase' } },
  ];
  const search = opts.search ? { $match: { $or: [{ 'user.username': { $regex: literalRegex(opts.search), $options: 'i' } }, { 'user.email': { $regex: literalRegex(opts.search), $options: 'i' } }, { 'case_snapshot.title': { $regex: literalRegex(opts.search), $options: 'i' } }, { 'courtCase.title': { $regex: literalRegex(opts.search), $options: 'i' } }, ...(mongoose.isObjectIdOrHexString(opts.search) ? [{ _id: objectId(opts.search) }] : [])] } } : null;
  const [result] = await SimulationSession.aggregate([{ $match: filter }, ...(search ? [...joins, search] : []), { $facet: {
    total: [{ $count: 'count' }], items: [{ $sort: opts.sort }, { $skip: opts.skip }, { $limit: opts.limit }, ...(!search ? joins : []),
      { $lookup: { from: TrialResult.collection.name, localField: '_id', foreignField: 'session_id', pipeline: [{ $project: { score: 1, earned_score: 1, assessed_max: 1 } }], as: 'legacy' } },
      { $project: { user_court_role: 1, created_at: 1, completed_at: 1, status: 1,
        user: { $arrayElemAt: ['$user', 0] }, title: { $ifNull: ['$case_snapshot.title', { $arrayElemAt: ['$courtCase.title', 0] }] },
        result: { $cond: [{ $ne: [{ $ifNull: ['$evaluation', null] }, null] }, { score: '$evaluation.score', earned_score: '$evaluation.earned_score', assessed_max: '$evaluation.assessed_max' }, { $arrayElemAt: ['$legacy', 0] }] },
        durationMs: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $ne: [{ $ifNull: ['$completed_at', null] }, null] }, { $gte: ['$completed_at', '$created_at'] }] }, { $subtract: ['$completed_at', '$created_at'] }, null] },
      } },
    ],
  } }]);
  return pageResult(result.items.map(({ result: evaluation, ...session }) => ({ ...session,
    score: scoreSummary(evaluation ?? {}).score, earned_score: evaluation?.earned_score, assessed_max: evaluation?.assessed_max,
  })), result.total[0]?.count ?? 0, opts);
}
router.get('/sessions', run(req => sessionList(req.query)));
router.get('/sessions/:id', run(async req => {
  const session = await SimulationSession.findById(objectId(req.params.id)).lean();
  if (!session) throw new AppError('Không tìm thấy phiên mô phỏng.', 404);
  const [user, courtCase, legacy, records] = await Promise.all([
    User.findById(session.user_id).select(userFields).lean(), session.case_snapshot ?? Case.findById(session.case_id).lean(),
    session.evaluation ?? TrialResult.findOne({ session_id: session._id }).lean(), getRecords(session),
  ]);
  const result = legacy ? learnerEvaluation(legacy, courtCase ?? {}) : null;
  // Chỉ giữ trường nhận xét phục vụ quản trị, không trả dữ liệu Mixed nội bộ.
  const evaluation = result ? { score: result.score, earned_score: result.earned_score, assessed_max: result.assessed_max, score_scope: result.score_scope, verdict: result.verdict, feedback: result.feedback, improvement_suggestions: result.improvement_suggestions,
    criteria: (result.criteria ?? []).map(g => ({ label: g.label, earned: g.earned, assessed_max: g.assessed_max, max: g.max, items: (g.items ?? []).map(i => ({ label: i.label, score: i.score, max: i.max, reason: i.reason, strength: i.strength, improvement: i.improvement, quote: i.quote })) })) } : null;
  return { data: { _id: session._id, user, courtCase: learnerCase(courtCase), user_court_role: session.user_court_role,
    created_at: session.created_at, completed_at: session.completed_at, status: session.status,
    durationMs: session.status === 'completed' && session.completed_at && session.completed_at >= session.created_at ? session.completed_at - session.created_at : null,
    evaluation, feedback: session.feedback ? { content: session.feedback.content, status: session.feedback.status, created_at: session.feedback.created_at } : null,
    transcript: records.map(record => { const r = learnerRecord(record, courtCase ?? {}); return { sender_name: r.sender_name, content: r.display_content, created_at: r.created_at }; }),
    models: await AiUsage.distinct('model', { session_id: session._id }),
  } };
}));
router.get('/users', run(async req => {
  const opts = queryOptions(req.query, ['created_at', 'username', 'email', 'status']);
  const filter = {};
  if (req.query.role) { if (!['admin', 'user'].includes(req.query.role)) throw new AppError('Vai trò không hợp lệ.'); filter.system_role = req.query.role; }
  if (req.query.status) { if (!['active', 'banned'].includes(req.query.status)) throw new AppError('Trạng thái không hợp lệ.'); filter.status = req.query.status; }
  if (req.query.verified) { if (!['true', 'false'].includes(req.query.verified)) throw new AppError('Bộ lọc xác thực không hợp lệ.'); filter.email_verified = req.query.verified === 'true' ? true : { $ne: true }; }
  if (opts.search) filter.$or = ['username', 'email'].map(field => ({ [field]: { $regex: literalRegex(opts.search), $options: 'i' } }));
  const [users, total] = await Promise.all([User.find(filter).select(userFields).sort(opts.sort).skip(opts.skip).limit(opts.limit).lean(), User.countDocuments(filter)]);
  const stats = await SimulationSession.aggregate([{ $match: { user_id: { $in: users.map(u => u._id) } } },
    { $project: { user_id: 1, created_at: 1, activity: { $max: ['$created_at', '$completed_at', '$feedback.created_at',
      { $max: { $reduce: { input: { $ifNull: ['$turns', []] }, initialValue: [], in: { $concatArrays: ['$value', { $map: { input: { $ifNull: ['$this.records', []] }, as: 'record', in: { $convert: { input: '$record.created_at', to: 'date', onError: null, onNull: null } } } }] } } } }] } } },
    { $group: { _id: '$user_id', sessions: { $sum: 1 }, lastSessionAt: { $max: '$created_at' }, lastActivityAt: { $max: '$activity' } } },
  ]);
  const statsById = new Map(stats.map(s => [String(s._id), s]));
  return pageResult(users.map(u => ({ ...u, sessions: statsById.get(String(u._id))?.sessions ?? 0, lastSessionAt: statsById.get(String(u._id))?.lastSessionAt ?? null, lastActivityAt: statsById.get(String(u._id))?.lastActivityAt ?? null })), total, opts);
}));
router.get('/users/:id', run(async req => {
  const id = objectId(req.params.id), user = await User.findById(id).select(userFields).lean();
  if (!user) throw new AppError('Không tìm thấy tài khoản.', 404);
  const [sessions, feedback] = await Promise.all([sessionList({ limit: '10' }, id), SimulationSession.find({ user_id: id, 'feedback.created_at': { $exists: true } }).select('_id feedback.content feedback.status feedback.created_at').sort({ 'feedback.created_at': -1 }).limit(10).lean()]);
  return { data: { ...user, sessions: sessions.data, sessionCount: sessions.pagination.total, feedback } };
}));
router.patch('/users/:id', run(async req => {
  const id = objectId(req.params.id), status = req.body?.status;
  if (!req.body || Object.keys(req.body).some(k => k !== 'status') || !['active', 'banned'].includes(status)) throw new AppError('Trạng thái tài khoản không hợp lệ.');
  // Không khóa bất kỳ admin nào: tránh mất quản trị kể cả hai yêu cầu đồng thời.
  const user = await User.findOneAndUpdate({ _id: id, system_role: { $ne: 'admin' } }, { $set: { status }, ...(status === 'banned' ? { $inc: { auth_version: 1 } } : {}) }, { returnDocument: 'before' }).select(userFields).lean();
  if (!user) throw new AppError('Không thể đổi trạng thái tài khoản quản trị hoặc tài khoản không tồn tại.', 409);
  if (status === 'banned') await AuthSession.deleteMany({ userId: id });
  if (user.status !== status) await AdminAudit.create({ admin_user_id: req.auth.userId, action: status === 'banned' ? 'USER_DISABLED' : 'USER_ENABLED', target_type: 'user', target_id: id });
  return { data: { ...user, status } };
}));
router.get('/audit', run(async req => {
  const opts = queryOptions(req.query);
  const [items, total] = await Promise.all([AdminAudit.find().select('admin_user_id action target_type target_id created_at').populate('admin_user_id', 'username').sort(opts.sort).skip(opts.skip).limit(opts.limit).lean(), AdminAudit.countDocuments()]);
  return pageResult(items, total, opts);
}));
router.get('/system/health', run(async () => {
  const [personas, lastSuccess] = await Promise.all([AiPersonal.find().select('role_name model_id').lean(), AiUsage.findOne({ success: true }).select('created_at').sort({ created_at: -1 }).lean()]);
  let localAi = false;
  try { localAi = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.AI_BASE_URL).hostname); } catch { /* Cấu hình không hợp lệ không có nghĩa dịch vụ sẵn sàng. */ }
  return { data: { backend: true, mongo: mongoose.connection.readyState === 1,
    aiConfigured: Boolean((env.AI_API_KEY || localAi) && ['judge', 'prosecutor', 'evaluator'].every(role => personas.some(p => p.role_name === role && p.model_id && p.model_id !== 'configure-me'))),
    emailConfigured: Boolean(process.env.EMAIL_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()),
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.GOOGLE_REDIRECT_URI?.trim()),
    verificationTemporarilyDisabled: env.AUTH_EMAIL_VERIFICATION_DISABLED,
    trackingEnabled: process.env.AI_USAGE_TRACKING !== 'false', pricingConfigured: Object.keys(modelPricing).length > 0,
    lastAiSuccess: lastSuccess?.created_at ?? null, checkedAt: new Date() } };
}));
export default router;
