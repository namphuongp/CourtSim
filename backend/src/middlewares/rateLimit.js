import { AuthRateBucket } from '../models/AuthState.js';
import { auditKey, securityAudit } from '../services/securityAudit.js';
import { AppError } from '../utils/AppError.js';

// Kho dùng chung giữa các instance; lưu trong MongoDB AuthRateBucket với TTL tự hủy
export async function consumeAuthLimit(key, limit, windowMs = 15 * 60000, customMessage = null) {
  const slot = Math.floor(Date.now() / windowMs);
  const id = auditKey(`${key}:${slot}`);
  let bucket;
  try {
    bucket = await AuthRateBucket.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((slot + 2) * windowMs) } },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    bucket = await AuthRateBucket.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 } },
      { returnDocument: 'after' }
    );
  }
  if (bucket.count > limit) {
    securityAudit('rate_limit', key);
    const retryAfter = Math.max(1, Math.ceil(((slot + 1) * windowMs - Date.now()) / 1000));
    const msg = customMessage || `Bạn đã thao tác quá nhanh hoặc vượt hạn mức cho phép. Vui lòng chờ ${retryAfter} giây rồi thử lại.`;
    const error = new AppError(msg, 429, 'RATE_LIMITED');
    error.retryAfter = retryAfter;
    throw error;
  }
}

/**
 * Giới hạn tần suất thao tác AI (Dialogue tranh tụng, Voice TTS, Chấm điểm)
 * Ngăn chặn người dùng cố tình spam đốt token hoặc tấn công làm quá tải hệ thống.
 */
export async function consumeAiLimit(key, limit, windowMs, customMessage) {
  return consumeAuthLimit(key, limit, windowMs, customMessage);
}
export async function authRateLimit(request, response, next) {
  try {
    if (request.path === '/me' || request.path === '/logout') return next();
    await consumeAuthLimit(`ip:${request.ip}:${request.path}`, 40);
    const email = request.body?.email;
    if (typeof email === 'string') await consumeAuthLimit(`email:${email.trim().toLowerCase()}:${request.path}`, 10);
    next();
  } catch (error) { if (error.statusCode === 429) response.setHeader('Retry-After', '900'); next(error); }
}
