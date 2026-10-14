import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { useAdminData, number, money, date, roleLabel } from './adminData';
import { LoadState, Metric, RangeSelect, Pagination } from './AdminElements';

const vnd = value => value == null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';

export function AdminPayments() {
  const [filter, setFilter] = useState({ page: 1, q: '', status: 'pending', sort: 'created_at', order: 'desc' });
  const [action, setAction] = useState({ id: '', busy: false, error: '', notice: '' });
  const resource = useAdminData('/v1/admin/payments?' + new URLSearchParams(filter));
  const change = (key, value) => setFilter(f => ({ ...f, [key]: value, page: 1 }));
  async function updatePayment(transactionId, status) {
    setAction({ id: transactionId, busy: true, error: '', notice: '' });
    try {
      await api.patch(`/v1/admin/payments/${transactionId}`, { status }, { timeout: 15000 });
      setAction({ id: '', busy: false, error: '', notice: status === 'success' ? 'Đã xác nhận thanh toán và mở quyền sử dụng.' : 'Đã từ chối giao dịch.' });
      resource.reload();
    } catch (error) {
      setAction({ id: transactionId, busy: false, error: getApiError(error, 'Chưa xử lý được giao dịch.'), notice: '' });
    }
  }
  const statusLabel = value => ({ pending: 'Chờ chuyển khoản', processing: 'Đang xác minh', paid: 'Đã thanh toán', expired: 'Đã hết hạn', cancelled: 'Đã hủy', submitted: 'Chờ xác minh', success: 'Đã xác minh', failed: 'Đã từ chối', refunded: 'Đã hoàn tiền' }[value] ?? value);
  return <><header className="admin-page-heading"><div><h1>Thanh toán</h1><p>Theo dõi webhook chuyển khoản; xử lý thủ công khi giao dịch cần đối soát lại.</p></div></header>
    {action.notice && <p className="admin-notice" role="status">{action.notice}</p>}
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); change('q', new FormData(e.currentTarget).get('q').trim()); }}>
      <label>Tìm giao dịch<input name="q" maxLength={100} placeholder="Mã giao dịch, tên hoặc email" /></label><button>Tìm kiếm</button>
      <label>Trạng thái<select value={filter.status} onChange={e => change('status', e.target.value)}><option value="">Tất cả</option><option value="pending">Chờ chuyển khoản</option><option value="processing">Đang xác minh</option><option value="paid">Đã thanh toán</option><option value="expired">Đã hết hạn</option><option value="cancelled">Đã hủy</option></select></label>
      <label>Sắp xếp<select value={filter.sort} onChange={e => change('sort', e.target.value)}><option value="created_at">Ngày tạo</option><option value="updated_at">Cập nhật</option><option value="amount">Số tiền</option><option value="status">Trạng thái</option></select></label>
      <label>Thứ tự<select value={filter.order} onChange={e => change('order', e.target.value)}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
    </form>
    <LoadState resource={resource}>{d => <section className="admin-card">{!d.data.length ? <p className="admin-empty">Chưa có giao dịch phù hợp.</p> : <div className="admin-table-scroll"><table><thead><tr>{['Giao dịch', 'Người dùng', 'Gói', 'Số tiền', 'Nội dung CK', 'Trạng thái', 'Thời gian', 'Xử lý'].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{d.data.map(item => <tr key={item.transaction_id}><td><strong>{item.transaction_id}</strong><small>{item.payment?.account_name} · {item.payment?.account_mask}</small></td><td>{item.user ? <Link to={`/admin/users/${item.user._id}`}>{item.user.username}</Link> : 'Tài khoản không còn tồn tại'}<small>{item.user?.email}</small></td><td>{item.plan?.name}<small>{item.plan?.payment_purpose}</small></td><td>{vnd(item.amount)}</td><td>{item.payment?.transfer_content}</td><td><span className="admin-badge">{statusLabel(item.status)}</span><small>{item.user_confirmed_at ? `Báo đã chuyển: ${date(item.user_confirmed_at)}` : ''}</small></td><td>{date(item.created_at)}<small>Cập nhật: {date(item.updated_at)}</small></td><td>{['pending'].includes(item.status) ? <div className="admin-payment-actions"><button disabled={action.busy && action.id === item.transaction_id} onClick={() => updatePayment(item.transaction_id, 'success')}>Xác nhận</button><button className="admin-danger" disabled={action.busy && action.id === item.transaction_id} onClick={() => updatePayment(item.transaction_id, 'failed')}>Từ chối</button>{action.id === item.transaction_id && action.error && <small role="alert">{action.error}</small>}</div> : '—'}</td></tr>)}</tbody></table></div>}<Pagination pagination={d.pagination} onChange={page => setFilter({ ...filter, page })}/></section>}</LoadState>
  </>;
}

export function AdminAi() {
  const [range, setRange] = useState('month');
  const resource = useAdminData(`/v1/admin/ai/usage?range=${range}`);
  return <><header className="admin-page-heading"><div><h1>AI & Chi phí</h1><p>Ước tính USD theo token và giá cấu hình, không phải hóa đơn nhà cung cấp.</p></div><RangeSelect value={range} onChange={setRange}/></header><LoadState resource={resource}>{({ data: d }) => <>
    {!d.trackingEnabled && <p className="admin-notice">Chưa bật theo dõi chi phí AI. Số liệu đã lưu vẫn được giữ lại.</p>}
    {!d.requests && <p className="admin-empty">Chưa có dữ liệu AI trong khoảng thời gian này.</p>}
    <div className="admin-metrics"><Metric label="Chi phí đã tính (ước tính)" value={money(d.estimatedCost)} note={`${d.priced}/${d.requests} lượt gọi có đủ dữ liệu giá`}/><Metric label="Lượt gọi" value={number(d.requests)} note="Gồm cả lần thử lại và lỗi"/><Metric label="Token đã ghi nhận" value={number(d.inputTokens + d.outputTokens)} note={`${d.tokensKnown}/${d.requests} lượt có số token đầu vào và đầu ra`}/><Metric label="Độ trễ trung bình" value={d.latencyMs == null ? 'Chưa có dữ liệu' : `${number(d.latencyMs)} ms`} note={`Tỷ lệ lỗi: ${d.errorRate == null ? 'Chưa có dữ liệu' : number(d.errorRate * 100) + '%'}`}/></div>
    {!d.completeCost && <p className="admin-notice">Chi phí chưa đầy đủ: chưa tính lượt gọi thiếu token hoặc chưa cấu hình giá. Không bao gồm dữ liệu trước khi bật theo dõi.</p>}
    <p className="admin-note">Bản ghi đầu tiên: {date(d.trackedSince)}. Lỗi ở đây là lỗi gọi dịch vụ hoặc định dạng phản hồi, không phải điểm chất lượng lập luận.</p>
    <section className="admin-card"><h2>Theo vai trò</h2>{d.roles.length ? <div className="admin-table-scroll"><table><thead><tr><th>Vai trò</th><th>Lượt gọi</th><th>Tỷ lệ lượt gọi</th><th>Chi phí đã tính</th></tr></thead><tbody>{d.roles.map(r => <tr key={r._id}><td>{roleLabel(r._id)}</td><td>{r.requests}</td><td>{number(r.requests / d.requests * 100)}%</td><td>{money(r.priced ? r.knownCost : null)}<small>{r.priced}/{r.requests} lượt có giá</small></td></tr>)}</tbody></table></div> : <p>Chưa có dữ liệu theo vai trò.</p>}<p className="admin-note">Giọng nói chưa có API chuyển âm thanh thành văn bản nên chưa có usage để tính phí.</p></section>
    <section className="admin-card"><h2>Theo model</h2>{d.models.length ? <div className="admin-table-scroll"><table><thead><tr><th>Model</th><th>Nhà cung cấp</th><th>Lượt gọi</th><th>Token vào / ra</th><th>Chi phí đã tính</th></tr></thead><tbody>{d.models.map((r, i) => <tr key={i}><td>{r._id.model}</td><td>{r._id.provider}</td><td>{r.requests}</td><td>{number(r.inputTokens)} / {number(r.outputTokens)}</td><td>{money(r.priced ? r.knownCost : null)}</td></tr>)}</tbody></table></div> : <p>Chưa có dữ liệu model.</p>}</section>
    <section className="admin-card"><h2>Chi phí theo phiên</h2><p>Trung bình: <strong>{money(d.costPerSession)}</strong> / phiên có đủ giá cho các lượt đã ghi nhận trong khoảng đã chọn ({d.pricedSessions} phiên).</p><p className="admin-note">Đây là chi phí trong khoảng đã chọn, không nhất thiết là toàn bộ chi phí vòng đời phiên. Phiên thiếu giá bị loại khỏi trung bình.</p><h3>Phiên có chi phí cao nhất</h3>{d.expensiveSessions.length ? <div className="admin-table-scroll"><table><thead><tr><th>Phiên</th><th>Lượt gọi</th><th>Chi phí ước tính</th></tr></thead><tbody>{d.expensiveSessions.map(s => <tr key={s._id}><td><Link to={`/admin/sessions/${s._id}`}>{s._id}</Link></td><td>{s.requests}</td><td>{money(s.cost)}</td></tr>)}</tbody></table></div> : <p>Chưa có phiên đủ dữ liệu để tính chi phí.</p>}</section>
  </>}</LoadState></>;
}
export function AdminSystem() {
  const resource = useAdminData('/v1/admin/system/health');
  return <><header className="admin-page-heading"><div><h1>Hệ thống</h1><p>Trạng thái kết nối và cấu hình, không gọi model để kiểm tra.</p></div><button onClick={resource.reload} disabled={resource.loading}>Làm mới</button></header><LoadState resource={resource}>{({ data: d }) => <><section className="admin-card"><dl className="admin-facts">{[['Backend', d.backend, 'Đang hoạt động'], ['MongoDB', d.mongo, 'Đã kết nối'], ['Dịch vụ AI', d.aiConfigured, 'Đã cấu hình'], ['Email', d.emailConfigured, 'Đã cấu hình'], ['Google OAuth', d.googleConfigured, 'Đã cấu hình'], ['Theo dõi AI', d.trackingEnabled, 'Đã bật'], ['Bảng giá AI', d.pricingConfigured, 'Đã cấu hình']].map(([label, ok, text]) => <div className="admin-fact-row" key={label}><dt>{label}</dt><dd><span className={`admin-badge ${ok ? 'admin-ok' : 'admin-warning'}`}>{ok ? text : 'Chưa sẵn sàng'}</span></dd></div>)}</dl><p>Lần gọi AI thành công gần nhất: {date(d.lastAiSuccess)}</p><p>Kiểm tra lúc: {date(d.checkedAt)}</p><p className="admin-note">Có cấu hình không bảo đảm nhà cung cấp đang hoạt động hoặc khóa còn hợp lệ.</p></section>{d.verificationTemporarilyDisabled && <p className="admin-notice">Đang tạm bỏ qua xác minh email trong môi trường phát triển.</p>}</>}</LoadState></>;
}
export function AdminAudit() {
  const [page, setPage] = useState(1);
  const resource = useAdminData(`/v1/admin/audit?page=${page}`);
  return <><h1>Hoạt động quản trị</h1><p>Lịch sử các thay đổi được ghi nhận kể từ khi bật chức năng.</p><LoadState resource={resource}>{d => <section className="admin-card">{!d.data.length ? <p>Chưa có hoạt động quản trị.</p> : <div className="admin-table-scroll"><table><thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>{d.data.map(e => <tr key={e._id}><td>{date(e.created_at)}</td><td>{e.admin_user_id?.username || 'Tài khoản không còn tồn tại'}</td><td>{{ USER_DISABLED: 'Vô hiệu hóa tài khoản', USER_ENABLED: 'Mở lại tài khoản', FEEDBACK_STATUS_CHANGED: 'Cập nhật góp ý', FEEDBACK_DELETED: 'Xóa góp ý', PAYMENT_APPROVED: 'Xác nhận thanh toán', PAYMENT_REJECTED: 'Từ chối thanh toán' }[e.action]}</td><td><Link to={e.target_type === 'user' ? `/admin/users/${e.target_id}` : e.target_type === 'payment' ? '/admin/payments' : '/admin/feedback'}>{e.target_id}</Link></td></tr>)}</tbody></table></div>}<Pagination pagination={d.pagination} onChange={setPage}/></section>}</LoadState></>;
}


