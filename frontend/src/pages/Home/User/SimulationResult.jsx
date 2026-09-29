import ScoringSummary from '../../../components/ScoringSummary';
import LearnerFeedback from '../../../components/feedback/LearnerFeedback';
import { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

export default function SimulationResult() {
  const { sessionId } = useParams();
  return <SessionResult key={sessionId} sessionId={sessionId} />;
}

function SessionResult({ sessionId }) {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api.get(`/v1/sessions/${sessionId}/result`).then(async ({ data }) => {
      if (!active) return;
      // Chỉ mời góp ý sau khi kết quả tải thành công; quyền hiển thị do backend cấp một lần.
      let show = false;
      try { const response = await api.post('/v1/sessions/' + sessionId + '/feedback/prompt', {}, { timeout: 5000 }); show = response.data.data?.show === true; }
      catch (error) { getApiError(error); /* Góp ý không bắt buộc, vẫn cho xem kết quả. */ }
      if (active) { setFeedbackOpen(show); setResult(data.data); setError(''); }
    }).catch((requestError) => { if (active) setError(getApiError(requestError, 'Chưa tải được kết quả. Vui lòng thử lại hoặc trở về phiên.')); });
    return () => { active = false; };
  }, [sessionId, reload]);

  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-rose-300"><p role="alert">{error}</p><button className="mr-4 underline" onClick={() => setReload((n) => n + 1)}>Thử lại</button><Link className="underline" to={`/simulation/${sessionId}`}>Trở lại phiên</Link></main>;
  if (!result) return <main className="min-h-screen bg-slate-950 p-8 text-white" role="status">Đang tải kết quả...</main>;
  const finishFeedback = (sent) => {
    setFeedbackSent(sent); setFeedbackOpen(false);
    requestAnimationFrame(() => document.getElementById('result-heading')?.focus());
  };
  if (feedbackOpen) return <main className="min-h-screen bg-slate-950 p-5"><LearnerFeedback sessionId={sessionId} onDone={finishFeedback} /></main>;
  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-200"><div className="mx-auto max-w-5xl space-y-6">
      {feedbackSent && <p role="status" className="text-emerald-400">Đã gửi góp ý. Cảm ơn bạn đã chia sẻ!</p>}
      <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-blue-300">Kết quả phiên mô phỏng</p><h1 id="result-heading" tabIndex={-1} className="text-3xl font-bold text-white">Kết quả luyện tập</h1></div><button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold"><Home size={17} /> Tổng quan</button></header>
      <ScoringSummary result={result} sessionId={sessionId} />
      <details className="rounded-2xl border border-slate-200 p-5"><summary className="cursor-pointer font-semibold">Nhận xét lưu cùng kết quả và nguồn pháp luật</summary>
      {result.assessed_max < 100 && <p className="my-3 text-sm">Nhận xét này không xác nhận năng lực ở các tiêu chí chưa chấm.</p>}
      {result.rubric_feedback && <section className="grid gap-4 md:grid-cols-2">{Object.entries(result.rubric_feedback).map(([key, item]) => <article key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"><h2 className="font-bold">{labels[key]}</h2><p>{item.reason}</p><blockquote className="border-l-4 border-blue-400 pl-3 text-sm">“{item.quote}”</blockquote><p className="text-sm"><strong>Điểm mạnh:</strong> {item.strength}</p><p className="text-sm"><strong>Thực hành tiếp:</strong> {item.improvement}</p></article>)}</section>}
      <section className="grid gap-6 md:grid-cols-2"><article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-3 font-bold text-white">Nhận xét</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.feedback}</p></article><article className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6"><h2 className="mb-3 font-bold text-amber-300">Hướng cải thiện</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.improvement_suggestions}</p></article></section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">Căn cứ pháp luật đã sử dụng</h2>{!result.citations?.length && <p className="text-sm text-slate-400">Chưa có căn cứ pháp luật được xác minh trong kết quả này.</p>}<LegalCitations citations={result.citations} /><LegalResearchResult research={result.legal_research} /></section>
      </details>
      <p className="text-center text-xs text-slate-500">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
