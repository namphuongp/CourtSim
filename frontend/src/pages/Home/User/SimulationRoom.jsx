import { canCiteEvidence } from '../../../../../shared/casePresentation.mjs';
import { dialogueText } from '../../../../../shared/dialogueText.mjs';
import DossierTabs from '../../../components/courtroom/DossierTabs';
import CourtroomGuide from '../../../components/courtroom/CourtroomGuide';
import CourtroomStage from '../../../components/courtroom/CourtroomStage';
import Transcript from '../../../components/courtroom/Transcript';
import SessionNotebook from '../../../components/courtroom/SessionNotebook';
import { actorFor, courtroomView, getTrialStageIndex, TRIAL_STAGES } from '../../../services/courtroom';
import ConfirmEndDialog from '../../../components/ConfirmEndDialog';
import CaseDossier from '../../../components/CaseDossier';
import { EVIDENCE_MIME, evidenceText, evidenceIds } from '../../../services/references';
import StudyPanel from '../../../components/StudyPanel';
import LegalAssistant from '../../../components/LegalAssistant';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { postDialogue } from '../../../services/dialogueStream';
import { draftKey, readDraft, saveDraft, useCurrentUser } from '../../../services/auth';
import UpgradeNotice from '../../../components/membership/UpgradeNotice';
import VoiceDebateControls from '../../../components/courtroom/VoiceDebateControls';
import { isManualSpeaking, speakCourtroomText, stopCourtroomSpeech, unlockCourtroomAudio } from '../../../services/voiceService';
import PdfExportModal from '../../../components/courtroom/PdfExportModal';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import CaseQuickSummaryModal from '../../../components/courtroom/CaseQuickSummaryModal';
import SessionTimer from '../../../components/courtroom/SessionTimer';
import { ArrowLeft, ArrowRight, Award, BookOpen, ChevronDown, CircleHelp, ClipboardList, FileDown, FileText, FolderOpen, Gavel, HelpCircle, Maximize2, MessageSquareQuote, Plus, Scale, Send } from 'lucide-react';
import { LoadingState } from '../../../components/WorkspaceStates';

const guidePreferencesInMemory = new Set();

function isGuideSuppressed(key) {
  if (guidePreferencesInMemory.has(key)) return true;
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function SimulationRoom() {
  const { sessionId } = useParams();
  return <Room key={sessionId} sessionId={sessionId} />;
}

function Room({ sessionId }) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const userId = useCurrentUser()?.id;
  const guidePreferenceKey = userId ? `courtsim.courtroom-guide.v1:${userId}` : null;
  const guideCheckedFor = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [fullRecord, setFullRecord] = useState(null);
  const [submittedContent, setSubmittedContent] = useState('');
  const [streamedSpeech, setStreamedSpeech] = useState(null);
  const argumentRef = useRef(null);
  const [panel, setPanel] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const toolsTriggerRef = useRef(null);
  const [insertError, setInsertError] = useState('');
  const busy = useRef(false);
  const storageKey = draftKey(sessionId);
  const completionKey = draftKey(`${sessionId}:completion`);
  const [draft, setDraft] = useState(() => readDraft(storageKey) ?? { content: '', request_id: crypto.randomUUID() });
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [expandedComposer, setExpandedComposer] = useState(false);
  const [dossierTab, setDossierTab] = useState('overview');
  const [draftMode, setDraftMode] = useState(null);
  const [reload, setReload] = useState(0);
  const [eventDate, setEventDate] = useState('');
  const [slow, setSlow] = useState(false);
  const [waitExpired, setWaitExpired] = useState(false);
  const [state, setState] = useState({ loading: true, sending: false, ending: false, error: '' });
  const [cooldown, setCooldown] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('courtsim_tts_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [caseSummaryOpen, setCaseSummaryOpen] = useState(false);
  const autoSpokenRecordIdsRef = useRef(new Set());
  const isInitialLoadedRef = useRef(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(null);
  const [countdownStopped, setCountdownStopped] = useState(false);
  // Lời thoại người dùng vừa nhấn vào trong khung hội thoại (dùng khi bấm nút bật giọng đọc)
  const [focusedRecordId, setFocusedRecordId] = useState(null);

  useEffect(() => {
    if (!toolsOpen) return;
    function closeOnOutsideClick(event) {
      if (!toolsRef.current?.contains(event.target)) setToolsOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setToolsOpen(false);
      toolsTriggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [toolsOpen]);

  function selectTool(action) {
    toolsTriggerRef.current?.focus();
    setToolsOpen(false);
    action();
  }

  function dismissGuidePermanently() {
    if (guidePreferenceKey) {
      try { localStorage.setItem(guidePreferenceKey, '1'); }
      catch { guidePreferencesInMemory.add(guidePreferenceKey); }
    }
    setPanel(null);
  }

  // Phát đúng một lời thoại cụ thể và ghi nhận đã đọc để chế độ tự động không đọc lặp lại.
  function speakRecord(record, { manual }) {
    if (!record?._id) return;
    const rawContent = record.display_content ?? record.content ?? '';
    const text = dialogueText(rawContent, session?.case_id?.evidence_inventory) || String(rawContent).trim();
    if (!text) return;
    const recordId = String(record._id);
    autoSpokenRecordIdsRef.current.add(recordId);
    speakCourtroomText(text, { role: actorFor(record), recordId, isManual: manual });
  }

  function handleToggleTts() {
    unlockCourtroomAudio();
    const next = !ttsEnabled;
    setTtsEnabled(next);
    try {
      localStorage.setItem('courtsim_tts_enabled', String(next));
    } catch { /* Bỏ qua */ }
    if (!next) {
      stopCourtroomSpeech();
      return;
    }
    // Bật giọng đọc: đọc ngay lời thoại người dùng vừa nhấn chọn; chưa chọn thì đọc lời AI mới nhất.
    const preferId = focusedRecordId ?? selectedId;
    const target = (preferId && records.find((r) => String(r._id) === String(preferId)))
      || records.filter((r) => r?._id && r.sender_type !== 'user').at(-1);
    if (target) {
      speakRecord(target, { manual: true });
    }
  }
  useEffect(() => { saveDraft(storageKey, draft); }, [storageKey, draft]);
  useEffect(() => {
    return () => {
      // Dừng ngay mọi luồng âm thanh khi rời khỏi phòng xử án
      stopCourtroomSpeech();
    };
  }, []);
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
      const incomingRecords = b.data.data || [];
      // Nếu là lần đầu tải phiên:
      // Đánh dấu tất cả bản ghi hiện có vào Set để tuyệt đối không tự động phát các bản ghi cũ từ trước!
      if (!isInitialLoadedRef.current && incomingRecords.length > 0) {
        incomingRecords.forEach((r) => {
          if (r?._id) autoSpokenRecordIdsRef.current.add(String(r._id));
        });
      }
      isInitialLoadedRef.current = true;
      setRecords(incomingRecords);
      if (window.location.hash === '#transcript') setPanel('history');
      const linked = window.location.hash.replace('#record-', '');
      if (incomingRecords.some((r) => r._id === linked)) setSelectedId(linked);
      setDraft((current) => incomingRecords.some((r) => r.request_id === current.request_id) ? { content: '', request_id: crypto.randomUUID() } : current);
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

  const lastVoiceTranscriptRef = useRef({ text: '', time: 0 });

  function appendVoiceTranscript(spokenText) {
    if (!spokenText?.trim()) return;
    const cleanSpoken = spokenText.trim();
    const now = Date.now();

    // 1. Chặn duplicate theo thời gian nếu cùng chuỗi được gọi liên tiếp trong 3 giây
    if (
      cleanSpoken.toLowerCase() === lastVoiceTranscriptRef.current.text.toLowerCase() &&
      now - lastVoiceTranscriptRef.current.time < 3000
    ) {
      return;
    }

    setDraft((current) => {
      const prev = current.content || '';
      let textToInsert = cleanSpoken;

      // 2. Chặn duplicate ngữ nghĩa: nếu câu này đã nằm sẵn ở cuối nội dung thì bỏ qua
      const trimmedPrev = prev.trim().toLowerCase();
      const trimmedNew = textToInsert.toLowerCase();
      if (trimmedPrev.endsWith(trimmedNew) || trimmedPrev === trimmedNew) {
        return current;
      }

      // Tự động viết hoa chữ cái đầu nếu bắt đầu câu mới
      const needsCapital = prev.length === 0 || /[.!?\n]\s*$/u.test(prev);
      if (needsCapital && textToInsert.length > 0) {
        textToInsert = textToInsert.charAt(0).toLocaleUpperCase('vi') + textToInsert.slice(1);
      }
      const spacer = prev.length === 0 || /[\s\n]$/u.test(prev) ? '' : ' ';
      const updated = (prev + spacer + textToInsert).slice(0, 4000);
      lastVoiceTranscriptRef.current = { text: cleanSpoken, time: now };
      return { content: updated, request_id: crypto.randomUUID() };
    });
    requestAnimationFrame(() => {
      if (argumentRef.current) {
        argumentRef.current.focus();
        argumentRef.current.scrollTop = argumentRef.current.scrollHeight;
      }
    });
  }

  // Khóa cuộn toàn bộ trang khi ở phòng mô phỏng để vừa vặn trong 1 màn hình (100vh)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHeight = document.body.style.height;
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.height = prevHeight;
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

  const canLearnerSpeak = !conversation || conversation.status === 'learner' || (conversation.status === 'awaiting_continue' && conversation.next_speaker === 'learner');

  async function send(event) {
    event.preventDefault();
    if (busy.current || disabled || cooldown || (conversation && !canLearnerSpeak) || draft.content.trim().length < 3) return;
    stopCourtroomSpeech();
    unlockCourtroomAudio();
    busy.current = true;
    setSubmittedContent(draft.content);
    setState((s) => ({ ...s, sending: true, error: '' }));
    try {
      const command = {
        ...draft,
        close_requested: Boolean(draft.close_requested),
        ...(conversation ? { action: 'submit', revision: conversation.revision } : {}),
        expected_turn_count: userTurns,
        evidence_ids: evidenceIds(draft.content, session.case_id.evidence_inventory),
        legal_reference_ids: draft.content.includes('[PL:') ? [...new Set([...draft.content.matchAll(/\[PL:([^\]\s]+)\]/gu)].map((match) => match[1]))] : undefined
      };
      const { data } = conversation ? await postDialogue(sessionId, command, setStreamedSpeech) : await api.post(`/v1/sessions/${sessionId}/messages`, command);
      if (conversation) {
        setSession(data.data.session);
        setRecords(data.data.records);
      } else {
        setRecords((current) => [...new Map([...current, ...data.data].map((r) => [r._id, r])).values()]);
      }
      setSelectedId(null);
      setFocusedRecordId(null);
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
      // Kích hoạt cooldown 2.5s để chống click dồn / spam token
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2500);
    }
  }

  async function continueDialogue(action) {
    if (busy.current || disabled) return;
    stopCourtroomSpeech();
    unlockCourtroomAudio();
    busy.current = true;
    setSelectedId(null);
    setFocusedRecordId(null);
    setState(s => ({ ...s, sending: true, error: '' }));
    try {
      const { data } = await postDialogue(sessionId, { action, revision: conversation.revision }, setStreamedSpeech);
      setSession(data.data.session); setRecords(data.data.records);
      requestAnimationFrame(() => {
        if (data.data.session.conversation.status === 'learner') argumentRef.current?.focus();
        else document.querySelector('.speech-content, .dialogue-messages-scroll')?.focus({ preventScroll: true });
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
    if (busy.current || (!options?.autoFromChat && disabled)) return;
    setCountdownStopped(true);
    setAutoCloseCountdown(null);

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

    if (userTurns < 1 && !options?.sendDraft && !options?.autoFromChat) return;

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
    setFocusedRecordId(id ? String(id) : null);
    setSelectedId(id === conversation?.current_record_id ? null : id);
    setPanel(null);
  }
  function returnToCurrent() {
    setSelectedId(null);
    setFocusedRecordId(null);
    requestAnimationFrame(() => document.querySelector('.speech-content, .dialogue-messages-scroll')?.focus({ preventScroll: true }));
  }
  const view = streamedSpeech?.content && state.sending ? { record: { _id: 'streaming', content: streamedSpeech.content, sender_type: streamedSpeech.role === 'judge' ? 'ai_judge' : 'ai_prosecutor' }, actor: streamedSpeech.role, streaming: true }
    : courtroomView({ records, selectedId, sending: state.sending && Boolean(submittedContent) && !session?.processing, pendingContent: submittedContent, processing: session?.processing, ending: state.ending });
  // Tự động phát âm thanh lời thoại AI khi có lượt mới (nếu TTS đang bật).
  // Tuyệt đối không can thiệp hoặc đè lên khi người dùng đang chủ động bấm nghe (isManualSpeaking).
  useEffect(() => {
    if (!ttsEnabled) return;

    // Chặn tự động đọc khi:
    // - Đang gửi bài (sending) hoặc backend đang xử lý (processing)
    // - AI đang stream chữ trên màn hình (streaming)
    // - Phiên đã hoàn tất (completed)
    // - Người dùng đang chủ động bấm nghe một tin nhắn cụ thể (isManualSpeaking)
    if (state.sending || session?.processing || view?.streaming || completed || isManualSpeaking()) {
      return;
    }

    // Chỉ tự động đọc tin nhắn AI mới nhất ở cuối danh sách records
    const latestAiRecord = records.filter((r) => r && r._id && r.sender_type !== 'user').at(-1);
    if (!latestAiRecord || !latestAiRecord._id) {
      return;
    }

    const recordIdStr = String(latestAiRecord._id);

    // Nếu bản ghi này đã được tự động đọc rồi => không đọc lặp
    if (autoSpokenRecordIdsRef.current.has(recordIdStr)) {
      return;
    }

    // Đánh dấu bản ghi này đã được tự động đọc
    autoSpokenRecordIdsRef.current.add(recordIdStr);

    // Dừng âm thanh trước đó (nếu có) trước khi đọc lượt mới
    stopCourtroomSpeech();

    const speechRole = actorFor(latestAiRecord);
    const textToSpeak = dialogueText(
      latestAiRecord.display_content || latestAiRecord.content,
      session?.case_id?.evidence_inventory
    );

    if (textToSpeak) {
      speakCourtroomText(textToSpeak, { role: speechRole, recordId: recordIdStr });
    }
  }, [
    ttsEnabled,
    records,
    view?.streaming,
    state.sending,
    session?.processing,
    session?.case_id?.evidence_inventory,
    completed,
  ]);
  const panelTitles = { notebook: 'Sổ tay phiên', guide: 'Hướng dẫn phiên tòa', case: 'Hồ sơ phiên tòa', assistant: 'Trợ lý luật', history: 'Hồ sơ phiên tòa', speech: 'Lời trình bày đầy đủ' };
  const courtCase = session?.case_id;
  const maxTurns = session?.max_turns ?? 20;
  const stageIndex = completed ? TRIAL_STAGES.length - 1 : getTrialStageIndex(session, records);
  const hasLearnerTurn = canLearnerSpeak && userTurns < maxTurns;
  const ready = !disabled && hasLearnerTurn;
  const reviewing = Boolean(selectedId && selectedId !== (conversation?.current_record_id ?? records.at(-1)?._id));
  const nextSpeaker = conversation?.next_speaker === 'judge' ? 'Chủ tọa' : conversation?.next_speaker === 'opponent' ? 'Bên đối lập' : 'Bạn';
  const lastRecord = records.at(-1);
  const isJudgeClose = lastRecord?.sender_type === 'ai_judge' && lastRecord?.purpose === 'close';
  const isConcluded = Boolean(
    completed ||
    conversation?.concluded ||
    (conversation?.phase === 'summary' && isJudgeClose)
  );
  const isReadyToClose = Boolean(
    (isConcluded || conversation?.ready_to_close || conversation?.phase === 'summary' || isJudgeClose) &&
    userTurns >= 1
  );

  const canOfferGuide = session?.status === 'ongoing' && !disabled && !preparing &&
    !isConcluded && !state.error && !selectedId && hash !== '#transcript' && !hash.startsWith('#record-') &&
    !panel && !toolsOpen && !confirmEnd && !expandedComposer && !pdfModalOpen && !caseSummaryOpen;
  useEffect(() => {
    if (state.loading || !session || !guidePreferenceKey || guideCheckedFor.current === guidePreferenceKey) return;
    guideCheckedFor.current = guidePreferenceKey;
    if (canOfferGuide && !isGuideSuppressed(guidePreferenceKey)) setPanel('guide');
  }, [state.loading, session, guidePreferenceKey, canOfferGuide]);

  useEffect(() => {
    if (!isConcluded || completed || state.ending || countdownStopped) {
      setAutoCloseCountdown(null);
      return;
    }
    let secondsRemaining = 5;
    setAutoCloseCountdown(secondsRemaining);
    const interval = setInterval(() => {
      secondsRemaining -= 1;
      if (secondsRemaining > 0) {
        setAutoCloseCountdown(secondsRemaining);
        return;
      }
      clearInterval(interval);
      setAutoCloseCountdown(null);
      complete({ autoFromChat: true });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConcluded, completed, state.ending, countdownStopped]);
  const currentPhase = conversation?.phase ?? (userTurns === 0 ? 'opening' : 'debate');
  const argumentPlaceholder = isReadyToClose || currentPhase === 'summary'
    ? 'Tóm tắt lập luận, chứng cứ chính và đề nghị của phía bạn…'
    : currentPhase === 'clarification'
      ? 'Trả lời câu hỏi của Chủ tọa và dẫn chứng cứ liên quan trong hồ sơ…'
      : userTurns === 0
        ? 'Kính thưa Hội đồng xét xử, trình bày yêu cầu khởi kiện/phản bác mở đầu và chứng cứ cốt lõi của phía bạn…'
        : 'Phản hồi luận điểm của bên đối lập và liên hệ chứng cứ phù hợp…';
  let status = 'Kiểm tra thông tin phiên';
  if (state.ending) status = 'Đang nghị án & chấm điểm';
  else if (state.sending) status = conversation ? 'Đang chuẩn bị lượt tiếp theo' : submittedContent ? 'Đang chờ phản hồi' : 'Đang lưu ngày';
  else if (session?.processing) status = readDraft(completionKey)?.requested ? 'Đang chấm điểm' : 'Đang xử lý lượt trước';
  else if (completed) status = 'Phiên đã kết thúc';
  else if (userTurns >= maxTurns) status = 'Đã đủ số lượt · Chọn Kết thúc phiên tòa để chấm điểm';
  else if (isReadyToClose) status = 'Giai đoạn tổng kết · Có thể kết thúc phiên';
  else if (ready) status = 'Đến lượt bạn';
  else if (conversation?.status === 'awaiting_continue') status = 'Đọc lời thoại rồi bấm Tiếp tục';
  else if (conversation?.status === 'failed') status = 'Có thể thử lại lời thoại';
  const speechControls = conversation && !completed && preparing && !reviewing ? (
    <div className="speech-controls">
      <p role="status">{streamedSpeech?.content ? 'Đang nhận lời thoại. Bạn có thể đọc phần đã hiện.' : conversation.next_speaker === 'judge' ? 'Chủ tọa đang chuẩn bị câu hỏi…' : conversation.next_speaker === 'opponent' ? 'Bên đối lập đang chuẩn bị lời đáp…' : 'Đang gửi lập luận…'}</p>
      {slow && <p role="status">{waitExpired ? 'Chưa xác nhận được kết quả. Kiểm tra kết nối và tiến trình trước khi thử lại để tránh gửi trùng.' : 'Phản hồi đang lâu hơn thường lệ.'} <button type="button" onClick={() => setReload(n => n + 1)}>Kiểm tra tiến trình</button></p>}
    </div>
  ) : null;
  let turnAction = <p className="room-turn-status" role="status">{status}</p>;
  if (reviewing) {
    turnAction = <button type="button" className="room-primary-button" onClick={returnToCurrent}>Trở về lượt hiện tại</button>;
  } else if (completed) {
    turnAction = <Link to={`/simulation/${sessionId}/result`} className="room-primary-button"><Award size={16} aria-hidden="true" /> Xem kết quả</Link>;
  } else if (isConcluded) {
    turnAction = (
      <button type="button" className="room-primary-button room-finish-button" disabled={disabled} onClick={() => complete({ autoFromChat: true })}>
        <Gavel size={16} aria-hidden="true" /> {state.ending ? 'Đang chấm điểm…' : 'Nghị án và chấm điểm'}
      </button>
    );
  } else if (conversation?.status === 'awaiting_continue') {
    turnAction = (
      <button type="button" className="room-primary-button" disabled={disabled} onClick={() => continueDialogue('advance')}>
        {nextSpeaker === 'Bạn' ? 'Trình bày ý kiến' : `Tiếp tục: ${nextSpeaker}`} <ArrowRight size={16} aria-hidden="true" />
      </button>
    );
  } else if (conversation?.status === 'failed') {
    turnAction = <button type="button" className="room-primary-button" disabled={disabled} onClick={() => continueDialogue('resume')}>Thử lại lời thoại</button>;
  } else if (hasLearnerTurn) {
    turnAction = (
      <button
        type="submit"
        form="courtroom-argument-form"
        className="room-primary-button"
        disabled={!ready || cooldown || draft.content.trim().length < 3}
      >
        {state.sending ? 'Đang gửi…' : cooldown ? 'Chờ giây lát…' : <>Gửi lập luận <Send size={16} aria-hidden="true" /></>}
      </button>
    );
  }
  if (state.loading) return <main className="courtroom-page"><LoadingState>Đang tải phiên tòa...</LoadingState></main>;
  return <main className="courtroom-page">
    {panel === 'guide' && <CourtroomGuide
      completed={completed}
      concluded={isConcluded}
      maxTurns={maxTurns}
      hasDialogue={Boolean(view.record)}
      returnFocusRef={toolsTriggerRef}
      onClose={() => setPanel(null)}
      onDismissPermanently={dismissGuidePermanently}
    />}
    <StudyPanel open={Boolean(panel) && panel !== 'guide'} compact={panel === 'speech'} title={panelTitles[panel] ?? 'Hồ sơ vụ án'} onClose={() => setPanel(null)}>
      {insertError && <p role="alert" className="mb-3 text-rose-400">{insertError}</p>}
      {(panel === 'case' || panel === 'history') && <>
        <DossierTabs value={panel} onChange={setPanel} />
        <div id="dossier-content" role="tabpanel" aria-labelledby={'dossier-tab-' + panel} tabIndex={0}>
          {panel === 'case' ? <CaseDossier key={dossierTab} initialTab={dossierTab} tabbed sessionId={sessionId} courtCase={session?.case_id} role={session?.user_court_role} onInsert={(item) => insertIntoArgument(typeof item === 'string' ? item : evidenceText(item))} insertionDisabled={!ready} /> : <Transcript session={session} records={records} selected={view.record?._id} onSelect={selectRecord} />}
        </div>
      </>}
      {panel === 'notebook' && <SessionNotebook key={sessionId} sessionId={sessionId} caseId={session?.case_id?._id} onInsert={insertIntoArgument} insertionDisabled={!ready}/>}
      {panel === 'assistant' && (
        !session && state.loading ? (
          <LoadingState>Đang tải thông tin phiên tòa...</LoadingState>
        ) : !session && state.error ? (
          <div role="alert" className="courtroom-notice p-4">
            <p className="text-rose-400 font-semibold">{state.error}</p>
            <button type="button" className="underline mt-2 text-sm text-blue-300" onClick={() => setReload((n) => n + 1)}>
              Tải lại dữ liệu
            </button>
          </div>
        ) : (session?.features?.legalAssistant || session?.features?.isFreeTrial || session?.is_free_trial || session?.access_source === 'free_trial' || !session?.access_plan || session?.access_plan === 'freemium') ? (
          <LegalAssistant
            sessionId={sessionId}
            open
            onInsert={insertIntoArgument}
            insertionDisabled={!ready}
            isFreeTrial={Boolean(session?.features?.isFreeTrial || session?.is_free_trial || session?.access_source === 'free_trial' || (!session?.access_source && (!session?.access_plan || session?.access_plan === 'freemium')))}
          />
        ) : (
          <UpgradeNotice />
        )
      )}
      {panel === 'speech' && <Transcript session={session} records={records} selected={view.record?._id} fullRecord={panel === 'speech' ? fullRecord : null} onSelect={selectRecord} />}
    </StudyPanel>
    <ConfirmEndDialog open={confirmEnd} pending={state.ending} hasDraft={Boolean(draft.content.trim())} userTurns={userTurns} onCancel={() => setConfirmEnd(false)} onConfirm={complete} />
    {expandedComposer && <FeedbackModal title="Trình bày ý kiến của bạn" onClose={() => setExpandedComposer(false)}><div className="argument-editor"><div><label htmlFor="argument-expanded">Nội dung lập luận</label><textarea id="argument-expanded" disabled={!ready} maxLength={4000} value={draft.content} onChange={event => setDraft({ content: event.target.value, request_id: crypto.randomUUID() })}/><small>{draft.content.length}/4000 ký tự · Bản nháp được lưu trên trình duyệt</small></div><aside><h3>{draftMode ?? 'Gợi ý trình bày'}</h3>{draftMode && <p>{draftMode === 'Phản bác' ? 'Chọn một ý kiến cụ thể của bên đối lập, chỉ ra điểm chưa thuyết phục và đối chiếu chứng cứ hoặc căn cứ pháp luật.' : draftMode === 'Đặt câu hỏi' ? 'Nêu câu hỏi ngắn, rõ và gắn với một tình tiết cần làm sáng tỏ trong hồ sơ.' : 'Tóm lược luận điểm chính, chứng cứ hỗ trợ và đề nghị của phía bạn.'}</p>}<ol><li>Nêu vấn đề cần giải quyết.</li><li>Liên hệ tình tiết và chứng cứ.</li><li>Giải thích căn cứ pháp luật.</li><li>Trả lời ý kiến của bên đối lập.</li><li>Kết luận về đề nghị của bạn.</li></ol><p>Nội dung chỉ được gửi khi bạn bấm Gửi lập luận trong phiên.</p></aside></div><div className="argument-editor-actions"><button type="button" onClick={() => { setExpandedComposer(false); requestAnimationFrame(() => argumentRef.current?.focus()); }}>Quay lại ô lập luận →</button></div></FeedbackModal>}
    <header className="room-header">
      <Link className="room-header-back" to="/dashboard/sessions">
        <ArrowLeft size={15} aria-hidden="true" /> Danh sách
      </Link>
      <div className="room-header-overview">
        <div className="room-header-title-row">
          <h1 className="room-header-title" title={courtCase?.title}>{courtCase?.title ?? 'Phiên mô phỏng'}</h1>
          {courtCase && (
            <button type="button" className="room-header-summary" aria-label="Thông tin vụ án" aria-haspopup="dialog" onClick={() => setCaseSummaryOpen(true)}>
              <FileText size={15} aria-hidden="true" />
              <span>Thông tin vụ án</span>
            </button>
          )}
        </div>
        <p className="room-header-meta">
          Giai đoạn {stageIndex + 1}/{TRIAL_STAGES.length} · {TRIAL_STAGES[stageIndex].title} · {userTurns}/{maxTurns} lượt
        </p>
      </div>
      {session && (
        <div className="room-header-actions">
          <SessionTimer session={session} completed={completed} />
          {!isConcluded && (
            <button type="button" className="room-header-end" aria-label="Kết thúc phiên tòa" aria-haspopup="dialog" disabled={disabled || !userTurns} onClick={() => setConfirmEnd(true)}>
              <Gavel size={15} aria-hidden="true" />
              <span>Kết thúc<span className="room-end-detail"> phiên tòa</span></span>
            </button>
          )}
        </div>
      )}
      <nav className="room-header-toolbar" aria-label="Công cụ phòng xử án">
        <div className="room-action-tools">
          <button
            type="button"
            className="room-tool-button deck-evidence-btn"
            aria-expanded={panel === 'case' && dossierTab === 'evidence'}
            onClick={() => {
              setDossierTab('evidence');
              setPanel(panel === 'case' && dossierTab === 'evidence' ? null : 'case');
            }}
          >
            <FolderOpen size={15} aria-hidden="true" />
            <span>Hồ sơ chứng cứ</span>
          </button>
          <button
            type="button"
            className="room-tool-button deck-transcript-btn"
            aria-expanded={panel === 'history'}
            onClick={() => setPanel(panel === 'history' ? null : 'history')}
          >
            <ClipboardList size={15} aria-hidden="true" />
            <span>Biên bản</span>
          </button>
          <div
            className="room-tools-disclosure"
            ref={toolsRef}
            onBlur={event => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setToolsOpen(false);
            }}
          >
            <button
              type="button"
              ref={toolsTriggerRef}
              className="room-tool-button room-tools-trigger"
              aria-expanded={toolsOpen}
              aria-controls="courtroom-other-tools"
              onClick={() => setToolsOpen(open => !open)}
            >
              <span>Công cụ khác</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            <div className="room-tools-popup" id="courtroom-other-tools" hidden={!toolsOpen}>
              <button type="button" onClick={() => selectTool(() => { setDossierTab('overview'); setPanel('case'); })}>
                <FolderOpen size={15} aria-hidden="true" /> Hồ sơ phiên tòa
              </button>
              <button type="button" onClick={() => selectTool(() => setPanel('assistant'))}>
                <Scale size={15} aria-hidden="true" /> Trợ lý luật
              </button>
              <button type="button" onClick={() => selectTool(() => setPanel('notebook'))}>
                <BookOpen size={15} aria-hidden="true" /> Sổ tay
              </button>
              <button type="button" onClick={() => selectTool(() => setPanel('guide'))}>
                <HelpCircle size={15} aria-hidden="true" /> Hướng dẫn
              </button>
              <button type="button" onClick={() => selectTool(() => setPdfModalOpen(true))}>
                <FileDown size={15} aria-hidden="true" /> Xuất PDF
              </button>
              {!completed && [[MessageSquareQuote, 'Phản biện'], [CircleHelp, 'Đặt câu hỏi'], [FileText, 'Tóm tắt']].map(([Icon, label]) => (
                <button key={label} type="button" disabled={!ready} onClick={() => selectTool(() => { setDraftMode(label); setExpandedComposer(true); })}>
                  <Icon size={15} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
    {insertError && !panel && <p role="alert" className="courtroom-notice">{insertError}</p>}
    {state.error && <div role="alert" className="courtroom-notice">{state.error}<button disabled={state.sending || state.ending} onClick={() => setReload((n) => n + 1)}>Tải lại dữ liệu</button></div>}
    {session && !session.case_event_date && !completed && <form onSubmit={saveEventDate} className="courtroom-notice"><p>Bổ sung ngày trong hồ sơ hoặc một ngày giả định cho bài tập để tiếp tục.</p><label>Ngày tra cứu <input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="m-2 rounded border p-2" /></label><button disabled={state.sending || !eventDate}>Lưu ngày</button></form>}
    <div className="courtroom-workspace">
      <CourtroomStage
        speechControls={speechControls}
        session={session}
        preparationStalled={waitExpired}
        pendingSpeaker={state.sending && !submittedContent && ['judge', 'opponent'].includes(conversation?.next_speaker) ? conversation.next_speaker : null}
        view={view}
        records={records}
        focusedRecordId={focusedRecordId}
        onFocusRecord={(id) => setFocusedRecordId(id ? String(id) : null)}
        onSelectRecord={selectRecord}
        navigationDisabled={state.sending || state.ending || session?.processing}
        onReadFull={(record) => { setFullRecord(record); setPanel('speech'); }}
        ttsEnabled={ttsEnabled}
        onToggleTts={handleToggleTts}
      />
    </div>
    <div className="courtroom-bottom-console">
      {completed ? (
        <div className="courtroom-notice text-center py-2">
          <p className="m-0 text-slate-300">Phiên đã kết thúc. Đây là biên bản chỉ đọc.</p>
        </div>
      ) : isConcluded ? (
        <div className="courtroom-concluded-banner">
          <div className="concluded-info">
            <span className="concluded-badge inline-flex items-center gap-1.5"><Gavel size={13} aria-hidden="true" /><span>Tuyên bố khép lại phần tranh luận</span></span>
            <p className="concluded-text">
              Chủ tọa phiên tòa đã tuyên bố kết thúc phần tranh tụng để Hội đồng xét xử bước vào phòng nghị án và chấm điểm.
              {autoCloseCountdown !== null && autoCloseCountdown > 0 && (
                <span className="concluded-countdown"> Tự động chuyển vào nghị án sau {autoCloseCountdown}s…</span>
              )}
            </p>
          </div>
          <div className="concluded-actions">
            {autoCloseCountdown !== null && autoCloseCountdown > 0 && (
              <button
                type="button"
                className="concluded-pause-btn"
                onClick={() => {
                  setCountdownStopped(true);
                  setAutoCloseCountdown(null);
                }}
                title="Dừng tự động chuyển trang để bạn đọc kỹ lại biên bản"
              >
                Dừng đếm ngược
              </button>
            )}
          </div>
        </div>
      ) : hasLearnerTurn && (
        <form id="courtroom-argument-form" onSubmit={send} className="courtroom-composer-form">
          <div className="composer-row-top">
            <VoiceDebateControls
              disabled={!ready}
              onAppendText={appendVoiceTranscript}
              textareaRef={argumentRef}
            />
            <div className="composer-status-badge" role="status">
              <span className="status-dot" aria-hidden="true" />
              <span className="status-text">{status}</span>
            </div>
            <button
              type="button"
              className="expand-argument"
              disabled={!ready}
              onClick={() => { setDraftMode(null); setExpandedComposer(true); }}
              aria-label="Mở rộng trình bày"
            >
              <Maximize2 size={13} /> Mở rộng
            </button>
          </div>

          <div className="composer-fields">
            <label htmlFor="argument" className="sr-only">Lập luận của bạn</label>
            <textarea
              ref={argumentRef}
              onDrop={dropEvidence}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes(EVIDENCE_MIME)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }
              }}
              id="argument"
              disabled={!ready}
              maxLength={4000}
              value={draft.content}
              onChange={(e) => setDraft({ content: e.target.value, request_id: crypto.randomUUID() })}
              placeholder={argumentPlaceholder}
            />
          </div>

          <div className="composer-foot flex flex-wrap items-center justify-between gap-2">
            <span>{draft.content.length}/4000 ký tự</span>
            {ready && userTurns === 0 && (
              <button
                type="button"
                className="quick-template-btn text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
                onClick={() => insertIntoArgument('Kính thưa Hội đồng xét xử, với tư cách Luật sư bảo vệ quyền và lợi ích hợp pháp cho thân chủ, tôi xin trình bày quan điểm mở đầu và chứng cứ cốt lõi như sau: ')}
              >
                <Plus size={12} aria-hidden="true" />
                <span>Mẫu lời mở đầu chuẩn mực</span>
              </button>
            )}
          </div>
        </form>
      )}
      <nav className="console-action-deck" aria-label="Điều khiển phiên tòa">
        <div className="room-turn-action">{turnAction}</div>
      </nav>
    </div>
    <PdfExportModal
      open={pdfModalOpen}
      onClose={() => setPdfModalOpen(false)}
      sessionId={sessionId}
      session={session}
      records={records}
      initialType="transcript"
    />
    <CaseQuickSummaryModal
      open={caseSummaryOpen}
      onClose={() => setCaseSummaryOpen(false)}
      courtCase={courtCase}
      session={session}
      stageIndex={stageIndex}
      completed={completed}
      onOpenFullDossier={() => {
        setDossierTab('overview');
        setPanel('case');
      }}
    />
  </main>;
}
