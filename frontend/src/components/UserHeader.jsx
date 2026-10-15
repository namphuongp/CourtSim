import { NavLink } from 'react-router-dom';
import CourtSimBrand from './CourtSimBrand';
import { LogoutButton } from '../pages/Auth/AccountActions';
import { getCurrentUser } from '../services/auth';
import './userShell.css';
import { memberFeatures } from '../../../shared/membershipPolicy.mjs';
import './membership/membership.css';

const navigation = [['/dashboard', 'Tổng quan'], ['/dashboard/sessions', 'Phiên đang học'], ['/dashboard/history', 'Lịch sử'], ['/dashboard/analytics', 'Đánh giá kỹ năng'], ['/guide', 'Hướng dẫn'], ['/account', 'Tài khoản']];
export default function UserHeader() {
  const user = getCurrentUser();
  return <header className="user-header"><div className="user-header-inner">
    <div className="user-header-top">
      <CourtSimBrand/>
      <div className="user-header-actions">
        {user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}
        <NavLink to="/account/membership" className="user-header-membership">{memberFeatures(user).name}</NavLink>
        <NavLink to="/account" className="user-header-name">{user?.full_name || 'Tài khoản'}</NavLink><LogoutButton/>
      </div>
    </div>
    <nav aria-label="Điều hướng chính" className="user-navigation">{navigation.map(([path, label]) => <NavLink key={path} to={path} end={path === '/dashboard'} className={({ isActive }) => isActive ? 'active' : undefined}>{label}</NavLink>)}</nav>
  </div></header>;
}
