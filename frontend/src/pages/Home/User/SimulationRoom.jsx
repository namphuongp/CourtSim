import DossierTabs from '../../../components/courtroom/DossierTabs';
import CourtroomGuide from '../../../components/courtroom/CourtroomGuide';
import CourtroomStage from '../../../components/courtroom/CourtroomStage';
import Transcript from '../../../components/courtroom/Transcript';
import { courtroomView } from '../../../services/courtroom';
import ConfirmEndDialog from '../../../components/ConfirmEndDialog';
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
  const [selectedId, setSelectedId] = useState(null);
  const [fullRecord, setFullRecord] = useState(null);
  const [submittedContent, setSubmittedContent] = useState('');
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
      if (window.location.hash === '#transcript') setPanel('history');
      const linked = window.location.hash.replace('#record-', '');
      if (b.data.data.some((r) => r._id === linked)) setSelectedId(linked);
      setDraft((current) => b.data.data.some((r) => r.request_id === current.request_id) ? { content: '', request_id: crypto.randomUUID() } : current);
      setState((current) => ({ ...current, loading: false, error: '' }));
    }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: getApiError(error) })); });
    return () => { active = false; };
  }, [sessionId, reload, completionKey, storageKey, navigate]);
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
      } catch { if (active) setState((current) => ({ ...current, error: 'Chưa kiểm tra được tiến trình. Kiểm tra kết nối và chọn Tải lại dữ liệu.' })); }
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
    if (!item) { setInsertError('Tài liệu không thuộc hồ sơ này. Hãy chọn lại trong Hồ sơ phiên tòa.'); return; }
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
    } catch (error) { setState((s) => ({ ...s, error: getApiError(error, 'Chưa lưu được ngày sự kiện. Vui lòng thử lại.') })); }
    finally { busy.current = false; setState((s) => ({ ...s, sending: false })); }
  }

  async function send(event) {
    event.preventDefault();
    if (busy.current || disabled || draft.content.trim().length < 10) return;
    busy.current = true;
    setSubmittedContent(draft.content);
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      const { data } = await api.post(`/v1/sessions/${sessionId}/messages`, { ...draft, expected_turn_count: userTurns, evidence_ids: evidenceIds(draft.content, session.case_id.evidence_inventory), legal_reference_ids: [...new Set([...draft.content.matchAll(/\[PL:([^\]\s]+)\]/gu)].map((match) => match[1]))] });
      setRecords((current) => [...new Map([...current, ...data.data].map((r) => [r._id, r])).values()]);
      setSelectedId(null);
      setDraft({ content: '', request_id: crypto.randomUUID() });
    } catch (error) {
      setState((s) => ({ ...s, error: getApiError(error, 'Chưa thể gửi lập luận. Nội dung bạn viết vẫn được giữ lại. Vui lòng thử lại.') }));
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
      setSubmittedContent('');
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
      setState((s) => ({ ...s, error: getApiError(error, 'Chưa thể chấm điểm. Các lượt đã gửi vẫn được giữ lại. Vui lòng thử lại.') }));
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

  function selectRecord(id) { setSelectedId(id); setPanel(null); }
  const view = courtroomView({ records, selectedId, sending: state.sending && Boolean(submittedContent), pendingContent: submittedContent, processing: session?.processing, ending: state.ending });
  const panelTitles = { guide: 'Hướng dẫn phiên tòa', case: 'Hồ sơ phiên tòa', assistant: 'Trợ lý luật', history: 'Hồ sơ phiên tòa', speech: 'Lời trình bày đầy đủ' };
  const ready = !disabled && userTurns < (session?.max_turns ?? 20);
  const status = state.ending ? 'Đang chấm điểm' : state.sending ? (submittedContent ? 'Đang chờ phản hồi' : 'Đang lưu ngày') : session?.processing ? (readDraft(completionKey)?.requested ? 'Đang chấm điểm' : 'Đang xử lý lượt trước') : completed ? 'Phiên đã kết thúc' : userTurns >= (session?.max_turns ?? 20) ? 'Đã đủ số lượt' : ready ? 'Đến lượt bạn' : 'Kiểm tra thông tin phiên';
  if (state.loading) return <main className="courtroom-page" role="status">Đang tải phiên tòa...</main>;
  return <main className="courtroom-page">
    {panel === 'guide' && <CourtroomGuide completed={completed} hasDialogue={Boolean(view.record)} onClose={() => setPanel(null)} />}
    <StudyPanel open={Boolean(panel) && panel !== 'guide'} compact={panel === 'speech'} title={panelTitles[panel] ?? 'Hồ sơ vụ án'} onClose={() => setPanel(null)}>
      {insertError && <p role="alert" className="mb-3 text-rose-400">{insertError}</p>}
      {(panel === 'case' || panel === 'history') && <>
        <DossierTabs value={panel} onChange={setPanel} />
        <div id="dossier-content" role="tabpanel" aria-labelledby={'dossier-tab-' + panel} tabIndex={0}>
          {panel === 'case' ? <CaseDossier courtCase={session?.case_id} role={session?.user_court_role} onInsert={(item) => insertIntoArgument(evidenceText(item))} insertionDisabled={!ready} /> : <Transcript session={session} records={records} selected={view.record?._id} onSelect={selectRecord} />}
        </div>
      </>}
      {panel === 'assistant' && <LegalAssistant sessionId={sessionId} open onInsert={insertIntoArgument} insertionDisabled={!ready} />}
      {panel === 'speech' && <Transcript session={session} records={records} selected={view.record?._id} fullRecord={panel === 'speech' ? fullRecord : null} onSelect={selectRecord} />}
    </StudyPanel>
    <ConfirmEndDialog open={confirmEnd} pending={state.ending} hasDraft={Boolean(draft.content.trim())} onCancel={() => setConfirmEnd(false)} onConfirm={complete} />
    <header className="courtroom-header"><div><Link className="courtroom-back" to="/dashboard/sessions">← Danh sách phiên</Link><h1>{session?.case_id?.title ?? 'Phiên mô phỏng'}</h1><p className="courtroom-meta"><span>{roleLabel(session?.user_court_role, session?.case_id?.category)}</span><span>· Ngày sự kiện: {session?.case_event_date ?? 'Chưa xác định'}</span><span>· {userTurns}/{session?.max_turns ?? 20} lượt</span></p></div><nav className="courtroom-controls" aria-label="Công cụ phiên tòa"><button className="tool-guide" aria-expanded={panel === 'guide'} onClick={() => setPanel(panel === 'guide' ? null : 'guide')}>Hướng dẫn</button><button className="tool-case" aria-expanded={panel === 'case' || panel === 'history'} onClick={() => setPanel(panel === 'case' || panel === 'history' ? null : 'case')}>Hồ sơ phiên tòa</button><button className="tool-law" aria-expanded={panel === 'assistant'} onClick={() => setPanel(panel === 'assistant' ? null : 'assistant')}>Trợ lý luật</button>{completed ? <Link to={'/simulation/' + sessionId + '/result'}>Xem kết quả</Link> : <button className="end-session" disabled={disabled || !userTurns} onClick={() => setConfirmEnd(true)}>{state.ending ? 'Đang chấm điểm...' : 'Kết thúc và chấm điểm'}</button>}</nav></header>
    {insertError && !panel && <p role="alert" className="courtroom-notice">{insertError}</p>}
    {state.error && <div role="alert" className="courtroom-notice">{state.error}<button disabled={state.sending || state.ending} onClick={() => setReload((n) => n + 1)}>Tải lại dữ liệu</button></div>}
    {session && !session.case_event_date && !completed && <form onSubmit={saveEventDate} className="courtroom-notice"><p>Bổ sung ngày trong hồ sơ hoặc một ngày giả định cho bài tập để tiếp tục.</p><label>Ngày tra cứu <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="m-2 rounded border p-2" /></label><button disabled={state.sending || !eventDate}>Lưu ngày</button></form>}
    <div className="courtroom-workspace"><CourtroomStage session={session} view={view} records={records} onSelect={setSelectedId} onReadFull={(record) => { setFullRecord(record); setPanel('speech'); }} />
    </div>
    {completed ? <p className="courtroom-notice">Phiên đã kết thúc. Đây là biên bản chỉ đọc.</p> : <form onSubmit={send} className="courtroom-composer">
      <div className="composer-heading"><label htmlFor="argument">Lập luận của bạn</label><span role="status" className={'turn-indicator' + (ready ? '' : ' is-busy')}>{status}</span></div>
      <div className="composer-fields"><textarea ref={argumentRef} onDrop={dropEvidence} onDragOver={(event) => { if (event.dataTransfer.types.includes(EVIDENCE_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} id="argument" disabled={!ready} maxLength={4000} value={draft.content} onChange={(e) => setDraft({ content: e.target.value, request_id: crypto.randomUUID() })} placeholder="Trình bày luận điểm, liên hệ chứng cứ và trả lời vấn đề chủ tọa đặt ra…" /><button className="composer-send" disabled={!ready || draft.content.trim().length < 10}>Gửi lập luận <span aria-hidden="true">↗</span></button></div>
      <div className="composer-foot"><span>{draft.content.length}/4000 · Bản nháp được giữ khi tải lại trang</span></div>{userTurns >= (session?.max_turns ?? 20) && <p>Đã đủ số lượt. Chọn Kết thúc và chấm điểm để xem kết quả.</p>}
    </form>}
  </main>;
}
