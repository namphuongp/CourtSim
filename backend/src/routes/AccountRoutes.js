import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AuthSession, PendingRegistration } from '../models/AuthState.js';
import { authenticate } from '../middlewares/auth.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { publicUser, SESSION_COOKIE, cookieOptions, issueSession } from '../services/authSession.js';
import { currentAccount, profileView, validateName, checkCurrentPassword, versionMatch } from '../services/accountService.js';
import { validateBody, validatePassword, startChallenge, verifyChallenge } from '../services/emailAuthService.js';
import { assertEmailReady } from '../services/emailService.js';
import { securityAudit } from '../services/securityAudit.js';

export function createAccountRoutes({ sendEmail } = {}) {
  const router = Router();
  router.use(authenticate);
  router.use(asyncHandler(async (req, _res, next) => {
    if (req.method !== 'GET') await consumeAuthLimit(`account:${req.auth.userId}:${req.path}`, req.path === '/' ? 30 : 10);
    next();
  }));
  router.get('/', asyncHandler(async (req, res) => {
    const user = await currentAccount(req);
    res.json({ data: { ...profileView(user), verificationAvailable: !env.AUTH_EMAIL_VERIFICATION_DISABLED } });
  }));
  router.patch('/', asyncHandler(async (req, res) => {
    validateBody(req.body, ['full_name']);
    const name = validateName(req.body.full_name);
    const user = await currentAccount(req);
    const updated = await User.findOneAndUpdate({ _id: user._id, status: 'active', ...versionMatch(user) }, { $set: { username: name } }, { returnDocument: 'after', runValidators: true }).select('+password_hash');
    if (!updated) throw new AppError('Tài khoản đã thay đổi. Vui lòng tải lại trang.', 409, 'AUTH_CONFLICT');
    securityAudit('PROFILE_UPDATED', user.email);
    res.json({ data: profileView(updated), user: publicUser(updated) });
  }));
  router.post('/password', asyncHandler(async (req, res) => {
    validateBody(req.body, ['current_password', 'password', 'confirm_password']);
    validatePassword(req.body.password, req.body.confirm_password);
    const user = await currentAccount(req);
    await checkCurrentPassword(user, req.body.current_password);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    // Version chặn phiên/đăng nhập cũ quay lại sau khi thu hồi, kể cả yêu cầu chạy đồng thời.
    const updated = await User.updateOne({ _id: user._id, password_hash: user.password_hash, status: 'active', ...versionMatch(user) }, {
      $set: { password_hash: passwordHash, auth_providers: ['password', ...(user.google_id ? ['google'] : [])] }, $inc: { auth_version: 1 },
    });
    if (!updated.modifiedCount) throw new AppError('Tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 409, 'AUTH_CONFLICT');
    await AuthSession.deleteMany({ userId: user._id });
    await PendingRegistration.deleteMany({ email: user.email, purpose: { $in: ['reset', 'set_password'] } });
    securityAudit('PASSWORD_CHANGED', user.email);
    res.clearCookie(SESSION_COOKIE, cookieOptions).json({ message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' });
  }));
  router.post('/password/otp', asyncHandler(async (req, res) => {
    validateBody(req.body, []);
    const user = await currentAccount(req);
    if (user.password_hash || !user.google_id) throw new AppError('Hãy dùng chức năng đổi mật khẩu của tài khoản.', 409, 'PASSWORD_ALREADY_SET');
    if (!sendEmail) assertEmailReady();
    const data = await startChallenge({ email: user.email, purpose: 'set_password', accountId: user._id, accountVersion: user.auth_version ?? 0 }, sendEmail);
    res.status(202).json({ data });
  }));
  router.post('/password/set', asyncHandler(async (req, res) => {
    validateBody(req.body, ['challenge', 'otp', 'password', 'confirm_password']);
    validatePassword(req.body.password, req.body.confirm_password);
    const user = await currentAccount(req);
    if (user.password_hash || !user.google_id) throw new AppError('Tài khoản đã có mật khẩu hoặc đã thay đổi. Vui lòng tải lại trang.', 409, 'AUTH_CONFLICT');
    await verifyChallenge(req.body.challenge, req.body.otp, ['set_password'], req.body.password, user);
    res.clearCookie(SESSION_COOKIE, cookieOptions).json({ message: 'Đã thiết lập mật khẩu. Vui lòng đăng nhập lại.' });
  }));
  router.post('/verification', asyncHandler(async (req, res) => {
    validateBody(req.body, []);
    const user = await currentAccount(req);
    if (user.email_verified) throw new AppError('Email đã được xác thực.', 409);
    if (env.AUTH_EMAIL_VERIFICATION_DISABLED) throw new AppError('Xác thực email đang tạm dừng.', 409, 'EMAIL_VERIFICATION_PAUSED');
    if (!sendEmail) assertEmailReady();
    res.status(202).json({ data: await startChallenge({ email: user.email, purpose: 'verify', accountId: user._id, accountVersion: user.auth_version ?? 0 }, sendEmail) });
  }));
  router.post('/verification/confirm', asyncHandler(async (req, res) => {
    validateBody(req.body, ['challenge', 'otp']);
    const user = await currentAccount(req);
    const verified = await verifyChallenge(req.body.challenge, req.body.otp, ['verify'], undefined, user);
    res.json({ data: profileView(verified), user: publicUser(verified) });
  }));
  router.get('/sessions', asyncHandler(async (req, res) => {
    const page = req.query.page ?? '1';
    if (Object.keys(req.query).some(key => key !== 'page') || typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page)) throw new AppError('Trang không hợp lệ.');
    const now = new Date();
    const filter = { userId: req.authUser._id, expiresAt: { $gt: now }, idleExpiresAt: { $gt: now }, $expr: { $eq: [{ $ifNull: ['$authVersion', 0] }, req.auth.authVersion] } };
    const [items, total] = await Promise.all([
      AuthSession.aggregate([{ $match: filter }, { $addFields: { current: { $eq: ['$_id', req.auth.sessionId] } } }, { $sort: { current: -1, createdAt: -1, _id: -1 } }, { $skip: (Number(page) - 1) * 20 }, { $limit: 20 }, { $project: { _id: 0, current: 1, device: 1, createdAt: 1, updatedAt: 1 } }]),
      AuthSession.countDocuments(filter),
    ]);
    res.json({ data: items, pagination: { page: Number(page), limit: 20, total } });
  }));
  router.post('/logout-others', asyncHandler(async (req, res) => {
    validateBody(req.body, []);
    const result = await AuthSession.deleteMany({ userId: req.auth.userId, _id: { $ne: req.auth.sessionId } });
    securityAudit('OTHER_SESSIONS_REVOKED', req.authUser.email);
    res.json({ message: 'Đã đăng xuất khỏi các thiết bị khác.', revoked: result.deletedCount });
  }));
  router.post('/logout-all', asyncHandler(async (req, res) => {
    validateBody(req.body, []);
    await User.updateOne({ _id: req.auth.userId }, { $inc: { auth_version: 1 } });
    await AuthSession.deleteMany({ userId: req.auth.userId });
    securityAudit('ALL_SESSIONS_REVOKED', req.authUser.email);
    res.clearCookie(SESSION_COOKIE, cookieOptions).json({ message: 'Đã đăng xuất khỏi tất cả thiết bị.' });
  }));
  router.delete('/google', asyncHandler(async (req, res) => {
    validateBody(req.body, ['password']);
    const user = await currentAccount(req);
    if (!user.password_hash) throw new AppError('Bạn cần thiết lập mật khẩu trước khi hủy liên kết Google.', 409, 'LAST_LOGIN_METHOD');
    await checkCurrentPassword(user, req.body.password);
    if (!user.google_id) throw new AppError('Tài khoản chưa liên kết Google.', 409, 'GOOGLE_NOT_LINKED');
    const updated = await User.findOneAndUpdate({ _id: user._id, status: 'active', google_id: user.google_id, password_hash: user.password_hash, ...versionMatch(user) }, {
      $unset: { google_id: 1, google_email: 1 }, $set: { auth_providers: ['password'] }, $inc: { auth_version: 1 },
    }, { returnDocument: 'after' }).select('+password_hash');
    if (!updated) throw new AppError('Tài khoản đã thay đổi. Vui lòng tải lại trang.', 409, 'AUTH_CONFLICT');
    await AuthSession.deleteMany({ userId: user._id });
    const currentUser = await issueSession(req, res, updated);
    securityAudit('GOOGLE_UNLINKED', user.email);
    res.json({ data: profileView(updated), user: currentUser, message: 'Đã hủy liên kết Google. Các phiên đăng nhập khác đã được đăng xuất.' });
  }));
  return router;
}
