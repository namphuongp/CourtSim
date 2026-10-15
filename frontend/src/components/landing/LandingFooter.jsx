import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CourtSimBrand from '../CourtSimBrand';

const groups = [
  { title: 'Sản phẩm', links: [
    { label: 'Chọn vụ án', to: '/dashboard/setup' },
    { label: 'Cách học', href: '#workflow' },
    { label: 'Kỹ năng luyện tập', href: '#features' },
    { label: 'Cách nhận góp ý', to: '/guide#scoring' },
  ] },
  { title: 'Hỗ trợ', links: [
    { label: 'Hướng dẫn sử dụng', to: '/guide' },
    { label: 'Câu hỏi thường gặp', to: '/guide#faq' },
    { label: 'Hỗ trợ khi gặp lỗi', to: '/guide#support' },
    { label: 'Gửi góp ý', to: '/guide#feedback' },
  ] },
  { title: 'Thông tin sử dụng', links: [
    { label: 'Phạm vi sử dụng', to: '/guide#usage' },
    { label: 'Dữ liệu cá nhân', to: '/guide#privacy' },
    { label: 'Cookie và bản nháp', to: '/guide#cookies' },
    { label: 'Lưu ý sử dụng', href: '#footer-disclaimer' },
  ] },
];

function FooterLink({ label, to, href, children, className = '' }) {
  if (to) return <Link className={className} to={to}>{children || label}</Link>;
  if (href) return <a className={className} href={href}>{children || label}</a>;
  // Mục chờ nội dung vẫn có ngữ nghĩa liên kết, không điều hướng đến URL giả.
  return <a className={className} role="link" aria-disabled="true" tabIndex={0} aria-label={label} title={`${label} — Sắp cập nhật`}>{children || label}</a>;
}

export default function LandingFooter() {
  return <footer className="landing-footer">
    <div className="landing-container landing-footer-grid">
      <div className="landing-footer-about">
        <CourtSimBrand />
        <p className="landing-footer-copyright">© {new Date().getFullYear()} CourtSim.<br />Bảo lưu mọi quyền.</p>
      </div>
      {groups.map(group => <nav key={group.title} aria-label={group.title}><h2>{group.title}</h2><ul>{group.links.map(link => <li key={link.label}><FooterLink {...link} /></li>)}</ul></nav>)}
      <div className="landing-footer-note">
        <p id="footer-disclaimer" className="landing-footer-disclaimer">CourtSim phục vụ học tập. Phản hồi AI có thể có sai sót, không thay thế đánh giá chuyên môn hoặc tư vấn pháp lý.</p>
        <a className="landing-footer-top" href="#main-content">Về đầu trang <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </div>
  </footer>;
}
