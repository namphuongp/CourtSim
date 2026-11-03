import { Link } from 'react-router-dom';
import './membership.css';

export default function MembershipSummary({ resource }) {
  if (resource.loading) return <section className="membership-summary"><p role="status">Đang kiểm tra quyền lợi và số lượt…</p></section>;
  if (resource.error) return <section className="membership-summary"><p role="alert">{resource.error}</p><button onClick={resource.refresh}>Tải lại quyền lợi</button></section>;
  const membership = resource.data;
  if (!membership) return null;

  const isTrial = Boolean(membership.isTrialActive);
  const completedCases = membership.completedFreeCases ?? 0;

  return (
    <section className="membership-summary" aria-label="Gói và lượt luyện tập">
      <header>
        <h2>Gói {membership.name}</h2>
        <Link to="/pricing">Xem bảng giá</Link>
      </header>

      {membership.unlimitedSessions ? (
        <p>Không trừ lượt mở phiên. Hạn mức AI và tối đa 20 lượt trình bày mỗi phiên vẫn áp dụng.</p>
      ) : isTrial ? (
        <p>
          Dùng thử miễn phí: Còn <strong>{membership.freeRemaining}/{membership.freeLimit}</strong> lượt mở phiên · Đã hoàn thành <strong>{completedCases}/2</strong> case dùng thử.
        </p>
      ) : (
        <p>
          Miễn phí còn {membership.freeRemaining}/{membership.freeLimit} lượt · Lượt đã mua còn {membership.caseCredits ?? 0}.
        </p>
      )}

      {isTrial ? (
        <p className="text-emerald-300">
          ✓ Đang mở khóa trải nghiệm tính năng cốt lõi Pro (Trợ lý Luật & Chấm điểm chi tiết) trong 2 case dùng thử.
        </p>
      ) : (
        <p>
          {membership.legalAssistant ? 'Có trợ lý luật và chấm điểm chi tiết.' : 'Mô phỏng và kết quả tổng quan.'}{' '}
          {membership.skillAnalytics ? 'Có phân tích kỹ năng nâng cao.' : 'Phân tích kỹ năng nâng cao dành riêng cho Pro.'}
        </p>
      )}

      {!membership.canCreateSession && (
        <p role="status" className="font-semibold text-amber-300">
          Bạn đã hoàn thành 02 case dùng thử miễn phí. Nâng cấp lên gói Pro hoặc mua lượt lẻ để tiếp tục mở phiên mới. Các phiên đã mở vẫn có thể tiếp tục.
        </p>
      )}

      <div className="membership-actions">
        {!membership.unlimitedSessions && (
          <>
            <Link to="/checkout/pay-per-use">Mua thêm 1 lượt</Link>
            <Link to="/checkout/lite">Thêm 5 lượt với Lite</Link>
          </>
        )}
        <Link to="/checkout/pro">
          {membership.id === 'pro' || membership.id === 'admin' ? 'Xem quyền lợi Pro' : 'Nâng cấp Pro'}
        </Link>
      </div>
    </section>
  );
}
