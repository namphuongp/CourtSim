import { Link } from 'react-router-dom';
import './membership.css';

export default function MembershipSummary({ resource }) {
  if (resource.loading) return <section className="membership-summary"><p role="status">Đang kiểm tra quyền lợi và số lượt…</p></section>;
  if (resource.error) return <section className="membership-summary"><p role="alert">{resource.error}</p><button onClick={resource.refresh}>Tải lại quyền lợi</button></section>;
  const membership = resource.data;
  if (!membership) return null;
  return <section className="membership-summary" aria-label="Gói và lượt luyện tập">
    <header><h2>Gói {membership.name}</h2><Link to="/#pricing">Xem bảng giá</Link></header>
    <p>{membership.unlimitedSessions ? 'Không trừ lượt mở phiên. Hạn mức AI và tối đa 20 lượt trình bày mỗi phiên vẫn áp dụng.' : `Miễn phí còn ${membership.freeRemaining}/${membership.freeLimit} lượt · Lượt đã mua còn ${membership.caseCredits}`}</p>
    <p>{membership.legalAssistant ? 'Có trợ lý luật và chấm điểm chi tiết.' : 'Mô phỏng và kết quả tổng quan.'} {membership.skillAnalytics ? 'Có phân tích kỹ năng nâng cao.' : 'Phân tích kỹ năng nâng cao dành cho Pro.'}</p>
    {!membership.canCreateSession && <p role="status">Đã hết lượt mở phiên mới. Bạn vẫn có thể tiếp tục các phiên đã mở và xem lịch sử.</p>}
    <div className="membership-actions">{!membership.unlimitedSessions && <><Link to="/checkout/pay-per-use">Mua thêm 1 lượt</Link><Link to="/checkout/lite">Thêm 5 lượt với Lite</Link></>}<Link to="/checkout/pro">{membership.id === 'pro' || membership.id === 'admin' ? 'Xem quyền lợi Pro' : 'Nâng cấp Pro'}</Link></div>
  </section>;
}
