import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function securityHeaders(_request, response, next) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  next();
}

export function corsOptions(requestOrigin, callback) {
  // Cho phép Postman/health check không gửi Origin; trình duyệt phải thuộc allowlist.
  if (!requestOrigin || env.CLIENT_ORIGINS.includes(requestOrigin)) return callback(null, true);
  return callback(new AppError('Không thể thực hiện yêu cầu từ trang này. Hãy mở lại CourtSim.', 403, 'CORS_DENIED'));
}
