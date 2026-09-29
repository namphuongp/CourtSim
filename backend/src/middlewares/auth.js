import User from '../models/User.js';
import { env } from '../config/env.js';
import { AuthSession } from '../models/AuthState.js';
import { cookie, hash, SESSION_COOKIE } from '../services/authSession.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(request, response, next) {
  try {
    const token = cookie(request, SESSION_COOKIE);
    if (!token) throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401, 'UNAUTHORIZED');
    const now = new Date();
    const session = await AuthSession.findOneAndUpdate({ tokenHash: hash(token), expiresAt: { $gt: now }, idleExpiresAt: { $gt: now } }, { $set: { idleExpiresAt: new Date(Date.now() + 30 * 60000) } }, { returnDocument: 'after' }).lean();
    if (!session) throw new AppError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401, 'INVALID_TOKEN');
    const user = await User.findById(session.userId).select('+password_hash').lean();
    if (!user) throw new AppError('Vui lòng đăng nhập lại.', 401, 'UNAUTHORIZED');
    if ((session.authVersion ?? 0) !== (user.auth_version ?? 0)) throw new AppError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401, 'INVALID_TOKEN');
    if (user.status !== 'active') throw new AppError('Tài khoản đã bị khóa.', 403, 'ACCOUNT_DISABLED');
    if (!user.email_verified && !env.AUTH_EMAIL_VERIFICATION_DISABLED) throw new AppError('Vui lòng xác thực email để tiếp tục.', 403, 'EMAIL_NOT_VERIFIED');
    request.auth = { userId: String(user._id), role: user.system_role, tier: user.subscription_type, sessionId: session._id, authVersion: user.auth_version ?? 0 };
    request.authUser = user;
    response.setHeader('Cache-Control', 'no-store');
    next();
  } catch (error) { next(error); }
}
export function requireAdmin(request, _response, next) {
  if (request.auth?.role !== 'admin') return next(new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN'));
  next();
}
