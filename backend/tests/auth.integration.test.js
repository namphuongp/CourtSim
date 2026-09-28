import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

test('authentication production: OTP, cookie, Google và phân quyền', { skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 90000 }, async t => {
  process.env.JWT_SECRET = 'auth-test-secret-for-isolated-database-only';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret'; process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';
  const { createApp } = await import('../src/app.js');
  const { default: User } = await import('../src/models/User.js');
  const { PendingRegistration, AuthSession, AuthRateBucket, OAuthAttempt } = await import('../src/models/AuthState.js');
  const { googleUser, verifyGoogleToken, completeGoogle } = await import('../src/services/googleAuthService.js');
  const { consumeAuthLimit } = await import('../src/middlewares/rateLimit.js');
  const db = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  let server; const sent = []; let failEmail = false;
  t.after(async () => { if (server) await new Promise(r => server.close(r)); if (mongoose.connection.name === db) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI, { dbName: db });
  await Promise.all([User, PendingRegistration, AuthSession, AuthRateBucket, OAuthAttempt].map(model => model.init()));
  server = createApp({ sendEmail: async mail => { if (failEmail) throw new Error('Test provider failure'); sent.push(mail); } }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function req(path, body, session, headers = {}) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://localhost:5173', 'X-CourtSim-Request': '1', 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' });
    return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? await response.json() : {}, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  const password = 'Test-only-passphrase-123';
  const registration = email => ({ full_name: 'Người kiểm thử', email, password, confirm_password: password });
  const register = async email => (await req('/auth/register', registration(email))).body.data;
  const verify = data => req('/auth/verify-email', { challenge: data.challenge, otp: sent.at(-1).otp });
  let account, session;
  await t.test('validate input, xác minh OTP một lần, cookie HttpOnly và không lộ bí mật', async () => {
    for (const input of [{ ...registration('bad'), email: {} }, { ...registration('test@example.com'), password: 'short' }, { ...registration('test@example.com'), role: 'admin' }, { ...registration('test@example.com'), confirm_password: 'different' }]) assert.equal((await req('/auth/register', input)).status, 400);
    account = await register('main@example.com');
    assert.match(sent.at(-1).otp, /^\d{6}$/);
    assert.equal(JSON.stringify(account).includes(sent.at(-1).otp), false);
    assert.equal(await User.countDocuments(), 0);
    const pending = await PendingRegistration.findOne({ challenge: account.challenge }).select('+otpHash +passwordHash');
    assert.notEqual(pending.otpHash, sent.at(-1).otp); assert.notEqual(pending.passwordHash, password);
    const first = await verify(account); assert.equal(first.status, 200); session = first.cookie;
    assert.match(first.headers.get('set-cookie'), /HttpOnly/); assert.match(first.headers.get('set-cookie'), /SameSite=Lax/);
    assert.equal(first.body.token, undefined); assert.equal(first.body.user.emailVerified, true); assert.equal(first.body.user.password_hash, undefined);
    assert.equal((await verify(account)).status, 400);
    assert.equal(await PendingRegistration.countDocuments({ email: 'main@example.com' }), 0);
    assert.equal((await req('/auth/me', undefined, session)).status, 200);
  });
  await t.test('email trùng có cùng cấu trúc; đăng nhập sai, tài khoản cũ chưa xác thực', async () => {
    const count = sent.length; const duplicate = await req('/auth/register', registration('main@example.com'));
    assert.equal(duplicate.status, 202); assert.deepEqual(Object.keys(duplicate.body.data).sort(), Object.keys(account).sort()); assert.equal(sent.length, count);
    assert.equal((await req('/auth/resend-verification', {challenge:duplicate.body.data.challenge})).status,429);
    assert.equal((await req('/auth/login', { email: 'main@example.com', password: 'wrong' })).status, 401);
    assert.equal((await req('/auth/login', { email: 'missing@example.com', password })).status, 401);
    await User.create({ username: 'Tài khoản cũ', email: 'legacy@example.com', password_hash: await bcrypt.hash(password, 12) });
    const legacy = await req('/auth/login', { email: 'legacy@example.com', password }); assert.equal(legacy.status, 202); assert.equal(legacy.cookie, undefined);
    assert.equal((await verify(legacy.body.data)).status, 200);
    assert.equal((await req('/auth/login', { email: 'main@example.com', password })).status, 200);
  });
  await t.test('OTP sai, hết hạn, cooldown và mã cũ bị hủy khi gửi lại', async () => {
    const data = await register('resend@example.com'); const old = sent.at(-1).otp;
    assert.equal((await req('/auth/verify-email', { challenge: data.challenge, otp: 'abcdef' })).status, 400);
    assert.equal((await req('/auth/resend-verification', { challenge: data.challenge })).status, 429);
    await PendingRegistration.updateOne({ challenge: data.challenge }, { $set: { lastSentAt: new Date(Date.now() - 61000) } });
    assert.equal((await req('/auth/resend-verification', { challenge: data.challenge })).status, 202);
    assert.equal((await req('/auth/verify-email', { challenge: data.challenge, otp: old })).status, 400);
    await PendingRegistration.updateOne({ challenge: data.challenge }, { $set: { otpExpiresAt: new Date(0) } });
    assert.equal((await verify(data)).status, 400);
  });
  await t.test('năm lần sai khóa mã; gửi lại có giới hạn, giới hạn phân tán', async () => {
    const data = await register('attempts@example.com'); const wrong = sent.at(-1).otp === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await req('/auth/verify-email', { challenge: data.challenge, otp: wrong })).status, 400);
    assert.equal((await verify(data)).status, 400);
    await PendingRegistration.updateOne({ challenge: data.challenge }, { $set: { resendCount: 5, lastSentAt: new Date(0) } });
    assert.equal((await req('/auth/resend-verification', { challenge: data.challenge })).status, 429);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => consumeAuthLimit('concurrent-test', 3)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
    assert.equal(results.filter(r => r.status === 'rejected').every(r => r.reason.statusCode === 429), true);
  });
  await t.test('xác minh song song tạo đúng một tài khoản; email provider lỗi không cấp phiên', async () => {
    const data = await register('race@example.com'); const otp = sent.at(-1).otp;
    const results = await Promise.all([req('/auth/verify-email', { challenge: data.challenge, otp }), req('/auth/verify-email', { challenge: data.challenge, otp })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]); assert.equal(await User.countDocuments({ email: 'race@example.com' }), 1);
    failEmail = true; assert.equal((await req('/auth/register', registration('emailfail@example.com'))).status, 500); failEmail = false;
    assert.equal(await User.countDocuments({ email: 'emailfail@example.com' }), 0);
  });
  await t.test('CSRF, JWT cũ, phiên hết hạn, quyền admin lấy từ DB và logout thu hồi', async () => {
    assert.equal((await req('/auth/logout', {}, session, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await req('/auth/logout', {}, session, { 'X-CourtSim-Request': '' })).status, 403);
    assert.equal((await req('/auth/me', undefined, 'courtsim=invalid')).status, 401);
    const signed = jwt.sign({ sub: String((await User.findOne({ email: 'main@example.com' }))._id) }, process.env.JWT_SECRET);
    assert.equal((await req('/auth/me', undefined, null, { Authorization: `Bearer ${signed}` })).status, 401);
    assert.equal((await req('/v1/admin/feedback', undefined, session)).status, 403);
    await User.updateOne({ email: 'main@example.com' }, { $set: { system_role: 'admin' } });
    assert.equal((await req('/v1/admin/feedback', undefined, session)).status, 200);
    assert.equal((await req('/auth/logout', {}, session)).status, 200); assert.equal((await req('/auth/me', undefined, session)).status, 401);
    const login = await req('/auth/login', { email: 'main@example.com', password }); session = login.cookie;
    await AuthSession.updateMany({}, { $set: { idleExpiresAt: new Date(0) } });
    assert.equal((await req('/auth/me', undefined, session)).status, 401);
  });
  await t.test('đặt lại mật khẩu hủy mọi phiên và không trả thông tin email tồn tại', async () => {
    const login = await req('/auth/login', { email: 'main@example.com', password });
    const reset = await req('/auth/forgot-password', { email: 'main@example.com' });
    const otp = sent.at(-1).otp;
    const missing = await req('/auth/forgot-password', { email: 'unknown@example.com' }); assert.equal(missing.status, reset.status);
    const next = password + '-new';
    assert.equal((await req('/auth/reset-password', { challenge: reset.body.data.challenge, otp, password: next, confirm_password: next })).status, 200);
    assert.equal((await req('/auth/me', undefined, login.cookie)).status, 401);
    assert.equal((await req('/auth/login', { email: 'main@example.com', password })).status, 401);
    assert.equal((await req('/auth/login', { email: 'main@example.com', password: next })).status, 200);
  });
  await t.test('Google: chữ ký, issuer, audience, expiry, nonce và email verified', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
    const fetchKeys = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
    const sign = payload => jwt.sign({ sub: 'google-1', email: 'google@gmail.com', email_verified: true, nonce: 'expected', ...payload }, privateKey, { algorithm: 'RS256', keyid: 'test-key', issuer: 'https://accounts.google.com', audience: process.env.GOOGLE_CLIENT_ID, expiresIn: '5m' });
    assert.equal((await verifyGoogleToken(sign({}), 'expected', fetchKeys)).sub, 'google-1');
    for (const payload of [{ nonce: 'wrong' }, { email_verified: false }, { azp: 'wrong-client' }]) await assert.rejects(verifyGoogleToken(sign(payload), 'expected', fetchKeys));
    for (const options of [{ audience: 'wrong' }, { issuer: 'https://evil.test' }, { expiresIn: '-1s' }]) {
      const token = jwt.sign({ sub: 'google-1', email: 'google@gmail.com', email_verified: true, nonce: 'expected' }, privateKey, { algorithm: 'RS256', keyid: 'test-key', issuer: 'https://accounts.google.com', audience: process.env.GOOGLE_CLIENT_ID, expiresIn: '5m', ...options });
      await assert.rejects(verifyGoogleToken(token, 'expected', fetchKeys));
    }
    await assert.rejects(verifyGoogleToken('fake', 'expected', fetchKeys));
  });
  await t.test('Google: user mới/cũ, race, linking an toàn và tài khoản bị khóa', async () => {
    const identity = { sub: 'google-new', email: 'new@gmail.com', email_verified: true, name: 'Người học Google' };
    const users = await Promise.all([googleUser(identity), googleUser(identity)]); assert.equal(String(users[0]._id), String(users[1]._id));
    assert.equal((await googleUser(identity)).id, users[0].id);
    const gmail = await User.create({ username: 'Gmail cũ', email: 'password@gmail.com', email_verified: true, password_hash: 'hash', auth_providers: ['password'] });
    assert.equal((await googleUser({ ...identity, sub: 'linked', email: gmail.email })).id, gmail.id);
    const third = await User.create({ username: 'Email khác', email: 'third@example.com', email_verified: true, password_hash: 'hash' });
    await assert.rejects(googleUser({ ...identity, sub: 'third', email: third.email }), e => e.code === 'GOOGLE_LINK_REQUIRED');
    assert.equal((await googleUser({ ...identity, sub: 'third', email: third.email }, third._id)).id, third.id);
    await User.updateOne({ _id: users[0]._id }, { $set: { status: 'banned' } });
    await assert.rejects(googleUser(identity), e => e.code === 'ACCOUNT_DISABLED');
  });
  await t.test('Google start có state/nonce/PKCE; callback sai state không cấp cookie', async () => {
    const start = await req('/auth/google/start', { returnTo: '//evil.test' }); assert.equal(start.status, 200);
    const url = new URL(start.body.url); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(url.searchParams.get('nonce'));
    const failed = await req('/auth/google/callback?state=wrong&code=wrong', undefined, start.cookie);
    assert.equal(failed.status, 302); assert.match(failed.headers.get('location'), /googleError=failed/);
    assert.equal(failed.cookie?.startsWith('courtsim='), false);
    const request = {query:{state:url.searchParams.get('state'),code:'valid-code'},headers:{cookie:start.cookie}};
    const response = {clearCookie:()=>{}};
    const attempt = await OAuthAttempt.findOne({});
    let exchanges=0;
    const exchange = async (_url, options) => { exchanges++; assert.ok(options.body.get('code_verifier')); return {ok:true,json:async()=>({id_token:'fixture-token'})}; };
    const identity = async (_token, nonce) => { assert.equal(nonce, attempt.nonce); return {sub:'callback-user',email:'callback@gmail.com',email_verified:true}; };
    const completed = await completeGoogle(request,response,identity,exchange);
    assert.equal(completed.returnTo,'/dashboard');
    assert.equal(completed.user.google_id,'callback-user');
    await assert.rejects(completeGoogle(request,response,identity,exchange));
    assert.equal(exchanges,1);
  });
});
