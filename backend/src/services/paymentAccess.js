import User from '../models/User.js';
import UserUsageQuota from '../models/UserUsageQuota.js';
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
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function applyPaymentEntitlement({ userId, entitlement }) {
  if (!entitlement) return null;
  if (entitlement.type === 'case_credit') return addCaseCredits(userId, entitlement.quantity);
  if (entitlement.type === 'pro_bundle') return User.findByIdAndUpdate(userId, { $set: { subscription_type: 'pro' } }, { new: true });
  return null;
}

export async function consumeCaseAccess(userId, tier) {
  if (tier === 'pro') return { source: 'subscription' };
  let quota = await UserUsageQuota.findOne({ user_id: userId });
  if (!quota) {
    try {
      quota = await UserUsageQuota.create({ user_id: userId, reset_date: nextYear() });
    } catch (error) {
      if (error.code !== 11000) throw error;
      quota = await UserUsageQuota.findOne({ user_id: userId });
    }
  }

  const free = await UserUsageQuota.updateOne(
    { _id: quota._id, cases_played: { $lt: 2 } },
    { $inc: { cases_played: 1 } },
  );
  if (free.matchedCount) return { source: 'free_trial' };

  const credited = await UserUsageQuota.updateOne(
    { _id: quota._id, case_credits: { $gt: 0 } },
    { $inc: { case_credits: -1, cases_played: 1 } },
  );
  if (credited.matchedCount) return { source: 'credit' };

  throw new AppError('Ban da dung het 2 luot mien phi. Vui long thanh toan them luot mo phong de tiep tuc.', 402, 'PAYMENT_REQUIRED');
}
