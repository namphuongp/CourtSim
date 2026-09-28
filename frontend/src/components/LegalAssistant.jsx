import { useEffect, useRef, useState } from 'react';
import api, { getApiError } from '../services/api';
import { draftKey, readDraft, saveDraft } from '../services/auth';
import { LegalCitations } from './LegalBasis';

export default function LegalAssistant({ sessionId, open, onInsert, insertionDisabled }) {
  const key = draftKey(`${sessionId}:assistant`);
  const [draft, setDraft] = useState(() => readDraft(key) ?? { question: '', request_id: crypto.randomUUID() });
  const [items, setItems] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
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
    }).catch(() => { if (active) { setLoaded(true); setError('Chưa tải được phần tra cứu. Bạn có thể thử lại.'); } });
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
      setDraft({ question: '', request_id: crypto.randomUUID() });
    } catch (err) { setError(getApiError(err, 'Trợ lý chưa trả lời được. Câu hỏi được giữ lại để thử lại.')); }
    finally { busy.current = false; setSending(false); }
  }
  return <div className="space-y-4 text-sm">
    <p>Hỏi về căn cứ liên quan đến vụ án. Chọn trích dẫn để đưa vào bài viết, rồi giải thích cách áp dụng bằng lập luận của bạn.</p>
    <p className="text-slate-400">Tra cứu không gửi lượt tranh luận và không tự thay đổi điểm.</p>
    {!loaded && <p role="status">Đang tải phần tra cứu...</p>}
    {error && <p role="alert">{error} <button onClick={() => setReload((v) => v + 1)} className="underline">Tải lại</button></p>}
    {!items.length && loaded && <p>Chưa có câu hỏi. Bạn có thể hỏi điều kiện áp dụng một quy định hoặc mốc pháp luật cần xem xét.</p>}
    {items.map((item) => <article key={item._id} className="space-y-2 rounded-xl border border-slate-700 p-3"><h3 className="font-semibold">{item.question}</h3>
      {item.status === 'pending' ? <p role="status">Đang tra cứu. Câu trả lời sẽ được cập nhật tại đây.</p> : item.status === 'failed' ? <p>Chưa có câu trả lời. Bạn có thể gửi lại câu hỏi.</p> : <><p className="whitespace-pre-wrap">{item.answer}</p><LegalCitations citations={item.citations} onInsert={onInsert} insertionDisabled={insertionDisabled} />{item.sources?.map((source) => /^https:\/\//.test(source.url) && <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{source.title} {source.law_number} — cần kiểm tra thêm</a></p>)}</>}
    </article>)}
    <form onSubmit={ask} className="space-y-2"><label className="block" htmlFor="legal-question">Câu hỏi tra cứu luật</label><textarea id="legal-question" maxLength={1500} disabled={sending} value={draft.question} onChange={(e) => setDraft({ question: e.target.value, request_id: crypto.randomUUID() })} className="min-h-28 w-full rounded-lg border border-slate-600 bg-slate-950 p-3" placeholder="Quy định nào cần xem xét đối với yêu cầu trong vụ án?" /><button disabled={sending || draft.question.trim().length < 5} className="rounded-lg bg-blue-600 px-4 py-2 disabled:opacity-50">{sending ? 'Đang tra cứu...' : 'Hỏi trợ lý'}</button></form>
  </div>;
}
