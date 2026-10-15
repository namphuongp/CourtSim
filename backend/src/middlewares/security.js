import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function securityHeaders(_request, response, next) {
  if (env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000');
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

function isSepayWebhook(request) {
  return request.method === 'POST' && request.path === '/api/payments/sepay/webhook';
}

export function browserMutationGuard(request, _response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  if (isSepayWebhook(request)) return next();
  // Endpoint máy chủ xác thực bằng HMAC; các API dùng cookie vẫn giữ kiểm tra CSRF.
  if (request.method === 'POST' && request.path === '/api/v1/survey/google-forms') return next();
  // Cookie xác thực cần chống CSRF kể cả khi trình duyệt không gửi Origin.
  if (!env.CLIENT_ORIGINS.includes(request.headers.origin) || request.headers['x-courtsim-request'] !== '1') {
    return next(new AppError('Yêu cầu không hợp lệ. Hãy tải lại trang và thử lại.', 403, 'CSRF_DENIED'));
  }
  next();
}
