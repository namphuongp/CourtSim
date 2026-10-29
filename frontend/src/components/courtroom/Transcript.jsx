import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles } from '../../services/courtroom';
import { LegalCitations } from '../LegalBasis';
import PdfExportModal from './PdfExportModal';

function RecordContent({ record, session }) {
  return <><p>{dialogueText(record.display_content ?? record.content, session?.case_id?.evidence_inventory) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.'}</p><LegalCitations citations={record.citations} /></>;
}

export default function Transcript({ session, records = [], selected, onSelect, fullRecord }) {
  const roles = courtroomRoles(session);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  return (
    <>
      <div className="transcript-toolbar flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tổng cộng {records?.length || 0} lượt tranh tụng
        </span>
        <button
          type="button"
          onClick={() => setPdfModalOpen(true)}
          disabled={!records?.length}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <FileDown size={14} />
          <span>Xuất biên bản PDF</span>
        </button>
      </div>

      {fullRecord ? (
        <article className="transcript-full">
          <h3>{roles[actorFor(fullRecord)].name}</h3>
          <RecordContent record={fullRecord} session={session} />
        </article>
      ) : (
        <div className="transcript-list">
          {!records.length && <p>Chưa có phát biểu trong phiên.</p>}
          {records.map((record, index) => {
            const label = `${String(index + 1).padStart(2, '0')} · ${roles[actorFor(record)].name}`;
            return (
              <article key={record._id} className="transcript-entry" aria-label={label} data-selected={selected === record._id}>
                <h3>{label}</h3>
                <RecordContent record={record} session={session} />
                <button type="button" onClick={() => onSelect(record._id)} aria-label={`Xem tại phiên tòa: ${label}`}>
                  Xem tại phiên tòa
                </button>
              </article>
            );
          })}
        </div>
      )}

      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        sessionId={session?._id}
        session={session}
        records={records}
        initialType="transcript"
      />
    </>
  );
}
