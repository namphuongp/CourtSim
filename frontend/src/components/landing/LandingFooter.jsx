import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CourtSimBrand from '../CourtSimBrand';

const groups = [
  { title: 'Sản phẩm', links: [
    { label: 'Chọn vụ án', to: '/dashboard/setup' },
    { label: 'Cách học', href: '#how-it-works' },
    { label: 'Kỹ năng luyện tập', href: '#skills' },
    { label: 'Cách nhận góp ý', href: '#feedback' },
  ] },
  { title: 'Hỗ trợ', links: [
    { label: 'Hướng dẫn sử dụng', to: '/guide' },
    { label: 'Câu hỏi thường gặp' },
    { label: 'Liên hệ hỗ trợ' },
    { label: 'Gửi góp ý' },
  ] },
  { title: 'Pháp lý', links: [
    { label: 'Điều khoản sử dụng' },
    { label: 'Chính sách bảo mật' },
    { label: 'Chính sách cookie' },
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
        <div className="landing-footer-social" aria-label="Kết nối với CourtSim">
          {[['f', 'Facebook'], ['in', 'LinkedIn'], ['▶', 'YouTube']].map(([mark, label]) => <FooterLink key={label} label={label} className="landing-social-link"><span aria-hidden="true">{mark}</span></FooterLink>)}
        </div>
      </div>
      {groups.map(group => <nav key={group.title} aria-label={group.title}><h2>{group.title}</h2><ul>{group.links.map(link => <li key={link.label}><FooterLink {...link} /></li>)}</ul></nav>)}
      <div className="landing-footer-note">
        <p id="footer-disclaimer" className="landing-footer-disclaimer">CourtSim phục vụ học tập. Phản hồi AI có thể có sai sót, không thay thế đánh giá chuyên môn hoặc tư vấn pháp lý.</p>
        <a className="landing-footer-top" href="#main-content">Về đầu trang <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </div>
  </footer>;
}
