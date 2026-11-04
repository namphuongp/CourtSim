import { useEffect, useState } from 'react';
import { FileDown, Gavel, Pause, Play, Search, Shield, User, Volume2 } from 'lucide-react';
import {
  getSpeakingRecordId,
  isCourtroomSpeechPaused,
  pauseCourtroomSpeech,
  resumeCourtroomSpeech,
  speakCourtroomText,
  subscribeCourtroomSpeech,
  unlockCourtroomAudio,
} from '../../services/voiceService';
import { dialogueText } from '../../../../shared/dialogueText.mjs';
import { actorFor, courtroomRoles, getSpeakerInfo } from '../../services/courtroom';
import { LegalCitations } from '../LegalBasis';
import PdfExportModal from './PdfExportModal';
import './courtroomTools.css';

function RecordContent({ record, session }) {
  return <><p>{dialogueText(record.display_content ?? record.content, session?.case_id?.evidence_inventory) || 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.'}</p><LegalCitations citations={record.citations} /></>;
}

export default function Transcript({ session, records = [], selected, onSelect, fullRecord }) {
  const roles = courtroomRoles(session);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [speaker, setSpeaker] = useState('all');
  const [speakingId, setSpeakingId] = useState(() => getSpeakingRecordId());
  const [isPaused, setIsPaused] = useState(() => isCourtroomSpeechPaused());

  useEffect(() => {
    return subscribeCourtroomSpeech((id, state) => {
      setSpeakingId(id);
      setIsPaused(Boolean(state?.isPaused));
    });
  }, []);

  function handleTogglePlay(record) {
    if (!record?._id) return;
    const isThisSpeaking = speakingId === record._id && !isPaused;
    const isThisPaused = speakingId === record._id && isPaused;

    if (isThisSpeaking) {
      pauseCourtroomSpeech();
    } else if (isThisPaused) {
      resumeCourtroomSpeech();
    } else {
      unlockCourtroomAudio();
      const text = dialogueText(record.display_content ?? record.content, session?.case_id?.evidence_inventory);
      const role = actorFor(record);
      speakCourtroomText(text, { role, recordId: record._id, isManual: true });
    }
  }

  if (fullRecord) {
    return (
      <article className="transcript-full">
        <h3>{getSpeakerInfo(fullRecord, session).name}</h3>
        <RecordContent record={fullRecord} session={session} />
      </article>
    );
  }

  const visible = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => 
      (speaker === 'all' || actorFor(record) === speaker) &&
      dialogueText(record.display_content ?? record.content, session?.case_id?.evidence_inventory)
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi'))
    );

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

      <div className="transcript-workspace">
        <div className="transcript-filters">
          <label>
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Tìm trong biên bản"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nội dung phát biểu…"
            />
          </label>
          <div aria-label="Lọc người phát biểu">
            {[
              ['all', 'Tất cả'],
              ['judge', roles.judge.name],
              ['opponent', roles.opponent.name],
              ['learner', roles.learner.name],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={speaker === value}
                onClick={() => setSpeaker(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <small aria-live="polite">{visible.length}/{records.length} phát biểu</small>
        </div>

        <div className="transcript-list">
          {!records.length && <p>Chưa có phát biểu trong phiên.</p>}
          {records.length > 0 && !visible.length && (
            <p>Không có phát biểu phù hợp. Hãy đổi bộ lọc hoặc từ khóa.</p>
          )}
          {visible.map(({ record, index }) => {
            const speakerInfo = getSpeakerInfo(record, session);
            const label = `${String(index + 1).padStart(2, '0')} · ${speakerInfo.name}`;
            return (
              <article
                key={record._id}
                className="transcript-entry"
                aria-label={label}
                data-selected={selected === record._id}
              >
                <h3>
                  <span className={`transcript-avatar actor-${speakerInfo.actor}`} aria-hidden="true">
                    {speakerInfo.actor === 'judge' ? <Gavel size={13} className="text-amber-400" /> : speakerInfo.actor === 'opponent' ? <Shield size={13} className="text-rose-400" /> : <User size={13} className="text-sky-400" />}
                  </span>
                  {label}
                  {record.created_at && (
                    <time dateTime={record.created_at}>
                      {new Date(record.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  )}
                </h3>
                <RecordContent record={record} session={session} />
                <div className="transcript-entry-actions flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePlay(record)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                    aria-label={speakingId === record._id && !isPaused ? 'Tạm dừng đọc' : 'Nghe đọc lượt này'}
                  >
                    {speakingId === record._id && !isPaused ? <Pause size={12} /> : speakingId === record._id && isPaused ? <Play size={12} /> : <Volume2 size={12} />}
                    <span>{speakingId === record._id && !isPaused ? 'Đang đọc' : speakingId === record._id && isPaused ? 'Tiếp tục' : 'Nghe đọc'}</span>
                  </button>
                  <button type="button" onClick={() => onSelect(record._id)} aria-label={`Xem tại phiên tòa: ${label}`}>
                    Xem tại phiên tòa
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

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
