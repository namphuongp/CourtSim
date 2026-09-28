import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Gavel, LogOut } from 'lucide-react';
import { clearAuth, getCurrentUser } from '../../../services/auth';

const navigation = [['/dashboard', 'Tổng quan'], ['/dashboard/sessions', 'Phiên đang học'], ['/dashboard/history', 'Lịch sử'], ['/dashboard/analytics', 'Đánh giá kỹ năng'], ['/guide', 'Hướng dẫn']];
export default function DashboardLayout() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  return <div className="min-h-screen bg-slate-950 text-slate-300">
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><NavLink to="/dashboard" className="flex items-center gap-2 text-xl font-bold text-white"><Gavel className="text-blue-400" /> COURTSIM</NavLink><div className="flex items-center gap-4"><span className="text-sm">{user?.full_name ?? 'Người học'}</span><button onClick={() => { clearAuth(); navigate('/login'); }} className="flex items-center gap-2 text-rose-400"><LogOut size={18} /> Đăng xuất</button></div></div>
      <nav aria-label="Điều hướng chính" className="mx-auto mt-4 flex max-w-7xl flex-wrap gap-2">{navigation.map(([path, label]) => <NavLink end={path === '/dashboard'} key={path} to={path} className={({ isActive }) => `rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-800'}`}>{label}</NavLink>)}</nav>
    </header>
    <main className="mx-auto max-w-7xl p-4 sm:p-8"><Outlet /></main>
  </div>;
}
