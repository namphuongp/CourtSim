import React from 'react';
import { 
  LogOut, LayoutDashboard, Gavel, History, BarChart3, Settings, 
  Search, Bell, User 
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Hướng dẫn sử dụng', icon: Gavel, path: '/guide' },
    { name: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Phiên diễn án', icon: Gavel, path: '/dashboard/sessions' },
    { name: 'Lịch sử', icon: History, path: '/dashboard/history' },
    { name: 'Đánh giá kỹ năng', icon: BarChart3, path: '/dashboard/analytics' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-[#334e68] font-sans flex overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#d9e2ec] flex flex-col justify-between hidden md:flex z-20 relative shadow-[4px_0_24px_rgba(15,43,67,0.04)]">
        <div>
          <div className="h-20 flex items-center px-8 border-b border-slate-800">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <Gavel className="w-6 h-6 text-blue-400" />
              <span className="font-bold text-xl tracking-tighter text-white">
                COURT<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">SIM</span>
              </span>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              // Highlight menu nếu URL hiện tại khớp
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" /> {item.name}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl font-medium transition-all">
            <Settings className="w-5 h-5" /> Cài đặt tài khoản
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:bg-rose-500/10 rounded-xl font-medium transition-all mt-1">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-screen overflow-y-auto">
        {/* Glow effect */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Header */}
        <header className="h-20 border-b border-[#d9e2ec] flex items-center justify-between px-8 bg-white/95 backdrop-blur-md sticky top-0 z-10 shadow-[0_4px_20px_rgba(15,43,67,0.05)]">
          <div className="relative w-96 hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm kiếm vụ án, tài liệu..." 
              className="w-full bg-[#f8fbfe] border border-[#cbdbe7] rounded-full py-2 pl-10 pr-4 text-sm text-[#243b53] placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-full relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>
            <div className="w-px h-6 bg-slate-800"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-blue-500 transition-colors">
                <User className="w-4 h-4 text-slate-300" />
              </div>
              <span className="text-sm font-medium text-white">Người dùng</span>
            </div>
          </div>
        </header>

        {/* NƠI RENDER CÁC TRANG CON */}
        <div className="p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
