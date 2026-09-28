import CaseSource from '../../../components/CaseSource';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, CircleHelp, Gavel } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';

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
  const storageKey = draftKey('setup');
  const [form, updateForm] = useState(() => readDraft(storageKey) ?? { case_id: '', user_court_role: '', difficulty: 'balanced', case_event_date: '', request_id: crypto.randomUUID() });
  const setForm = (value) => updateForm({ ...value, request_id: crypto.randomUUID() });
  const busy = useRef(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { saveDraft(storageKey, form); }, [storageKey, form]);
  useEffect(() => {
    let active = true;
    if (form.case_id) api.get(`/v1/cases/${form.case_id}`).then(({ data }) => { if (active) { setSelectedCase(data.data); setDetailError(''); } }).catch((e) => { if (active) setDetailError(getApiError(e)); });
    return () => { active = false; };
  }, [form.case_id, reload]);
  const [state, setState] = useState({ loading: true, submitting: false, error: '' });

  useEffect(() => {
    let active = true;
    async function loadCases() {
      const { data } = await api.get('/v1/cases?limit=50');
      const items = [...data.data];
      for (let page = 2; items.length < data.pagination.total; page += 1) {
        const response = await api.get(`/v1/cases?limit=50&page=${page}`);
        if (!response.data.data.length) break;
        items.push(...response.data.data);
      }
      return items;
    }
    loadCases().then((items) => {
      if (!active) return;
      setCases(items);
      setState((current) => ({ ...current, loading: false }));
    }).catch((error) => { if (active) setState({ loading: false, submitting: false, error: getApiError(error) }); });
    return () => { active = false; };
  }, [reload]);

  const fixedDate = selectedCase?._id === form.case_id ? selectedCase.reference_date : null;
  const eventDate = fixedDate || form.case_event_date;

  async function startSession() {
    if (busy.current || selectedCase?._id !== form.case_id) return;
    busy.current = true;
    setState((current) => ({ ...current, submitting: true, error: '' }));
    try {
      const { data } = await api.post('/v1/sessions', { ...form, case_event_date: eventDate });
      saveDraft(storageKey, null);
      navigate(`/simulation/${data.data.session._id}`);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: getApiError(error, 'Không thể tạo phiên.') }));
      busy.current = false;
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-white">Thiết lập phiên tòa</h1><p className="mt-2 text-slate-400">Chọn hồ sơ, vai luật sư và mức độ phản biện.</p></div>
        <Link to="/guide" className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-blue-300"><CircleHelp size={18} /> Xem hướng dẫn</Link>
      </header>
      {state.error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{state.error} <button className="underline" onClick={() => setReload((n) => n + 1)}>Thử lại</button></p>}
      <fieldset disabled={state.submitting} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 flex items-center gap-2 font-bold text-white"><BookOpen size={20} /> 1. Chọn vụ án</h2>
            {state.loading ? <p>Đang tải...</p> : <div className="space-y-3">{!cases.length && <p>Thư viện chưa có hồ sơ. Vui lòng liên hệ người quản trị để bổ sung.</p>}{cases.map((item) => <button key={item._id} onClick={() => setForm({ ...form, case_id: item._id })} className={`w-full rounded-2xl border p-4 text-left ${form.case_id === item._id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}><strong className="text-white">{item.title}</strong><p className="mt-1 text-sm text-slate-400">{item.summary}</p><span className="mt-2 inline-block text-xs text-blue-300">{item.category}</span></button>)}</div>}
          </div>
          {form.case_id && <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-3 font-bold">Hồ sơ đầy đủ</h2>{detailError ? <p role="alert">{detailError} <button className="underline" onClick={() => setReload((n) => n + 1)}>Thử lại</button></p> : selectedCase?._id !== form.case_id ? <p>Đang tải hồ sơ...</p> : <><CaseSource courtCase={selectedCase} /><p className="whitespace-pre-wrap leading-7">{selectedCase.full_document}</p></>}</article>}
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">2. Chọn vai của bạn</h2><div className="grid gap-3 md:grid-cols-2">{roles.map((role) => <button key={role.id} onClick={() => setForm({ ...form, user_court_role: role.id })} className={`rounded-2xl border p-4 text-left ${form.user_court_role === role.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}>{roleLabel(role.id, selectedCase?.category)}</button>)}</div></div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">3. Chọn mức độ</h2><div className="grid gap-3 md:grid-cols-3">{difficulties.map((item) => <button key={item.id} onClick={() => setForm({ ...form, difficulty: item.id })} className={`rounded-2xl border p-4 text-left ${form.difficulty === item.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}><strong>{item.label}</strong><p className="mt-1 text-xs text-slate-400">{item.note}</p></button>)}</div></div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <label htmlFor="case-event-date" className="mb-2 block font-bold text-white">{fixedDate ? '4. Mốc tra cứu của bài tập' : '4. Ngày sự kiện làm phát sinh tranh chấp'}</label>
            <p className="mb-4 text-sm text-slate-400">Dùng ngày trong hồ sơ. Nếu hồ sơ không nêu ngày, chọn một mốc giả định cho bài tập; mốc này chỉ hỗ trợ tra cứu và không xác lập luật áp dụng đầy đủ.</p>
            <input id="case-event-date" type="date" required readOnly={Boolean(fixedDate)} value={eventDate} onChange={(event) => setForm({ ...form, case_event_date: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
          </div>
        </div>
        <aside className="h-fit rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:sticky lg:top-24"><Gavel className="mb-3 text-blue-400" /><h2 className="font-bold text-white">Sẵn sàng tranh tụng?</h2><p className="my-4 text-sm text-slate-400">Mỗi lượt của bạn sẽ được bên đối lập phản biện, sau đó Thẩm phán AI điều hành.</p><button onClick={startSession} disabled={selectedCase?._id !== form.case_id || Boolean(detailError) || !form.case_id || !form.user_court_role || !eventDate || state.submitting} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{state.submitting ? 'Đang khởi tạo...' : 'Bắt đầu phiên tòa'}</button></aside>
      </fieldset>
    </section>
  );
}
