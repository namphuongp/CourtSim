import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import { useAdminData, vnd, date, number, paymentStatusLabel } from './adminData';
import { LoadState, Metric, Pagination } from './AdminElements';

const auditLabels = { payment_created: 'Tạo yêu cầu thanh toán', payment_paid: 'Xác nhận đã thanh toán',
  payment_expired: 'Đơn hết hạn', payment_cancelled: 'Hủy đơn thanh toán', payment_poll_failed: 'Chưa đối soát được với SePay',
  payment_fulfillment_failed: 'Chưa cập nhật được quyền lợi', webhook_received: 'Nhận thông báo chuyển khoản',
  duplicate_transaction: 'Bỏ qua giao dịch đã xử lý', wrong_amount: 'Số tiền chưa khớp' };

function Status({ value }) {
  return <span className={`admin-badge ${value === 'paid' ? 'admin-ok' : ['pending', 'processing'].includes(value) ? 'admin-warning' : ''}`}>{paymentStatusLabel(value)}</span>;
}

function PaymentDetail({ id, onClose, onChanged }) {
  const resource = useAdminData(`/v1/admin/payments/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(reconcile = false) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (reconcile) await api.post(`/v1/admin/payments/${encodeURIComponent(id)}/reconcile`, {}, { timeout: 20000 });
      else await api.patch(`/v1/admin/payments/${encodeURIComponent(id)}`, { status: confirm, note: note.trim() }, { timeout: 20000 });
      setNotice(reconcile ? 'Đã kiểm tra trạng thái đối soát hiện tại.' : confirm === 'paid' ? 'Đã xác nhận thanh toán và cập nhật quyền lợi.' : 'Đã hủy giao dịch.');
      setConfirm(''); resource.reload(); onChanged();
    } catch (err) { setError(getApiError(err, 'Chưa thể xử lý thanh toán. Vui lòng thử lại.')); }
    finally { setBusy(false); }
  }
  return <FeedbackModal title="Chi tiết thanh toán" onClose={() => { if (!busy) onClose(); }}>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && <p className="feedback-error" role="alert">{error}</p>}
    <LoadState resource={resource}>{({ data: payment }) => <>
      <p className="admin-payment-code">{payment.order_code}</p>
      <dl className="admin-facts">
        <dt>Người thanh toán</dt><dd>{payment.user ? <Link to={`/admin/users/${payment.user._id}`} onClick={onClose}>{payment.user.username}</Link> : 'Tài khoản không còn tồn tại'}</dd>
        <dt>Email</dt><dd>{payment.user?.email ?? '—'}</dd>
        <dt>Gói đã mua</dt><dd>{payment.plan?.name || payment.type || '—'}</dd>
        <dt>Số tiền</dt><dd className="admin-money">{vnd(payment.amount)}</dd>
        <dt>Trạng thái</dt><dd><Status value={payment.status}/></dd>
        <dt>Ngày tạo</dt><dd>{date(payment.created_at)}</dd>
        <dt>Ngày thanh toán</dt><dd>{payment.paid_at ? date(payment.paid_at) : 'Chưa ghi nhận'}</dd>
        <dt>Đối soát gần nhất</dt><dd>{date(payment.verification?.checked_at)}</dd>
        <dt>Xác nhận bằng</dt><dd>{({ sepay_polling: 'Đối soát API SePay', manual: 'Quản trị viên xác nhận', sepay_webhook: 'Thông báo chuyển khoản' })[payment.verification?.source] || 'Chưa xác nhận'}</dd>
        {payment.verification?.provider_order_id && <><dt>Mã đơn SePay</dt><dd>{payment.verification.provider_order_id}</dd></>}
        {payment.note && <><dt>Ghi chú quản trị</dt><dd className="admin-preserve">{payment.note}</dd></>}
      </dl>
      {payment.verification?.available === false && <p className="admin-notice">Lần đối soát gần nhất chưa thành công. Kiểm tra lại với SePay trước khi xác nhận thủ công.</p>}
      {!confirm && <div className="admin-payment-actions">
        {(payment.status === 'processing' || (payment.provider === 'sepay_gateway' && ['pending', 'expired'].includes(payment.status))) && <button disabled={busy} onClick={() => submit(true)}>{busy ? 'Đang kiểm tra…' : payment.status === 'processing' ? 'Hoàn tất cấp quyền' : 'Đối soát với SePay'}</button>}
        {['pending', 'expired'].includes(payment.status) && <>
          <button disabled={busy} onClick={() => { setConfirm('paid'); setError(''); }}>Xác nhận thủ công</button>
          <button className="admin-danger" disabled={busy} onClick={() => { setConfirm('cancelled'); setError(''); }}>Hủy giao dịch</button>
        </>}
      </div>}
      {confirm && <section className="admin-payment-confirm" aria-label="Xác nhận xử lý thanh toán">
        <h3>{confirm === 'paid' ? 'Xác nhận đã nhận tiền?' : 'Hủy giao dịch này?'}</h3>
        <p>{confirm === 'paid' ? `Xác nhận đã nhận ${vnd(payment.amount)} cho đơn ${payment.order_code}. Quyền lợi gói sẽ được cấp cho người dùng.` : `Đơn ${payment.order_code} sẽ được đánh dấu đã hủy. Hãy kiểm tra tiền thực nhận trước khi tiếp tục.`}</p>
        <label>Ghi chú đối soát<textarea maxLength={500} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Thông tin đối chiếu hoặc lý do xử lý"/></label>
        <div className="admin-payment-actions"><button disabled={busy} onClick={() => setConfirm('')}>Quay lại</button><button disabled={busy} className={confirm === 'cancelled' ? 'admin-danger' : ''} onClick={() => submit()}>{busy ? 'Đang xử lý…' : 'Xác nhận xử lý'}</button></div>
      </section>}
      <h3>Lịch sử xử lý</h3>
      {payment.audits?.length ? <ol className="admin-payment-history">{payment.audits.map(entry => <li key={entry._id}><strong>{auditLabels[entry.action] || 'Cập nhật đối soát thanh toán'}</strong><time>{date(entry.created_at)}</time></li>)}</ol> : <p>Chưa có lịch sử xử lý.</p>}
    </>}</LoadState>
  </FeedbackModal>;
}

export default function AdminPayments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = searchParams.get('user') || '';
  const [view, setView] = useState('transactions');
  const [filter, setFilter] = useState({ page: 1, q: '', status: '', range: '', sort: 'created_at', order: 'desc' });
  const [selected, setSelected] = useState('');
  const query = new URLSearchParams({ ...filter, view, ...(userId ? { user_id: userId } : {}) });
  const resource = useAdminData(`/v1/admin/payments?${query}`);
  const change = (key, value) => setFilter(previous => ({ ...previous, [key]: value, page: 1 }));
  function changeView(next) {
    setView(next);
    setFilter(previous => ({ ...previous, page: 1, sort: next === 'users' ? 'paidAmount' : 'created_at' }));
  }
  function showUser(id) { setSearchParams({ user: id }); changeView('transactions'); }
  return <>
    <header className="admin-page-heading"><div><h1>Quản lý thanh toán</h1><p>Theo dõi số tiền, lịch sử mua gói và đối soát giao dịch của người dùng.</p></div><button onClick={resource.reload} disabled={resource.loading}>Làm mới dữ liệu</button></header>
    <div className="admin-payment-views" role="group" aria-label="Chế độ xem thanh toán"><button aria-pressed={view === 'transactions'} onClick={() => changeView('transactions')}>Lịch sử giao dịch</button><button aria-pressed={view === 'users'} onClick={() => changeView('users')}>Theo người dùng</button></div>
    {userId && <p className="admin-notice">Đang xem thanh toán của một người dùng. <button onClick={() => { setSearchParams({}); change('page', 1); }}>Xem tất cả người dùng</button></p>}
    <form className="admin-filters" onSubmit={event => { event.preventDefault(); change('q', String(new FormData(event.currentTarget).get('q')).trim()); }}>
      <label>Tìm thanh toán<input name="q" maxLength={100} placeholder="Mã đơn, tên hoặc email"/></label><button>Tìm kiếm</button>
      <label>Trạng thái<select value={filter.status} onChange={event => change('status', event.target.value)}><option value="">Tất cả trạng thái</option>{['pending', 'processing', 'paid', 'expired', 'cancelled', 'refunded'].map(status => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}</select></label>
      <label>Ngày tạo đơn<select value={filter.range} onChange={event => change('range', event.target.value)}><option value="">Toàn bộ thời gian</option><option value="today">Hôm nay</option><option value="7d">7 ngày gần đây</option><option value="30d">30 ngày gần đây</option><option value="month">Tháng này</option></select></label>
      <label>Sắp xếp<select value={filter.sort} onChange={event => change('sort', event.target.value)}>{(view === 'users' ? [['paidAmount', 'Tổng đã thanh toán'], ['pendingAmount', 'Tiền đang chờ'], ['totalOrders', 'Số đơn'], ['lastPaymentAt', 'Thanh toán gần nhất']] : [['created_at', 'Ngày tạo'], ['updated_at', 'Ngày cập nhật'], ['amount', 'Số tiền'], ['status', 'Trạng thái']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Thứ tự<select value={filter.order} onChange={event => change('order', event.target.value)}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
    </form>
    <LoadState resource={resource}>{result => <>
      <div className="admin-metrics" aria-label="Tổng hợp thanh toán">
        <Metric label="Tổng đã thu" value={vnd(result.summary.paidAmount)} note="Chỉ tính các đơn đã thanh toán"/>
        <Metric label="Số tiền đang chờ" value={vnd(result.summary.pendingAmount)} note={`${number(result.summary.pendingCount)} đơn chờ thanh toán hoặc xác minh`}/>
        <Metric label="Đơn đã thanh toán" value={number(result.summary.paidCount)} note="Giao dịch được xác nhận tự động hoặc thủ công"/>
        <Metric label="Tổng số đơn" value={number(result.summary.totalOrders)} note="Bao gồm đơn chờ, hết hạn, hủy và hoàn tiền"/>
      </div>
      <p className="admin-note">Số liệu tính trên toàn bộ kết quả theo bộ lọc, không chỉ trang đang xem. Lọc thời gian theo ngày tạo đơn.</p>
      <section className="admin-card"><h2>{view === 'users' ? 'Tổng thanh toán theo người dùng' : 'Lịch sử thanh toán'}</h2>
        {!result.data.length ? <p className="admin-empty">Chưa có thanh toán phù hợp.</p> : <div className="admin-table-scroll" tabIndex={0} aria-label={view === 'users' ? 'Thanh toán theo người dùng' : 'Danh sách thanh toán'}>
          {view === 'users' ? <table><thead><tr>{['Người dùng', 'Tổng đã trả', 'Tiền đang chờ', 'Số đơn', 'Thanh toán gần nhất', 'Lịch sử'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.map(item => <tr key={item._id}><td>{item.user ? <Link to={`/admin/users/${item.user._id}`}>{item.user.username}</Link> : 'Tài khoản không còn tồn tại'}<small>{item.user?.email}</small></td><td className="admin-money">{vnd(item.paidAmount)}<small>{item.paidCount} đơn đã thanh toán</small></td><td className="admin-money">{vnd(item.pendingAmount)}</td><td>{item.totalOrders}</td><td>{item.lastPaymentAt ? date(item.lastPaymentAt) : 'Chưa thanh toán'}</td><td><button onClick={() => showUser(item._id)}>Xem lịch sử</button></td></tr>)}</tbody></table>
            : <table><thead><tr>{['Mã đơn', 'Người dùng', 'Gói', 'Số tiền', 'Trạng thái', 'Ngày tạo / thanh toán', 'Đối soát'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.map(item => <tr key={item.id}><td className="admin-payment-code">{item.order_code}</td><td>{item.user ? <Link to={`/admin/users/${item.user._id}`}>{item.user.username}</Link> : 'Tài khoản không còn tồn tại'}<small>{item.user?.email}</small></td><td>{item.plan?.name || item.type || '—'}</td><td className="admin-money">{vnd(item.amount)}</td><td><Status value={item.status}/></td><td>{date(item.created_at)}{item.paid_at && <small>Đã trả: {date(item.paid_at)}</small>}</td><td><button onClick={() => setSelected(item.transaction_id)} aria-label={`Xem thanh toán ${item.order_code}`}>Xem chi tiết</button></td></tr>)}</tbody></table>}
        </div>}
        <Pagination pagination={result.pagination} onChange={page => setFilter(previous => ({ ...previous, page }))}/>
      </section>
    </>}</LoadState>
    {selected && <PaymentDetail id={selected} onClose={() => setSelected('')} onChanged={resource.reload}/>}
  </>;
}
