import { scoreSummary } from '../../../../../shared/scorePresentation.mjs';
import { Link } from 'react-router-dom';
import { date, duration, number, roleLabel } from './adminData';
import { Activity, ChartNoAxesCombined, Coins, MessageSquare, Users } from 'lucide-react';
import { LoadingState } from '../../../components/WorkspaceStates';
export function LoadState({ resource, children }) {
  if (resource.loading) return <LoadingState>Đang tải dữ liệu…</LoadingState>;
  if (resource.error) return <div className="admin-empty" role="alert">{resource.error} <button onClick={resource.reload}>Thử lại</button></div>;
  return children(resource.data);
}
export function RangeSelect({ value, onChange }) {
  return <label className="admin-range">Thời gian<select value={value} onChange={e => onChange(e.target.value)}><option value="today">Hôm nay</option><option value="7d">7 ngày gần đây</option><option value="30d">30 ngày gần đây</option><option value="month">Tháng này</option></select></label>;
}
export function Metric({ label, value, note }) {
  const Icon = /người dùng|tài khoản/iu.test(label) ? Users : /chi phí|tiền|doanh thu/iu.test(label) ? Coins : /góp ý/iu.test(label) ? MessageSquare : /phiên/iu.test(label) ? ChartNoAxesCombined : Activity;
  return <article className="admin-metric"><span className="admin-metric-icon"><Icon size={17} aria-hidden="true"/></span><p>{label}</p><strong className={typeof value === 'string' && value.startsWith('Chưa') ? 'admin-metric-empty' : undefined}>{value}</strong>{note && <small>{note}</small>}</article>;
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
  const max = Math.ceil(Math.max(4, ...rows.flatMap(r => [r.users, r.sessions])) / 4) * 4;
  const step = 700 / Math.max(1, rows.length);
  const bar = Math.min(16, step * .32);
  return <><div className="admin-chart-legend"><span>● Người dùng mới</span><span>● Phiên mô phỏng</span></div>{rows.every(r => !r.users && !r.sessions) ? <p className="admin-empty">Chưa có hoạt động trong khoảng thời gian này.</p> : <svg className="admin-chart" viewBox="0 0 780 225" role="img" aria-label="Biểu đồ người dùng mới và phiên mô phỏng theo ngày"><defs><linearGradient id="admin-session-bars" x1="0" y1="1" x2="0" y2="0"><stop stopColor="#3682fc"/><stop offset="1" stopColor="#78b9ff"/></linearGradient></defs>{[0, 1, 2, 3, 4].map(i => <g key={i}><path d={`M40 ${30 + i * 40} H750`} stroke="#e7eef9" strokeDasharray="3 4"/><text x="30" y={34 + i * 40} textAnchor="end">{Math.round(max * (4 - i) / 4)}</text></g>)}{rows.map((r, i) => <g key={r.day}><title>{r.day}: {r.users} người dùng, {r.sessions} phiên</title><rect x={40 + i * step + (step - bar * 2) / 2} y={190 - r.users * 160 / max} width={bar} height={r.users * 160 / max} rx="3" fill="#1e4fc4"/><rect x={42 + i * step + step / 2} y={190 - r.sessions * 160 / max} width={bar} height={r.sessions * 160 / max} rx="3" fill="url(#admin-session-bars)"/></g>)}<text x="40" y="217">{rows[0]?.day}</text><text x="740" y="217" textAnchor="end">{rows.at(-1)?.day}</text></svg>}<details><summary>Xem số liệu theo ngày</summary><div className="admin-table-scroll"><table><thead><tr><th>Ngày</th><th>Người dùng mới</th><th>Phiên mô phỏng</th></tr></thead><tbody>{rows.map(r => <tr key={r.day}><td>{r.day}</td><td>{r.users}</td><td>{r.sessions}</td></tr>)}</tbody></table></div></details></>;
}
