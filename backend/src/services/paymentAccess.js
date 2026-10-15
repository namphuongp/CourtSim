import { randomUUID } from 'node:crypto';
import { FREE_SESSION_LIMIT, memberFeatures, normalizeMembership } from '../../../shared/membershipPolicy.mjs';
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
  if (quota.free_cases_used === undefined) {
    // Dữ liệu cũ dùng chung cases_played: giữ số lượt miễn phí đã tiêu thụ.
    await UserUsageQuota.updateOne({ _id: quota._id, free_cases_used: { $exists: false } },
      { $set: { free_cases_used: Math.min(FREE_SESSION_LIMIT, Math.max(0, quota.cases_played ?? 0)) } });
    quota = await UserUsageQuota.findById(quota._id).lean();
  }
  return quota;
}

export async function membershipStatus(user, creationRequestId) {
  const features = memberFeatures(user);
  const quota = await UserUsageQuota.findOne({ user_id: user._id }).lean();
  const freeUsed = quota?.free_cases_used ?? Math.min(FREE_SESSION_LIMIT, Math.max(0, quota?.cases_played ?? 0));
  const freeRemaining = Math.max(0, FREE_SESSION_LIMIT - freeUsed);
  const credits = Math.max(0, quota?.case_credits ?? 0);
  // Lượt mua từ phiên bản cũ vẫn có đầy đủ quyền của phiên trả phí.
  const plan = features.id === 'freemium' && credits > 0 ? 'pay-per-use' : features.id;
  const effective = plan === 'pay-per-use' ? memberFeatures({ tier: plan }) : features;
  const resumable = creationRequestId ? await SimulationSession.exists({ user_id: user._id, creation_request_id: creationRequestId }) : null;
  return { ...effective, freeLimit: FREE_SESSION_LIMIT, freeUsed, freeRemaining, caseCredits: credits,
    remainingSessions: effective.unlimitedSessions ? null : freeRemaining + credits,
    resumeRequestId: resumable ? creationRequestId : null,
    canCreateSession: effective.unlimitedSessions || freeRemaining + credits > 0 };
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
