import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, UserRound, ShieldCheck, CreditCard, Link2, Settings } from 'lucide-react';
import CourtSimBrand from './CourtSimBrand';
import { LogoutButton } from '../pages/Auth/AccountActions';
import { getCurrentUser } from '../services/auth';
import './userShell.css';
import { memberFeatures } from '../../../shared/membershipPolicy.mjs';
import './membership/membership.css';

const navigation = [['/dashboard', 'Tổng quan'], ['/dashboard/sessions', 'Phiên đang học'], ['/dashboard/history', 'Lịch sử'], ['/dashboard/analytics', 'Đánh giá kỹ năng'], ['/guide', 'Hướng dẫn'], ['/account', 'Tài khoản']];
export default function UserHeader() {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const trigger = useRef(null);
  const location = useLocation();
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!menu.current?.contains(event.target)) setOpen(false); };
    const keyboard = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', keyboard); };
  }, [open]);
  return <header className="user-header"><div className="user-header-inner">
    <div className="user-header-top">
      <CourtSimBrand/>
      <div className="user-header-actions">
        {user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}
        <NavLink to="/account/membership" className="user-header-membership">{memberFeatures(user).name}</NavLink>
        <div className="account-menu" ref={menu}><button ref={trigger} className="account-menu-trigger" aria-expanded={open} aria-controls="account-dropdown" onClick={() => setOpen(value => !value)}><UserRound size={15}/><span>{user?.full_name || 'Tài khoản'}</span><ChevronDown size={13}/></button>{open && <nav id="account-dropdown" className="account-menu-dropdown" aria-label="Menu tài khoản" key={location.pathname}><p className="account-menu-user">{user?.full_name || 'Tài khoản'}</p>{[['/account', 'Hồ sơ cá nhân', UserRound], ['/account/security', 'Bảo mật', ShieldCheck], ['/account/linked', 'Liên kết đăng nhập', Link2], ['/account/membership', 'Gói & lượt luyện tập', CreditCard], ['/privacy', 'Quyền riêng tư', Settings]].map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={16}/>{label}</NavLink>)}<LogoutButton/></nav>}</div><LogoutButton/>
      </div>
    </div>
    <nav aria-label="Điều hướng chính" className="user-navigation">{navigation.map(([path, label]) => <NavLink key={path} to={path} end={path === '/dashboard'} className={({ isActive }) => isActive ? 'active' : undefined}>{label}</NavLink>)}</nav>
  </div></header>;
}
