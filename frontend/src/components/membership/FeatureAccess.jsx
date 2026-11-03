import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChartNoAxesCombined, Gavel, Layers } from 'lucide-react';
import useMembership from './useMembership';
import MembershipSummary from './MembershipSummary';

export default function FeatureAccess() {
  const resource = useMembership();
  if (!resource.data || resource.loading || resource.error) return <MembershipSummary resource={resource} />;
  const membership = resource.data;
  const isTrial = Boolean(membership.isTrialActive);
  const credits = Number.isFinite(membership.freeRemaining) && Number.isFinite(membership.caseCredits)
    ? membership.freeRemaining + membership.caseCredits
    : null;

  const cards = [
    [
      BookOpen,
      'Trợ lý tra cứu luật',
      'Tra cứu vấn đề pháp lý, đọc nguồn và đưa trích dẫn vào lập luận trong phiên.',
      membership.legalAssistant
        ? isTrial
          ? 'Đang mở (02 case dùng thử)'
          : 'Có trong gói của bạn'
        : 'Dành cho gói trả phí',
      membership.legalAssistant ? 'Vào phiên luyện tập' : 'Xem gói Pro',
      membership.legalAssistant ? '/dashboard/sessions' : '/checkout/pro'
    ],
    [
      ChartNoAxesCombined,
      'Phân tích kỹ năng nâng cao',
      'Theo dõi tiến bộ, xem điểm mạnh và kỹ năng cần luyện qua các phiên đã được đánh giá.',
      membership.skillAnalytics ? 'Đã mở' : 'Dành riêng cho Pro',
      membership.skillAnalytics ? 'Xem hồ sơ kỹ năng' : 'Xem gói Pro',
      membership.skillAnalytics ? '/dashboard/analytics' : '/checkout/pro'
    ],
    [
      Layers,
      'Lượt luyện tập',
      'Lượt đã mua được dùng trước, sau đó đến lượt miễn phí còn lại. Các phiên đã mở vẫn có thể tiếp tục.',
      membership.unlimitedSessions
        ? 'Không trừ lượt mở phiên'
        : isTrial
        ? `Đã hoàn thành ${membership.completedFreeCases ?? 0}/2 case (${membership.freeRemaining ?? 0} lượt còn lại)`
        : credits === null
        ? 'Chưa có thông tin số lượt'
        : `${credits} lượt còn lại`,
      'Quản lý gói & lượt',
      '/account/membership'
    ],
    [
      Gavel,
      'Phiên mô phỏng theo lượt',
      'Chọn vụ án và vai luật sư, đối đáp với AI, xem lại biên bản và nhận kết quả sau phiên.',
      'Tối đa 20 lượt trình bày mỗi phiên',
      membership.canCreateSession ? 'Thiết lập phiên mới' : 'Tiếp tục phiên đã mở',
      membership.canCreateSession ? '/dashboard/setup' : '/dashboard/sessions'
    ],
  ];

  return (
    <div className="account-feature-grid">
      {cards.map(([Icon, title, text, status, action, to]) => (
        <article key={title} className="account-card account-feature-card">
          <Icon size={25} />
          <p className="account-feature-status">{status}</p>
          <h2>{title}</h2>
          <p>{text}</p>
          <Link to={to}>
            {action}
            <ArrowRight size={15} />
          </Link>
        </article>
      ))}
    </div>
  );
}
