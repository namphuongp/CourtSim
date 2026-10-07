import CourtSimBrand from '../../../components/CourtSimBrand';
import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Scale, MessageSquare, ChartNoAxesCombined, Settings, Menu, ClipboardList, CreditCard } from 'lucide-react';
import { LogoutButton } from '../../Auth/AccountActions';
import { getCurrentUser } from '../../../services/auth';
import FeedbackModal from '../../../components/feedback/FeedbackModal';
import './admin.css';
const links = [['/admin', 'Tổng quan', LayoutDashboard], ['/admin/users', 'Người dùng', Users], ['/admin/sessions', 'Phiên tòa', Scale], ['/admin/feedback', 'Góp ý', MessageSquare], ['/admin/payments', 'Thanh toán', CreditCard], ['/admin/ai', 'AI & Chi phí', ChartNoAxesCombined], ['/admin/system', 'Hệ thống', Settings], ['/admin/audit', 'Hoạt động quản trị', ClipboardList]];
function Navigation({ onNavigate }) {
  return <nav aria-label="Điều hướng quản trị">{links.map(([to, label, Icon]) => <NavLink key={to} end={to === '/admin'} to={to} onClick={onNavigate}><Icon size={19} aria-hidden="true"/>{label}</NavLink>)}<Link to="/dashboard" onClick={onNavigate}>Vào luyện tập ↗</Link></nav>;
}
export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  return <div className="admin-shell"><a className="admin-skip" href="#admin-content">Đến nội dung</a><header className="admin-header"><div><button className="admin-menu-toggle" aria-label="Mở menu quản trị" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} aria-hidden="true"/></button><CourtSimBrand/><span className="admin-header-label">Quản trị</span></div><div><span className="admin-account">{getCurrentUser()?.full_name || 'Quản trị viên'}</span><Link to="/account">Tài khoản</Link><LogoutButton/></div></header><aside className="admin-sidebar"><p>QUẢN TRỊ</p><Navigation/></aside><main id="admin-content" className="admin-content"><Outlet/></main>{open && <FeedbackModal title="Menu quản trị" onClose={() => setOpen(false)}><div className="admin-mobile-nav"><Navigation onNavigate={() => setOpen(false)}/></div></FeedbackModal>}</div>;
}
