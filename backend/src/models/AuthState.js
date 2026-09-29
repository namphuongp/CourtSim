import mongoose from 'mongoose';

const pending = new mongoose.Schema({
  challenge: { type: String, required: true, unique: true },
  email: { type: String, required: true, index: true },
  accountVersion: Number, accountId: mongoose.Schema.Types.ObjectId,
  name: String, passwordHash: { type: String, select: false },
  purpose: { type: String, enum: ['register', 'verify', 'reset', 'set_password'], required: true },
  otpHash: { type: String, select: false }, otpExpiresAt: Date,
  attempts: { type: Number, default: 0 }, resendCount: { type: Number, default: 0 },
  lastSentAt: Date, consumed: { type: Boolean, default: false },
  deliverySuppressed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
pending.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Một đăng ký đang chờ cho mỗi email/mục đích; OTP mới luôn thay OTP cũ.
pending.index({ email: 1, purpose: 1 }, { unique: true });
export const PendingRegistration = mongoose.model('PendingRegistration', pending);

const session = new mongoose.Schema({
  authVersion: { type: Number, default: 0 },
  device: { type: String, maxlength: 80, default: null },
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true }, idleExpiresAt: { type: Date, required: true },
}, { timestamps: true });
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuthSession = mongoose.model('AuthSession', session);

const bucket = new mongoose.Schema({ _id: String, count: Number, expiresAt: Date });
bucket.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AuthRateBucket = mongoose.model('AuthRateBucket', bucket);

const oauth = new mongoose.Schema({
  stateHash: { type: String, unique: true }, nonce: String, verifier: String,
  linkSessionHash: String, linkAuthVersion: Number,
  browserHash: String, returnTo: String, linkUserId: mongoose.Schema.Types.ObjectId,
  expiresAt: Date,
});
oauth.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const OAuthAttempt = mongoose.model('OAuthAttempt', oauth);
