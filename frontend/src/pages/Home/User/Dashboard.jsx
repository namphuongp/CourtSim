import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useDashboardSessions from '../../../components/dashboard/useDashboardSessions';
import { dashboardSummary, formatScore, practiceSuggestion } from '../../../components/dashboard/dashboardData.mjs';
import ProgressChart from '../../../components/dashboard/ProgressChart';
import SessionCard from '../../../components/dashboard/SessionCard';
import RecentSessions from '../../../components/dashboard/RecentSessions';
import { CheckCircle2, Gavel, ChartNoAxesCombined, MessagesSquare } from 'lucide-react';
import { LoadingState } from '../../../components/WorkspaceStates';
import { useCurrentUser } from '../../../services/auth';
import { PRACTICE_CASES_PATH } from '../../../services/simulation';
import '../../../components/dashboard/dashboard.css';

function savedGuideDismissal(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function Dashboard() {
  const user = useCurrentUser();
  const casesLink = useRef(null);
  const [dismissedFor, setDismissedFor] = useState(null);
  const guideKey = user?.id ? `courtsim.dashboard-guide.v1:${user.id}` : null;
  const showGuide = guideKey && dismissedFor !== guideKey && !savedGuideDismissal(guideKey);
  const { sessions, loading, error, retry } = useDashboardSessions();
  const summary = useMemo(() => dashboardSummary(sessions), [sessions]);
  const suggestion = useMemo(() => practiceSuggestion(summary.completed), [summary]);
  const nextSession = summary.ongoing[0];
  const metrics = [
    ['Đã hoàn thành', summary.completed.length, CheckCircle2],
    ['Đang luyện tập', summary.ongoing.length, Gavel],
    ['Điểm trung bình', summary.average === null ? 'Chưa có điểm' : `${formatScore(summary.average)}/100`, ChartNoAxesCombined],
    ['Tổng lượt tranh tụng', summary.totalTurns, MessagesSquare],
  ];

  function hideGuide() {
    try { localStorage.setItem(guideKey, '1'); } catch { /* Vẫn đóng hướng dẫn trong lần xem này. */ }
    setDismissedFor(guideKey);
    casesLink.current?.focus();
  }

  return <section className="practice-dashboard space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">Không gian luyện tập của bạn</h1>
        <p className="mt-2 text-slate-400">
          {nextSession ? 'Tiếp tục phiên đang luyện hoặc chọn một vụ án khác.' : 'Chọn một vụ án và vai luật sư. Phiên sẽ mở sau khi bạn xác nhận.'}
        </p>
      </div>
      <Link ref={casesLink} to={PRACTICE_CASES_PATH} className={nextSession ? 'dashboard-start-secondary' : 'dashboard-primary'}>Chọn vụ án</Link>
    </header>
    {showGuide && <section className="dashboard-card dashboard-getting-started" aria-labelledby="first-practice-heading">
      <div className="dashboard-guide-header">
        <h2 id="first-practice-heading">Cách bắt đầu luyện tập</h2>
        <button type="button" onClick={hideGuide}>Ẩn hướng dẫn</button>
      </div>
      <ol className="dashboard-first-steps">
        <li><strong>Chọn vụ án</strong><p>Đọc tóm tắt và xem chứng cứ trong hồ sơ.</p></li>
        <li><strong>Chọn vai luật sư</strong><p>Chọn bên bạn muốn bảo vệ rồi xác nhận mở phiên.</p></li>
        <li><strong>Trình bày và phản biện</strong><p>Làm theo hướng dẫn trong phòng xử án. Xem nhận xét khi kết thúc.</p></li>
      </ol>
      <Link to="/guide">Xem hướng dẫn đầy đủ</Link>
    </section>}
    {loading ? <LoadingState>Đang tải không gian luyện tập...</LoadingState> : error ? (
      <div role="alert" className="dashboard-card dashboard-alert">{error} <button onClick={retry} className="text-blue-400 underline">Thử lại</button></div>
    ) : sessions.length ? <>
      {nextSession && <section className="dashboard-resume space-y-4" aria-labelledby="resume-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="resume-heading">Tiếp tục luyện tập</h2>
          {summary.ongoing.length > 1 && <Link className="text-blue-400 underline text-sm" to="/dashboard/sessions">Xem {summary.ongoing.length} phiên đang học</Link>}
        </div>
        <SessionCard session={nextSession} resume />
      </section>}
      <div className="dashboard-metrics">
        {metrics.map(([label, value, Icon]) => <article className="dashboard-card" key={label}>
          <span className="metric-icon"><Icon size={17} aria-hidden="true" /></span>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          {label === 'Điểm trung bình' && summary.scored.length > 0 && <p className="text-xs text-slate-400 mt-2">Tỷ lệ quy đổi từ {summary.scored.length} phiên trên phần đã đánh giá.</p>}
        </article>)}
      </div>
      <div className="dashboard-insights">
        <ProgressChart sessions={summary.points} />
        <section className="dashboard-card space-y-3" aria-labelledby="suggestion-heading">
          <h2 id="suggestion-heading" className="font-bold">Gợi ý luyện tập</h2>
          {suggestion ? <>
            <p className="text-sm whitespace-pre-line">{suggestion.text}</p>
            <Link className="text-sm text-blue-400 underline" to={`/simulation/${suggestion.session._id}/result`}>Xem nhận xét của phiên</Link>
          </> : <p className="text-sm text-slate-400">Gợi ý sẽ xuất hiện sau khi bạn hoàn thành một phiên.</p>}
          <p><Link className="text-blue-400 underline" to="/dashboard/analytics">Đánh giá kỹ năng →</Link></p>
        </section>
      </div>
      <RecentSessions sessions={sessions} />
    </> : !showGuide && <p className="dashboard-card dashboard-empty">Chọn vụ án để bắt đầu phiên luyện tập đầu tiên.</p>}
  </section>;
}
