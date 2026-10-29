import { canCiteEvidence } from '../../../../../shared/casePresentation.mjs';
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
import { postDialogue } from '../../../services/dialogueStream';
import { roleLabel } from '../../../services/simulation';
import { draftKey, readDraft, saveDraft } from '../../../services/auth';
import UpgradeNotice from '../../../components/membership/UpgradeNotice';
import VoiceDebateControls from '../../../components/courtroom/VoiceDebateControls';
import { speakCourtroomText, stopCourtroomSpeech } from '../../../services/voiceService';

export default function SimulationRoom() {
  const { sessionId } = useParams();
  return <Room key={sessionId} sessionId={sessionId} />;
}

function Room({ sessionId }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [fullRecord, setFullRecord] = useState(null);
  const [submittedContent, setSubmittedContent] = useState('');
  const [streamedSpeech, setStreamedSpeech] = useState(null);
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
  const [slow, setSlow] = useState(false);
  const [waitExpired, setWaitExpired] = useState(false);
  const [state, setState] = useState({ loading: true, sending: false, ending: false, error: '' });
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const lastSpokenRecordIdRef = useRef(null);
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
  const conversation = session?.conversation;
  useEffect(() => {
    if (conversation?.status !== 'awaiting_continue' || selectedId || state.sending) return;
    api.post(`/v1/sessions/${sessionId}/dialogue/seen`, { record_id: conversation.current_record_id }).catch(() => { /* Không tiến lượt nếu mất mạng khi ghi nhận hiển thị. */ });
  }, [conversation?.status, conversation?.current_record_id, selectedId, state.sending, sessionId]);
  const preparing = state.sending || conversation?.status === 'generating';
  useEffect(() => {
    if (!preparing) return;
    const timer = setTimeout(() => setSlow(true), 30_000);
    const deadline = setTimeout(() => setWaitExpired(true), 150_000);
    return () => { clearTimeout(timer); clearTimeout(deadline); setSlow(false); setWaitExpired(false); };
  }, [preparing]);

  useEffect(() => {
    if ((!session?.processing && !state.sending) || state.ending) return;
    let active = true;
    let timer;
    async function poll() {
      try {
        const [{ data }, history] = await Promise.all([api.get(`/v1/sessions/${sessionId}`), api.get(`/v1/sessions/${sessionId}/records`)]);
        if (!active) return;
        setSession(data.data);
        setRecords(history.data.data);
        if (data.data.status === 'completed') navigate(`/simulation/${sessionId}/result`, { replace: true });
        else if (!data.data.processing && !state.sending) setReload((value) => value + 1);
      } catch { if (active) setState((current) => ({ ...current, error: 'Chưa kiểm tra được tiến trình. Kiểm tra kết nối và chọn Tải lại dữ liệu.' })); }
      if (active) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timer); };
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

  function appendVoiceTranscript(spokenText) {
    if (!spokenText?.trim()) return;
    setDraft((current) => {
      const prev = current.content || '';
      const spacer = prev.length === 0 || /[\s\n]$/u.test(prev) ? '' : ' ';
      const updated = (prev + spacer + spokenText).slice(0, 4000);
      return { content: updated, request_id: crypto.randomUUID() };
    });
    requestAnimationFrame(() => {
      if (argumentRef.current) {
        argumentRef.current.focus();
        argumentRef.current.scrollTop = argumentRef.current.scrollHeight;
      }
    });
  }

  // Tự động đọc lời thoại Hội đồng xét xử & Bên đối lập khi bật chế độ TTS
  useEffect(() => {
    if (!ttsEnabled) {
      stopCourtroomSpeech();
      return;
    }
    const record = view?.record;
    if (!record || view.streaming || record.sender_type === 'user') return;
    if (record._id && record._id !== lastSpokenRecordIdRef.current) {
      lastSpokenRecordIdRef.current = record._id;
      speakCourtroomText(record.content, { role: view.actor });
    }
  }, [ttsEnabled, view?.record?._id, view?.record?.content, view?.streaming, view?.actor]);

  // Dọn dẹp âm thanh khi rời phòng
  useEffect(() => {
    return () => {
      stopCourtroomSpeech();
    };
  }, []);

  function dropEvidence(event) {
    const id = event.dataTransfer.getData(EVIDENCE_MIME);
    if (!id) return;
    event.preventDefault();
    const item = session?.case_id?.evidence_inventory?.find((entry) => entry.id === id);
    if (!item || !canCiteEvidence(item, session?.case_id)) { setInsertError('Tài liệu không thuộc hồ sơ này. Hãy chọn lại trong Hồ sơ phiên tòa.'); return; }
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
    if (busy.current || disabled || (conversation && conversation.status !== 'learner') || draft.content.trim().length < 1) return;
    busy.current = true;
    setSubmittedContent(draft.content);
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      const command = { ...draft, ...(conversation ? { action: 'submit', revision: conversation.revision } : {}), expected_turn_count: userTurns, evidence_ids: evidenceIds(draft.content, session.case_id.evidence_inventory), legal_reference_ids: draft.content.includes('[PL:') ? [...new Set([...draft.content.matchAll(/\[PL:([^\]\s]+)\]/gu)].map((match) => match[1]))] : undefined };
      const { data } = conversation ? await postDialogue(sessionId, command, setStreamedSpeech) : await api.post(`/v1/sessions/${sessionId}/messages`, command);
      if (conversation) { setSession(data.data.session); setRecords(data.data.records); }
      else setRecords((current) => [...new Map([...current, ...data.data].map((r) => [r._id, r])).values()]);
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
          if (a.data.data.conversation?.status !== 'failed') setState((s) => ({ ...s, error: '' }));
        }
      } catch { /* Giữ bản nháp để thử lại cùng mã yêu cầu khi có mạng. */ }
    } finally {
      busy.current = false;
      setSubmittedContent('');
      setStreamedSpeech(null);
      setState((s) => ({ ...s, sending: false }));
    }
  }

  async function continueDialogue(action) {
    if (busy.current || disabled) return;
    busy.current = true;
    setSelectedId(null);
    setState(s => ({ ...s, sending: true, error: '' }));
    try {
      const { data } = await postDialogue(sessionId, { action, revision: conversation.revision }, setStreamedSpeech);
      setSession(data.data.session); setRecords(data.data.records);
      requestAnimationFrame(() => {
        if (data.data.session.conversation.status === 'learner') argumentRef.current?.focus();
        else document.querySelector('.speech-content')?.focus();
      });
    } catch (error) {
      setState(s => ({ ...s, error: getApiError(error, 'Chưa tạo được lời thoại tiếp theo. Các lượt đã lưu vẫn được giữ lại, hãy thử lại.') }));
      setReload(n => n + 1);
    } finally { busy.current = false; setStreamedSpeech(null); setState(s => ({ ...s, sending: false })); }
  }

  async function pollStatusManually() {
    try {
      const { data } = await api.get(`/v1/sessions/${sessionId}`);
      setSession(data.data);
      if (data.data.status === 'completed' || data.data.evaluation) {
        saveDraft(completionKey, null);
        saveDraft(storageKey, null);
        navigate(`/simulation/${sessionId}/result`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function complete(options = {}) {
    if (busy.current || disabled) return;

    // Nếu người dùng chọn gửi lời tranh tụng dở dang làm phần kết luận trước khi chấm điểm
    if (options?.sendDraft && draft.content.trim()) {
      busy.current = true;
      setState((s) => ({ ...s, ending: true, error: '' }));
      try {
        const command = {
          ...draft,
          ...(conversation ? { action: 'submit', revision: conversation.revision } : {}),
          expected_turn_count: userTurns,
          evidence_ids: evidenceIds(draft.content, session.case_id?.evidence_inventory),
          legal_reference_ids: draft.content.includes('[PL:') ? [...new Set([...draft.content.matchAll(/\[PL:([^\]\s]+)\]/gu)].map((match) => match[1]))] : undefined
        };
        const { data } = conversation ? await postDialogue(sessionId, command, setStreamedSpeech) : await api.post(`/v1/sessions/${sessionId}/messages`, command);
        if (conversation) {
          setSession(data.data.session);
          setRecords(data.data.records);
        } else {
          setRecords((current) => [...new Map([...current, ...data.data].map((r) => [r._id, r])).values()]);
        }
        setDraft({ content: '', request_id: crypto.randomUUID() });
        saveDraft(storageKey, null);
      } catch (submitErr) {
        busy.current = false;
        setState((s) => ({ ...s, ending: false, error: getApiError(submitErr, 'Chưa gửi được lời tranh luận cuối cùng. Bạn có thể kiểm tra lại nội dung.') }));
        return;
      }
      busy.current = false;
    }

    if (userTurns < 1 && !options?.sendDraft) return;

    busy.current = true;
    saveDraft(completionKey, { requested: true });
    setState((s) => ({ ...s, ending: true, error: '' }));

    // Tự động kiểm tra trạng thái phiên nếu request mất nhiều thời gian hoặc có gián đoạn mạng
    async function checkCompletionStatus(attempts = 6, intervalMs = 2500) {
      for (let i = 0; i < attempts; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        try {
          const { data } = await api.get(`/v1/sessions/${sessionId}`);
          if (data.data?.status === 'completed' || data.data?.evaluation) {
            saveDraft(completionKey, null);
            saveDraft(storageKey, null);
            navigate(`/simulation/${sessionId}/result`);
            return true;
          }
        } catch {
          // tiếp tục thử lại
        }
      }
      return false;
    }

    try {
      await api.post(`/v1/sessions/${sessionId}/complete`);
      saveDraft(completionKey, null);
      saveDraft(storageKey, null);
      navigate(`/simulation/${sessionId}/result`);
    } catch (error) {
      const isBusyOrSlow = error.response?.status === 409 || error.response?.status === 504 || error.code === 'ECONNABORTED' || !error.response;
      if (isBusyOrSlow) {
        const completed = await checkCompletionStatus(6, 2500);
        if (completed) return;
      }

      setConfirmEnd(false);
      setState((s) => ({ ...s, ending: false, error: getApiError(error, 'Chưa thể chấm điểm. Vui lòng thử lại.') }));
      if (error.response?.status >= 500 && /^AI_/u.test(error.response.data?.error?.code ?? '')) {
        saveDraft(completionKey, null);
        setSession(current => ({ ...current, processing: false }));
        return;
      }
      try {
        const { data } = await api.get(`/v1/sessions/${sessionId}`);
        setSession(data.data);
        if (data.data.status === 'completed') navigate(`/simulation/${sessionId}/result`, { replace: true });
        else if (!data.data.processing) saveDraft(completionKey, null);
      } catch { /* Giữ thông báo và cho phép tải lại để kiểm tra kết quả đã lưu. */ }
    } finally {
      busy.current = false;
      setState((s) => ({ ...s, ending: false }));
    }
  }

  function selectRecord(id) {
    // Chỉ đổi lời đang xem; không tiến cursor hoặc gọi model khi duyệt biên bản.
    setSelectedId(id === conversation?.current_record_id ? null : id);
    setPanel(null);
  }
  function returnToCurrent() {
    setSelectedId(null);
    requestAnimationFrame(() => document.querySelector('.speech-content')?.focus());
  }
  const view = streamedSpeech?.content && state.sending ? { record: { _id: 'streaming', content: streamedSpeech.content, sender_type: streamedSpeech.role === 'judge' ? 'ai_judge' : 'ai_prosecutor' }, actor: streamedSpeech.role, streaming: true }
    : courtroomView({ records, selectedId: selectedId ?? conversation?.current_record_id, sending: state.sending && Boolean(submittedContent) && !session?.processing, pendingContent: submittedContent, processing: session?.processing, ending: state.ending });
  const panelTitles = { guide: 'Hướng dẫn phiên tòa', case: 'Hồ sơ phiên tòa', assistant: 'Trợ lý luật', history: 'Hồ sơ phiên tòa', speech: 'Lời trình bày đầy đủ' };
  const ready = !disabled && (!conversation || conversation.status === 'learner') && userTurns < (session?.max_turns ?? 20);
  const reviewing = Boolean(selectedId && selectedId !== (conversation?.current_record_id ?? records.at(-1)?._id));
  const nextSpeaker = conversation?.next_speaker === 'judge' ? 'Chủ tọa' : conversation?.next_speaker === 'opponent' ? 'Bên đối lập' : 'Bạn';
  const status = state.ending ? 'Đang chấm điểm' : state.sending ? (conversation ? 'Đang chuẩn bị lượt tiếp theo' : submittedContent ? 'Đang chờ phản hồi' : 'Đang lưu ngày') : session?.processing ? (readDraft(completionKey)?.requested ? 'Đang chấm điểm' : 'Đang xử lý lượt trước') : completed ? 'Phiên đã kết thúc' : userTurns >= (session?.max_turns ?? 20) ? 'Đã đủ số lượt' : ready ? 'Đến lượt bạn' : conversation?.status === 'awaiting_continue' ? 'Đọc lời thoại rồi bấm Tiếp tục' : conversation?.status === 'failed' ? 'Có thể thử lại lời thoại' : 'Kiểm tra thông tin phiên';
  const speechControls = reviewing ? <div className="speech-controls"><button type="button" className="dialogue-next" onClick={returnToCurrent}>Trở về lượt hiện tại</button></div> : conversation && !completed ? <div className="speech-controls">
      {preparing && <p role="status" aria-live="polite">{streamedSpeech?.content ? 'Đang nhận lời thoại. Bạn có thể đọc phần đã hiện.' : conversation.next_speaker === 'judge' ? 'Chủ tọa đang chuẩn bị câu hỏi…' : conversation.next_speaker === 'opponent' ? 'Bên đối lập đang chuẩn bị lời đáp…' : 'Đang gửi lập luận…'}</p>}
      {slow && preparing && <p role="status">{waitExpired ? 'Chưa xác nhận được kết quả. Kiểm tra kết nối và tiến trình trước khi thử lại để tránh gửi trùng.' : 'Phản hồi đang lâu hơn thường lệ.'} <button type="button" onClick={() => setReload(n => n + 1)}>Kiểm tra tiến trình</button></p>}
      {conversation.status === 'awaiting_continue' && <button type="button" className="dialogue-next" disabled={disabled} onClick={() => continueDialogue('advance')}>{nextSpeaker === 'Bạn' ? 'Trình bày ý kiến' : `Tiếp tục: ${nextSpeaker}`} <span aria-hidden="true">→</span></button>}
      {conversation.status === 'failed' && <button type="button" className="dialogue-next" disabled={disabled} onClick={() => continueDialogue('resume')}>Thử lại lời thoại</button>}
    </div> : null;
  if (state.loading) return <main className="courtroom-page" role="status">Đang tải phiên tòa...</main>;
  return <main className="courtroom-page">
    {panel === 'guide' && <CourtroomGuide completed={completed} maxTurns={session?.max_turns ?? 20} hasDialogue={Boolean(view.record)} onClose={() => setPanel(null)} />}
    <StudyPanel open={Boolean(panel) && panel !== 'guide'} compact={panel === 'speech'} title={panelTitles[panel] ?? 'Hồ sơ vụ án'} onClose={() => setPanel(null)}>
      {insertError && <p role="alert" className="mb-3 text-rose-400">{insertError}</p>}
      {(panel === 'case' || panel === 'history') && <>
        <DossierTabs value={panel} onChange={setPanel} />
        <div id="dossier-content" role="tabpanel" aria-labelledby={'dossier-tab-' + panel} tabIndex={0}>
          {panel === 'case' ? <CaseDossier courtCase={session?.case_id} role={session?.user_court_role} onInsert={(item) => insertIntoArgument(evidenceText(item))} insertionDisabled={!ready} /> : <Transcript session={session} records={records} selected={view.record?._id} onSelect={selectRecord} />}
        </div>
      </>}
      {panel === 'assistant' && (session?.features?.legalAssistant ? <LegalAssistant sessionId={sessionId} open onInsert={insertIntoArgument} insertionDisabled={!ready} /> : <UpgradeNotice />)}
      {panel === 'speech' && <Transcript session={session} records={records} selected={view.record?._id} fullRecord={panel === 'speech' ? fullRecord : null} onSelect={selectRecord} />}
    </StudyPanel>
    <ConfirmEndDialog 
      open={confirmEnd} 
      pending={state.ending} 
      hasDraft={Boolean(draft.content.trim())} 
      draftContent={draft.content}
      userTurns={userTurns}
      maxTurns={session?.max_turns ?? 20}
      userRole={roleLabel(session?.user_court_role, session?.case_id?.category, session?.case_id)}
      onCancel={() => setConfirmEnd(false)} 
      onConfirm={complete} 
      onPollStatus={pollStatusManually}
    />
    <header className="courtroom-header"><div><Link className="courtroom-back" to="/dashboard/sessions">← Danh sách phiên</Link><h1>{session?.case_id?.title ?? 'Phiên mô phỏng'}</h1><p className="courtroom-meta"><span>{roleLabel(session?.user_court_role, session?.case_id?.category, session?.case_id)}</span><span>· {session?.case_id?.practice_context ? 'Mốc tham chiếu sơ thẩm' : 'Ngày sự kiện'}: {session?.case_event_date ?? 'Chưa xác định'}</span><span>· {userTurns}/{session?.max_turns ?? 20} lượt</span></p></div><nav className="courtroom-controls" aria-label="Công cụ phiên tòa"><button className="tool-guide" aria-expanded={panel === 'guide'} onClick={() => setPanel(panel === 'guide' ? null : 'guide')}>Hướng dẫn</button><button className="tool-case" aria-expanded={panel === 'case' || panel === 'history'} onClick={() => setPanel(panel === 'case' || panel === 'history' ? null : 'case')}>Hồ sơ phiên tòa</button><button className="tool-law" aria-expanded={panel === 'assistant'} onClick={() => setPanel(panel === 'assistant' ? null : 'assistant')}>Trợ lý luật</button>{completed ? <Link to={'/simulation/' + sessionId + '/result'}>Xem kết quả</Link> : <button className="end-session" disabled={disabled || !userTurns} title={!userTurns ? 'Cần gửi ít nhất 1 lượt tranh luận trước khi kết thúc' : undefined} onClick={() => setConfirmEnd(true)}>{state.ending ? 'Đang chấm điểm...' : 'Kết thúc và chấm điểm'}</button>}</nav></header>
    {insertError && !panel && <p role="alert" className="courtroom-notice">{insertError}</p>}
    {state.error && <div role="alert" className="courtroom-notice">{state.error}<button disabled={state.sending || state.ending} onClick={() => setReload((n) => n + 1)}>Tải lại dữ liệu</button></div>}
    {session && !session.case_event_date && !completed && <form onSubmit={saveEventDate} className="courtroom-notice"><p>Bổ sung ngày trong hồ sơ hoặc một ngày giả định cho bài tập để tiếp tục.</p><label>Ngày tra cứu <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="m-2 rounded border p-2" /></label><button disabled={state.sending || !eventDate}>Lưu ngày</button></form>}
    <div className="courtroom-workspace"><CourtroomStage speechControls={speechControls} session={session} preparationStalled={waitExpired} pendingSpeaker={state.sending && !submittedContent && ['judge', 'opponent'].includes(conversation?.next_speaker) ? conversation.next_speaker : null} view={view} records={records} onSelectRecord={selectRecord} navigationDisabled={state.sending || state.ending || session?.processing} onHistory={() => setPanel('history')} onReadFull={(record) => { setFullRecord(record); setPanel('speech'); }} />
    </div>
    {completed ? <p className="courtroom-notice">Phiên đã kết thúc. Đây là biên bản chỉ đọc.</p> : <form onSubmit={send} className="courtroom-composer">
      <div className="composer-heading"><label htmlFor="argument">Lập luận của bạn</label>{!conversation && !ready && <span role="status" className="turn-indicator is-busy">{status}</span>}</div>
      <VoiceDebateControls
        disabled={!ready}
        onAppendText={appendVoiceTranscript}
        textareaRef={argumentRef}
        ttsEnabled={ttsEnabled}
        onToggleTts={() => setTtsEnabled((v) => !v)}
      />
      <div className="composer-fields"><textarea ref={argumentRef} onDrop={dropEvidence} onDragOver={(event) => { if (event.dataTransfer.types.includes(EVIDENCE_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} id="argument" disabled={!ready} maxLength={4000} value={draft.content} onChange={(e) => setDraft({ content: e.target.value, request_id: crypto.randomUUID() })} placeholder="Trình bày luận điểm, liên hệ chứng cứ và trả lời vấn đề chủ tọa đặt ra… Hoặc bấm nút Micro ở trên để tranh tụng bằng giọng nói." /><button className="composer-send" disabled={!ready || draft.content.trim().length < 1}>Gửi lập luận <span aria-hidden="true">↗</span></button></div>
      <div className="composer-foot"><span>{draft.content.length}/4000</span></div>{userTurns >= (session?.max_turns ?? 20) && <p>Đã đủ số lượt. Chọn Kết thúc và chấm điểm để xem kết quả.</p>}
    </form>}
  </main>;
}
