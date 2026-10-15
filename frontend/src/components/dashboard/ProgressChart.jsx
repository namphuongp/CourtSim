import { Link } from 'react-router-dom';
import { formatDate, formatScore, normalizedScore, sessionTime } from './dashboardData.mjs';

export default function ProgressChart({ sessions }) {
  const times = sessions.map(s => sessionTime(s, true));
  const first = times[0], last = times.at(-1);
  const points = sessions.map((s, index) => ({ session: s, score: normalizedScore(s.result),
    x: first === last ? 310 : 45 + (times[index] - first) / (last - first) * 530,
    y: 180 - normalizedScore(s.result) * 1.5 }));
  return <section className="dashboard-card" aria-labelledby="progress-heading">
    <h2 id="progress-heading" className="font-bold">Tiến bộ gần đây</h2>
    <p className="mt-2 text-sm text-slate-400">Điểm quy đổi trên phần đã đánh giá.</p>
    {!points.length ? <p className="dashboard-empty">Chưa có phiên đã chấm có ngày hợp lệ. Kết quả luyện tập sẽ xuất hiện tại đây.</p> : <>
      <svg className="dashboard-chart" viewBox="0 0 620 220" role="img" aria-label={`Biểu đồ điểm của ${points.length} phiên đã chấm, chi tiết trong danh sách bên dưới`}>
        {[0, 50, 100].map(value => <g key={value}><line x1="45" x2="575" y1={180 - value * 1.5} y2={180 - value * 1.5} stroke="#d9e2ec" /><text x="8" y={184 - value * 1.5} fill="#526d82" fontSize="12">{value}</text></g>)}
        {points.length > 1 && <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />}
        {points.map(p => <circle key={p.session._id} cx={p.x} cy={p.y} r="5" fill="#1d4ed8"><title>{formatDate(sessionTime(p.session, true))}: {formatScore(p.score)}/100</title></circle>)}
        <text x="45" y="210" fill="#526d82" fontSize="12">{formatDate(first)}</text>
        {first !== last && <text x="575" y="210" textAnchor="end" fill="#526d82" fontSize="12">{formatDate(last)}</text>}
      </svg>
      {points.length === 1 && <p className="text-sm text-slate-400">Mới có một phiên có điểm, chưa đủ dữ liệu để nhận xét xu hướng.</p>}
      <details className="text-sm mt-3"><summary className="cursor-pointer text-blue-400">Xem điểm từng phiên</summary><ul className="space-y-2 mt-3">{points.map(p => <li key={p.session._id}><Link className="text-blue-400 underline" to={`/simulation/${p.session._id}/result`}>{formatDate(sessionTime(p.session, true))} · {p.session.case_id?.title ?? 'Phiên luyện tập'}</Link> — {formatScore(p.score)}/100 (quy đổi)</li>)}</ul></details>
    </>}
  </section>;
}
