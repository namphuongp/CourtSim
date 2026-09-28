import { useState } from 'react';
import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles } from '../../services/courtroom';
import './courtroom.css';

function Character({ actor, role, active }) {
  const [failed, setFailed] = useState(false);
  return <div className={`court-character character-${actor}${active ? ' is-speaking' : ''}`} data-actor={actor} data-state={active ? 'speaking' : 'listening'}>
    <div className="character-portrait">
      {['listening', 'speaking'].map((state) => <img key={state} src={`/courtsim-characters/${role.asset}-${state}.png`} alt={state === (active ? 'speaking' : 'listening') ? `${role.name} — ${active ? 'minh họa phát biểu' : 'đang lắng nghe'}` : ''} aria-hidden={state !== (active ? 'speaking' : 'listening')} className={`character-image state-${state}`} draggable="false" onError={() => setFailed(true)} />)}
      {failed && <span className="asset-error">Chưa tải được ảnh {role.name.toLocaleLowerCase('vi')}</span>}
    </div>
    <div className="character-name"><strong>{role.name}</strong><span>{role.detail}</span></div>
  </div>;
}

export default function CourtroomStage({ session, view, records, onSelect, onReadFull }) {
  const roles = courtroomRoles(session);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const record = view.record;
  const owner = record ? actorFor(record) : 'judge';
  const content = dialogueText(record?.display_content ?? record?.content, session?.case_id?.evidence_inventory) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.';
  const index = records.findIndex((r) => r._id === record?._id);
  const latest = !view.pending && index === records.length - 1;
  return <section className="court-stage-section" aria-label="Phòng xử án">
    <div className="court-stage-toolbar"><span>PHÒNG XỬ ÁN <span className="stage-divider">/</span> Phiên luyện tập</span></div>
    <div className="court-viewport"><div className="court-scene">
      <img className="court-background" src="/courtsim-courtroom-background-v2.png" alt="" aria-hidden="true" onError={() => setBackgroundFailed(true)} />
      {backgroundFailed && <p className="background-error">Chưa tải được nền phòng xử án. Bạn vẫn có thể tiếp tục phiên.</p>}
      <Character actor="judge" role={roles.judge} active={view.actor === 'judge'} />
      {/* Dùng lại đúng nền làm lớp che bàn: không chỉnh/cắt tệp gốc hoặc thêm chứng cứ minh họa. */}
      <div className="court-desk-layer desk-judge" aria-hidden="true" />
      <Character actor="opponent" role={roles.opponent} active={view.actor === 'opponent'} />
      <Character actor="learner" role={roles.learner} active={view.actor === 'learner'} />
      <div className="court-desk-layer desk-front" aria-hidden="true" />
      {record && <article id={`record-${record._id}`} className={`court-speech speech-${owner}`} aria-label={`Lời ${roles[owner].name.toLocaleLowerCase('vi')}`}>
        <div className="speech-heading"><strong>{roles[owner].name}</strong><span>{view.pending ? 'Đang gửi lập luận' : latest ? 'Lời gần nhất' : 'Đang xem lại'}</span></div>
        <p key={record._id} className="speech-content" tabIndex={0} role="region" aria-label="Nội dung lời thoại">{content}</p>
        <div className="speech-actions"><button type="button" onClick={() => onReadFull(record)}>Đọc đầy đủ{record.citations?.length ? ' và căn cứ' : ''}</button>{!view.pending && <div className="speech-navigation"><button type="button" aria-label="Lời trước" disabled={index <= 0} onClick={() => onSelect(records[index - 1]._id)}>←</button><span>{index + 1}/{records.length}</span><button type="button" aria-label="Lời tiếp theo" disabled={index < 0 || index >= records.length - 1} onClick={() => onSelect(records[index + 1]._id)}>→</button></div>}</div>
      </article>}
    </div></div>
  </section>;
}
