import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Gauge,
  Maximize2,
  MessageSquare,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Scale,
  Shield,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles, getSpeakerInfo } from '../../services/courtroom';
import FeedbackModal from '../feedback/FeedbackModal';
import {
  cycleCourtroomSpeechRate,
  getCourtroomSpeechRate,
  getSpeakingRecordId,
  isAutoplayBlocked,
  isCourtroomSpeechPaused,
  pauseCourtroomSpeech,
  resumeCourtroomSpeech,
  speakCourtroomText,
  stopCourtroomSpeech,
  subscribeAutoplayBlocked,
  subscribeCourtroomSpeech,
  subscribeCourtroomSpeechRate,
  unlockAndResumeCourtroomSpeech,
  unlockCourtroomAudio,
} from '../../services/voiceService';
import './courtroom.css';

const PHASE_LABELS = {
  opening: 'Giai đoạn I: Khai mạc & Thủ tục bắt đầu phiên tòa',
  presentation: 'Giai đoạn I: Trình bày yêu cầu & Quan điểm mở đầu',
  clarification: 'Giai đoạn II: Xét hỏi & Kiểm tra chứng cứ tại tòa',
  debate: 'Giai đoạn III: Tranh luận & Đối đáp pháp lý',
  summary: 'Giai đoạn IV: Tổng kết tranh tụng & HĐXX Nghị án',
};

function Character({ actor, role, active, preparing, invited, onInspect }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`court-character character-${actor}${active ? ' is-speaking' : ''}${preparing ? ' is-preparing' : ''}${invited ? ' is-invited' : ''}`}
      data-actor={actor}
      data-state={preparing ? 'preparing' : invited ? 'invited' : active ? 'speaking' : 'listening'}
    >
      <div className="character-portrait">
        {['listening', 'speaking'].map((state) => (
          <img
            key={state}
            src={`/courtsim-characters/${role.asset}-${state}.png`}
            alt={
              state === (active ? 'speaking' : 'listening')
                ? `${role.name} — ${active ? 'minh họa phát biểu' : 'đang lắng nghe'}`
                : ''
            }
            aria-hidden={state !== (active ? 'speaking' : 'listening')}
            className={`character-image state-${state}`}
            draggable="false"
            onError={() => setFailed(true)}
          />
        ))}
        {failed && <span className="asset-error">Chưa tải được ảnh {role.name.toLocaleLowerCase('vi')}</span>}
      </div>
      <button
        type="button"
        className="character-name"
        onClick={onInspect}
        aria-label={`Xem vai ${role.name.toLocaleLowerCase('vi')}`}
      >
        <strong>{role.name}</strong>
        <span>{role.detail}</span>
        {(active || preparing || invited) && (
          <small className="character-status">
            {preparing ? 'Đang chuẩn bị…' : invited ? 'Được mời phát biểu' : 'Đang phát biểu'}
          </small>
        )}
      </button>
    </div>
  );
}

export default function CourtroomStage({
  session,
  view,
  records = [],
  onHistory,
  onReadFull,
  onSelectRecord,
  navigationDisabled = false,
  preparationStalled = false,
  pendingSpeaker = null,
  speechControls,
  ttsEnabled = false,
  onToggleTts,
}) {
  const roles = courtroomRoles(session);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [speakingRecordId, setSpeakingRecordId] = useState(() => getSpeakingRecordId());
  const [isPaused, setIsPaused] = useState(() => isCourtroomSpeechPaused());
  const [autoplayBlocked, setAutoplayBlocked] = useState(() => isAutoplayBlocked());
  const [speechRate, setSpeechRate] = useState(() => getCourtroomSpeechRate());
  const [inspectedActor, setInspectedActor] = useState(null);
  const [isStreamExpanded, setIsStreamExpanded] = useState(false);

  // Auto-scroll state & refs
  const chatScrollRef = useRef(null);
  const userScrolledUpRef = useRef(false);
  const [hasNewMessageWhileScrolledUp, setHasNewMessageWhileScrolledUp] = useState(false);
  const prevRecordCountRef = useRef(0);

  useEffect(() => {
    return () => {
      // Dọn dẹp sạch mọi tiến trình đọc âm thanh khi stage unmount
      stopCourtroomSpeech();
    };
  }, []);

  useEffect(() => {
    return subscribeCourtroomSpeech((id, state) => {
      setSpeakingRecordId(id);
      setIsPaused(Boolean(state?.isPaused));
    });
  }, []);

  useEffect(() => {
    return subscribeAutoplayBlocked((blocked) => {
      setAutoplayBlocked(blocked);
    });
  }, []);

  useEffect(() => {
    return subscribeCourtroomSpeechRate((r) => setSpeechRate(r));
  }, []);

  // Xây dựng danh sách tin nhắn theo đúng thứ tự lượt phát biểu
  const sortedRecords = [...records].sort((a, b) => {
    if (a.created_at && b.created_at) {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
    }
    return 0;
  });

  const displayRecords = [...sortedRecords];

  // Thêm tin nhắn đang gửi của người dùng (pending)
  if (view?.pending && view?.record?.content) {
    displayRecords.push({
      _id: 'pending-user',
      sender_type: 'user',
      content: view.record.content,
      display_content: view.record.content,
      created_at: new Date().toISOString(),
      pending: true,
    });
  }

  // Thêm tin nhắn đang stream của AI (streaming)
  if (view?.streaming && view?.record?.content) {
    displayRecords.push({
      _id: 'streaming-ai',
      sender_type: view.record.sender_type || (view.actor === 'judge' ? 'ai_judge' : 'ai_prosecutor'),
      content: view.record.content,
      display_content: view.record.content,
      created_at: new Date().toISOString(),
      streaming: true,
    });
  }

  // Xử lý sự kiện cuộn từ người dùng
  function handleChatScroll() {
    const el = chatScrollRef.current;
    if (!el) return;

    // Khoảng cách từ thanh cuộn hiện tại đến đáy danh sách tin nhắn
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Ngưỡng: nếu cách đáy > 50px nghĩa là người dùng đang cuộn lên trên đọc tin cũ
    const isScrolledUp = distanceFromBottom > 50;
    userScrolledUpRef.current = isScrolledUp;

    // Nếu người dùng đã tự cuộn xuống sát đáy thì ẩn nút thông báo tin mới
    if (!isScrolledUp) {
      setHasNewMessageWhileScrolledUp(false);
    }
  }

  // Tự động cuộn thông minh khi có tin mới hoặc stream
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    const currentCount = displayRecords.length;
    const isNewMessage = currentCount > prevRecordCountRef.current;
    prevRecordCountRef.current = currentCount;

    // NẾU NGƯỜI DÙNG ĐANG CUỘN LÊN TRÊN ĐỌC TIN NHẮN CŨ:
    // TUYỆT ĐỐI KHÔNG TỰ ĐỘNG KÉO XUỐNG ĐÁY!
    if (userScrolledUpRef.current) {
      if (isNewMessage || view?.streaming) {
        setHasNewMessageWhileScrolledUp(true);
      }
      return;
    }

    // NẾU NGƯỜI DÙNG ĐANG Ở SẴN CUỐI DANH SÁCH TIN NHẮN:
    // Tự động cuộn xuống đáy để theo dõi lời thoại mới nhất
    el.scrollTop = el.scrollHeight;
  }, [displayRecords.length, view?.streaming, view?.record?.content]);

  // Hàm người dùng bấm nút chủ động cuộn xuống đáy
  function scrollToBottom() {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    userScrolledUpRef.current = false;
    setHasNewMessageWhileScrolledUp(false);
  }

  function handleToggleSpeechForRecord(rec, role, text) {
    if (!rec?._id) return;
    const isThisSpeaking = Boolean(speakingRecordId === rec._id && !isPaused);
    const isThisPaused = Boolean(speakingRecordId === rec._id && isPaused);

    if (isThisSpeaking) {
      pauseCourtroomSpeech();
    } else if (isThisPaused) {
      resumeCourtroomSpeech();
    } else {
      unlockCourtroomAudio();
      stopCourtroomSpeech();
      setSpeakingRecordId(rec._id);
      setIsPaused(false);
      speakCourtroomText(text, {
        role,
        recordId: rec._id,
        isManual: true,
        onStart: () => {
          setSpeakingRecordId(rec._id);
          setIsPaused(false);
        },
        onEnd: () => {
          setSpeakingRecordId((cur) => (cur === rec._id ? null : cur));
          setIsPaused(false);
        },
        onError: () => {
          setSpeakingRecordId((cur) => (cur === rec._id ? null : cur));
          setIsPaused(false);
        },
      });
    }
  }

  function handleReplaySpeechForRecord(rec, role, text) {
    if (!rec?._id) return;
    unlockCourtroomAudio();
    stopCourtroomSpeech();
    setSpeakingRecordId(rec._id);
    setIsPaused(false);
    speakCourtroomText(text, {
      role,
      recordId: rec._id,
      isManual: true,
      onStart: () => {
        setSpeakingRecordId(rec._id);
        setIsPaused(false);
      },
      onEnd: () => {
        setSpeakingRecordId((cur) => (cur === rec._id ? null : cur));
        setIsPaused(false);
      },
      onError: () => {
        setSpeakingRecordId((cur) => (cur === rec._id ? null : cur));
        setIsPaused(false);
      },
    });
  }

  const inspectedRole = inspectedActor ? roles[inspectedActor] : null;
  const inspectedSide =
    (inspectedActor === 'learner'
      ? session?.user_court_role === 'defense_lawyer'
      : session?.user_court_role !== 'defense_lawyer')
      ? 'defendant'
      : 'plaintiff';

  const preparing =
    preparationStalled || view.streaming
      ? null
      : session?.conversation?.status === 'generating'
      ? session.conversation.next_speaker
      : pendingSpeaker;

  const invited =
    session?.status !== 'completed' &&
    session?.conversation?.status === 'learner' &&
    !view.pending &&
    view.record?._id === session?.conversation?.current_record_id;

  const activeActor = view.streaming ? view.actor : invited || preparing ? null : view.actor;
  const currentPhase = session?.conversation?.phase ?? (records.length <= 1 ? 'opening' : 'debate');
  const phaseLabel =
    session?.status === 'completed'
      ? 'Phiên tòa đã khép lại — Hoàn tất nghị án'
      : (PHASE_LABELS[currentPhase] ?? 'Phiên luyện tập');
  const currentIssueLabel =
    session?.status !== 'completed' && currentPhase !== 'summary'
      ? session?.conversation?.hearing_state?.current_issue?.label
      : null;

  return (
    <section className="court-stage-section" aria-label="Phòng xử án">
      <div className="court-stage-toolbar">
        <span>
          PHÒNG XỬ ÁN <span className="stage-divider">/</span> {phaseLabel}
          {currentIssueLabel ? <> <span className="stage-divider">·</span> Trọng tâm: {currentIssueLabel}</> : null}
        </span>
        <div className="stage-audio-master-controls">
          {typeof onToggleTts === 'function' && (
            <button
              type="button"
              onClick={onToggleTts}
              className={`stage-master-sound-btn ${ttsEnabled ? 'is-active' : ''}`}
              title={
                ttsEnabled
                  ? 'Đang bật tự động phát âm thanh AI (Bấm để tắt âm thanh)'
                  : 'Đang tắt âm thanh AI (Bấm để bật âm thanh tự động)'
              }
              aria-label={ttsEnabled ? 'Tắt âm thanh phiên tòa' : 'Bật âm thanh phiên tòa'}
            >
              {ttsEnabled ? (
                <>
                  <Volume2 size={13} className="text-emerald-400" />
                  <span>Âm thanh: Bật</span>
                </>
              ) : (
                <>
                  <VolumeX size={13} className="text-slate-400" />
                  <span>Âm thanh: Tắt</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => cycleCourtroomSpeechRate()}
            className="stage-master-rate-btn"
            aria-label={`Tốc độ đọc hiện tại: ${speechRate}x. Bấm để đổi`}
            title={`Tốc độ đọc âm thanh hiện tại: ${speechRate}x. Bấm để chuyển đổi 1.0x, 1.25x và 1.5x`}
          >
            <Gauge size={12} className="text-sky-400" />
            <span>{speechRate}x</span>
          </button>
        </div>
      </div>

      {autoplayBlocked && (
        <aside role="alert" className="court-autoplay-banner">
          <div className="autoplay-banner-content">
            <VolumeX size={16} className="text-amber-400 animate-pulse" aria-hidden="true" />
            <strong>Trình duyệt đã chặn tự động phát âm thanh.</strong>
            <span>Bấm kích hoạt để nghe giọng đọc của Hội đồng xét xử và Bên đối lập:</span>
          </div>
          <button
            type="button"
            className="autoplay-enable-btn"
            onClick={() => {
              unlockAndResumeCourtroomSpeech();
              setAutoplayBlocked(false);
            }}
          >
            <Volume2 size={14} aria-hidden="true" /> Bật âm thanh phiên tòa
          </button>
        </aside>
      )}

      <div className="court-viewport">
        <div className="court-scene">
          <img
            className="court-background"
            src="/courtsim-courtroom-background-v2.png"
            alt=""
            aria-hidden="true"
            onError={() => setBackgroundFailed(true)}
          />
          {backgroundFailed && (
            <p className="background-error">Chưa tải được nền phòng xử án. Bạn vẫn có thể tiếp tục phiên.</p>
          )}
          <Scale className="court-emblem" aria-hidden="true" />
          <span className="court-versus" aria-hidden="true">
            VS
          </span>

          <button className="stage-transcript-info" type="button" onClick={onHistory}>
            <span>BIÊN BẢN PHIÊN</span>
            <strong>
              {records.length}
              <small> phát biểu đã lưu</small>
            </strong>
            <span>Mở biên bản →</span>
          </button>

          <div className="stage-session-info">
            <span>PHẦN TRÌNH BÀY CỦA BẠN</span>
            <strong>
              {records.filter((item) => item.sender_type === 'user').length}
              <small> / {session?.max_turns ?? 20} lượt</small>
            </strong>
            <progress
              aria-label="Số lượt đã trình bày"
              value={records.filter((item) => item.sender_type === 'user').length}
              max={session?.max_turns ?? 20}
            />
          </div>

          <div className="court-turn-badge" role="status">
            {!session
              ? 'Chưa tải được phiên'
              : preparing
              ? 'Đang chuẩn bị lượt tiếp theo'
              : invited
              ? 'Đến lượt bạn trình bày'
              : session.status === 'completed'
              ? 'Phiên đã hoàn tất'
              : 'Đang diễn ra'}
          </div>

          <Character
            actor="judge"
            role={roles.judge}
            active={activeActor === 'judge'}
            preparing={preparing === 'judge'}
            onInspect={() => setInspectedActor('judge')}
          />
          <div className="court-desk-layer desk-judge" aria-hidden="true" />
          <Character
            actor="opponent"
            role={roles.opponent}
            active={activeActor === 'opponent'}
            preparing={preparing === 'opponent'}
            onInspect={() => setInspectedActor('opponent')}
          />
          <Character
            actor="learner"
            role={roles.learner}
            active={activeActor === 'learner'}
            invited={invited}
            onInspect={() => setInspectedActor('learner')}
          />
          <div className="court-desk-layer desk-front" aria-hidden="true" />

          {/* KHUNG HỘI THOẠI PHIÊN TÒA: DANH SÁCH BONG BÓNG CHAT VỚI AUTO-SCROLL THÔNG MINH */}
          <article className={`court-speech court-dialogue-stream ${isStreamExpanded ? 'is-stream-expanded' : ''}`} aria-label="Khung hội thoại phiên tòa">
            <div className="dialogue-stream-header">
              <span className="dialogue-stream-title">
                <MessageSquare size={13} className="text-sky-400" />
                HỘI THOẠI PHIÊN TÒA
              </span>
              <div className="dialogue-stream-header-actions">
                <span className="dialogue-stream-count">
                  {displayRecords.length} lượt phát biểu
                </span>
                <button
                  type="button"
                  onClick={() => setIsStreamExpanded((v) => !v)}
                  className="dialogue-stream-expand-toggle"
                  title={isStreamExpanded ? 'Thu nhỏ khung hội thoại' : 'Mở rộng khung hội thoại'}
                  aria-label={isStreamExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                >
                  {isStreamExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="dialogue-messages-scroll"
              tabIndex={0}
              role="log"
              aria-label="Danh sách tin nhắn phát biểu trong phiên tòa"
            >
              {displayRecords.map((rec, idx) => {
                const speaker = getSpeakerInfo(rec, session);
                const isRecordSpeaking = speakingRecordId === rec._id && !isPaused;
                const isRecordPaused = speakingRecordId === rec._id && isPaused;
                const contentText = dialogueText(
                  rec.display_content ?? rec.content,
                  session?.case_id?.evidence_inventory
                ) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.';

                return (
                  <div
                    key={rec._id || idx}
                    id={`record-${rec._id}`}
                    className={`dialogue-bubble bubble-${speaker.actor} ${
                      isRecordSpeaking ? 'is-speaking-bubble' : ''
                    } ${view?.record?._id === rec._id ? 'is-selected-bubble' : ''}`}
                    onClick={() => onSelectRecord?.(rec._id)}
                  >
                    <div className="bubble-header">
                      <div className="bubble-speaker-info">
                        <span className={`bubble-avatar avatar-${speaker.actor}`} aria-hidden="true">
                          {speaker.actor === 'judge' ? (
                            <Gavel size={12} className="text-amber-400" />
                          ) : speaker.actor === 'opponent' ? (
                            <Shield size={12} className="text-rose-400" />
                          ) : (
                            <User size={12} className="text-sky-400" />
                          )}
                        </span>
                        <strong className="bubble-speaker-name">{speaker.name}</strong>
                        <span className="bubble-role-pill">{speaker.roleTag}</span>
                      </div>
                      <div className="bubble-meta">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeechForRecord(rec, speaker.actor, contentText)}
                          className={`bubble-header-voice-btn ${isRecordSpeaking ? 'is-speaking' : isRecordPaused ? 'is-paused' : ''}`}
                          title={isRecordSpeaking ? 'Tạm dừng đọc' : 'Bấm để nghe phát biểu này'}
                          aria-label={isRecordSpeaking ? 'Tạm dừng' : 'Nghe phát biểu này'}
                        >
                          {isRecordSpeaking ? <Pause size={10} /> : isRecordPaused ? <Play size={10} /> : <Volume2 size={10} />}
                          <span>{isRecordSpeaking ? 'Đang đọc' : isRecordPaused ? 'Tiếp tục' : 'Nghe đọc'}</span>
                        </button>
                        <span className="bubble-turn-num">#{idx + 1}</span>
                        {rec.created_at && (
                          <time className="bubble-time" dateTime={rec.created_at}>
                            {new Date(rec.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        )}
                      </div>
                    </div>

                    <div className="bubble-body">
                      <p className="bubble-text">{contentText}</p>

                      {/* Trích dẫn căn cứ pháp luật */}
                      {Boolean(rec.citations?.length) && (() => {
                        const validCitations = rec.citations.filter(Boolean);
                        if (!validCitations.length) return null;
                        const seen = new Set();
                        const uniqueCitations = validCitations.filter((c) => {
                          const key =
                            typeof c === 'object'
                              ? `${c.id || ''}:${c.law_number || ''}:${c.article || ''}`
                              : String(c);
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                        return (
                          <div
                            className="speech-citations-chip"
                            role="button"
                            tabIndex={0}
                            onClick={() => onReadFull(rec)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') onReadFull(rec);
                            }}
                            title="Bấm để xem chi tiết căn cứ pháp luật và toàn văn lời thoại"
                            aria-label="Căn cứ pháp lý trích dẫn"
                          >
                            <span className="chip-badge inline-flex items-center gap-1"><Scale size={11} className="text-sky-400" /> Căn cứ:</span>
                            <span className="chip-items">
                              {uniqueCitations.slice(0, 3).map((c, i) => {
                                const isObj = typeof c === 'object';
                                const label = isObj
                                  ? `${c.title || c.law_number || 'Văn bản'}${
                                      c.article ? ` (Đ.${c.article})` : ''
                                    }`
                                  : String(c);
                                const isExpired = isObj && c.validity_status === 'expired';
                                const isAmended = isObj && c.validity_status === 'amended';
                                const tooltip = isObj && c.validity_warning
                                  ? `${label} — ${c.validity_warning}`
                                  : isObj ? (c.context_text || c.text || label) : label;
                                return (
                                  <span
                                    key={c.id || i}
                                    className={`chip-item ${isExpired ? 'chip-expired' : isAmended ? 'chip-amended' : ''}`}
                                    title={tooltip}
                                  >
                                    {label}
                                    {isExpired && <span className="chip-validity-tag expired">Hết HL</span>}
                                    {isAmended && <span className="chip-validity-tag amended">Đã sửa</span>}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bubble-footer">
                      <button
                        type="button"
                        onClick={() => handleToggleSpeechForRecord(rec, speaker.actor, contentText)}
                        aria-label={
                          isRecordSpeaking
                            ? 'Tạm dừng đọc lượt này'
                            : isRecordPaused
                            ? 'Tiếp tục đọc lượt này'
                            : 'Nghe đọc lượt này'
                        }
                        title={
                          isRecordSpeaking
                            ? 'Bấm để tạm dừng giọng đọc'
                            : isRecordPaused
                            ? 'Bấm để tiếp tục nghe'
                            : 'Nghe phát biểu bằng giọng nói AI tự nhiên'
                        }
                        className={`bubble-voice-btn ${
                          isRecordSpeaking ? 'is-speaking' : isRecordPaused ? 'is-paused' : ''
                        }`}
                      >
                        {isRecordSpeaking ? (
                          <Pause size={12} className="text-sky-400" />
                        ) : isRecordPaused ? (
                          <Play size={12} className="text-amber-400" />
                        ) : (
                          <Volume2 size={12} />
                        )}
                        <span>{isRecordSpeaking ? 'Đang đọc' : isRecordPaused ? 'Tiếp tục' : 'Nghe đọc'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReplaySpeechForRecord(rec, speaker.actor, contentText)}
                        className="bubble-replay-btn"
                        aria-label="Phát lại lời thoại từ đầu"
                        title="Phát lại toàn bộ lời thoại này từ đầu"
                      >
                        <RotateCcw size={11} />
                        <span>Phát lại</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onReadFull(rec)}
                        className="bubble-expand-btn"
                        aria-label="Phóng to lời thoại"
                      >
                        Phóng to
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Trạng thái đang chuẩn bị lượt tiếp theo */}
              {preparing && !view?.streaming && (
                <div className="dialogue-bubble bubble-preparing" role="status">
                  <span className="preparing-indicator inline-flex items-center gap-1.5">
                    {session?.conversation?.next_speaker === 'judge' ? (
                      <>
                        <Gavel size={13} className="text-amber-400" />
                        <span>Thẩm phán (Chủ tọa) đang chuẩn bị câu hỏi xét hỏi…</span>
                      </>
                    ) : (
                      <>
                        <Shield size={13} className="text-rose-400" />
                        <span>Bên đối lập đang chuẩn bị lập luận…</span>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Nút nổi báo có tin mới khi người dùng đang cuộn lên xem tin cũ */}
            {hasNewMessageWhileScrolledUp && (
              <button
                type="button"
                className="scroll-to-bottom-pill animate-bounce"
                onClick={scrollToBottom}
                aria-label="Cuộn xuống lời thoại mới nhất"
              >
                <span>↓ Có lời thoại mới</span>
              </button>
            )}

            {/* Thanh điều khiển tiếp tục lượt thoại nếu có */}
            {speechControls && (
              <div className="dialogue-stream-footer">
                {speechControls}
              </div>
            )}
          </article>
        </div>
      </div>

      {inspectedRole && (
        <FeedbackModal title={`Vai trò: ${inspectedRole.name}`} onClose={() => setInspectedActor(null)}>
          <div className="court-role-preview">
            <img src={`/courtsim-characters/${inspectedRole.asset}-listening.png`} alt={inspectedRole.name} />
            <div>
              <h3>{inspectedRole.detail}</h3>
              {inspectedActor === 'judge' ? (
                <p>Thẩm phán - Chủ tọa phiên tòa điều hành phiên, xét hỏi và ra phán quyết.</p>
              ) : (
                <>
                  <p>
                    {inspectedActor === 'learner'
                      ? 'Bạn bảo vệ quan điểm của phía đã chọn dựa trên tình tiết và chứng cứ trong hồ sơ.'
                      : 'Bên đối lập do AI đảm nhiệm và phản hồi lập luận của phía bạn.'}
                  </p>
                  {session?.case_id?.parties
                    ?.filter((party) => party.side === inspectedSide)
                    .map((party, index) => (
                      <article key={index}>
                        <h4>{party.name}</h4>
                        <ul>
                          {party.claims?.map((claim, i) => (
                            <li key={i}>{claim}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                </>
              )}
              <button className="court-role-close" onClick={() => setInspectedActor(null)}>
                Quay lại phiên tòa →
              </button>
            </div>
          </div>
        </FeedbackModal>
      )}
    </section>
  );
}
