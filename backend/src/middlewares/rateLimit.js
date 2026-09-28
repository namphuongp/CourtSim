import { AppError } from '../utils/AppError.js';

const attempts = new Map();

export function authRateLimit(request, _response, next) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const key = request.ip;
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (current.count >= 20) return next(new AppError('Bạn đã thử nhiều lần liên tiếp. Vui lòng chờ một lúc rồi thử lại.', 429, 'RATE_LIMITED'));
  current.count += 1;
  next();
}

// Tránh Map tăng vô hạn với server chạy lâu.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
}, 15 * 60 * 1000).unref();
