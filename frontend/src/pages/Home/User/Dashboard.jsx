import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useDashboardSessions from '../../../components/dashboard/useDashboardSessions';
import { dashboardSummary, formatScore, practiceSuggestion } from '../../../components/dashboard/dashboardData.mjs';
import ProgressChart from '../../../components/dashboard/ProgressChart';
import SessionCard from '../../../components/dashboard/SessionCard';
import RecentSessions from '../../../components/dashboard/RecentSessions';
import StepGuide from '../../../components/StepGuide';
import { CheckCircle2, CircleHelp, Gavel, ChartNoAxesCombined, MessagesSquare } from 'lucide-react';
import { LoadingState } from '../../../components/WorkspaceStates';
import { useCurrentUser } from '../../../services/auth';
import { PRACTICE_CASES_PATH } from '../../../services/simulation';
import '../../../components/dashboard/dashboard.css';

const guideSteps = [
  {
    target: '.dashboard-cases-link',
    title: 'Chọn vụ án',
    text: 'Bấm Chọn vụ án để đọc hồ sơ, xem chứng cứ và chọn vai luật sư. Phiên sẽ mở sau khi bạn xác nhận.',
  },
  {
    target: '.user-navigation a[href="/dashboard/sessions"]',
    title: 'Tiếp tục phiên đang luyện',
    text: 'Mở Phiên đang học để quay lại một phiên đã bắt đầu. Hướng dẫn trong phòng xử án sẽ chỉ cho bạn cách đọc lời thoại và gửi lập luận.',
  },
  {
    target: '.user-navigation a[href="/dashboard/history"]',
    title: 'Xem kết quả đã lưu',
    text: 'Mở Lịch sử để xem lại các phiên đã hoàn thành, điểm và nhận xét về phần trình bày của bạn.',
  },
];

function savedGuideDismissal(key) {
  try { return Boolean(key) && localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function Dashboard() {
  const user = useCurrentUser();
  const guideButton = useRef(null);
  const [guideState, setGuideState] = useState(null);
  const guideKey = user?.id ? `courtsim.dashboard-guide.v1:${user.id}` : null;
  const currentGuide = guideState?.key === guideKey ? guideState : null;
  const skipNext = currentGuide?.skipNext ?? savedGuideDismissal(guideKey);
  const showGuide = guideKey && (currentGuide?.open ?? !skipNext);
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

  function toggleGuide(open) {
    setGuideState({ key: guideKey, open, skipNext });
  }

  function updateGuidePreference(checked, open = true) {
    try {
      if (checked) localStorage.setItem(guideKey, '1');
      else localStorage.removeItem(guideKey);
    } catch { /* Vẫn giữ lựa chọn trong lần xem này. */ }
    setGuideState({ key: guideKey, open, skipNext: checked });
  }

  return <section className="practice-dashboard space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">Không gian luyện tập của bạn</h1>
        <p className="mt-2 text-slate-400">
          {nextSession ? 'Tiếp tục phiên đang luyện hoặc chọn một vụ án khác.' : 'Chọn một vụ án và vai luật sư. Phiên sẽ mở sau khi bạn xác nhận.'}
        </p>
      </div>
      <div className="dashboard-header-actions">
        <button ref={guideButton} type="button" className="dashboard-guide-trigger" aria-haspopup="dialog" onClick={() => toggleGuide(true)}>
          <CircleHelp size={16} aria-hidden="true" /> Hướng dẫn nhanh
        </button>
        <Link to={PRACTICE_CASES_PATH} className={`dashboard-cases-link ${nextSession ? 'dashboard-start-secondary' : 'dashboard-primary'}`}>Chọn vụ án</Link>
      </div>
    </header>
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
    </> : <p className="dashboard-card dashboard-empty">Chọn vụ án để bắt đầu phiên luyện tập đầu tiên.</p>}
    {showGuide && <StepGuide
      steps={guideSteps}
      reopenNote="Bạn có thể mở lại bằng nút Hướng dẫn nhanh."
      returnFocusRef={guideButton}
      onClose={() => toggleGuide(false)}
      onFinish={() => updateGuidePreference(true, false)}
      skipNext={skipNext}
      onSkipNextChange={updateGuidePreference}
    />}
  </section>;
}
