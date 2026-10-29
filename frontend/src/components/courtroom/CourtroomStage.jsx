import { useState } from 'react';
import { ChevronLeft, ChevronRight, Scale, Volume2 } from 'lucide-react';
import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles } from '../../services/courtroom';
import FeedbackModal from '../feedback/FeedbackModal';
import { speakCourtroomText, stopCourtroomSpeech } from '../../services/voiceService';
import './courtroom.css';

function Character({ actor, role, active, preparing, invited, onInspect }) {
  const [failed, setFailed] = useState(false);
  return <div className={`court-character character-${actor}${active ? ' is-speaking' : ''}${preparing ? ' is-preparing' : ''}${invited ? ' is-invited' : ''}`} data-actor={actor} data-state={preparing ? 'preparing' : invited ? 'invited' : active ? 'speaking' : 'listening'}>
    <div className="character-portrait">
      {['listening', 'speaking'].map((state) => <img key={state} src={`/courtsim-characters/${role.asset}-${state}.png`} alt={state === (active ? 'speaking' : 'listening') ? `${role.name} — ${active ? 'minh họa phát biểu' : 'đang lắng nghe'}` : ''} aria-hidden={state !== (active ? 'speaking' : 'listening')} className={`character-image state-${state}`} draggable="false" onError={() => setFailed(true)} />)}
      {failed && <span className="asset-error">Chưa tải được ảnh {role.name.toLocaleLowerCase('vi')}</span>}
    </div>
    <button type="button" className="character-name" onClick={onInspect} aria-label={`Xem vai ${role.name.toLocaleLowerCase('vi')}`}><strong>{role.name}</strong><span>{role.detail}</span>{(active || preparing || invited) && <small className="character-status">{preparing ? 'Đang chuẩn bị…' : invited ? 'Được mời phát biểu' : 'Đang phát biểu'}</small>}</button>
  </div>;
}

export default function CourtroomStage({ session, view, records, onHistory, onReadFull, onSelectRecord, navigationDisabled = false, preparationStalled = false, pendingSpeaker = null, speechControls }) {
  const roles = courtroomRoles(session);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [speakingRecordId, setSpeakingRecordId] = useState(null);
  const [inspectedActor, setInspectedActor] = useState(null);
  const inspectedRole = inspectedActor ? roles[inspectedActor] : null;
  const inspectedSide = (inspectedActor === 'learner' ? session?.user_court_role === 'defense_lawyer' : session?.user_court_role !== 'defense_lawyer') ? 'defendant' : 'plaintiff';
  const record = view.record;
  const owner = record ? actorFor(record) : 'judge';
  const content = dialogueText(record?.display_content ?? record?.content, session?.case_id?.evidence_inventory) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.';
  const isCurrentSpeaking = speakingRecordId === record?._id;

  function handleToggleSpeech() {
    if (isCurrentSpeaking) {
      stopCourtroomSpeech();
      setSpeakingRecordId(null);
    } else {
      setSpeakingRecordId(record?._id);
      speakCourtroomText(content, {
        role: owner,
        onStart: () => setSpeakingRecordId(record?._id),
        onEnd: () => setSpeakingRecordId((cur) => (cur === record?._id ? null : cur)),
        onError: () => setSpeakingRecordId((cur) => (cur === record?._id ? null : cur)),
      });
    }
  }
  const index = records.findIndex((r) => r._id === record?._id);
  const canNavigate = !navigationDisabled && !view.pending && !view.streaming && index >= 0 && Boolean(onSelectRecord);
  const latest = !view.pending && index === records.length - 1;
  const preparing = preparationStalled || view.streaming ? null : session?.conversation?.status === 'generating' ? session.conversation.next_speaker : pendingSpeaker;
  // Lời cũ vẫn được giữ để đọc, nhưng quyền phát biểu đã chuyển sang người học.
  const invited = session?.status !== 'completed' && session?.conversation?.status === 'learner' && !view.pending && record?._id === session.conversation.current_record_id;
  const activeActor = view.streaming ? view.actor : invited || preparing ? null : view.actor;
  return <section className="court-stage-section" aria-label="Phòng xử án">
    <div className="court-stage-toolbar"><span>PHÒNG XỬ ÁN <span className="stage-divider">/</span> Phiên luyện tập</span></div>
    <div className="court-viewport"><div className="court-scene">
      <img className="court-background" src="/courtsim-courtroom-background-v2.png" alt="" aria-hidden="true" onError={() => setBackgroundFailed(true)} />
      {backgroundFailed && <p className="background-error">Chưa tải được nền phòng xử án. Bạn vẫn có thể tiếp tục phiên.</p>}
      <Scale className="court-emblem" aria-hidden="true" />
      <span className="court-versus" aria-hidden="true">VS</span>
      <div className="stage-session-info"><span>PHẦN TRÌNH BÀY CỦA BẠN</span><strong>{records.filter(item => item.sender_type === 'user').length}<small> / {session?.max_turns ?? 20} lượt</small></strong><progress aria-label="Số lượt đã trình bày" value={records.filter(item => item.sender_type === 'user').length} max={session?.max_turns ?? 20}/></div>
      <button className="stage-transcript-info" type="button" onClick={onHistory}><span>BIÊN BẢN PHIÊN</span><strong>{records.length}<small> phát biểu đã lưu</small></strong><span>Mở biên bản →</span></button>
      <div className="court-turn-badge" role="status">{!session ? 'Chưa tải được phiên' : preparing ? 'Đang chuẩn bị lượt tiếp theo' : invited ? 'Đến lượt bạn trình bày' : session.status === 'completed' ? 'Phiên đã hoàn tất' : 'Đang diễn ra'}</div>
      <Character actor="judge" role={roles.judge} active={activeActor === 'judge'} preparing={preparing === 'judge'} onInspect={() => setInspectedActor('judge')} />
      {/* Dùng lại đúng nền làm lớp che bàn: không chỉnh/cắt tệp gốc hoặc thêm chứng cứ minh họa. */}
      <div className="court-desk-layer desk-judge" aria-hidden="true" />
      <Character actor="opponent" role={roles.opponent} active={activeActor === 'opponent'} preparing={preparing === 'opponent'} onInspect={() => setInspectedActor('opponent')} />
      <Character actor="learner" role={roles.learner} active={activeActor === 'learner'} invited={invited} onInspect={() => setInspectedActor('learner')} />
      <div className="court-desk-layer desk-front" aria-hidden="true" />
      {record && <article id={`record-${record._id}`} className={`court-speech speech-${owner}`} aria-label={`Lời ${roles[owner].name.toLocaleLowerCase('vi')}`}>
        <div className="speech-heading"><strong>{roles[owner].name}</strong><span>{view.streaming ? 'Đang nhận lời thoại…' : view.pending ? 'Đang gửi lập luận' : latest ? 'Lời gần nhất' : 'Đang xem lại'}</span></div>
        <p key={record._id} className="speech-content" tabIndex={0} role="region" aria-label="Nội dung lời thoại">{content}</p>
        {Boolean(record.citations?.length) && (() => {
          const validCitations = record.citations.filter(Boolean);
          if (!validCitations.length) return null;
          const seen = new Set();
          const uniqueCitations = validCitations.filter((c) => {
            const key = typeof c === 'object' ? `${c.id || ''}:${c.law_number || ''}:${c.article || ''}` : String(c);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return (
            <div
              className="speech-citations-chip"
              role="button"
              tabIndex={0}
              onClick={() => onReadFull(record)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onReadFull(record); }}
              title="Bấm để xem chi tiết căn cứ pháp luật và toàn văn lời thoại"
              aria-label="Căn cứ pháp lý trích dẫn - bấm để phóng to và xem chi tiết"
            >
              <span className="chip-badge">⚖️ Căn cứ:</span>
              <span className="chip-items">
                {uniqueCitations.map((c, i) => {
                  const label = typeof c === 'object'
                    ? `${c.title || c.law_number || 'Văn bản pháp luật'}${c.article ? ` (Điều ${c.article})` : ''}`
                    : String(c);
                  return (
                    <span key={c.id || i} className="chip-item" title={c.context_text || c.text || label}>
                      {label}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })()}
        <div className="speech-footer">
          <nav className="speech-navigation" aria-label="Duyệt lời thoại">
            <button type="button" aria-label="Lời thoại trước" title="Lời thoại trước" disabled={!canNavigate || index === 0} onClick={() => onSelectRecord(records[index - 1]._id)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <span aria-live="polite" aria-atomic="true" aria-label={index >= 0 ? `Lời thoại ${index + 1} trên ${records.length}` : 'Đang chuẩn bị lời thoại'}>{index >= 0 ? index + 1 : '—'} / {records.length}</span>
            <button type="button" aria-label="Lời thoại sau" title="Lời thoại sau" disabled={!canNavigate || index === records.length - 1} onClick={() => onSelectRecord(records[index + 1]._id)}><ChevronRight size={20} aria-hidden="true" /></button>
          </nav>
          {speechControls}
          <div className="speech-tools" aria-label="Công cụ đọc lời thoại">
            <button
              type="button"
              onClick={handleToggleSpeech}
              aria-label={isCurrentSpeaking ? 'Dừng đọc lời thoại' : 'Nghe đọc lời thoại'}
              title={isCurrentSpeaking ? 'Bấm để dừng đọc' : 'Nghe phát biểu bằng giọng nói tiếng Việt tự nhiên'}
              className={`speech-voice-btn ${isCurrentSpeaking ? 'is-speaking' : ''}`}
            >
              <Volume2
                size={15}
                style={{
                  display: 'inline-block',
                  verticalAlign: '-2px',
                  marginRight: '4px',
                  color: isCurrentSpeaking ? '#38bdf8' : undefined,
                }}
              />
              {isCurrentSpeaking ? 'Đang đọc…' : 'Nghe đọc'}
            </button>
            <button type="button" onClick={() => onReadFull(record)} aria-label="Phóng to lời thoại">Phóng to{record.citations?.length ? ' và xem căn cứ' : ''}</button>
            {!view.pending && <button type="button" onClick={onHistory}>Biên bản phiên</button>}
          </div>
        </div>
      </article>}
    </div></div>
    {inspectedRole && <FeedbackModal title={`Vai trò: ${inspectedRole.name}`} onClose={() => setInspectedActor(null)}><div className="court-role-preview"><img src={`/courtsim-characters/${inspectedRole.asset}-listening.png`} alt={inspectedRole.name}/><div><h3>{inspectedRole.detail}</h3>{inspectedActor === 'judge' ? <p>Chủ tọa do AI đảm nhiệm, đặt câu hỏi làm rõ và điều hành lượt phát biểu.</p> : <><p>{inspectedActor === 'learner' ? 'Bạn bảo vệ quan điểm của phía đã chọn dựa trên tình tiết và chứng cứ trong hồ sơ.' : 'Bên đối lập do AI đảm nhiệm và phản hồi lập luận của phía bạn.'}</p>{session?.case_id?.parties?.filter(party => party.side === inspectedSide).map((party, index) => <article key={index}><h4>{party.name}</h4><ul>{party.claims?.map((claim, i) => <li key={i}>{claim}</li>)}</ul></article>)}</>}<button className="court-role-close" onClick={() => setInspectedActor(null)}>Quay lại phiên tòa →</button></div></div></FeedbackModal>}
  </section>;
}
