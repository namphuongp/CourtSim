import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
export const providerNames = user => [ ...(user.password_hash ? ['password'] : []), ...(user.google_id ? ['google'] : []) ];
export const versionMatch = user => ({ $expr: { $eq: [{ $ifNull: ['$auth_version', 0] }, user.auth_version ?? 0] } });
export function profileView(user) {
  return { full_name: user.username, email: user.email, joinedAt: user.created_at, emailVerified: user.email_verified === true,
    hasPassword: Boolean(user.password_hash), googleLinked: Boolean(user.google_id), googleEmail: user.google_id ? user.google_email ?? null : null, authProviders: providerNames(user) };
}
export async function currentAccount(request) {
  const user = await User.findById(request.auth.userId).select('+password_hash');
  if (!user || user.status !== 'active' || (user.auth_version ?? 0) !== request.auth.authVersion) throw new AppError('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.', 401, 'INVALID_TOKEN');
  return user;
}
export async function checkCurrentPassword(user, value) {
  if (!user.password_hash) throw new AppError('Tài khoản chưa có mật khẩu. Hãy thiết lập mật khẩu trước.', 409, 'PASSWORD_NOT_SET');
  if (typeof value !== 'string' || !value || value.length > 128 || !await bcrypt.compare(value, user.password_hash)) throw new AppError('Mật khẩu hiện tại chưa đúng. Vui lòng kiểm tra lại.', 400, 'CURRENT_PASSWORD_INVALID');
}
export function validateName(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 100 || /[\u0000-\u001f\u007f]/u.test(value)) throw new AppError('Họ và tên cần từ 2 đến 100 ký tự, không chứa ký tự điều khiển.');
  return value.trim();
}
export function deviceLabel(agent = '') {
  const value = typeof agent === 'string' ? agent.slice(0, 1000) : '';
  const browser = /Edg\//.test(value) ? 'Edge' : /Firefox\//.test(value) ? 'Firefox' : /Chrome\/|CriOS\//.test(value) ? 'Chrome' : /Safari\//.test(value) ? 'Safari' : 'Trình duyệt';
  const os = /Android/.test(value) ? 'Android' : /iPhone|iPad/.test(value) ? 'iOS' : /Windows/.test(value) ? 'Windows' : /Macintosh/.test(value) ? 'macOS' : /Linux/.test(value) ? 'Linux' : '';
  return value ? browser + (os ? ` · ${os}` : '') : null;
}
