import { useState } from 'react';
import { Gavel } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { safeReturnPath } from '../../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      // Đọc từ form để tương thích với trình quản lý mật khẩu tự điền.
      const values = new FormData(event.currentTarget);
      const credentials = {
        email: String(values.get('email') ?? '').trim(),
        password: String(values.get('password') ?? ''),
      };
      const { data } = await api.post('/auth/login', credentials);
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      navigate(params.get('returnTo') ? safeReturnPath(params.get('returnTo')) : data.user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError, 'Đăng nhập thất bại.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-5 shadow-2xl">
        <div className="text-center"><Gavel className="mx-auto mb-3 text-blue-400" /><h1 className="text-3xl font-bold text-white">Đăng nhập CourtSim</h1></div>
        {params.get('registered') && <p role="status" className="text-emerald-400">Đã tạo tài khoản. Đăng nhập để bắt đầu.</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        <label className="block text-sm">Email<input name="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="block text-sm">Mật khẩu<input name="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <button disabled={loading} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        <p className="text-center text-sm text-slate-400">Chưa có tài khoản? <Link className="text-blue-400" to="/register">Đăng ký</Link></p>
      </form>
    </main>
  );
}
