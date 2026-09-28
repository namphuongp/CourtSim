import { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import { useEffect, useState } from 'react';
import { Award, Home } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

export default function SimulationResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api.get(`/v1/sessions/${sessionId}/result`).then(({ data }) => { if (active) { setResult(data.data); setError(''); } }).catch((requestError) => { if (active) setError(getApiError(requestError)); });
    return () => { active = false; };
  }, [sessionId, reload]);

  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-rose-300"><p role="alert">{error}</p><button className="mr-4 underline" onClick={() => setReload((n) => n + 1)}>Thử lại</button><Link className="underline" to={`/simulation/${sessionId}`}>Trở lại phiên</Link></main>;
  if (!result) return <main className="min-h-screen bg-slate-950 p-8 text-white">Đang tải kết quả...</main>;
  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-200"><div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-blue-300">Kết quả phiên mô phỏng</p><h1 className="text-3xl font-bold text-white">Báo cáo năng lực tranh tụng</h1></div><button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold"><Home size={17} /> Dashboard</button></header>
      <div className="grid gap-6 lg:grid-cols-3"><section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-7 text-center"><Award className="mx-auto mb-3 text-emerald-400" size={44} /><p className="text-sm text-emerald-300">Điểm tổng hợp</p><p className="text-6xl font-black text-white">{Number.isFinite(result.score) ? result.score : 'Chưa có'}</p><p className="text-sm">/100</p><p className="mt-3 text-sm">{result.score_scope}</p><p className="mt-4 leading-7">{result.verdict}</p></section>
        <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-7 lg:col-span-2"><h2 className="font-bold text-white">Điểm theo tiêu chí</h2>{result.criteria && <><p className="text-sm">Đã đánh giá {result.assessed_max}% trọng số · Điểm thực đạt {result.earned_score}/{result.assessed_max}</p>{result.criteria.map((group) => <div key={group.id} className="flex justify-between gap-4 text-sm"><span>{group.label}</span><strong>{group.score === null ? (group.assessed_max ? `${group.earned}/${group.assessed_max} đã chấm` : 'Chưa đủ dữ liệu') : `${group.score}/${group.max}`}</strong></div>)}</>}{!result.criteria && Object.entries(result.rubric_scores ?? {}).map(([key, value]) => <div key={key}><div className="mb-2 flex justify-between text-sm"><span>{labels[key] ?? key}</span><strong>{Math.round(value)}/100</strong></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${value}%` }} /></div></div>)}</section></div>
      {result.criteria && <section className="space-y-4">{result.criteria.map((group) => <article key={group.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold">{group.label} — tối đa {group.max} điểm</h2>{group.items.map((item) => <details key={item.id} className="mt-3 border-t border-slate-700 pt-3"><summary className="cursor-pointer">{item.id}. {item.label}: {item.score === null ? 'Chưa đủ điều kiện đánh giá' : `${item.score}/${item.max}`}</summary><p className="mt-2">{item.reason}</p>{item.quote && <blockquote className="my-2 border-l-4 border-blue-400 pl-3">“{item.quote}” <Link className="text-blue-400 underline" to={`/simulation/${sessionId}#record-${item.record_id}`}>Xem phát biểu</Link></blockquote>}<p><strong>Điểm mạnh:</strong> {item.strength}</p><p><strong>Cần thực hành:</strong> {item.improvement}</p></details>)}</article>)}</section>}
      <Link to={`/simulation/${sessionId}`} className="inline-block text-blue-400 underline">Xem lại toàn bộ biên bản</Link>
      {result.rubric_feedback && <section className="grid gap-4 md:grid-cols-2">{Object.entries(result.rubric_feedback).map(([key, item]) => <article key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"><h2 className="font-bold">{labels[key]}</h2><p>{item.reason}</p><blockquote className="border-l-4 border-blue-400 pl-3 text-sm">“{item.quote}”</blockquote><p className="text-sm"><strong>Điểm mạnh:</strong> {item.strength}</p><p className="text-sm"><strong>Thực hành tiếp:</strong> {item.improvement}</p></article>)}</section>}
      <section className="grid gap-6 md:grid-cols-2"><article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-3 font-bold text-white">Nhận xét</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.feedback}</p></article><article className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6"><h2 className="mb-3 font-bold text-amber-300">Hướng cải thiện</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.improvement_suggestions}</p></article></section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">Điều luật đã viện dẫn và nguồn</h2><LegalCitations citations={result.citations} /><LegalResearchResult research={result.legal_research} /></section>
      <p className="text-center text-xs text-slate-500">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
