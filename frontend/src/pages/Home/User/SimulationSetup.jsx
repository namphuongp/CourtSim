import { caseIntroduction } from '../../../../../shared/casePresentation.mjs';
import CaseDossier from '../../../components/CaseDossier';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, CheckCircle2, Gavel } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';
import '../../../components/dashboard/dashboard.css';
import useMembership from '../../../components/membership/useMembership';
import MembershipSummary from '../../../components/membership/MembershipSummary';

const roles = [
  { id: 'defense_lawyer', label: 'Luật sư bảo vệ bị đơn/bị cáo' },
  { id: 'plaintiff_lawyer', label: 'Luật sư bảo vệ nguyên đơn/người bị hại' },
];

export default function SimulationSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [reviewedCase, setReviewedCase] = useState(null);
  const [cases, setCases] = useState([]);
  const storageKey = draftKey('setup');
  const [form, updateForm] = useState(() => {
    const saved = readDraft(storageKey);
    // Bản nháp cũ không được âm thầm giữ mức phản biện đã bỏ khỏi giao diện.
    const requestedCase = params.get('case');
    const changesCase = requestedCase && requestedCase !== saved?.case_id;
    return { case_id: '', user_court_role: '', case_event_date: '', ...saved, ...(requestedCase ? { case_id: requestedCase } : {}), difficulty: 'balanced', request_id: !changesCase && saved?.difficulty === 'balanced' && saved.request_id ? saved.request_id : crypto.randomUUID() };
  });
  const setForm = (value) => updateForm({ ...value, request_id: crypto.randomUUID() });
  const membership = useMembership(form.request_id);
  const canResume = membership.data?.resumeRequestId === form.request_id;
  const canStart = membership.data?.canCreateSession || canResume;
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
    if (busy.current || selectedCase?._id !== form.case_id || !form.user_court_role || !eventDate || detailError || !canStart || membership.loading) return;
    busy.current = true;
    setState((current) => ({ ...current, submitting: true, error: '' }));
    try {
      const { data } = await api.post('/v1/sessions', { ...form, case_event_date: eventDate });
      saveDraft(storageKey, null);
      navigate(`/simulation/${data.data.session._id}`);
    } catch (error) {
      setState((current) => ({ ...current, submitting: false, error: getApiError(error, 'Chưa thể bắt đầu phiên. Lựa chọn của bạn vẫn được giữ lại. Vui lòng thử lại.') }));
      busy.current = false;
      if (error.response?.status === 402) membership.refresh();
    }
  }

  const ready = selectedCase?._id === form.case_id && !detailError;
  const valid = ready && Boolean(form.user_court_role && eventDate) && canStart && !membership.loading && !state.submitting;
  const steps = ['Vụ án', 'Hồ sơ', 'Vai', 'Mốc tra cứu', 'Chuẩn bị'];
  const completedSteps = [Boolean(form.case_id), reviewedCase === form.case_id, Boolean(form.user_court_role), Boolean(eventDate)];
  function goStep(index) { if (index === 1) setReviewedCase(form.case_id); setStep(index); }
  const canNext = step === 0 ? ready : step === 1 ? ready : step === 2 ? Boolean(form.user_court_role) : step === 3 ? Boolean(eventDate) : false;
  const summary = <dl className="setup-summary"><div><dt>Vụ án</dt><dd>{ready ? caseIntroduction(selectedCase).title : 'Chưa chọn vụ án'}</dd></div><div><dt>Vai của bạn</dt><dd>{form.user_court_role ? roleLabel(form.user_court_role, selectedCase?.category, selectedCase) : 'Chưa chọn vai'}</dd></div><div><dt>Mốc tra cứu</dt><dd>{eventDate || 'Chưa chọn mốc tra cứu'}</dd></div><div><dt>Giới hạn</dt><dd>20 lượt trao đổi</dd></div></dl>;
  return <section className="practice-dashboard simulation-setup mx-auto space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">Thiết lập phiên tòa</h1><p className="mt-2 text-slate-400">Đọc hồ sơ, chọn vai và mốc tra cứu — chuẩn bị trước khi vào phòng xử án.</p><nav className="setup-step-tabs" aria-label="Các bước thiết lập">{steps.map((title, index) => <button key={title} type="button" aria-current={step === index ? 'step' : undefined} disabled={state.submitting || (index > 0 && !ready)} onClick={() => goStep(index)}>{index < step && completedSteps[index] ? '✓' : index + 1} {title}</button>)}</nav></div><Link to="/guide" className="setup-guide-link flex items-center gap-2 px-4 py-2 text-sm"><CircleHelp size={16}/> Xem hướng dẫn</Link></header>
    {state.error && <p role="alert" className="dashboard-card dashboard-alert">{state.error} <button className="underline" onClick={() => setReload(n => n + 1)}>Thử lại</button></p>}
    <fieldset disabled={state.submitting} className="setup-grid grid gap-6 lg:grid-cols-3">
      <div className="setup-step-content lg:col-span-2">
        <article className="setup-card p-6">
          <h2 className="setup-step-title"><span>{step + 1}</span>{['Chọn vụ án', 'Hồ sơ vụ án', 'Chọn vai của bạn', 'Mốc tra cứu pháp luật', 'Chuẩn bị & sẵn sàng'][step]}</h2>
          {step === 0 && <><p className="setup-step-description">Đọc tóm tắt và chọn tình huống bạn muốn thực hành.</p>{state.loading ? <p role="status">Đang tải hồ sơ...</p> : <div className="space-y-3">{!cases.length && <p>Chưa có vụ án để lựa chọn. Bạn có thể tải lại sau.</p>}{cases.map(item => <button key={item._id} aria-pressed={form.case_id === item._id} onClick={() => setForm({ ...form, case_id: item._id })} className={`setup-option w-full border p-4 text-left ${form.case_id === item._id ? 'is-selected' : ''}`}><strong>{caseIntroduction(item).title}</strong><p className="mt-1 text-sm">{caseIntroduction(item).summary}</p><span className="mt-2 inline-block text-xs">{item.category}</span></button>)}</div>}{form.case_id && !ready && <p className="mt-4" role={detailError ? 'alert' : 'status'}>{detailError || 'Đang tải chi tiết hồ sơ…'}{detailError && <button onClick={() => setReload(n => n + 1)} className="ml-2 underline">Thử lại</button>}</p>}</>}
          {step === 1 && <CaseDossier key={form.case_id} tabbed courtCase={selectedCase} role={form.user_court_role} />}
          {step === 2 && <><p className="setup-step-description">Chọn phía bạn bảo vệ; AI đảm nhiệm Chủ tọa và bên còn lại.</p><div className="grid gap-3 md:grid-cols-2">{roles.map(role => <button key={role.id} aria-label={roleLabel(role.id, selectedCase?.category, selectedCase)} aria-pressed={form.user_court_role === role.id} onClick={() => setForm({ ...form, user_court_role: role.id })} className={`setup-option setup-role border p-5 text-left ${form.user_court_role === role.id ? 'is-selected' : ''}`}><strong>{roleLabel(role.id, selectedCase?.category, selectedCase)}</strong><p>Đọc yêu cầu, liên hệ tình tiết và chứng cứ để bảo vệ quan điểm của thân chủ.</p>{selectedCase?.parties?.filter(party => party.side === (role.id === 'defense_lawyer' ? 'defendant' : 'plaintiff')).map((party, index) => <div className="setup-role-party" key={index}><b>{party.name}</b>{party.claims?.map((claim, i) => <p key={i}>{claim}</p>)}</div>)}<span>{form.user_court_role === role.id ? '◉ Đã chọn vai' : '○ Chọn vai này'}</span></button>)}</div></>}
          {step === 3 && <><label htmlFor="case-event-date" className="mb-2 mt-5 block font-bold">{fixedDate ? '3. Mốc tra cứu của bài tập' : '3. Ngày sự kiện làm phát sinh tranh chấp'}</label><p className="mb-4 text-sm">{selectedCase?.practice_context ? 'Dùng ngày xét xử sơ thẩm làm mốc tham khảo khi tra cứu luật. Ngày xét xử phúc thẩm chưa được nêu trong hồ sơ.' : 'Chọn ngày xảy ra sự việc để tra cứu luật. Nếu hồ sơ không nêu rõ, bạn có thể chọn ngày giả định cho bài tập. Cần đối chiếu thời điểm áp dụng của từng quy định.'}</p><input id="case-event-date" type="date" required readOnly={Boolean(fixedDate)} value={eventDate} onChange={event => setForm({ ...form, case_event_date: event.target.value })} className="setup-date w-full rounded-lg border px-4 py-3"/><p className="setup-date-note">{selectedCase?.reference_date_note || 'Mốc tra cứu không tự xác nhận hiệu lực hay điều kiện áp dụng của văn bản pháp luật.'}</p></>}
          {step === 4 && <><p className="setup-step-description">Kiểm tra các lựa chọn và cách tham gia phiên trước khi bắt đầu.</p>{summary}<div className="setup-preparation"><div><BookOpen size={20}/><h3>Nắm rõ hồ sơ</h3><p>Chỉ sử dụng tình tiết và chứng cứ đã được cung cấp.</p></div><div><Gavel size={20}/><h3>Tranh luận theo lượt</h3><p>Đọc lời thoại rồi bấm Tiếp tục. Gửi lập luận khi đến lượt bạn.</p></div></div></>}
        </article>
        <nav className="setup-step-actions" aria-label="Chuyển bước thiết lập"><button type="button" disabled={step === 0} onClick={() => goStep(step - 1)}><ArrowLeft size={14}/> Quay lại</button>{step < 4 ? <button type="button" className="setup-next" disabled={!canNext} onClick={() => goStep(step + 1)}>Tiếp: {steps[step + 1]} <ArrowRight size={14}/></button> : <button type="button" className="setup-next" disabled={!valid} onClick={() => setConfirm(true)}>Bắt đầu phiên tòa <ArrowRight size={14}/></button>}</nav>
      </div>
      <aside className="setup-aside h-fit p-5 lg:sticky lg:top-32"><Gavel className="mb-3"/><h2>Sẵn sàng tranh tụng?</h2>{summary}<ul className="setup-checklist">{['Đã chọn vụ án', 'Đã đọc hồ sơ', 'Đã chọn vai', 'Đã đặt mốc tra cứu'].map((text, index) => <li key={text} className={completedSteps[index] ? 'is-done' : ''}><CheckCircle2 size={14}/>{completedSteps[index] ? text : text.replace('Đã', 'Chưa')}</li>)}</ul><MembershipSummary resource={membership}/>{canResume && <p className="my-4 text-sm">Bạn có thể tiếp tục khởi tạo phiên đã yêu cầu. Hệ thống sẽ không trừ thêm lượt.</p>}<button type="button" onClick={() => setConfirm(true)} disabled={!valid} className="setup-start w-full font-bold">{state.submitting ? 'Đang khởi tạo...' : canResume ? 'Tiếp tục khởi tạo phiên' : 'Bắt đầu phiên tòa'}</button><p className="setup-start-note">Kiểm tra thông tin trước khi xác nhận sử dụng lượt luyện tập.</p></aside>
    </fieldset>
    {confirm && <FeedbackModal title="Bắt đầu phiên luyện tập?" onClose={() => { if (!state.submitting) setConfirm(false); }}><p className="mb-5 text-sm">Kiểm tra vụ án, vai và mốc tra cứu. Lượt chỉ được sử dụng khi hệ thống khởi tạo phiên.</p>{summary}{state.error && <p role="alert" className="my-4 text-rose-600">{state.error}</p>}<div className="setup-confirm-actions"><button disabled={state.submitting} onClick={() => setConfirm(false)}>Tiếp tục chuẩn bị</button><button className="setup-next" disabled={!valid} onClick={startSession}>{state.submitting ? 'Đang khởi tạo...' : 'Xác nhận bắt đầu'}</button></div></FeedbackModal>}
  </section>;
}
