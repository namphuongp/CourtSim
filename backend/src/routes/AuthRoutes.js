import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { authRateLimit } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(authRateLimit);

router.post('/register', asyncHandler(async (request, response) => {
  const fullName = request.body?.full_name?.trim();
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;

  if (!fullName || fullName.length < 2 || fullName.length > 100) throw new AppError('Họ tên phải có từ 2 đến 100 ký tự.');
  if (!email || !emailPattern.test(email) || email.length > 254) throw new AppError('Email không hợp lệ.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new AppError('Mật khẩu phải có từ 8 đến 128 ký tự.');
  if (await User.exists({ email })) throw new AppError('Email đã tồn tại.', 409, 'USER_EXISTS');

  const user = await User.create({ username: fullName, email, password_hash: await bcrypt.hash(password, 12) });
  response.status(201).json({ message: 'Đăng ký thành công.', data: { id: user.id, full_name: user.username, email: user.email } });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;
  if (!email || typeof password !== 'string') throw new AppError('Email và mật khẩu là bắt buộc.');

  const user = await User.findOne({ email }).select('+password_hash');
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new AppError('Email hoặc mật khẩu không chính xác.', 401, 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw new AppError('Tài khoản đã bị khóa.', 403, 'ACCOUNT_DISABLED');

  const token = jwt.sign({ sub: user.id, role: user.system_role, tier: user.subscription_type }, env.JWT_SECRET, { expiresIn: '1d', issuer: 'courtsim-api', audience: 'courtsim-web' });
  response.json({ token, user: { id: user.id, full_name: user.username, email: user.email, tier: user.subscription_type, role: user.system_role } });
}));

export default router;
