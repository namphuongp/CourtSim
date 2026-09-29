import { AuthRateBucket } from '../models/AuthState.js';
import { auditKey, securityAudit } from '../services/securityAudit.js';
import { AppError } from '../utils/AppError.js';

// Kho dùng chung giữa các instance; có thể thay adapter này bằng Redis.
export async function consumeAuthLimit(key, limit, windowMs = 15 * 60000) {
  const slot = Math.floor(Date.now() / windowMs);
  const id = auditKey(`${key}:${slot}`);
  let bucket;
  try {
    bucket = await AuthRateBucket.findOneAndUpdate({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((slot + 2) * windowMs) } }, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    bucket = await AuthRateBucket.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  }
  if (bucket.count > limit) {
    securityAudit('rate_limit', key);
    const error = new AppError('Bạn đã dùng hết lượt trong khoảng thời gian này. Vui lòng chờ rồi thử lại.', 429, 'RATE_LIMITED');
    error.retryAfter = Math.max(1, Math.ceil(((slot + 1) * windowMs - Date.now()) / 1000));
    throw error;
  }
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
