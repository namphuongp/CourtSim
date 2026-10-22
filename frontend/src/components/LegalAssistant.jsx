import { useEffect, useRef, useState } from 'react';
import api, { getApiError } from '../services/api';
import { draftKey, readDraft, saveDraft } from '../services/auth';
import { LegalCitations } from './LegalBasis';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { LoadingState } from './WorkspaceStates';
import './courtroom/courtroomTools.css';

export default function LegalAssistant({ sessionId, open, onInsert, insertionDisabled }) {
  const key = draftKey(`${sessionId}:assistant`);
  const [draft, setDraft] = useState(() => readDraft(key) ?? { question: '', request_id: crypto.randomUUID() });
  const [items, setItems] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const busy = useRef(false);
  const pending = items.some((item) => item.status === 'pending');
  useEffect(() => { saveDraft(key, draft); }, [key, draft]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    api.get(`/v1/sessions/${sessionId}/assistant`).then(({ data }) => {
      if (!active) return;
      setItems(data.data); setError(''); setLoaded(true);
      setDraft((current) => data.data.some((item) => item.request_id === current.request_id && item.status === 'completed') ? { question: '', request_id: crypto.randomUUID() } : current);
    }).catch(() => { if (active) { setLoaded(true); setError('Chưa tải được lịch sử tra cứu. Vui lòng thử lại.'); } });
    return () => { active = false; };
  }, [sessionId, open, reload]);
  useEffect(() => {
    if (!open || !pending) return;
    const timer = setInterval(() => setReload((v) => v + 1), 3000);
    return () => clearInterval(timer);
  }, [open, pending]);

  async function ask(event) {
    event.preventDefault();
    if (busy.current || draft.question.trim().length < 5) return;
    busy.current = true; setSending(true); setError('');
    try {
      const { data } = await api.post(`/v1/sessions/${sessionId}/assistant`, draft);
      setItems((current) => [...current.filter((i) => i._id !== data.data._id), data.data]);
      setSelected(data.data._id);
      setDraft({ question: '', request_id: crypto.randomUUID() });
    } catch (err) { setError(getApiError(err, 'Chưa nhận được câu trả lời. Câu hỏi của bạn vẫn được giữ lại. Vui lòng thử lại.')); }
    finally { busy.current = false; setSending(false); }
  }
  const current = items.find(item => item._id === selected) ?? items.at(-1);
  return <div className="legal-assistant space-y-4 text-sm">
    <div className="assistant-intro"><Sparkles size={24}/><div><h3>Tra cứu cùng trợ lý luật</h3><small>Căn cứ rõ ràng · Đọc nguồn trước khi viện dẫn</small></div></div>
    <p>Tìm theo số hiệu, tên luật hoặc vấn đề tranh chấp đất đai. Trợ lý ưu tiên kho tài liệu pháp luật và có thể tra cứu thêm trên web. Đọc nguồn và trạng thái áp dụng trước khi đưa trích dẫn vào lập luận.</p>
    <p className="text-slate-400">Tra cứu không gửi lượt tranh luận và không tự thay đổi điểm.</p>
    <form onSubmit={ask} className="assistant-form space-y-2"><label className="block" htmlFor="legal-question">Câu hỏi tra cứu luật</label><textarea id="legal-question" maxLength={1500} disabled={sending} value={draft.question} onChange={(e) => setDraft({ question: e.target.value, request_id: crypto.randomUUID() })} className="min-h-28 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" placeholder="Quy định nào cần xem xét đối với yêu cầu trong vụ án?" /><div><small>{draft.question.length}/1500 ký tự</small><button disabled={sending || draft.question.trim().length < 5}><Search size={14}/>{sending ? 'Đang tra cứu...' : 'Hỏi trợ lý'}</button></div></form>
    {!loaded && <LoadingState>Đang tải phần tra cứu...</LoadingState>}
    {error && <p role="alert">{error} <button onClick={() => setReload((v) => v + 1)} className="underline">Tải lại</button></p>}
    {!items.length && loaded && <p>Chưa có câu hỏi. Hãy hỏi về quy định liên quan đến vụ án.</p>}
    {items.length > 0 && <div className="assistant-workspace"><nav aria-label="Lịch sử tra cứu"><h4><BookOpen size={14}/>Câu hỏi đã tra cứu</h4>{[...items].reverse().map(item => <button key={item._id} type="button" aria-pressed={item._id === current?._id} onClick={() => setSelected(item._id)}><strong>{item.question}</strong><small>{item.status === 'pending' ? 'Đang tra cứu' : item.status === 'failed' ? 'Chưa thành công' : 'Có câu trả lời'}</small></button>)}</nav><article className="assistant-answer"><h3>{current.question}</h3>{current.status === 'pending' ? <LoadingState>Đang tra cứu. Câu trả lời sẽ được cập nhật tại đây.</LoadingState> : current.status === 'failed' ? <p role="status">Tra cứu chưa thành công. Bạn có thể gửi lại câu hỏi.</p> : <><p className="whitespace-pre-wrap">{current.answer}</p><LegalCitations citations={current.citations} onInsert={onInsert} insertionDisabled={insertionDisabled}/><LegalCitations citations={current.sources}/></>}</article></div>}
  </div>;
}
