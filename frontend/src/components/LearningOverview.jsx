import { scoreSummary } from '../../../shared/scorePresentation.mjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { roleLabel } from '../services/simulation';
import api, { getApiError } from '../services/api';
import './dashboard/dashboard.css';

const rubricLabels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng', issue_identification: 'Vấn đề pháp lý và mục tiêu', legal_application: 'Áp dụng pháp luật', evidence_analysis: 'Phân tích chứng cứ', legal_reasoning: 'Lập luận pháp lý', rebuttal: 'Phản biện', adaptation: 'Ứng biến' };
const titles = { dashboard: 'Không gian luyện tập của bạn', sessions: 'Phiên đang luyện tập', history: 'Lịch sử học tập', analytics: 'Đánh giá kỹ năng' };

export default function LearningOverview({ view = 'dashboard' }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api.get('/v1/sessions').then(({ data }) => { if (active) { setSessions(data.data); setError(''); } })
      .catch((e) => { if (active) setError(getApiError(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const completed = sessions.filter((s) => s.status === 'completed');
  const scored = completed.filter((s) => s.result && (Number.isFinite(s.result.score) || Number.isFinite(s.result.earned_score)));
  const completeScores = scored.filter(s => !scoreSummary(s.result).partial && !scoreSummary(s.result).provisional);
  const average = completeScores.length ? Math.round(completeScores.reduce((sum, s) => sum + s.result.score, 0) / completeScores.length) : null;
  const visible = sessions.filter((s) => (view !== 'sessions' || s.status === 'ongoing') && (view !== 'history' || s.status === 'completed'))
    .filter((s) => `${s.case_id?.title ?? ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  return <section className="practice-dashboard learning-overview space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">{titles[view]}</h1><p className="mt-2 text-slate-400">Đọc hồ sơ, xây dựng lập luận và nhận góp ý từ phiên thực hành của bạn.</p></div><Link to="/dashboard/setup" className="dashboard-primary">Tạo phiên mới</Link></header>
    {loading && <p className="dashboard-card" role="status">Đang tải danh sách phiên...</p>}
    {error && <div role="alert" className="dashboard-card dashboard-alert">{error} <button onClick={() => { setLoading(true); setReload((n) => n + 1); }}>Thử lại</button></div>}
    {!loading && !error && <>
      {(view === 'dashboard' || view === 'analytics') && <div className="dashboard-metrics is-three-up">{[['Đã hoàn thành', completed.length], ['Đang luyện tập', sessions.length - completed.length], ['Điểm trung bình các phiên chấm đủ', average === null ? 'Chưa có điểm' : `${average}/100`]].map(([label, value]) => <article key={label} className="dashboard-card"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p></article>)}</div>}
      {view === 'analytics' ? <div className="dashboard-card learning-rubric space-y-5"><p className="text-sm text-slate-400">{scored.length ? `Tổng hợp từ ${scored.length} phiên có điểm. Điểm phản ánh bài tập đã thực hiện, không phải chứng nhận năng lực hành nghề.` : 'Hoàn thành một phiên để xem đánh giá kỹ năng.'}</p>{scored.length > 0 && Object.entries(rubricLabels).map(([key, label]) => {
        const values = scored.map((s) => s.result.rubric_scores?.[key]).filter(Number.isFinite);
        const score = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
        return <div key={key}><p className="flex justify-between"><span>{label}</span><strong>{score === null ? 'Chưa có' : `${score}/100`}</strong></p>{score !== null && <progress aria-label={label} max="100" value={score} className="mt-2 h-3 w-full accent-blue-600" />}</div>;
      })}</div> : <>
        <label className="dashboard-search block text-sm">Tìm phiên theo tên hồ sơ<input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3" placeholder="Nhập tên vụ án" /></label>
        {!visible.length && <p className="dashboard-card dashboard-empty">{search ? 'Không tìm thấy phiên phù hợp. Hãy thử tên vụ án khác.' : 'Chưa có phiên trong danh sách này. Chọn Tạo phiên mới để bắt đầu.'}</p>}
        <div className="dashboard-session-grid grid gap-4 lg:grid-cols-2">{(view === 'dashboard' ? visible.slice(0, 6) : visible).map((s) => <article key={s._id} className="dashboard-card dashboard-session-card space-y-3">
          <p className={`dashboard-status ${s.status === 'completed' ? 'is-completed' : ''}`}>{s.status === 'completed' ? 'Đã hoàn thành' : 'Đang luyện tập'} · {new Date(s.created_at).toLocaleDateString('vi-VN')}</p>
          <h2 className="text-lg font-bold text-white">{s.case_id?.title ?? 'Hồ sơ không còn trong thư viện'}</h2>
          <p className="text-sm text-slate-400">{roleLabel(s.user_court_role, s.case_id?.category, s.case_id)} · {s.turn_count} lượt</p>
          {s.result && <><p className="font-bold">Điểm: {scoreSummary(s.result).label}</p>{s.result?.assessed_max !== undefined && <p className="text-xs text-amber-300">{scoreSummary(s.result).partial ? `${100 - s.result.assessed_max}% trọng số chưa chấm · Chưa có điểm toàn bài` : 'Đã đánh giá đủ trọng số'}</p>}</>}
          <div className="flex flex-wrap gap-4"><Link className="text-blue-400 underline" to={`/simulation/${s._id}${s.status === 'completed' ? '#transcript' : ''}`}>{s.status === 'completed' ? 'Xem biên bản' : 'Tiếp tục tranh tụng'}</Link>{s.status === 'completed' && <Link className="text-blue-400 underline" to={`/simulation/${s._id}/result`}>Xem kết quả</Link>}</div>
        </article>)}</div>
      </>}
    </>}
  </section>;
}
