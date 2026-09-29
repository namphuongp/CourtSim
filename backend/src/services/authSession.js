import { deviceLabel, providerNames } from './accountService.js';
import { createHash, randomBytes } from 'node:crypto';
import { AuthSession } from '../models/AuthState.js';
import { env } from '../config/env.js';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const SESSION_COOKIE = env.NODE_ENV === 'production' ? '__Host-courtsim' : 'courtsim';
export const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export function cookie(request, name) {
  const value = request.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1);
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null;
}
export function publicUser(user) {
  return { id: String(user._id), full_name: user.username, email: user.email, role: user.system_role, tier: user.subscription_type, emailVerified: user.email_verified, authProviders: user.password_hash !== undefined ? providerNames(user) : user.auth_providers ?? [] };
}
export async function issueSession(request, response, user) {
  const previous = cookie(request, SESSION_COOKIE);
  if (previous) await AuthSession.deleteOne({ tokenHash: hash(previous) });
  const token = secret();
  await AuthSession.create({ tokenHash: hash(token), userId: user._id, authVersion: user.auth_version ?? 0, device: deviceLabel(request.headers['user-agent']), expiresAt: new Date(Date.now() + 7 * 86400000), idleExpiresAt: new Date(Date.now() + 30 * 60000) });
  response.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 7 * 86400000 });
  response.setHeader('Cache-Control', 'no-store');
  return publicUser(user);
}
