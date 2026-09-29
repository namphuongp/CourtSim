import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

test('account self-service, isolation and credential lifecycle', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 90000 }, async t => {
  process.env.JWT_SECRET = 'isolated-account-test-secret-not-for-production';
  process.env.AUTH_EMAIL_VERIFICATION_DISABLED = 'false';
  process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'; process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';
  const { createApp } = await import('../src/app.js');
  const { default: User } = await import('../src/models/User.js');
  const { AuthSession, PendingRegistration, AuthRateBucket, OAuthAttempt } = await import('../src/models/AuthState.js');
  const { secret, hash } = await import('../src/services/authSession.js');
  const { googleUser, completeGoogle } = await import('../src/services/googleAuthService.js');
  const db = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server; const sent = [];
  t.after(async () => { if (server) await new Promise(r => server.close(r)); if (mongoose.connection.name === db) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName: db });
  await Promise.all([User, AuthSession, PendingRegistration, AuthRateBucket, OAuthAttempt].map(m => m.init()));
  server = createApp({ sendEmail: async mail => sent.push(mail) }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  async function req(path, method = 'GET', body, cookie, origin = 'http://localhost:5173') {
    const response = await fetch(base + path, { method, headers: { Origin: origin, 'X-CourtSim-Request': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const password = 'Account123';
  const a = await User.create({ username: 'Người học A', email: 'a@example.com', email_verified: true, password_hash: await bcrypt.hash(password, 4), auth_providers: ['password'] });
  const b = await User.create({ username: 'Người học B', email: 'b@example.com', email_verified: true, google_id: 'google-b', auth_providers: ['google'] });
  async function session(user) { const token = secret(); await AuthSession.create({ tokenHash: hash(token), userId: user._id, authVersion: user.auth_version ?? 0, expiresAt: new Date(Date.now() + 600000), idleExpiresAt: new Date(Date.now() + 600000) }); return `courtsim=${token}`; }
  let cookie = await session(a); const other = await session(a), googleCookie = await session(b);
  await t.test('profile whitelist, identity, CSRF and safe response', async () => {
    assert.equal((await req('/account')).status, 401);
    const profile = await req('/account', 'GET', undefined, cookie);
    assert.equal(profile.body.data.email, a.email);
    assert.doesNotMatch(JSON.stringify(profile.body), /password_hash|google_id|tokenHash|auth_version/);
    for (const body of [{ role: 'admin' }, { email_verified: true }, { userId: b.id, full_name: 'Hacked' }, { email: 'other@example.com' }, { full_name: {} }]) assert.equal((await req('/account', 'PATCH', body, cookie)).status, 400);
    assert.equal((await req('/account', 'PATCH', { full_name: 'Tên mới' }, cookie, 'https://evil.test')).status, 403);
    assert.equal((await req('/account', 'PATCH', { full_name: 'Tên mới' }, cookie)).status, 200);
    assert.equal((await User.findById(b._id)).username, 'Người học B');
  });
  await t.test('own sessions only and logout others', async () => {
    const list = await req('/account/sessions', 'GET', undefined, cookie);
    assert.equal(list.body.data.length, 2); assert.equal(list.body.data[0].current, true);
    assert.doesNotMatch(JSON.stringify(list.body), /token|userId|_id/);
    assert.equal((await req('/account/logout-others', 'POST', {}, cookie)).status, 200);
    assert.equal((await req('/me', 'GET', undefined, other)).status, 401);
    assert.equal((await req('/me', 'GET', undefined, googleCookie)).status, 200);
  });
  await t.test('password policy, old password and all-session revocation', async () => {
    const body = { current_password: 'wrong', password: 'Nextpass123', confirm_password: 'Nextpass123' };
    assert.equal((await req('/account/password', 'POST', body, cookie)).status, 400);
    assert.equal((await req('/account/password', 'POST', { ...body, current_password: password, password: 'weak', confirm_password: 'weak' }, cookie)).status, 400);
    assert.equal((await req('/account/password', 'POST', { ...body, current_password: password }, cookie)).status, 200);
    assert.equal((await req('/me', 'GET', undefined, cookie)).status, 401);
    assert.equal((await req('/login', 'POST', { email: a.email, password })).status, 401);
    const login = await req('/login', 'POST', { email: a.email, password: body.password }); assert.equal(login.status, 200); cookie = login.cookie;
    const stale = await session(a); assert.equal((await req('/me', 'GET', undefined, stale)).status, 401);
  });
  await t.test('Google-only requires OTP; challenge bound to account and single use', async () => {
    assert.equal((await req('/account/google', 'DELETE', { password }, googleCookie)).body.error.code, 'LAST_LOGIN_METHOD');
    const challenge = await req('/account/password/otp', 'POST', {}, googleCookie); assert.equal(challenge.status, 202);
    const body = { challenge: challenge.body.data.challenge, otp: sent.at(-1).otp, password, confirm_password: password };
    assert.equal((await req('/account/password/set', 'POST', body, cookie)).status, 409);
    const c = await User.create({ username: 'Google khác', email: 'c@example.com', email_verified: true, google_id: 'google-c', auth_providers: ['google'] });
    assert.equal((await req('/account/password/set', 'POST', body, await session(c))).status, 400);
    assert.equal((await req('/account/password/set', 'POST', { ...body, otp: 'bad' }, googleCookie)).status, 400);
    assert.equal((await req('/account/password/set', 'POST', body, googleCookie)).status, 200);
    assert.equal((await req('/account/password/set', 'POST', body, googleCookie)).status, 401);
    assert.deepEqual((await User.findById(b.id)).auth_providers, ['password', 'google']);
    const login = await req('/login', 'POST', { email: b.email, password }); assert.equal(login.status, 200);
    assert.equal((await req('/google/link', 'POST', { password }, login.cookie)).status, 409);
    const unlink = await req('/account/google', 'DELETE', { password }, login.cookie); assert.equal(unlink.status, 200);
    assert.equal((await req('/me', 'GET', undefined, login.cookie)).status, 401);
    assert.equal((await req('/me', 'GET', undefined, unlink.cookie)).status, 200);
    assert.deepEqual((await User.findById(b.id)).auth_providers, ['password']);
  });
  await t.test('Google linking bound to active session, rejects conflicts and revoked callback', async () => {
    const start = await req('/google/link', 'POST', { password: 'Nextpass123' }, cookie); assert.equal(start.status, 200);
    const url = new URL(start.body.url);
    await req('/account/logout-all', 'POST', {}, cookie);
    await assert.rejects(completeGoogle({ query: { state: url.searchParams.get('state'), code: 'code' }, headers: { cookie: `${cookie}; ${start.cookie}` } }, { clearCookie() {} }, async () => ({ sub: 'ga', email: a.email, email_verified: true }), async () => ({ ok: true, json: async () => ({ id_token: 'fixture' }) })), error => error.code === 'GOOGLE_LINK_CONFLICT');
    const fresh = await User.findById(a.id);
    await assert.rejects(googleUser({ sub: 'wrong', email: b.email }, a._id, fresh.auth_version));
    const linked = await googleUser({ sub: 'ga', email: a.email, email_verified: true }, a._id, fresh.auth_version);
    assert.deepEqual(linked.auth_providers, ['password', 'google']);
    await assert.rejects(googleUser({ sub: 'ga', email: a.email, email_verified: true }, b._id));
    assert.equal((await req('/me', 'GET', undefined, cookie)).status, 401);
  });
  await t.test('successful OAuth callback links current account and cannot replay', async () => {
    const login = await req('/login', 'POST', { email: b.email, password });
    const start = await req('/google/link', 'POST', { password }, login.cookie);
    assert.equal(start.status, 200);
    const url = new URL(start.body.url);
    const request = { query: { state: url.searchParams.get('state'), code: 'valid-code' }, headers: { cookie: `${login.cookie}; ${start.cookie}` } };
    const verify = async () => ({ sub: 'google-b-new', email: b.email, email_verified: true });
    const exchange = async () => ({ ok: true, json: async () => ({ id_token: 'fixture' }) });
    const result = await completeGoogle(request, { clearCookie() {} }, verify, exchange);
    assert.equal(result.linked, true); assert.equal(result.returnTo, '/account/linked'); assert.equal(result.user.id, b.id);
    await assert.rejects(completeGoogle(request, { clearCookie() {} }, verify, exchange));
  });
  await t.test('old email-verification challenge cannot recreate a revoked login', async () => {
    const user = await User.create({ username: 'Chưa xác thực', email: 'verify@example.com', password_hash: await bcrypt.hash(password, 4), email_verified: false });
    const login = await req('/login', 'POST', { email: user.email, password });
    assert.equal(login.status, 202);
    const otp = sent.at(-1).otp;
    await User.updateOne({ _id: user.id }, { $inc: { auth_version: 1 } });
    assert.equal((await req('/verify-email', 'POST', { challenge: login.body.data.challenge, otp })).status, 409);
    assert.equal(await AuthSession.countDocuments({ userId: user.id }), 0);
  });
});
