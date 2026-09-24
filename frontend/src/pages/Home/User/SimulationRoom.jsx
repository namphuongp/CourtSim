import { useEffect, useRef, useState } from 'react';
import { BookOpen, Gavel, LogOut, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

export default function SimulationRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const endRef = useRef(null);
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [argument, setArgument] = useState('');
  const [state, setState] = useState({ loading: true, sending: false, ending: false, error: '' });

  useEffect(() => {
    Promise.all([api.get(`/v1/sessions/${sessionId}`), api.get(`/v1/sessions/${sessionId}/records`)]).then(([sessionResponse, recordsResponse]) => {
      setSession(sessionResponse.data.data);
      setRecords(recordsResponse.data.data);
      setState((current) => ({ ...current, loading: false }));
    }).catch((error) => setState((current) => ({ ...current, loading: false, error: getApiError(error) })));
  }, [sessionId]);
  useEffect(() => {
    // Không return giá trị từ effect: một số trình duyệt trả Promise khi scroll.
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [records, state.sending]);

  async function send(event) {
    event.preventDefault();
    if (argument.trim().length < 10) return;
    setState((current) => ({ ...current, sending: true, error: '' }));
    try {
      const { data } = await api.post(`/v1/sessions/${sessionId}/messages`, { content: argument });
      setRecords((current) => [...current, ...data.data]);
      setArgument('');
    } catch (error) {
      setState((current) => ({ ...current, error: getApiError(error, 'AI chưa thể phản hồi.') }));
    } finally {
      setState((current) => ({ ...current, sending: false }));
    }
  }

  async function complete() {
    if (!records.some((item) => item.sender_type === 'user')) return;
    setState((current) => ({ ...current, ending: true, error: '' }));
    try {
      await api.post(`/v1/sessions/${sessionId}/complete`);
      navigate(`/simulation/${sessionId}/result`);
    } catch (error) {
      setState((current) => ({ ...current, ending: false, error: getApiError(error, 'Không thể chấm điểm phiên.') }));
    }
  }

  if (state.loading) return <div className="min-h-screen bg-slate-950 p-8 text-white">Đang tải phiên tòa...</div>;
  const hasUserArgument = records.some((item) => item.sender_type === 'user');
  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 p-4"><div><h1 className="flex items-center gap-2 font-bold text-white"><Gavel className="text-blue-400" /> {session?.case_id?.title}</h1><p className="text-xs text-slate-500">Lượt tranh luận: {records.filter((item) => item.sender_type === 'user').length}</p></div><button disabled={state.ending || state.sending || !hasUserArgument} onClick={complete} title={!hasUserArgument ? 'Cần gửi ít nhất một lập luận trước khi kết thúc.' : undefined} className="flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2 text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"><LogOut size={17} /> {state.ending ? 'Đang chấm...' : 'Kết thúc'}</button></header>
      {state.error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-300">{state.error}</p>}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
        <section className="flex min-h-0 flex-col"><div className="flex-1 space-y-4 overflow-y-auto p-5">{records.map((item) => <article key={item._id} className={`max-w-3xl rounded-2xl border p-4 ${item.sender_type === 'user' ? 'ml-auto border-blue-500/30 bg-blue-500/10' : item.sender_type === 'ai_judge' ? 'border-amber-500/30 bg-amber-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{item.sender_name}</p><p className="whitespace-pre-wrap leading-7">{item.content}</p></article>)}{state.sending && <p className="text-sm text-slate-400">Bên đối lập và Thẩm phán đang phân tích...</p>}<div ref={endRef} /></div>
          <form onSubmit={send} className="border-t border-slate-800 p-4"><textarea maxLength="4000" value={argument} onChange={(event) => setArgument(event.target.value)} placeholder="Trình bày luận điểm, viện dẫn chứng cứ và yêu cầu của bạn..." className="min-h-28 w-full resize-none rounded-2xl border border-slate-700 bg-slate-900 p-4 outline-none focus:border-blue-500" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">{argument.length}/4000 ký tự</span><button disabled={state.sending || argument.trim().length < 10} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40"><Send size={17} /> Gửi lập luận</button></div></form>
        </section>
        <aside className="hidden overflow-y-auto border-l border-slate-800 bg-slate-900/50 p-5 lg:block"><h2 className="mb-3 flex items-center gap-2 font-bold text-white"><BookOpen size={18} /> Hồ sơ vụ án</h2><p className="mb-4 text-sm text-slate-400">{session?.case_id?.summary}</p><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-300">{session?.case_id?.full_document}</pre></aside>
      </div>
    </main>
  );
}
