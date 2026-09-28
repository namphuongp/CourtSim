import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AuthSession } from '../models/AuthState.js';
import { env } from '../config/env.js';
import { authRateLimit, consumeAuthLimit } from '../middlewares/rateLimit.js';
import { authenticate } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, normalizeEmail, validatePassword, startChallenge, resendChallenge, verifyChallenge } from '../services/emailAuthService.js';
import { assertEmailReady } from '../services/emailService.js';
import { cookie, cookieOptions, hash, SESSION_COOKIE, issueSession, publicUser } from '../services/authSession.js';
import { securityAudit } from '../services/securityAudit.js';
import { startGoogle, completeGoogle } from '../services/googleAuthService.js';

// Hash giả cân bằng công việc bcrypt khi email không tồn tại; không phải mật khẩu tài khoản.
const dummyHash = bcrypt.hashSync('dummy-not-an-account-password', 12);
export function createAuthRoutes({ sendEmail } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authRateLimit);
  router.post('/register', asyncHandler(async (req, res) => {
    validateBody(req.body, ['full_name', 'email', 'password', 'confirm_password']);
    const email = normalizeEmail(req.body.email), name = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    if (typeof name !== 'string' || name.length < 2 || name.length > 100) throw new AppError('Họ tên cần từ 2 đến 100 ký tự.');
    validatePassword(req.body.password, req.body.confirm_password);
    if (env.AUTH_EMAIL_VERIFICATION_DISABLED) {
      if (await User.exists({ email })) throw new AppError('Email đã được đăng ký. Vui lòng đăng nhập.', 409, 'EMAIL_EXISTS');
      let user;
      try {
        user = await User.create({ username: name, email, password_hash: await bcrypt.hash(req.body.password, 12), email_verified: false, auth_providers: ['password'] });
      } catch (error) {
        if (error.code === 11000) throw new AppError('Email đã được đăng ký. Vui lòng đăng nhập.', 409, 'EMAIL_EXISTS');
        throw error;
      }
      return res.status(201).json({ user: await issueSession(req, res, user) });
    }
    if (!sendEmail) assertEmailReady();
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await consumeAuthLimit(`mail:${email}`, 5);
    const existing = await User.exists({ email });
    const data = await startChallenge({ email, name, passwordHash: existing ? undefined : passwordHash, purpose: 'register', deliverySuppressed: Boolean(existing) }, sendEmail, false);
    res.status(202).json({ data });
  }));
  router.post('/login', asyncHandler(async (req, res) => {
    validateBody(req.body, ['email', 'password']);
    const email = normalizeEmail(req.body.email), password = req.body.password;
    if (typeof password !== 'string' || password.length > 128) throw new AppError('Email hoặc mật khẩu không hợp lệ.');
    const user = await User.findOne({ email }).select('+password_hash');
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !user.password_hash || !valid) { securityAudit('login_failure', email); throw new AppError('Email hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS'); }
    if (user.status !== 'active') throw new AppError('Tài khoản đã bị khóa.', 403, 'ACCOUNT_DISABLED');
    if (!user.email_verified && !env.AUTH_EMAIL_VERIFICATION_DISABLED) {
      if (!sendEmail) assertEmailReady();
      return res.status(202).json({ verificationRequired: true, data: await startChallenge({ email, purpose: 'verify' }, sendEmail) });
    }
    securityAudit('login_success', email);
    res.json({ user: await issueSession(req, res, user) });
  }));
  router.post('/verify-email', asyncHandler(async (req, res) => {
    validateBody(req.body, ['challenge', 'otp']);
    const user = await verifyChallenge(req.body.challenge, req.body.otp, ['register', 'verify']);
    res.json({ user: await issueSession(req, res, user) });
  }));
  router.post('/resend-verification', asyncHandler(async (req, res) => {
    validateBody(req.body, ['challenge']);
    res.status(202).json({ data: await resendChallenge(req.body.challenge, sendEmail) });
  }));
  router.post('/forgot-password', asyncHandler(async (req, res) => {
    validateBody(req.body, ['email']);
    const email = normalizeEmail(req.body.email);
    if (!sendEmail) assertEmailReady();
    await consumeAuthLimit(`mail:${email}`, 5);
    const user = await User.findOne({ email, status: 'active' }).select('+password_hash');
    res.status(202).json({ data: await startChallenge({ email, purpose: 'reset', deliverySuppressed: !user?.password_hash }, sendEmail, false) });
  }));
  router.post('/reset-password', asyncHandler(async (req, res) => {
    validateBody(req.body, ['challenge', 'otp', 'password', 'confirm_password']);
    validatePassword(req.body.password, req.body.confirm_password);
    await verifyChallenge(req.body.challenge, req.body.otp, ['reset'], req.body.password);
    res.clearCookie(SESSION_COOKIE, cookieOptions).json({ message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' });
  }));
  router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.authUser) }));
  router.post('/logout', asyncHandler(async (req, res) => {
    const token = cookie(req, SESSION_COOKIE);
    if (token) await AuthSession.deleteOne({ tokenHash: hash(token) });
    res.clearCookie(SESSION_COOKIE, cookieOptions).json({ message: 'Đã đăng xuất.' });
  }));
  router.post('/google/start', asyncHandler(async (req, res) => {
    validateBody(req.body, ['returnTo']);
    res.json({ url: await startGoogle(req, res, req.body.returnTo) });
  }));
  router.post('/google/link', authenticate, asyncHandler(async (req, res) => {
    validateBody(req.body, ['password']);
    const user = await User.findById(req.auth.userId).select('+password_hash');
    if (typeof req.body.password !== 'string' || req.body.password.length > 128 || !user.password_hash || !await bcrypt.compare(req.body.password, user.password_hash)) throw new AppError('Mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
    res.json({ url: await startGoogle(req, res, '/dashboard', user._id) });
  }));
  router.get('/google/callback', async (req, res) => {
    const frontend = env.CLIENT_ORIGINS[0];
    try {
      const { user, returnTo } = await completeGoogle(req, res);
      await issueSession(req, res, user);
      securityAudit('google_login_success', user.email);
      res.redirect(`${frontend}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      securityAudit('google_login_failure');
      res.clearCookie('courtsim_oauth', cookieOptions);
      res.redirect(`${frontend}/login?googleError=${error.code === 'GOOGLE_LINK_REQUIRED' ? 'link' : 'failed'}`);
    }
  });
  return router;
}
export default createAuthRoutes();
