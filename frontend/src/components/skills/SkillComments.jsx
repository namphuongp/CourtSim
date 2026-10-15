import { Link } from 'react-router-dom';
import { formatDate, sessionTime } from '../dashboard/dashboardData.mjs';

export function CommentSource({ session }) {
  return <Link className="skill-link" to={`/simulation/${session._id}/result`}>Xem đánh giá · {formatDate(sessionTime(session, true))}</Link>;
}

export default function SkillComments({ comments }) {
  return <aside className="skill-card space-y-5" aria-labelledby="skill-comments-title">
    <h2 id="skill-comments-title">Nhận xét của CourtSim</h2>
    {[['Điểm mạnh', comments.strengths], ['Cần cải thiện', comments.improvements]].map(([label, items]) => <div key={label}><h3>{label}</h3>{items.length ? <ul className="skill-comments-list">{items.map(item => <li key={`${item.session._id}-${item.text}`}><p>{item.text}</p><CommentSource session={item.session} /></li>)}</ul> : <p className="skill-helper">Chưa có nhận xét đã lưu cho mục này.</p>}</div>)}
    {!comments.strengths.length && !comments.improvements.length && comments.feedback && <div><h3>Nhận xét chung</h3><p>{comments.feedback.text}</p><CommentSource session={comments.feedback.session} /></div>}
    <div className="skill-goal"><h3>Mục tiêu luyện tập tiếp theo</h3>{comments.goal ? <><p>{comments.goal.text}</p><CommentSource session={comments.goal.session} /></> : <p className="skill-helper">Chưa có mục tiêu trong đánh giá đã lưu. Hoàn thành thêm phiên luyện tập để nhận góp ý.</p>}</div>
    <Link className="skill-link" to="/dashboard/setup">Tạo phiên luyện tập →</Link>
  </aside>;
}
