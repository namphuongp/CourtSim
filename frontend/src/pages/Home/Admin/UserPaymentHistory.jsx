import { Link } from 'react-router-dom';
import { date, vnd, paymentStatusLabel } from './adminData';

export default function UserPaymentHistory({ userId, payments }) {
  if (!payments) return null;
  const { summary, data } = payments;
  return <section className="admin-card" aria-label="Thanh toán của người dùng">
    <h2>Thanh toán của người dùng</h2>
    <dl className="admin-facts"><dt>Tổng đã thanh toán</dt><dd className="admin-money">{vnd(summary.paidAmount)}</dd><dt>Đang chờ thanh toán</dt><dd className="admin-money">{vnd(summary.pendingAmount)}</dd><dt>Số đơn đã thanh toán</dt><dd>{summary.paidCount} / {summary.totalOrders} đơn</dd></dl>
    {data.length ? <div className="admin-table-scroll" tabIndex={0} aria-label="Giao dịch gần đây của người dùng"><table><thead><tr><th>Mã đơn</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>{data.map(payment => <tr key={payment.id}><td>{payment.order_code}</td><td>{payment.plan?.name || payment.type}</td><td className="admin-money">{vnd(payment.amount)}</td><td>{paymentStatusLabel(payment.status)}</td><td>{date(payment.created_at)}</td></tr>)}</tbody></table></div> : <p>Người dùng chưa có giao dịch thanh toán.</p>}
    <p><Link to={`/admin/payments?user=${userId}`}>Xem toàn bộ lịch sử và đối soát →</Link></p>
  </section>;
}
