import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useDashboardSessions from '../../../components/dashboard/useDashboardSessions';
import { dashboardSummary, formatScore, practiceSuggestion } from '../../../components/dashboard/dashboardData.mjs';
import ProgressChart from '../../../components/dashboard/ProgressChart';
import SessionCard from '../../../components/dashboard/SessionCard';
import RecentSessions from '../../../components/dashboard/RecentSessions';
import '../../../components/dashboard/dashboard.css';

export default function Dashboard() {
  const { sessions, loading, error, retry } = useDashboardSessions();
  const summary = useMemo(() => dashboardSummary(sessions), [sessions]);
  const suggestion = useMemo(() => practiceSuggestion(summary.completed), [summary]);
  return <section className="practice-dashboard space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-white">Không gian luyện tập của bạn</h1><p className="mt-2 text-slate-400">Đọc hồ sơ, xây dựng lập luận và nhận góp ý từ phiên thực hành của bạn.</p></div><Link to="/dashboard/setup" className="dashboard-primary">Tạo phiên mới</Link></header>
    {loading ? <p role="status">Đang tải không gian luyện tập...</p> : error ? <div role="alert" className="dashboard-card">{error} <button onClick={retry} className="text-blue-400 underline">Thử lại</button></div> : <>
      <div className="dashboard-metrics">{[['Đã hoàn thành', summary.completed.length], ['Đang luyện tập', summary.ongoing.length], ['Điểm trung bình', summary.average === null ? 'Chưa có điểm' : `${formatScore(summary.average)}/100`], ['Tổng lượt tranh tụng', summary.totalTurns]].map(([label, value]) => <article className="dashboard-card" key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>{label === 'Điểm trung bình' && summary.scored.length > 0 && <p className="text-xs text-slate-400 mt-2">Tỷ lệ quy đổi từ {summary.scored.length} phiên trên phần đã đánh giá, không phải điểm toàn bài.</p>}</article>)}</div>
      <div className="dashboard-insights"><ProgressChart sessions={summary.points} /><section className="dashboard-card space-y-3" aria-labelledby="suggestion-heading"><h2 id="suggestion-heading" className="font-bold">Gợi ý luyện tập</h2>{suggestion ? <><p className="text-sm whitespace-pre-line">{suggestion.text}</p><Link className="text-sm text-blue-400 underline" to={`/simulation/${suggestion.session._id}/result`}>Xem đánh giá nguồn</Link></> : <p className="text-sm text-slate-400">Chưa có nhận xét hoặc đánh giá kỹ năng để đề xuất. Hoàn thành một phiên luyện tập để nhận góp ý.</p>}<p><Link className="text-blue-400 underline" to="/dashboard/analytics">Đánh giá kỹ năng →</Link></p></section></div>
      <section className="space-y-4" aria-labelledby="resume-heading"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="resume-heading" className="font-bold">Tiếp tục luyện tập</h2>{summary.ongoing.length > 1 && <Link className="text-blue-400 underline text-sm" to="/dashboard/sessions">Xem {summary.ongoing.length} phiên đang học</Link>}</div>{summary.ongoing[0] ? <SessionCard session={summary.ongoing[0]} resume /> : <p className="dashboard-card text-slate-400">Bạn không có phiên đang luyện tập. Tạo phiên mới khi sẵn sàng.</p>}</section>
      <RecentSessions sessions={sessions} />
    </>}
  </section>;
}
