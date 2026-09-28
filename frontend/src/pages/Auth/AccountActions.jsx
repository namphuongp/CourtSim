import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { clearAuth } from '../../services/auth';
export function LogoutButton() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function logout() {
    if (busy) return; setBusy(true); setError('');
    try { await api.post('/auth/logout', {}); clearAuth(); window.location.assign('/login'); }
    catch (error) { setError(getApiError(error, 'Chưa thể đăng xuất. Vui lòng thử lại.')); setBusy(false); }
  }
  return <span><button disabled={busy} onClick={logout}>{busy ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>{error && <span role="alert" className="auth-logout-error">{error}</span>}</span>;
}
export function LinkGoogle() {
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const password = String(new FormData(event.currentTarget).get('password'));
    try { const { data } = await api.post('/auth/google/link', { password }); window.location.assign(data.url); }
    catch (error) { setError(getApiError(error, 'Chưa thể liên kết Google. Vui lòng thử lại.')); setBusy(false); }
  }
  return <>{params.get('googleError') && <p role="alert">Chưa thể liên kết Google. Vui lòng thử lại và chọn tài khoản có cùng email.</p>}<details open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Liên kết Google</summary><form onSubmit={submit}><label>Xác nhận mật khẩu CourtSim<input name="password" type="password" autoComplete="current-password" required maxLength={128} className="border rounded p-2 m-2" /></label><button disabled={busy} className="border rounded p-2">{busy ? 'Đang xử lý...' : 'Chọn tài khoản Google'}</button>{error && <p role="alert">{error}</p>}</form></details></>;
}
