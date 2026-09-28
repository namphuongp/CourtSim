import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiError } from '../../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [status, setStatus] = useState({ error: '', loading: false });

  async function submit(event) {
    event.preventDefault();
    if (status.loading) return;
    setStatus({ error: '', loading: true });
    try {
      await api.post('/auth/register', form);
      navigate('/login?registered=1', { replace: true });
    } catch (error) {
      setStatus({ error: getApiError(error, 'Đăng ký thất bại.'), loading: false });
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 space-y-5 shadow-2xl">
        <h1 className="text-center text-3xl font-bold text-white">Tạo tài khoản</h1>
        {status.error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{status.error}</p>}
        <label className="block text-sm">Họ và tên<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" required minLength="2" maxLength="100" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
        <label className="block text-sm">Email<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="block text-sm">Mật khẩu (ít nhất 8 ký tự, tối đa 72 byte)<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" type="password" required minLength="8" maxLength="128" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <button disabled={status.loading} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{status.loading ? 'Đang tạo...' : 'Đăng ký'}</button>
        <p className="text-center text-sm text-slate-400">Đã có tài khoản? <Link className="text-blue-400" to="/login">Đăng nhập</Link></p>
      </form>
    </main>
  );
}
