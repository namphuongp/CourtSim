import ConfirmEndDialog from '../../../components/ConfirmEndDialog';
import LegalBasis, { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import CaseSource from '../../../components/CaseSource';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Gavel, LogOut, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';

function FactAnalysis({ analysis }) {
  if (!analysis) return null;
  const groups = [
    ['Dữ kiện trong hồ sơ', analysis.established_facts],
    ['Lời trình bày của người học', analysis.learner_claims],
    ['Suy luận', analysis.inferences],
    ['Còn thiếu/chưa được chứng minh', analysis.missing_facts],
  ].filter(([, values]) => values?.length);
  if (!groups.length) return null;
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-950/50 p-3 text-sm">
      {groups.map(([label, values]) => <p key={label}><strong className="text-slate-300">{label}:</strong> <span className="text-slate-400">{values.join('; ')}</span></p>)}
    </div>
  );
}

export default function SimulationRoom() {
  const { sessionId } = useParams();
  return <Room key={sessionId} sessionId={sessionId} />;
}

function Room({ sessionId }) {
  const navigate = useNavigate();
  const endRef = useRef(null);
  const busy = useRef(false);
  const storageKey = draftKey(sessionId);
  const completionKey = draftKey(`${sessionId}:completion`);
  const [draft, setDraft] = useState(() => readDraft(storageKey) ?? { content: '', request_id: crypto.randomUUID() });
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [reload, setReload] = useState(0);
  const [eventDate, setEventDate] = useState('');
  const [state, setState] = useState({ loading: true, sending: false, ending: false, error: '' });
  useEffect(() => { saveDraft(storageKey, draft); }, [storageKey, draft]);
  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/v1/sessions/${sessionId}`), api.get(`/v1/sessions/${sessionId}/records`)]).then(([a, b]) => {
      if (!active) return;
      setSession(a.data.data);
      if (readDraft(completionKey) && a.data.data.status === 'completed') {
        saveDraft(completionKey, null);
        saveDraft(storageKey, null);
        navigate(`/simulation/${sessionId}/result`, { replace: true });
      }
      if (readDraft(completionKey) && !a.data.data.processing && a.data.data.status === 'ongoing') saveDraft(completionKey, null);
      setRecords(b.data.data);
      setDraft((current) => b.data.data.some((r) => r.request_id === current.request_id) ? { content: '', request_id: crypto.randomUUID() } : current);
      setState((current) => ({ ...current, loading: false, error: '' }));
    }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: getApiError(error) })); });
    return () => { active = false; };
  }, [sessionId, reload, completionKey, storageKey, navigate]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [records, state.sending]);
  const userTurns = records.filter((r) => r.sender_type === 'user').length;
  const completed = session?.status === 'completed';
  const disabled = state.sending || state.ending || completed || !session || !session.case_event_date || session.processing;

  useEffect(() => {
    if (!session?.processing || state.ending || state.sending) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/v1/sessions/${sessionId}`);
        if (!active) return;
        setSession(data.data);
        if (data.data.status === 'completed') navigate(`/simulation/${sessionId}/result`, { replace: true });
        else if (!data.data.processing) setReload((value) => value + 1);
      } catch { /* Lỗi mạng tạm thời: giữ trạng thái và nút tải lại. */ }
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [session?.processing, sessionId, state.ending, state.sending, navigate]);

  async function saveEventDate(event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      await api.patch(`/v1/sessions/${sessionId}`, { case_event_date: eventDate });
      setReload((n) => n + 1);
    } catch (error) { setState((s) => ({ ...s, error: getApiError(error) })); }
    finally { busy.current = false; setState((s) => ({ ...s, sending: false })); }
  }

  async function send(event) {
    event.preventDefault();
    if (busy.current || disabled || draft.content.trim().length < 10) return;
    busy.current = true;
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      const { data } = await api.post(`/v1/sessions/${sessionId}/messages`, { ...draft, expected_turn_count: userTurns });
      setRecords((current) => [...new Map([...current, ...data.data].map((r) => [r._id, r])).values()]);
      setDraft({ content: '', request_id: crypto.randomUUID() });
    } catch (error) {
      setState((s) => ({ ...s, error: getApiError(error, 'AI chưa thể phản hồi. Bản nháp được giữ lại.') }));
      // Kiểm tra lần ghi đã thành công nhưng mất phản hồi; không gửi thêm lượt mới.
      try {
        const [a, b] = await Promise.all([api.get(`/v1/sessions/${sessionId}`), api.get(`/v1/sessions/${sessionId}/records`)]);
        setSession(a.data.data); setRecords(b.data.data);
        if (b.data.data.some((r) => r.request_id === draft.request_id)) {
          setDraft({ content: '', request_id: crypto.randomUUID() });
          setState((s) => ({ ...s, error: '' }));
        }
      } catch { /* Giữ bản nháp để thử lại cùng mã yêu cầu khi có mạng. */ }
    } finally {
      busy.current = false;
      setState((s) => ({ ...s, sending: false }));
    }
  }

  async function complete() {
    if (busy.current || disabled || !userTurns) return;
    busy.current = true;
    saveDraft(completionKey, { requested: true });
    setState((s) => ({ ...s, ending: true, error: '' }));
    try {
      await api.post(`/v1/sessions/${sessionId}/complete`);
      saveDraft(completionKey, null);
      saveDraft(storageKey, null);
      navigate(`/simulation/${sessionId}/result`);
    } catch (error) {
      setConfirmEnd(false);
      setState((s) => ({ ...s, error: getApiError(error, 'Chưa thể chấm điểm. Biên bản vẫn được giữ; bạn có thể thử lại.') }));
      try {
        const { data } = await api.get(`/v1/sessions/${sessionId}`);
        setSession(data.data);
        if (data.data.status === 'completed') navigate(`/simulation/${sessionId}/result`, { replace: true });
      } catch { /* Giữ thông báo và cho phép tải lại để kiểm tra kết quả đã lưu. */ }
    } finally {
      busy.current = false;
      setState((s) => ({ ...s, ending: false }));
    }
  }

  if (state.loading) return <main className="min-h-screen bg-slate-950 p-8" role="status">Đang tải phiên tòa...</main>;
  const dossier = <><LegalBasis sessionId={sessionId} /><CaseSource courtCase={session?.case_id} showLegalNote={false} /><p className="mb-3 text-sm text-slate-400">{session?.case_id?.summary}</p>{session?.legal_coverage_warnings?.map((w) => <p key={w} className="mb-3 text-sm text-amber-300">{w}</p>)}<p className="whitespace-pre-wrap text-sm leading-7">{session?.case_id?.full_document}</p></>;
  return <main className="flex h-dvh flex-col bg-slate-950 text-slate-200">
    <ConfirmEndDialog open={confirmEnd} pending={state.ending} hasDraft={Boolean(draft.content.trim())} onCancel={() => setConfirmEnd(false)} onConfirm={complete} />
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><div><Link className="text-sm text-blue-400 underline" to="/dashboard/sessions">← Danh sách phiên</Link><h1 className="mt-1 font-bold text-white">{session?.case_id?.title ?? 'Phiên mô phỏng'}</h1><p className="text-xs text-slate-500">{roleLabel(session?.user_court_role, session?.case_id?.category)} · Ngày tra cứu: {session?.case_event_date ?? 'Chưa xác định'} · {userTurns}/{session?.max_turns ?? 20} lượt</p></div>{completed ? <Link to={`/simulation/${sessionId}/result`} className="rounded-xl bg-blue-600 px-4 py-2">Xem kết quả</Link> : <button disabled={disabled || !userTurns} onClick={() => setConfirmEnd(true)} className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300 disabled:opacity-40">{state.ending ? 'Đang chấm điểm...' : 'Kết thúc và chấm điểm'}</button>}</header>
    {state.error && <div role="alert" className="border-b border-rose-500/30 p-3 text-sm text-rose-300">{state.error} <button disabled={state.sending || state.ending} onClick={() => setReload((n) => n + 1)} className="ml-2 underline">Tải lại dữ liệu</button></div>}
    {session && !session.case_event_date && !completed && <form onSubmit={saveEventDate} className="border-b border-slate-800 p-3 text-sm"><p>Phiên cũ chưa có ngày tra cứu luật. Bổ sung ngày trong hồ sơ, hoặc một ngày giả định cho bài tập, để tiếp tục.</p><label>Ngày tra cứu <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="m-2 rounded border border-slate-700 p-2" /></label><button disabled={state.sending || !eventDate} className="rounded bg-blue-600 px-3 py-2">Lưu ngày</button></form>}
    {session?.processing && !state.sending && !state.ending && <p role="status" className="p-3 text-sm">Một yêu cầu đang được xử lý. Chờ rồi <button onClick={() => setReload((n) => n + 1)} className="text-blue-400 underline">cập nhật phiên</button>.</p>}
    <details className="border-b border-slate-800 p-3 lg:hidden"><summary className="cursor-pointer font-semibold">Hồ sơ và giới hạn nguồn luật</summary><div className="max-h-60 overflow-y-auto pt-3">{dossier}</div></details>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
      <section className="flex min-h-0 min-w-0 flex-col"><div className="flex-1 space-y-4 overflow-y-auto p-4">{records.map((item) => <article id={`record-${item._id}`} key={item._id} className={`max-w-3xl break-words rounded-2xl border p-4 ${item.sender_type === 'user' ? 'ml-auto border-blue-500/30 bg-blue-500/10' : item.sender_type === 'ai_judge' ? 'border-amber-500/30 bg-amber-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}><p className="mb-2 text-xs font-bold text-slate-400">{item.sender_name}</p><p className="whitespace-pre-wrap leading-7">{item.content}</p><FactAnalysis analysis={item.fact_analysis} /><LegalCitations citations={item.citations} />{item.citation_warnings?.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-300">{warning}</p>)}<details className="mt-3"><summary className="cursor-pointer text-sm">Mốc tra cứu và trạng thái căn cứ</summary><LegalResearchResult research={item.legal_research} /></details></article>)}{state.sending && <p role="status">Bên đối lập và Thẩm phán đang phân tích. Lượt chỉ được lưu khi cả hai phản hồi hợp lệ.</p>}{state.ending && <p role="status">Đang đánh giá toàn bộ phiên. Quá trình có thể mất vài phút.</p>}<div ref={endRef} /></div>
      {completed ? <p className="border-t border-slate-800 p-4 text-sm">Phiên đã kết thúc. Đây là biên bản chỉ đọc.</p> : <form onSubmit={send} className="border-t border-slate-800 p-4"><label htmlFor="argument" className="text-sm font-semibold">Lập luận của bạn</label><textarea id="argument" disabled={disabled} maxLength={4000} value={draft.content} onChange={(e) => setDraft({ content: e.target.value, request_id: crypto.randomUUID() })} placeholder="Nêu yêu cầu → chứng cứ trong hồ sơ → giải thích → trả lời phản biện..." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{draft.content.length}/4000 · Bản nháp lưu trong tab này</span><button disabled={disabled || userTurns >= (session?.max_turns ?? 20) || draft.content.trim().length < 10} className="rounded-xl bg-blue-600 px-5 py-2 disabled:opacity-40">Gửi lập luận</button></div>{userTurns >= (session?.max_turns ?? 20) && <p className="mt-2 text-sm">Đã đủ số lượt. Chọn Kết thúc để nhận đánh giá.</p>}</form>}
      </section>
      <aside className="hidden overflow-y-auto border-l border-slate-800 bg-slate-900 p-5 lg:block"><h2 className="mb-4 font-bold">Hồ sơ vụ án</h2>{dossier}</aside>
    </div>
  </main>;
}
