import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { safeReturnPath, setCurrentUser } from '../../services/auth';
import { AuthShell, PasswordField, GoogleMark } from './AuthElements';

export function GoogleButton() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  async function start() {
    if (busy) return;
    setBusy(true); setError('');
    try { const { data } = await api.post('/auth/google/start', { returnTo: safeReturnPath(params.get('returnTo')) }); window.location.assign(data.url); }
    catch (error) { setError(getApiError(error, 'Chưa thể đăng nhập Google. Bạn có thể dùng tài khoản và mật khẩu.')); setBusy(false); }
  }
  return <><button type="button" className="auth-secondary" disabled={busy} onClick={start}><GoogleMark />{busy ? 'Đang mở Google...' : 'Tiếp tục với Google'}</button>{error && <p role="alert">{error}</p>}</>;
}
export default function AuthForm({ register = false }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const returnTo = safeReturnPath(params.get('returnTo'));
  const query = `?returnTo=${encodeURIComponent(returnTo)}`;
  async function submit(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (register && values.password !== values.confirm_password) { setConfirmationError('Hai mật khẩu chưa khớp. Vui lòng nhập lại.'); event.currentTarget.elements.confirm_password.focus(); lock.current = false; setBusy(false); return; }
    setConfirmationError('');
    try {
      const { data } = await api.post(register ? '/auth/register' : '/auth/login', values);
      if (!data.user && (register || data.verificationRequired)) {
        sessionStorage.setItem('courtsim:verification', JSON.stringify({ ...data.data, email: values.email, returnTo }));
        navigate('/verify-email', { replace: true });
      } else {
        setCurrentUser(data.user);
        navigate(params.get('returnTo') ? returnTo : data.user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      }
    } catch (error) { setError(getApiError(error, 'Chưa thể tiếp tục. Kiểm tra kết nối và thử lại.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AuthShell><h1>{register ? 'Tạo tài khoản' : 'Đăng nhập CourtSim'}</h1><p className="auth-subtitle">{register ? 'Bắt đầu hành trình luyện lập luận của bạn.' : 'Tiếp tục phiên luyện tập của bạn.'}</p>
    {params.get('googleError') && <p role="alert">{params.get('googleError') === 'link' ? 'Hãy đăng nhập bằng mật khẩu, xác thực email rồi chọn Liên kết Google trong tài khoản.' : 'Chưa thể đăng nhập Google. Vui lòng thử lại hoặc dùng mật khẩu.'}</p>}
    {params.get('reset') && <p role="status">Đã đổi mật khẩu. Vui lòng đăng nhập lại.</p>}
    <GoogleButton /><div className="auth-divider"><span>hoặc dùng tài khoản</span></div>
    <form onSubmit={submit} aria-busy={busy}>
      {register && <label>Họ và tên<input name="full_name" autoComplete="name" required minLength={2} maxLength={100} /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <PasswordField creating={register} forgot={!register} />
      {register && <><p className="auth-hint">Dùng ít nhất 8 ký tự, có chữ hoa và số.</p><PasswordField name="confirm_password" label="Nhập lại mật khẩu" creating error={confirmationError} onChange={() => setConfirmationError('')} /></>}
      {error && <p role="alert">{error}</p>}
      <button className="auth-primary" disabled={busy}>{busy ? 'Đang xử lý...' : register ? 'Đăng ký' : 'Đăng nhập'}</button>
    </form>
    <p className="auth-switch">{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <Link to={`${register ? '/login' : '/register'}${query}`}>{register ? 'Đăng nhập' : 'Đăng ký'}</Link></p>
  </AuthShell>;
}
