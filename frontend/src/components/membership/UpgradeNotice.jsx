import { Link } from 'react-router-dom';
import './membership.css';

export default function UpgradeNotice({ analytics = false }) {
  return <section className="membership-notice" aria-label="Quyền lợi thành viên">
    <h2>{analytics ? 'Phân tích kỹ năng dành cho Pro' : 'Mở thêm quyền lợi luyện tập'}</h2>
    <p>{analytics ? 'Gói Pro cho phép theo dõi tiến bộ, điểm mạnh và kỹ năng cần cải thiện qua nhiều phiên.' : 'Freemium có mô phỏng và kết quả tổng quan. Mua lượt lẻ, Lite hoặc Pro để sử dụng trợ lý luật và chấm điểm chi tiết.'}</p>
    <div className="membership-actions">{analytics ? <Link to="/checkout/pro">Xem gói Pro</Link> : <><Link to="/checkout/pay-per-use">Mua 1 lượt</Link><Link to="/checkout/lite">Gói Lite</Link></>}<Link to="/pricing">So sánh các gói</Link></div>
  </section>;
}
