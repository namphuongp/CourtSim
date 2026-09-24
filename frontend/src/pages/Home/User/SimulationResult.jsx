import { useEffect, useState } from 'react';
import { Award, Home } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

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
      <p className="text-center text-xs text-slate-500">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
