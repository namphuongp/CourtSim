import { useEffect, useState } from 'react';
import { FilePenLine } from 'lucide-react';
import { draftKey, readDraft, saveDraft } from '../../services/auth';
import './courtroomTools.css';

export default function SessionNotebook({ sessionId, caseId, onInsert, insertionDisabled }) {
  const key = draftKey(`${sessionId}:notes`);
  const caseKey = caseId ? draftKey(`case:${caseId}:notes`) : null;
  const [notes, setNotes] = useState(() => readDraft(key)?.content ?? (caseKey ? readDraft(caseKey)?.content : '') ?? '');
  useEffect(() => {
    saveDraft(key, { content: notes });
    if (caseKey) saveDraft(caseKey, { content: notes });
  }, [key, caseKey, notes]);
  return <section className="session-notebook"><div className="assistant-intro"><FilePenLine size={23}/><div><h3>Sổ tay phiên luyện tập</h3><small>Ghi chú tình tiết, căn cứ và dàn ý của bạn (đồng bộ với Bảng Note hồ sơ)</small></div></div><label htmlFor="session-notes">Ghi chú cá nhân</label><textarea id="session-notes" value={notes} maxLength={4000} onChange={event => setNotes(event.target.value)} placeholder="Ghi lại vấn đề cần làm rõ, chứng cứ cần đối chiếu hoặc dàn ý trình bày…"/><div><small>{notes.length}/4000 ký tự</small><button type="button" disabled={insertionDisabled || !notes.trim()} onClick={() => onInsert(notes)}>Đưa ghi chú vào lập luận →</button></div><p>Ghi chú được lưu trong thẻ trình duyệt này và đồng bộ trực tiếp với Bảng ghi chú cá nhân trong Hồ sơ chứng cứ. Chèn ghi chú chỉ cập nhật bản nháp, bạn cần bấm Gửi lập luận để phát biểu.</p></section>;
}
