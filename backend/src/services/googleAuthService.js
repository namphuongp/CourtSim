import { versionMatch } from './accountService.js';
import jwt from 'jsonwebtoken';
import { createPublicKey, createHash } from 'node:crypto';
import User from '../models/User.js';
import { OAuthAttempt, AuthSession } from '../models/AuthState.js';
import { secret, hash, cookie, cookieOptions, SESSION_COOKIE } from './authSession.js';
import { AppError } from '../utils/AppError.js';
import { normalizeEmail } from './emailAuthService.js';

let keyCache = { keys: [], until: 0 };
export function googleConfig() {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_REDIRECT_URI: redirectUri } = process.env;
  if (!clientId || !clientSecret || !redirectUri) throw new AppError('Đăng nhập Google chưa sẵn sàng. Vui lòng dùng email và mật khẩu.', 503, 'GOOGLE_UNAVAILABLE');
  return { clientId, clientSecret, redirectUri };
}
export async function startGoogle(request, response, returnTo, linkUserId) {
  if (returnTo !== undefined && (typeof returnTo !== 'string' || returnTo.length > 2048)) throw new AppError('Đường dẫn trở về không hợp lệ.');
  const config = googleConfig();
  const state = secret(), browser = secret(), nonce = secret(), verifier = secret();
  const sessionToken = cookie(request, SESSION_COOKIE);
  if (linkUserId && (!request.auth || String(linkUserId) !== request.auth.userId || !sessionToken)) throw new AppError('Vui lòng đăng nhập lại trước khi liên kết Google.', 401, 'INVALID_TOKEN');
  await OAuthAttempt.create({ linkSessionHash: linkUserId ? hash(sessionToken) : undefined, linkAuthVersion: linkUserId ? request.auth.authVersion : undefined, stateHash: hash(state), browserHash: hash(browser), nonce, verifier, returnTo: /^\/(dashboard|simulation|admin|account)(\/|$)/.test(returnTo ?? '') ? returnTo : '/dashboard', linkUserId, expiresAt: new Date(Date.now() + 600000) });
  response.cookie('courtsim_oauth', browser, { ...cookieOptions, maxAge: 600000 });
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function verifyGoogleToken(token, nonce, fetcher = fetch) {
  const config = googleConfig();
  if (typeof token !== 'string' || token.length > 16000) throw new Error('Invalid identity');
  const decoded = jwt.decode(token, { complete: true });
  if (decoded?.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') throw new Error('Invalid identity');
  if (Date.now() >= keyCache.until) {
    const response = await fetcher('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable keys');
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new Error('Invalid keys');
    keyCache = { keys: data.keys, until: Date.now() + 3600000 };
  }
  const jwk = keyCache.keys.find(key => key.kid === decoded.header.kid && key.kty === 'RSA');
  if (!jwk) { keyCache.until = 0; throw new Error('Unknown signing key'); }
  const identity = jwt.verify(token, createPublicKey({ key: jwk, format: 'jwk' }), { algorithms: ['RS256'], audience: config.clientId, issuer: ['https://accounts.google.com', 'accounts.google.com'], maxAge: '10m' });
  if (identity.nonce !== nonce || identity.email_verified !== true || typeof identity.sub !== 'string' || !identity.sub || identity.sub.length > 255 || !Number.isFinite(identity.exp)
    || (identity.azp && identity.azp !== config.clientId) || (Array.isArray(identity.aud) && identity.aud.length > 1 && identity.azp !== config.clientId)) throw new Error('Invalid identity');
  normalizeEmail(identity.email);
  return identity;
}
export async function googleUser(identity, linkUserId, expectedVersion) {
  const email = normalizeEmail(identity.email);
  let user = await User.findOne({ google_id: identity.sub }).select('+password_hash');
  if (user) {
    if (linkUserId && String(user._id) !== String(linkUserId)) throw new AppError('Tài khoản Google này đã liên kết với tài khoản khác.', 409, 'GOOGLE_LINK_CONFLICT');
  } else {
    user = await User.findOne({ email }).select('+password_hash');
    if (user) {
      if (linkUserId && String(linkUserId) !== String(user._id)) throw new AppError('Chọn tài khoản Google có cùng email với tài khoản CourtSim.', 409, 'GOOGLE_LINK_CONFLICT');
      // Google là nguồn quản lý Gmail/Workspace; email bên thứ ba cần xác thực lại mật khẩu.
      const authoritative = email.endsWith('@gmail.com') || (typeof identity.hd === 'string' && identity.hd.toLowerCase() === email.split('@')[1]);
      if (!user.email_verified || user.google_id || (String(linkUserId ?? '') !== String(user._id) && !authoritative)) throw new AppError('Hãy đăng nhập bằng mật khẩu, xác thực email rồi liên kết Google trong tài khoản.', 409, 'GOOGLE_LINK_REQUIRED');
      if (expectedVersion !== undefined && (user.auth_version ?? 0) !== expectedVersion) throw new AppError('Phiên liên kết đã hết hạn. Vui lòng bắt đầu lại.', 409, 'GOOGLE_LINK_CONFLICT');
      user = await User.findOneAndUpdate({ _id: user._id, google_id: { $exists: false }, email_verified: true, status: 'active', ...versionMatch(user) }, { $set: { google_id: identity.sub, google_email: email, auth_providers: [...(user.password_hash ? ['password'] : []), 'google'] }, $inc: { auth_version: 1 } }, { returnDocument: 'after' }).select('+password_hash');
      if (!user) throw new AppError('Chưa thể liên kết tài khoản. Vui lòng đăng nhập lại.', 409, 'GOOGLE_LINK_CONFLICT');
    } else {
      if (linkUserId) throw new AppError('Chọn tài khoản Google có cùng email với tài khoản CourtSim.', 409, 'GOOGLE_LINK_CONFLICT');
      try { user = await User.create({ username: typeof identity.name === 'string' && identity.name.trim().length >= 2 ? identity.name.trim().slice(0, 100) : 'Người học', email, google_id: identity.sub, google_email: email, email_verified: true, auth_providers: ['google'] }); }
      catch (error) { if (error.code !== 11000) throw error; user = await User.findOne({ google_id: identity.sub }); if (!user) throw new AppError('Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.', 409, 'GOOGLE_LINK_CONFLICT'); }
    }
  }
  if (user.status !== 'active') throw new AppError('Tài khoản đã bị khóa.', 403, 'ACCOUNT_DISABLED');
  if (expectedVersion !== undefined && linkUserId && (user.auth_version ?? 0) !== expectedVersion && (user.auth_version ?? 0) !== expectedVersion + 1) throw new AppError('Phiên liên kết đã hết hạn.', 409, 'GOOGLE_LINK_CONFLICT');
  const savedEmail = await User.updateOne({ _id: user._id, google_id: identity.sub, status: 'active', ...versionMatch(user) }, { $set: { google_email: email } });
  if (!savedEmail.matchedCount) throw new AppError('Tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 409, 'GOOGLE_LINK_CONFLICT');
  user.google_email = email;
  return user;
}
export async function completeGoogle(request, response, verifier = verifyGoogleToken, fetcher = fetch) {
  const state = request.query.state, code = request.query.code;
  const browser = cookie(request, 'courtsim_oauth');
  if (typeof state !== 'string' || state.length > 200 || !browser) throw new Error('Invalid OAuth state');
  const attempt = await OAuthAttempt.findOneAndDelete({ stateHash: hash(state), browserHash: hash(browser), expiresAt: { $gt: new Date() } });
  response.clearCookie('courtsim_oauth', cookieOptions);
  try {
  if (!attempt || typeof code !== 'string' || code.length > 4096) throw new Error('Invalid OAuth callback');
  const config = googleConfig();
  const result = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: attempt.verifier }) });
  if (!result.ok) throw new Error('OAuth exchange failed');
  const data = await result.json();
  const identity = await verifier(data.id_token, attempt.nonce);
  if (attempt.linkUserId) {
    const token = cookie(request, SESSION_COOKIE);
    const now = new Date();
    const active = token && hash(token) === attempt.linkSessionHash && await AuthSession.exists({ tokenHash: attempt.linkSessionHash, userId: attempt.linkUserId, expiresAt: { $gt: now }, idleExpiresAt: { $gt: now }, $expr: { $eq: [{ $ifNull: ['$authVersion', 0] }, attempt.linkAuthVersion] } });
    const owner = active && await User.findById(attempt.linkUserId).lean();
    if (!owner || owner.status !== 'active' || (owner.auth_version ?? 0) !== attempt.linkAuthVersion) throw new AppError('Phiên liên kết đã hết hạn. Vui lòng bắt đầu lại.', 409, 'GOOGLE_LINK_CONFLICT');
  }
  return { user: await googleUser(identity, attempt.linkUserId, attempt.linkAuthVersion), returnTo: attempt.returnTo, linked: Boolean(attempt.linkUserId) };
  } catch (error) { if (attempt?.linkUserId) error.accountLink = true; throw error; }
}
