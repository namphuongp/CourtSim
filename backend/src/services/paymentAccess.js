import { randomUUID } from 'node:crypto';
import { FREE_SESSION_LIMIT, FREE_UPLOAD_LIMIT, memberFeatures, normalizeMembership } from '../../../shared/membershipPolicy.mjs';
import Case from '../models/Case.js';
import User from '../models/User.js';
import UserUsageQuota from '../models/UserUsageQuota.js';
import SimulationSession from '../models/SimulationSession.js';
import { AppError } from '../utils/AppError.js';

function nextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

export async function addCaseCredits(userId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;
  return UserUsageQuota.findOneAndUpdate(
    { user_id: userId },
    { $inc: { case_credits: quantity }, $setOnInsert: { reset_date: nextYear() } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

export async function applyPaymentEntitlement({ userId, entitlement, paymentId }) {
  if (!entitlement) return null;
  if (entitlement.type === 'case_credit') {
    let quota;
    if (paymentId) {
      await ensureQuota(userId);
      // The credit increment and deduplication marker commit in the same document.
      quota = await UserUsageQuota.findOneAndUpdate(
        { user_id: userId, applied_payment_ids: { $ne: String(paymentId) } },
        { $inc: { case_credits: entitlement.quantity }, $addToSet: { applied_payment_ids: String(paymentId) } },
        { returnDocument: 'after' },
      );
    } else quota = await addCaseCredits(userId, entitlement.quantity);
    const plan = entitlement.plan === 'lite' ? 'lite' : 'pay-per-use';
    // Mua lượt lẻ không hạ gói Lite/Pro; Lite không hạ Pro.
    await User.updateOne({ _id: userId, subscription_type: { $in: plan === 'lite' ? ['free', 'pay-per-use'] : ['free'] } },
      { $set: { subscription_type: plan } });
    return quota;
  }
  if (entitlement.type === 'pro_bundle') return User.findByIdAndUpdate(userId, { $set: { subscription_type: 'pro' } }, { returnDocument: 'after' });
  return null;
}

async function ensureQuota(userId) {
  let quota = await UserUsageQuota.findOne({ user_id: userId }).lean();
  if (!quota) {
    try {
      quota = (await UserUsageQuota.create({ user_id: userId, free_cases_used: 0, reset_date: nextYear() })).toObject();
    } catch (error) {
      if (error.code !== 11000) throw error;
      quota = await UserUsageQuota.findOne({ user_id: userId }).lean();
    }
  }

  // Tự động kiểm tra và đồng bộ chính xác số case miễn phí thực tế từ SimulationSession
  const activeFreeSessions = await SimulationSession.countDocuments({
    user_id: userId,
    status: { $in: ['completed', 'ongoing'] },
    $or: [
      { is_free_trial: true },
      { access_source: 'free_trial' },
      { access_plan: 'freemium' },
      { access_plan: { $exists: false } }
    ]
  });

  if (quota.free_cases_used === undefined || quota.free_cases_used > activeFreeSessions) {
    const freeUsed = Math.min(FREE_SESSION_LIMIT, Math.max(activeFreeSessions, quota.free_cases_used ?? 0));
    await UserUsageQuota.updateOne(
      { _id: quota._id },
      { $set: { free_cases_used: freeUsed } }
    );
    quota = await UserUsageQuota.findById(quota._id).lean();
  }
  return quota;
}

export async function membershipStatus(user, creationRequestId) {
  const features = memberFeatures(user);
  const quota = await UserUsageQuota.findOne({ user_id: user._id }).lean();

  // Đếm chính xác số case miễn phí người dùng đã HOÀN THÀNH XONG
  const completedFreeCases = await SimulationSession.countDocuments({
    user_id: user._id,
    status: 'completed',
    $or: [
      { is_free_trial: true },
      { access_source: 'free_trial' },
      { access_plan: 'freemium' },
      { access_plan: { $exists: false } }
    ]
  });

  const rawFreeUsed = quota?.free_cases_used ?? Math.min(FREE_SESSION_LIMIT, Math.max(0, quota?.cases_played ?? 0));
  const freeUsed = Math.min(FREE_SESSION_LIMIT, Math.max(completedFreeCases, rawFreeUsed));
  const freeRemaining = Math.max(0, FREE_SESSION_LIMIT - freeUsed);

  // Người dùng chỉ hết thời gian dùng thử SAU KHI đã hoàn thành xong 02 case miễn phí đầu tiên
  const isTrialActive = features.id === 'freemium' && completedFreeCases < FREE_SESSION_LIMIT;

  // Đếm số hồ sơ riêng người dùng đã tải lên
  const uploadedCasesCount = await Case.countDocuments({ created_by: user._id });
  const rawFreeUploadsUsed = quota?.free_uploads_used ?? 0;
  const freeUploadsUsed = Math.min(FREE_UPLOAD_LIMIT, Math.max(uploadedCasesCount, rawFreeUploadsUsed));
  const freeUploadsRemaining = Math.max(0, FREE_UPLOAD_LIMIT - freeUploadsUsed);

  const credits = Math.max(0, quota?.case_credits ?? 0);
  // Lượt mua từ phiên bản cũ vẫn có đầy đủ quyền của phiên trả phí.
  const plan = features.id === 'freemium' && credits > 0 ? 'pay-per-use' : features.id;
  const effective = plan === 'pay-per-use' ? memberFeatures({ tier: plan }) : features;
  const resumable = creationRequestId ? await SimulationSession.exists({ user_id: user._id, creation_request_id: creationRequestId }) : null;

  // Trong thời gian dùng thử (khi chưa hoàn tất xong cả 2 case), luôn mở Trợ lý Luật và Chấm điểm chi tiết
  const trialEffective = isTrialActive
    ? { ...effective, legalAssistant: true, detailedScoring: true, isFreeTrial: true }
    : effective;

  const unlimitedUploads = Boolean(effective.unlimitedSessions || user?.system_role === 'admin' || user?.role === 'admin');
  const canUploadCase = Boolean(unlimitedUploads || freeUploadsRemaining > 0 || credits > 0);

  return {
    ...trialEffective,
    freeLimit: FREE_SESSION_LIMIT,
    freeUsed,
    freeRemaining,
    completedFreeCases,
    isTrialActive,
    caseCredits: credits,
    remainingSessions: effective.unlimitedSessions ? null : freeRemaining + credits,
    resumeRequestId: resumable ? creationRequestId : null,
    canCreateSession: effective.unlimitedSessions || freeRemaining + credits > 0,
    freeUploadLimit: FREE_UPLOAD_LIMIT,
    freeUploadsUsed,
    freeUploadsRemaining,
    uploadedCasesCount,
    unlimitedUploads,
    canUploadCase,
  };
}

export async function consumeCaseAccess(userId, tier, requestId = randomUUID(), role = 'user') {
  if (role === 'admin' || normalizeMembership(tier) === 'pro') return { source: 'subscription', plan: 'pro' };
  const quota = await ensureQuota(userId);
  const previous = async () => {
    const saved = await UserUsageQuota.findOne({ _id: quota._id, 'case_allocations.request_id': requestId }).lean();
    const allocation = saved?.case_allocations.find(item => item.request_id === requestId);
    return allocation ? { source: allocation.source, plan: allocation.plan } : null;
  };
  let allocated = await previous();
  if (allocated) return allocated;
  const filter = { _id: quota._id, 'case_allocations.request_id': { $ne: requestId } };
  const paidPlan = normalizeMembership(tier) === 'lite' ? 'lite' : 'pay-per-use';
  const credited = await UserUsageQuota.updateOne({ ...filter, case_credits: { $gt: 0 } },
    { $inc: { case_credits: -1, cases_played: 1 }, $push: { case_allocations: { request_id: requestId, source: 'credit', plan: paidPlan } } });
  if (credited.matchedCount) return { source: 'credit', plan: paidPlan };
  allocated = await previous();
  if (allocated) return allocated;
  const free = await UserUsageQuota.updateOne({ ...filter, free_cases_used: { $lt: FREE_SESSION_LIMIT } },
    { $inc: { free_cases_used: 1, cases_played: 1 }, $push: { case_allocations: { request_id: requestId, source: 'free_trial', plan: 'freemium' } } });
  if (free.matchedCount) return { source: 'free_trial', plan: 'freemium' };
  allocated = await previous();
  if (allocated) return allocated;
  throw new AppError('Bạn đã dùng hết lượt mô phỏng. Chọn gói hoặc mua thêm lượt để bắt đầu phiên mới. Các phiên đã mở vẫn có thể tiếp tục.', 402, 'PAYMENT_REQUIRED');
}

export async function finishCaseAllocation(userId, requestId) {
  await UserUsageQuota.updateOne({ user_id: userId }, { $pull: { case_allocations: { request_id: requestId } } });
}

export async function assertCanUploadCase(userId, tier, role = 'user') {
  if (role === 'admin' || normalizeMembership(tier) === 'pro') return;
  const quota = await ensureQuota(userId);
  const uploadedCasesCount = await Case.countDocuments({ created_by: userId });
  const freeUploadsUsed = Math.max(uploadedCasesCount, quota?.free_uploads_used ?? 0);
  if (freeUploadsUsed < FREE_UPLOAD_LIMIT || (quota?.case_credits ?? 0) > 0) return;
  throw new AppError(
    `Bạn đã sử dụng hết ${FREE_UPLOAD_LIMIT} lượt tải hồ sơ riêng miễn phí. Vui lòng mua thêm lượt hoặc nâng cấp gói (Lite / Pro) để tiếp tục tải hồ sơ riêng.`,
    402,
    'UPLOAD_PAYMENT_REQUIRED'
  );
}

export async function consumeCaseUploadAccess(userId, tier, role = 'user') {
  if (role === 'admin' || normalizeMembership(tier) === 'pro') {
    return { source: 'subscription', plan: 'pro' };
  }
  const quota = await ensureQuota(userId);
  const uploadedCasesCount = await Case.countDocuments({ created_by: userId });
  const currentFreeUploads = Math.max(uploadedCasesCount, quota?.free_uploads_used ?? 0);

  if (currentFreeUploads < FREE_UPLOAD_LIMIT) {
    await UserUsageQuota.updateOne(
      { _id: quota._id },
      { $set: { free_uploads_used: currentFreeUploads + 1 } }
    );
    return { source: 'free_upload', plan: normalizeMembership(tier) };
  }

  const paidPlan = normalizeMembership(tier) === 'lite' ? 'lite' : 'pay-per-use';
  const credited = await UserUsageQuota.updateOne(
    { _id: quota._id, case_credits: { $gt: 0 } },
    { $inc: { case_credits: -1 } }
  );
  if (credited.matchedCount) {
    return { source: 'credit', plan: paidPlan };
  }

  throw new AppError(
    `Bạn đã sử dụng hết ${FREE_UPLOAD_LIMIT} lượt tải hồ sơ riêng miễn phí. Vui lòng mua thêm lượt hoặc nâng cấp gói (Lite / Pro) để tiếp tục tải hồ sơ riêng.`,
    402,
    'UPLOAD_PAYMENT_REQUIRED'
  );
}
