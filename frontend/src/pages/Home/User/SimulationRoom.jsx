import { dialogueText } from '../../../../../shared/dialogueText.mjs';
import ConfirmEndDialog from '../../../components/ConfirmEndDialog';
import { LegalCitations } from '../../../components/LegalBasis';
import CaseDossier from '../../../components/CaseDossier';
import { EVIDENCE_MIME, evidenceText, evidenceIds } from '../../../services/references';
import StudyPanel from '../../../components/StudyPanel';
import LegalAssistant from '../../../components/LegalAssistant';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';

export default function SimulationRoom() {
  const { sessionId } = useParams();
  return <Room key={sessionId} sessionId={sessionId} />;
}

function Room({ sessionId }) {
  const navigate = useNavigate();
  const endRef = useRef(null);
  const argumentRef = useRef(null);
  const [panel, setPanel] = useState(null);
  const [insertError, setInsertError] = useState('');
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

  function insertIntoArgument(text) {
    if (disabled) return;
    const start = argumentRef.current?.selectionStart ?? draft.content.length;
    const end = argumentRef.current?.selectionEnd ?? start;
    const insertion = (start ? '\n' : '') + text + '\n';
    const content = draft.content.slice(0, start) + insertion + draft.content.slice(end);
    if (content.length > 4000) { setInsertError('Bài viết sẽ vượt 4.000 ký tự. Hãy rút gọn trước khi thêm tài liệu.'); return; }
    setInsertError('');
    setDraft({ content, request_id: crypto.randomUUID() });
    setPanel(null);
    requestAnimationFrame(() => { argumentRef.current?.focus(); argumentRef.current?.setSelectionRange(start + insertion.length, start + insertion.length); });
  }

  function dropEvidence(event) {
    const id = event.dataTransfer.getData(EVIDENCE_MIME);
    if (!id) return;
    event.preventDefault();
    const item = session?.case_id?.evidence_inventory?.find((entry) => entry.id === id);
    if (!item) { setInsertError('Tài liệu không thuộc hồ sơ này. Hãy chọn lại trong Hồ sơ vụ án.'); return; }
    insertIntoArgument(evidenceText(item));
  }

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
      const { data } = await api.post(`/v1/sessions/${sessionId}/messages`, { ...draft, expected_turn_count: userTurns, evidence_ids: evidenceIds(draft.content, session.case_id.evidence_inventory), legal_reference_ids: [...new Set([...draft.content.matchAll(/\[PL:([^\]\s]+)\]/gu)].map((match) => match[1]))] });
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
  return <main className="flex h-dvh flex-col bg-slate-950 text-slate-200">
    <StudyPanel open={Boolean(panel)} title={panel === 'case' ? 'Hồ sơ vụ án' : 'Trợ lý tra cứu luật'} onClose={() => setPanel(null)}>
      {insertError && <p role="alert" className="mb-3 text-rose-400">{insertError}</p>}
      {panel === 'case' ? <CaseDossier courtCase={session?.case_id} role={session?.user_court_role} onInsert={(item) => insertIntoArgument(evidenceText(item))} insertionDisabled={disabled} /> : <LegalAssistant sessionId={sessionId} open={panel === 'assistant'} onInsert={insertIntoArgument} insertionDisabled={disabled} />}
    </StudyPanel>
    <ConfirmEndDialog open={confirmEnd} pending={state.ending} hasDraft={Boolean(draft.content.trim())} onCancel={() => setConfirmEnd(false)} onConfirm={complete} />
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><div><Link className="text-sm text-blue-400 underline" to="/dashboard/sessions">← Danh sách phiên</Link><h1 className="mt-1 font-bold text-white">{session?.case_id?.title ?? 'Phiên mô phỏng'}</h1><p className="text-xs text-slate-500">{roleLabel(session?.user_court_role, session?.case_id?.category)} · Ngày tra cứu: {session?.case_event_date ?? 'Chưa xác định'} · {userTurns}/{session?.max_turns ?? 20} lượt</p></div><div className="flex flex-wrap gap-2"><button aria-expanded={panel === 'case'} onClick={() => setPanel(panel === 'case' ? null : 'case')} className="rounded-xl border border-blue-400 px-4 py-2 text-blue-400">Hồ sơ vụ án</button><button aria-expanded={panel === 'assistant'} onClick={() => setPanel(panel === 'assistant' ? null : 'assistant')} className="rounded-xl border border-slate-600 px-4 py-2">Trợ lý tra cứu luật</button>{completed ? <Link to={`/simulation/${sessionId}/result`} className="rounded-xl bg-blue-600 px-4 py-2">Xem kết quả</Link> : <button disabled={disabled || !userTurns} onClick={() => setConfirmEnd(true)} className="rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300 disabled:opacity-40">{state.ending ? 'Đang chấm điểm...' : 'Kết thúc và chấm điểm'}</button>}</div></header>
    {insertError && !panel && <p role="alert" className="p-3 text-rose-300">{insertError}</p>}
    {state.error && <div role="alert" className="border-b border-rose-500/30 p-3 text-sm text-rose-300">{state.error} <button disabled={state.sending || state.ending} onClick={() => setReload((n) => n + 1)} className="ml-2 underline">Tải lại dữ liệu</button></div>}
    {session && !session.case_event_date && !completed && <form onSubmit={saveEventDate} className="border-b border-slate-800 p-3 text-sm"><p>Phiên cũ chưa có ngày tra cứu luật. Bổ sung ngày trong hồ sơ, hoặc một ngày giả định cho bài tập, để tiếp tục.</p><label>Ngày tra cứu <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="m-2 rounded border border-slate-700 p-2" /></label><button disabled={state.sending || !eventDate} className="rounded bg-blue-600 px-3 py-2">Lưu ngày</button></form>}
    {session?.processing && !state.sending && !state.ending && <p role="status" className="p-3 text-sm">Một yêu cầu đang được xử lý. Chờ rồi <button onClick={() => setReload((n) => n + 1)} className="text-blue-400 underline">cập nhật phiên</button>.</p>}
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col"><div className="flex-1 space-y-4 overflow-y-auto p-4">{records.map((item) => <article id={`record-${item._id}`} key={item._id} className={`max-w-3xl break-words rounded-2xl border p-4 ${item.sender_type === 'user' ? 'ml-auto border-blue-500/30 bg-blue-500/10' : item.sender_type === 'ai_judge' ? 'border-amber-500/30 bg-amber-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}><p className="mb-2 text-xs font-bold text-slate-400">{item.sender_name}</p><p className="whitespace-pre-wrap leading-7">{dialogueText(item.display_content ?? item.content, session?.case_id?.evidence_inventory)}</p><LegalCitations citations={item.citations} /></article>)}{state.sending && <p role="status">Bên đối lập và Thẩm phán đang phân tích lập luận của bạn.</p>}{state.ending && <p role="status">Đang đánh giá toàn bộ phiên. Quá trình có thể mất vài phút.</p>}<div ref={endRef} /></div>
      {completed ? <p className="border-t border-slate-800 p-4 text-sm">Phiên đã kết thúc. Đây là biên bản chỉ đọc.</p> : <form onSubmit={send} className="border-t border-slate-800 p-4"><label htmlFor="argument" className="text-sm font-semibold">Lập luận của bạn</label><textarea ref={argumentRef} onDrop={dropEvidence} onDragOver={(event) => { if (event.dataTransfer.types.includes(EVIDENCE_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} id="argument" disabled={disabled} maxLength={4000} value={draft.content} onChange={(e) => setDraft({ content: e.target.value, request_id: crypto.randomUUID() })} placeholder="Nêu yêu cầu → chứng cứ trong hồ sơ → giải thích → trả lời phản biện..." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{draft.content.length}/4000 · Bản nháp lưu trong tab này</span><button disabled={disabled || userTurns >= (session?.max_turns ?? 20) || draft.content.trim().length < 10} className="rounded-xl bg-blue-600 px-5 py-2 disabled:opacity-40">Gửi lập luận</button></div>{userTurns >= (session?.max_turns ?? 20) && <p className="mt-2 text-sm">Đã đủ số lượt. Chọn Kết thúc để nhận đánh giá.</p>}</form>}
      </section>
    </div>
  </main>;
}
