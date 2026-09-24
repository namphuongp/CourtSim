import { useEffect, useState } from 'react';
import { BookOpen, CircleHelp, Gavel } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

const roles = [
  { id: 'defense_lawyer', label: 'Luật sư bảo vệ bị đơn/bị cáo' },
  { id: 'plaintiff_lawyer', label: 'Luật sư bảo vệ nguyên đơn/người bị hại' },
];
const difficulties = [
  { id: 'beginner', label: 'Cơ bản', note: 'AI gợi mở nhiều hơn' },
  { id: 'balanced', label: 'Cân bằng', note: 'Phản biện ở mức thực hành' },
  { id: 'advanced', label: 'Nâng cao', note: 'Phản biện chặt và ít gợi ý' },
];

export default function SimulationSetup() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState({ case_id: '', user_court_role: '', difficulty: 'balanced' });
  const [state, setState] = useState({ loading: true, submitting: false, error: '' });

  useEffect(() => {
    api.get('/v1/cases').then(({ data }) => {
      setCases(data.data);
      setState((current) => ({ ...current, loading: false }));
    }).catch((error) => setState({ loading: false, submitting: false, error: getApiError(error) }));
  }, []);

  async function startSession() {
    setState((current) => ({ ...current, submitting: true, error: '' }));
    try {
      const { data } = await api.post('/v1/sessions', form);
      navigate(`/simulation/${data.data.session._id}`);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: getApiError(error, 'Không thể tạo phiên.') }));
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-white">Thiết lập phiên tòa</h1><p className="mt-2 text-slate-400">Chọn hồ sơ, vai luật sư và mức độ phản biện.</p></div>
        <Link to="/guide" className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-blue-300"><CircleHelp size={18} /> Xem hướng dẫn</Link>
      </header>
      {state.error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{state.error}</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><BookOpen size={20} /> 1. Chọn vụ án</h2>
            {state.loading ? <p>Đang tải...</p> : <div className="space-y-3">{cases.map((item) => <button key={item._id} onClick={() => setForm({ ...form, case_id: item._id })} className={`w-full rounded-2xl border p-4 text-left ${form.case_id === item._id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}><strong className="text-white">{item.title}</strong><p className="mt-1 text-sm text-slate-400">{item.summary}</p><span className="mt-2 inline-block text-xs text-blue-300">{item.category}</span></button>)}</div>}
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">2. Chọn vai của bạn</h2><div className="grid gap-3 md:grid-cols-2">{roles.map((role) => <button key={role.id} onClick={() => setForm({ ...form, user_court_role: role.id })} className={`rounded-2xl border p-4 text-left ${form.user_court_role === role.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}>{role.label}</button>)}</div></div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">3. Chọn mức độ</h2><div className="grid gap-3 md:grid-cols-3">{difficulties.map((item) => <button key={item.id} onClick={() => setForm({ ...form, difficulty: item.id })} className={`rounded-2xl border p-4 text-left ${form.difficulty === item.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}><strong>{item.label}</strong><p className="mt-1 text-xs text-slate-400">{item.note}</p></button>)}</div></div>
        </div>
        <aside className="h-fit rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:sticky lg:top-24"><Gavel className="mb-3 text-blue-400" /><h2 className="font-bold text-white">Sẵn sàng tranh tụng?</h2><p className="my-4 text-sm text-slate-400">Mỗi lượt của bạn sẽ được bên đối lập phản biện, sau đó Thẩm phán AI điều hành.</p><button onClick={startSession} disabled={!form.case_id || !form.user_court_role || state.submitting} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{state.submitting ? 'Đang khởi tạo...' : 'Bắt đầu phiên tòa'}</button></aside>
      </div>
    </section>
  );
}
