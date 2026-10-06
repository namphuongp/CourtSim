import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SessionCard from './SessionCard';
import { recentSessions } from './dashboardData.mjs';

export default function RecentSessions({ sessions }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const visible = useMemo(() => recentSessions(sessions, { search, status, sort }), [sessions, search, status, sort]);
  return <section aria-labelledby="recent-heading" className="space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-3"><h2 id="recent-heading" className="font-bold">Các phiên gần đây</h2><Link className="text-blue-400 underline text-sm" to="/dashboard/history">Xem toàn bộ lịch sử</Link></div>
    <div className="dashboard-filters">
      <label>Tìm phiên theo tên vụ án<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nhập tên vụ án" /></label>
      <div><label htmlFor="dashboard-status">Trạng thái</label><select id="dashboard-status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Tất cả</option><option value="ongoing">Đang luyện</option><option value="completed">Đã hoàn thành</option></select></div>
      <div><label htmlFor="dashboard-sort">Sắp xếp</label><select id="dashboard-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Gần nhất</option><option value="oldest">Cũ nhất</option><option value="high">Điểm cao</option><option value="low">Điểm thấp</option></select></div>
    </div>
    <p className="text-sm text-slate-400" aria-live="polite">Hiển thị {visible.length} phiên.</p>
    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map(s => <SessionCard key={s._id} session={s} />)}</div> : <p className="dashboard-card dashboard-empty">{sessions.length ? 'Không tìm thấy phiên phù hợp với bộ lọc.' : 'Bạn chưa có phiên luyện tập. Chọn Tạo phiên mới để bắt đầu.'}</p>}
  </section>;
}
