import { useEffect, useState } from 'react';
import { Award, Home } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

function LegalReferences({ citations = [] }) {
  if (!citations.length) return <p className="text-sm text-slate-400">Không có điều luật nào được viện dẫn trong kết quả này.</p>;
  return (
    <ul className="space-y-3">
      {citations.map((citation) => (
        <li key={citation.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <a href={citation.source_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-300 underline">
            {citation.title}, {citation.locator} ({citation.law_number})
          </a>
          <p className="mt-1 text-xs text-slate-500">Nguồn: {citation.page_source_file ?? citation.source_files.join(', ')}{citation.page_from ? `, tr. ${citation.page_from}${citation.page_to !== citation.page_from ? `-${citation.page_to}` : ''}` : ''}</p>
          <p className="mt-1 text-xs text-slate-500">Hiệu lực từ {citation.effective_from}; phiên bản đã đối chiếu đến {citation.verified_through}.</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{citation.text}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SimulationResult() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/v1/sessions/${sessionId}/result`).then(({ data }) => setResult(data.data)).catch((requestError) => setError(getApiError(requestError)));
  }, [sessionId]);

  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-rose-300">{error}</main>;
  if (!result) return <main className="min-h-screen bg-slate-950 p-8 text-white">Đang tải kết quả...</main>;
  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-200"><div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between"><div><p className="text-sm text-blue-300">Kết quả phiên mô phỏng</p><h1 className="text-3xl font-bold text-white">Báo cáo năng lực tranh tụng</h1></div><button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold"><Home size={17} /> Dashboard</button></header>
      <div className="grid gap-6 lg:grid-cols-3"><section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-7 text-center"><Award className="mx-auto mb-3 text-emerald-400" size={44} /><p className="text-sm text-emerald-300">Điểm tổng hợp</p><p className="text-6xl font-black text-white">{Math.round(result.score)}</p><p className="mt-4 leading-7">{result.verdict}</p></section>
        <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-7 lg:col-span-2"><h2 className="font-bold text-white">Rubric chi tiết</h2>{Object.entries(result.rubric_scores ?? {}).map(([key, value]) => <div key={key}><div className="mb-2 flex justify-between text-sm"><span>{labels[key] ?? key}</span><strong>{Math.round(value)}/100</strong></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${value}%` }} /></div></div>)}</section></div>
      <section className="grid gap-6 md:grid-cols-2"><article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-3 font-bold text-white">Nhận xét</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.feedback}</p></article><article className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6"><h2 className="mb-3 font-bold text-amber-300">Hướng cải thiện</h2><p className="whitespace-pre-wrap leading-7 text-slate-300">{result.improvement_suggestions}</p></article></section>
      {result.fact_analysis && <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">Dữ kiện và giới hạn</h2><div className="grid gap-4 md:grid-cols-3">{[['Dữ kiện trong hồ sơ', result.fact_analysis.established_facts], ['Suy luận', result.fact_analysis.inferences], ['Còn thiếu/chưa được chứng minh', result.fact_analysis.missing_facts]].map(([title, items]) => <article key={title}><h3 className="mb-2 text-sm font-semibold text-slate-300">{title}</h3><ul className="list-inside list-disc space-y-1 text-sm text-slate-400">{items?.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul></article>)}</div></section>}
      {result.citation_warnings?.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"><h2 className="mb-2 font-bold text-amber-200">Giới hạn nguồn luật</h2><ul className="list-inside list-disc space-y-1 text-sm text-amber-100">{result.citation_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><h2 className="mb-4 font-bold text-white">Điều luật đã viện dẫn và nguồn</h2><LegalReferences citations={result.citations} /></section>
      <p className="text-center text-xs text-slate-500">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
