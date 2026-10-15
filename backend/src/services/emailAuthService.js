import { providerNames, versionMatch } from './accountService.js';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import { PendingRegistration, AuthSession } from '../models/AuthState.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { sendVerificationEmail } from './emailService.js';
import { securityAudit } from './securityAudit.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';

export function validateBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new AppError('Thông tin gửi lên không hợp lệ.');
}
export function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AppError('Email không hợp lệ.');
  return value.trim().toLowerCase();
}
export function validatePassword(password, confirm) {
  if (typeof password !== 'string' || password.length < 8 || !/\p{Lu}/u.test(password) || !/[0-9]/.test(password)) throw new AppError('Mật khẩu cần ít nhất 8 ký tự, có chữ hoa và số.');
  if (Buffer.byteLength(password) > 72) throw new AppError('Mật khẩu quá dài. Vui lòng chọn mật khẩu ngắn hơn.');
  if (confirm !== password) throw new AppError('Hai mật khẩu chưa khớp.');
}
export const otpDigest = (challenge, otp) => createHmac('sha256', env.JWT_SECRET).update(`otp:${challenge}:${otp}`).digest('hex');
export function challengeView(challenge = randomUUID()) {
  return { challenge, expiresAt: new Date(Date.now() + 5 * 60000).toISOString(), resendAt: new Date(Date.now() + 60000).toISOString(), message: 'Nếu thông tin phù hợp, mã xác thực sẽ được gửi đến email của bạn.' };
}
export async function startChallenge({ email, name, passwordHash, purpose, deliverySuppressed = false, accountVersion, accountId }, sendEmail = sendVerificationEmail, checkLimit = true) {
  if (checkLimit) await consumeAuthLimit(`mail:${email}`, 5);
  const now = new Date();
  const challenge = randomUUID();
  const otp = String(randomInt(0, 1000000)).padStart(6, '0');
  const value = { challenge, name, passwordHash, accountVersion, accountId, deliverySuppressed, otpHash: otpDigest(challenge, otp), otpExpiresAt: new Date(Date.now() + 300000), lastSentAt: now, attempts: 0, consumed: false, resendCount: 0, expiresAt: new Date(Date.now() + 86400000) };
  let pending;
  try {
    pending = await PendingRegistration.findOneAndUpdate({ email, purpose, $or: [{ lastSentAt: { $lte: new Date(Date.now() - 60000) } }, { lastSentAt: { $exists: false } }] }, { $set: value }, { upsert: true, returnDocument: 'after' });
  } catch (error) { if (error.code !== 11000) throw error; return challengeView(); }
  try { if (!deliverySuppressed) await sendEmail({ email, otp, idempotencyKey: `otp-${challenge}` }); }
  catch (error) {
    securityAudit('email_delivery_failure', email);
    if (error.code !== 'EMAIL_UNAVAILABLE') { await PendingRegistration.updateOne({ _id: pending._id, challenge }, { $set: { consumed: true } }); throw error; }
  }
  return challengeView(challenge);
}
export async function resendChallenge(challenge, sendEmail = sendVerificationEmail) {
  if (typeof challenge !== 'string' || !/^[a-f0-9-]{36}$/.test(challenge)) throw new AppError('Yêu cầu xác thực không hợp lệ.');
  const pending = await PendingRegistration.findOne({ challenge, consumed: false, expiresAt: { $gt: new Date() } }).select('+otpHash');
  if (!pending) return challengeView(challenge);
  await consumeAuthLimit(`mail:${pending.email}`, 5);
  let otp;
  do { otp = String(randomInt(0, 1000000)).padStart(6, '0'); } while (otpDigest(challenge, otp) === pending.otpHash);
  const updated = await PendingRegistration.findOneAndUpdate({ _id: pending._id, challenge, consumed: false, resendCount: { $lt: 5 }, lastSentAt: { $lte: new Date(Date.now() - 60000) } }, { $set: { otpHash: otpDigest(challenge, otp), otpExpiresAt: new Date(Date.now() + 300000), lastSentAt: new Date(), attempts: 0 }, $inc: { resendCount: 1 } }, { returnDocument: 'after' });
  if (!updated) { securityAudit('otp_resend_limit', pending.email); throw new AppError('Chưa thể gửi lại mã. Hãy chờ ít nhất 60 giây hoặc bắt đầu lại sau.', 429, 'OTP_COOLDOWN'); }
  try { if (!pending.deliverySuppressed) await sendEmail({ email: pending.email, otp, idempotencyKey: `otp-${challenge}-${updated.resendCount}` }); }
  catch (error) { securityAudit('email_delivery_failure', pending.email); if (error.code !== 'EMAIL_UNAVAILABLE') throw error; }
  return challengeView(challenge);
}
export async function verifyChallenge(challenge, otp, purpose, newPassword, expectedAccount) {
  if (typeof challenge !== 'string' || !/^[a-f0-9-]{36}$/.test(challenge) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw new AppError('Mã xác thực gồm 6 chữ số.', 400, 'OTP_INVALID');
  const filter = { ...(expectedAccount ? { email: expectedAccount.email, accountId: expectedAccount._id, accountVersion: expectedAccount.auth_version ?? 0 } : {}), challenge, purpose: { $in: purpose }, consumed: false, otpExpiresAt: { $gt: new Date() }, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  // Cả lần sai và đúng cùng tăng bộ đếm nguyên tử; chỉ một yêu cầu được tiêu thụ mã.
  const pending = await PendingRegistration.findOneAndUpdate(filter, { $inc: { attempts: 1 } }, { returnDocument: 'after' }).select('+otpHash +passwordHash');
  if (pending?.deliverySuppressed || !pending?.otpHash || !timingSafeEqual(Buffer.from(pending.otpHash, 'hex'), Buffer.from(otpDigest(challenge, otp), 'hex'))) {
    securityAudit(pending?.attempts >= 5 ? 'otp_attempts_exhausted' : 'otp_failure', challenge);
    throw new AppError('Mã xác thực không đúng hoặc đã hết hạn. Kiểm tra mã hoặc yêu cầu gửi lại.', 400, 'OTP_INVALID');
  }
  const claimed = await PendingRegistration.updateOne({ ...filter, otpHash: pending.otpHash, attempts: { $lte: 5 } }, { $set: { consumed: true }, $unset: { otpHash: 1 } });
  if (!claimed.modifiedCount) throw new AppError('Mã xác thực đã được sử dụng. Vui lòng đăng nhập hoặc gửi lại mã.', 400, 'OTP_INVALID');
  let user = await User.findOne({ email: pending.email }).select('+password_hash');
  if (pending.purpose === 'register') {
    if (user) throw new AppError('Vui lòng đăng nhập bằng phương thức đã đăng ký.', 409, 'AUTH_CONFLICT');
    try { user = await User.create({ username: pending.name, email: pending.email, password_hash: pending.passwordHash, email_verified: true, auth_providers: ['password'] }); }
    catch (error) { if (error.code !== 11000) throw error; throw new AppError('Vui lòng đăng nhập bằng phương thức đã đăng ký.', 409, 'AUTH_CONFLICT'); }
  } else {
    if (!user || user.status !== 'active') throw new AppError('Không thể xác thực tài khoản này.', 400, 'OTP_INVALID');
    if ((pending.accountId && String(pending.accountId) !== String(user._id)) || (pending.accountVersion !== undefined && pending.accountVersion !== (user.auth_version ?? 0))) throw new AppError('Tài khoản đã thay đổi. Vui lòng bắt đầu lại.', 409, 'AUTH_CONFLICT');
    const credentialsChanged = ['reset', 'set_password'].includes(pending.purpose);
    if (credentialsChanged) {
      if ((pending.accountId && String(pending.accountId) !== String(user._id)) || (pending.accountVersion !== undefined && pending.accountVersion !== (user.auth_version ?? 0))
        || (pending.purpose === 'set_password' && (!expectedAccount || user.password_hash || !user.google_id))
        || (pending.purpose === 'reset' && !user.password_hash)) throw new AppError('Tài khoản đã thay đổi. Vui lòng bắt đầu lại.', 409, 'AUTH_CONFLICT');
      validatePassword(newPassword, newPassword);
      const nextHash = await bcrypt.hash(newPassword, 12);
      const updated = await User.updateOne({ _id: user._id, status: 'active', ...versionMatch(user) }, {
        $set: { password_hash: nextHash, email_verified: true, auth_providers: ['password', ...(user.google_id ? ['google'] : [])] }, $inc: { auth_version: 1 },
      });
      if (!updated.modifiedCount) throw new AppError('Tài khoản đã thay đổi. Vui lòng bắt đầu lại.', 409, 'AUTH_CONFLICT');
      await AuthSession.deleteMany({ userId: user._id });
      await PendingRegistration.deleteMany({ email: user.email, purpose: { $in: ['reset', 'set_password'] } });
      securityAudit(pending.purpose === 'set_password' ? 'PASSWORD_SET' : 'PASSWORD_CHANGED', user.email);
    } else {
      const verified = await User.updateOne({ _id: user._id, status: 'active', ...versionMatch(user) }, { $set: { email_verified: true, auth_providers: providerNames(user) } });
      if (!verified.matchedCount) throw new AppError('Tài khoản đã thay đổi. Vui lòng bắt đầu lại.', 409, 'AUTH_CONFLICT');
    }
    const expectedVersion = (user.auth_version ?? 0) + (credentialsChanged ? 1 : 0);
    user = await User.findById(user._id).select('+password_hash');
    if (!user || user.status !== 'active' || (user.auth_version ?? 0) !== expectedVersion) throw new AppError('Tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 409, 'AUTH_CONFLICT');
  }
  await PendingRegistration.deleteOne({ _id: pending._id, challenge });
  securityAudit('otp_verified', user.email);
  return user;
}
