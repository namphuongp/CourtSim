import { Link, NavLink } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import CourtSimBrand from './CourtSimBrand';
import UserHeader from './UserHeader';
import './workspaceHeader.css';

export default function WorkspaceHeader() {
  if (getCurrentUser()?.id) return <UserHeader/>;
  return <header className="workspace-public-header"><div><CourtSimBrand/><nav aria-label="Điều hướng CourtSim"><NavLink to="/">Trang chủ</NavLink><NavLink to="/pricing">Bảng giá</NavLink><NavLink to="/guide">Hướng dẫn</NavLink></nav><Link to="/login">Đăng nhập</Link><Link className="workspace-signup" to="/register">Bắt đầu miễn phí</Link></div></header>;
}
