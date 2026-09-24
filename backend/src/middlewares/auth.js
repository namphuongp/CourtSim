import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(request, _response, next) {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next(new AppError('Yêu cầu đăng nhập.', 401, 'UNAUTHORIZED'));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'courtsim-api', audience: 'courtsim-web' });
    request.auth = { userId: payload.sub, role: payload.role, tier: payload.tier };
    next();
  } catch {
    next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_TOKEN'));
  }
}

export function requireAdmin(request, _response, next) {
  if (request.auth?.role !== 'admin') return next(new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN'));
  next();
}
