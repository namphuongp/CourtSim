import { Link } from 'react-router-dom';
import { scoreSummary } from '../../../../shared/scorePresentation.mjs';
import { roleLabel } from '../../services/simulation';
import { formatDate, formatScore, sessionTime } from '../dashboard/dashboardData.mjs';
import { skills, skillScore } from './skillData.mjs';

export default function RecentEvaluations({ evaluated }) {
  return <section aria-labelledby="recent-evaluations-title" className="space-y-4"><div className="skill-section-heading"><h2 id="recent-evaluations-title">Phiên đánh giá gần đây</h2><Link className="skill-link" to="/dashboard/history">Xem lịch sử</Link></div>
    {!evaluated.length ? <p className="skill-card skill-empty">Chưa có phiên đánh giá. Kết quả sẽ xuất hiện sau khi bạn hoàn thành một phiên.</p> : <div className="skill-recent-grid">{evaluated.slice(0, 4).map(session => {
      const ranked = skills.map(skill => ({ ...skill, score: skillScore(session, skill.id) })).filter(s => s.score !== null).sort((a, b) => b.score - a.score);
      return <article className="skill-card space-y-3" key={session._id}><p className="skill-helper">{formatDate(sessionTime(session, true))}</p><h3>{session.case_id?.title ?? 'Hồ sơ không còn trong thư viện'}</h3>
        <p className="skill-helper">{roleLabel(session.user_court_role, session.case_id?.category, session.case_id)}</p>
        <p className="font-bold">Điểm: {scoreSummary(session.result).label}</p>
        <p>{ranked.length ? `Kỹ năng nổi bật: ${ranked[0].label} — ${formatScore(ranked[0].score)}/100` : 'Chưa đủ dữ liệu xác định kỹ năng nổi bật.'}</p>
        <Link className="skill-link" to={`/simulation/${session._id}/result`}>Xem đánh giá</Link>
      </article>;
    })}</div>}
  </section>;
}
