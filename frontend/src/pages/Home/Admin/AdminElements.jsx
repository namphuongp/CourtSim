import { scoreSummary } from '../../../../../shared/scorePresentation.mjs';
import { Link } from 'react-router-dom';
import { date, duration, number, roleLabel } from './adminData';
export function LoadState({ resource, children }) {
  if (resource.loading) return <p className="admin-empty" role="status">Đang tải dữ liệu…</p>;
  if (resource.error) return <div className="admin-empty" role="alert">{resource.error} <button onClick={resource.reload}>Thử lại</button></div>;
  return children(resource.data);
}
export function RangeSelect({ value, onChange }) {
  return <label className="admin-range">Thời gian<select value={value} onChange={e => onChange(e.target.value)}><option value="today">Hôm nay</option><option value="7d">7 ngày gần đây</option><option value="30d">30 ngày gần đây</option><option value="month">Tháng này</option></select></label>;
}
export function Metric({ label, value, note }) {
  return <article className="admin-metric"><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}
export function Pagination({ pagination, onChange }) {
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  return <nav className="admin-pagination" aria-label="Phân trang"><span>{number(pagination.total)} kết quả</span><button disabled={pagination.page <= 1} onClick={() => onChange(pagination.page - 1)}>Trước</button><span>Trang {pagination.page}/{pages}</span><button disabled={pagination.page >= pages} onClick={() => onChange(pagination.page + 1)}>Sau</button></nav>;
}
export function SessionTable({ items }) {
  if (!items.length) return <p className="admin-empty">Chưa có phiên mô phỏng phù hợp.</p>;
  return <div className="admin-table-scroll" tabIndex={0} aria-label="Danh sách phiên mô phỏng"><table><thead><tr>{['Phiên / Vụ án', 'Người học', 'Vai trò', 'Bắt đầu', 'Kết thúc', 'Thời lượng', 'Điểm', 'Trạng thái'].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{items.map(s => <tr key={s._id}><td><Link to={`/admin/sessions/${s._id}`}>{s.title || 'Hồ sơ không còn tồn tại'}</Link><small>{s._id}</small></td><td>{s.user?.username || 'Tài khoản không còn tồn tại'}</td><td>{roleLabel(s.user_court_role)}</td><td>{date(s.created_at)}</td><td>{s.completed_at ? date(s.completed_at) : '—'}</td><td>{duration(s.durationMs)}</td><td>{s.status === 'completed' ? scoreSummary(s).label : '—'}</td><td><span className="admin-badge">{s.status === 'completed' ? 'Đã hoàn thành' : 'Chưa kết thúc'}</span></td></tr>)}</tbody></table></div>;
}
export function ActivityChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.users, r.sessions]));
  const points = field => rows.map((r, i) => `${40 + i * 700 / Math.max(1, rows.length - 1)},${190 - r[field] * 160 / max}`).join(' ');
  return <><div className="admin-chart-legend"><span>● Người dùng mới</span><span>● Phiên mô phỏng</span></div>{rows.every(r => !r.users && !r.sessions) ? <p className="admin-empty">Chưa có hoạt động trong khoảng thời gian này.</p> : <svg className="admin-chart" viewBox="0 0 780 225" role="img" aria-label="Biểu đồ người dùng mới và phiên mô phỏng theo ngày"><path d="M40 20 V190 H750" fill="none" stroke="#c5d3e2"/><text x="5" y="32">{max}</text><text x="15" y="193">0</text><polyline points={points('users')} fill="none" stroke="#2563eb" strokeWidth="3"/><polyline points={points('sessions')} fill="none" stroke="#0f8274" strokeWidth="3"/>{rows.map((r, i) => <g key={r.day}><circle cx={40 + i * 700 / Math.max(1, rows.length - 1)} cy={190 - r.sessions * 160 / max} r="3" fill="#0f8274"><title>{r.day}: {r.users} người dùng, {r.sessions} phiên</title></circle></g>)}<text x="40" y="217">{rows[0]?.day}</text><text x="740" y="217" textAnchor="end">{rows.at(-1)?.day}</text></svg>}<details><summary>Xem số liệu theo ngày</summary><div className="admin-table-scroll"><table><thead><tr><th>Ngày</th><th>Người dùng mới</th><th>Phiên mô phỏng</th></tr></thead><tbody>{rows.map(r => <tr key={r.day}><td>{r.day}</td><td>{r.users}</td><td>{r.sessions}</td></tr>)}</tbody></table></div></details></>;
}
