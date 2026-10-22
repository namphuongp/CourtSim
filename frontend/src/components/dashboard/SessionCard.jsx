import { Link } from 'react-router-dom';
import { roleLabel } from '../../services/simulation';
import { scoreSummary } from '../../../../shared/scorePresentation.mjs';
import { formatDate, sessionTime } from './dashboardData.mjs';

export default function SessionCard({ session, resume = false }) {
  const completed = session.status === 'completed';
  const score = session.result ? scoreSummary(session.result) : null;
  return <article className="dashboard-card session-record-card space-y-3" aria-label={`${resume ? 'Tiếp tục: ' : ''}${session.case_id?.title ?? 'Hồ sơ không còn trong thư viện'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className={`dashboard-status ${completed ? 'is-completed' : ''}`}>{completed ? 'Đã hoàn thành' : 'Đang luyện tập'}</span>
      <span className="text-slate-400">Cập nhật {formatDate(sessionTime(session))}</span>
    </div>
    <h3 className="text-lg font-bold">{session.case_id?.title ?? 'Hồ sơ không còn trong thư viện'}</h3>
    <p className="text-sm text-slate-400">{roleLabel(session.user_court_role, session.case_id?.category, session.case_id)} · {session.turn_count ?? 0} lượt</p>
    {score && <div><p className="font-bold">Điểm: {score.label}</p>{score.partial && <p className="text-xs text-amber-300">Chưa có điểm toàn bài, phần chưa chấm không tính là 0.</p>}</div>}
    <div className="flex flex-wrap gap-4"><Link className={resume ? 'dashboard-primary' : 'text-blue-400 underline'} to={`/simulation/${session._id}${completed ? '#transcript' : ''}`}>{completed ? 'Xem lại phiên' : 'Tiếp tục tranh tụng'}</Link>
      {completed && session.result && <Link className="text-blue-400 underline" to={`/simulation/${session._id}/result`}>Xem kết quả</Link>}</div>
  </article>;
}
