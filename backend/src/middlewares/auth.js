import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(request, _response, next) {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next(new AppError('Vui lòng đăng nhập để tiếp tục.', 401, 'UNAUTHORIZED'));
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'courtsim-api', audience: 'courtsim-web' });
    if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) throw new Error();
  } catch {
    return next(new AppError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401, 'INVALID_TOKEN'));
  }
  try {
    const user = await User.findById(payload.sub).select('status system_role subscription_type').lean();
    if (!user) return next(new AppError('Tài khoản không còn tồn tại.', 401, 'UNAUTHORIZED'));
    if (user.status !== 'active') return next(new AppError('Tài khoản đã bị khóa.', 403, 'ACCOUNT_DISABLED'));
    request.auth = { userId: payload.sub, role: user.system_role, tier: user.subscription_type };
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(request, _response, next) {
  if (request.auth?.role !== 'admin') return next(new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN'));
  next();
}
