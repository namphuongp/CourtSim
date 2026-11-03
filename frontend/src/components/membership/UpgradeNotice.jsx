import { Link } from 'react-router-dom';
import './membership.css';

export default function UpgradeNotice({ analytics = false }) {
  return (
    <section className="membership-notice" aria-label="Quyền lợi thành viên">
      <h2>{analytics ? 'Phân tích kỹ năng nâng cao (Dành riêng cho Pro)' : 'Tiếp tục luyện tập cùng CourtSim'}</h2>
      <p>
        {analytics
          ? 'Tính năng Phân tích kỹ năng nâng cao và Biểu đồ tiến bộ dài hạn qua nhiều phiên là tính năng đặc thù dành riêng cho gói Pro (không nằm trong phạm vi 02 case dùng thử ban đầu).'
          : 'Bạn đã hoàn tất 02 case dùng thử miễn phí (được mở khóa đầy đủ Trợ lý Luật và Chấm điểm chi tiết). Hãy chọn gói lượt lẻ hoặc gói thành viên để tiếp tục mở phiên và theo dõi năng lực.'}
      </p>
      <div className="membership-actions">
        {analytics ? (
          <Link to="/checkout/pro">Nâng cấp gói Pro</Link>
        ) : (
          <>
            <Link to="/checkout/pay-per-use">Mua 1 lượt</Link>
            <Link to="/checkout/lite">Gói Lite (5 case)</Link>
            <Link to="/checkout/pro">Gói Pro</Link>
          </>
        )}
        <Link to="/pricing">So sánh các gói</Link>
      </div>
    </section>
  );
}
