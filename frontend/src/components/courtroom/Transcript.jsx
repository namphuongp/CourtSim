import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles } from '../../services/courtroom';
import { LegalCitations } from '../LegalBasis';

function RecordContent({ record, session }) {
  return <><p>{dialogueText(record.display_content ?? record.content, session?.case_id?.evidence_inventory) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.'}</p><LegalCitations citations={record.citations} /></>;
}

export default function Transcript({ session, records, selected, onSelect, fullRecord }) {
  const roles = courtroomRoles(session);
  if (fullRecord) return <article className="transcript-full"><h3>{roles[actorFor(fullRecord)].name}</h3><RecordContent record={fullRecord} session={session} /></article>;
  return <div className="transcript-list">{!records.length && <p>Chưa có phát biểu trong phiên.</p>}{records.map((record, index) => {
    const label = `${String(index + 1).padStart(2, '0')} · ${roles[actorFor(record)].name}`;
    return <article key={record._id} className="transcript-entry" aria-label={label} data-selected={selected === record._id}>
      <h3>{label}</h3><RecordContent record={record} session={session} />
      <button type="button" onClick={() => onSelect(record._id)} aria-label={`Xem tại phiên tòa: ${label}`}>Xem tại phiên tòa</button>
    </article>;
  })}</div>;
}
