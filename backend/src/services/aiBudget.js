import { consumeAuthLimit } from '../middlewares/rateLimit.js';

function limit(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error(`${name} phải là số nguyên dương, tối đa 1000000.`);
  return value;
}

export const aiLimits = Object.freeze({
  userWindow: limit('AI_USER_CALLS_PER_15_MIN', 80),
  userDay: limit('AI_USER_CALLS_PER_DAY', 200),
  globalDay: limit('AI_GLOBAL_CALLS_PER_DAY', 2000),
});

export async function consumeAiBudget(userId, consume = consumeAuthLimit) {
  // Tính mỗi lần gọi provider, kể cả retry; Mongo dùng chung nên nhiều instance không vượt hạn mức.
  if (userId) {
    await consume(`ai:user:${userId}:window`, aiLimits.userWindow);
    await consume(`ai:user:${userId}:day`, aiLimits.userDay, 86400000);
  }
  await consume('ai:global:day', aiLimits.globalDay, 86400000);
}
