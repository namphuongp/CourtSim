import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { useAdminData, date } from './adminData';
import { LoadState, Pagination } from './AdminElements';

export { default as AdminAi } from './AdminAi';

export function AdminSystem() {
  const resource = useAdminData('/v1/admin/system/health');
  return <><header className="admin-page-heading"><div><h1>Hệ thống</h1><p>Trạng thái kết nối và cấu hình, không gọi model để kiểm tra.</p></div><button onClick={resource.reload} disabled={resource.loading}>Làm mới</button></header><LoadState resource={resource}>{({ data: d }) => <><section className="admin-card"><dl className="admin-facts">{[['Backend', d.backend, 'Đang hoạt động'], ['MongoDB', d.mongo, 'Đã kết nối'], ['Dịch vụ AI', d.aiConfigured, 'Đã cấu hình'], ['Email', d.emailConfigured, 'Đã cấu hình'], ['Google OAuth', d.googleConfigured, 'Đã cấu hình'], ['Theo dõi AI', d.trackingEnabled, 'Đã bật'], ['Bảng giá AI', d.pricingConfigured, 'Đã cấu hình']].map(([label, ok, text]) => <div className="admin-fact-row" key={label}><dt>{label}</dt><dd><span className={`admin-badge ${ok ? 'admin-ok' : 'admin-warning'}`}>{ok ? text : 'Chưa sẵn sàng'}</span></dd></div>)}</dl><p>Lần gọi AI thành công gần nhất: {date(d.lastAiSuccess)}</p><p>Kiểm tra lúc: {date(d.checkedAt)}</p><p className="admin-note">Có cấu hình không bảo đảm nhà cung cấp đang hoạt động hoặc khóa còn hợp lệ.</p></section>{d.verificationTemporarilyDisabled && <p className="admin-notice">Đang tạm bỏ qua xác minh email trong môi trường phát triển.</p>}</>}</LoadState></>;
}
export function AdminAudit() {
  const [page, setPage] = useState(1);
  const resource = useAdminData(`/v1/admin/audit?page=${page}`);
  return <><h1>Hoạt động quản trị</h1><p>Lịch sử các thay đổi được ghi nhận kể từ khi bật chức năng.</p><LoadState resource={resource}>{d => <section className="admin-card">{!d.data.length ? <p>Chưa có hoạt động quản trị.</p> : <div className="admin-table-scroll"><table><thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>{d.data.map(e => <tr key={e._id}><td>{date(e.created_at)}</td><td>{e.admin_user_id?.username || 'Tài khoản không còn tồn tại'}</td><td>{{ USER_DISABLED: 'Vô hiệu hóa tài khoản', USER_ENABLED: 'Mở lại tài khoản', FEEDBACK_STATUS_CHANGED: 'Cập nhật góp ý', FEEDBACK_DELETED: 'Xóa góp ý', PAYMENT_APPROVED: 'Xác nhận thanh toán', PAYMENT_REJECTED: 'Từ chối thanh toán', PAYMENT_RECONCILED: 'Đối soát thanh toán với SePay' }[e.action]}</td><td><Link to={e.target_type === 'user' ? `/admin/users/${e.target_id}` : e.target_type === 'payment' ? '/admin/payments' : '/admin/feedback'}>{e.target_id}</Link></td></tr>)}</tbody></table></div>}<Pagination pagination={d.pagination} onChange={setPage}/></section>}</LoadState></>;
}


