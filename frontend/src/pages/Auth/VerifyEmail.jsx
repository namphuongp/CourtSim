import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { setCurrentUser, safeReturnPath } from '../../services/auth';
import { AuthShell, PasswordField } from './AuthElements';
const storageKey = 'courtsim:verification';
function readChallenge() { try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { return null; } }
export default function VerifyEmail({ reset = false }) {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(readChallenge);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const lock = useRef(false);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(challenge?.expiresAt) - now) / 1000)) || 0;
  const cooldown = Math.max(0, Math.ceil((Date.parse(challenge?.resendAt) - now) / 1000)) || 0;
  async function verify(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const { data } = await api.post(reset ? '/auth/reset-password' : '/auth/verify-email', { ...values, challenge: challenge.challenge, otp });
      sessionStorage.removeItem(storageKey);
      if (reset) navigate('/login?reset=1', { replace: true });
      else { setCurrentUser(data.user); navigate(safeReturnPath(challenge.returnTo), { replace: true }); }
    } catch (error) { setError(getApiError(error, 'Chưa thể xác thực. Nội dung vẫn được giữ lại. Vui lòng thử lại.')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function resend() {
    if (lock.current || cooldown) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/resend-verification', { challenge: challenge.challenge });
      const next = { ...challenge, ...data.data };
      sessionStorage.setItem(storageKey, JSON.stringify(next)); setChallenge(next); setOtp(''); input.current?.focus();
    } catch (error) { setError(getApiError(error, 'Chưa thể gửi lại mã. Vui lòng thử lại sau.')); }
    finally { lock.current = false; setBusy(false); }
  }
  const masked = challenge?.email?.replace(/^(.).*(@.*)$/, '$1***$2');
  return <AuthShell><h1>{reset ? 'Đặt lại mật khẩu' : 'Xác thực email'}</h1>{!challenge ? <><p>Hãy bắt đầu lại để nhận mã xác thực mới.</p><Link to={reset ? '/forgot-password' : '/register'}>Bắt đầu lại</Link></> : <>
    <p>Nếu thông tin phù hợp, mã xác thực sẽ được gửi đến <strong>{masked}</strong>. Kiểm tra cả thư rác.</p>
    <form onSubmit={verify}><label htmlFor="otp">Mã xác thực</label><div className={`otp-control${error ? ' has-error' : ''}`}><div className="otp-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} className={index === otp.length ? 'is-current' : otp[index] ? 'is-filled' : ''}>{otp[index] ?? ''}</span>)}</div><input ref={input} id="otp" className="otp-input" aria-invalid={Boolean(error)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} required /></div>
      <p className="auth-hint">{remaining ? `Mã hết hạn sau: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : 'Mã đã hết hạn. Bạn có thể yêu cầu mã mới.'}</p>
      {reset && <><PasswordField label="Mật khẩu mới" creating /><p className="auth-hint">Dùng ít nhất 8 ký tự, có chữ hoa và số.</p><PasswordField label="Nhập lại mật khẩu" name="confirm_password" creating /></>}
      {error && <p role="alert">{error}</p>}<button className="auth-primary" disabled={busy || otp.length !== 6 || !remaining}>{busy ? 'Đang xử lý...' : reset ? 'Đổi mật khẩu' : 'Xác nhận'}</button>
    </form><button className="auth-secondary" style={{ marginTop: 14 }} onClick={resend} disabled={busy || cooldown > 0}>{cooldown ? `Gửi lại mã sau ${cooldown} giây` : 'Gửi lại mã'}</button><p><Link to="/login">Quay lại đăng nhập</Link></p>
  </>}</AuthShell>;
}
export function ForgotPassword() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    try { const { data } = await api.post('/auth/forgot-password', { email }); sessionStorage.setItem(storageKey, JSON.stringify({ ...data.data, email })); navigate('/reset-password'); }
    catch (error) { setError(getApiError(error)); } finally { setBusy(false); }
  }
  return <AuthShell><h1>Quên mật khẩu</h1><p>Nhập email bạn đã dùng để đăng ký CourtSim.</p><form onSubmit={submit}><label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>{error && <p role="alert">{error}</p>}<button className="auth-primary" disabled={busy}>{busy ? 'Đang xử lý...' : 'Gửi mã xác thực'}</button></form><p><Link to="/login">Quay lại đăng nhập</Link></p></AuthShell>;
}
