import React from 'react';
import { LogOut, LayoutDashboard, Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('userToken'); // Xóa token giả lập
    navigate('/'); // Đẩy về Landing Page
  };

  return (
    <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5] font-sans p-8">
      {/* Navbar nội bộ */}
      <nav className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#2A241E] border border-white/5">
             <Gavel className="w-6 h-6 text-[#D9C3A3]" />
          </div>
          <span className="font-bold text-xl tracking-tighter">
            Trang Chủ <span className="text-[#D9C3A3]">Workspace</span>
          </span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-[#A39684] hover:text-[#F2E7D5] transition-colors"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </nav>

      {/* Nội dung chính */}
      <div className="max-w-4xl mx-auto mt-12 text-center space-y-6">
        <LayoutDashboard className="w-16 h-16 text-[#D9C3A3] mx-auto opacity-50" />
        <h1 className="text-3xl font-bold">Chào mừng bạn trở lại!</h1>
        <p className="text-[#A39684]">Đây là không gian làm việc cá nhân của bạn. Tại đây bạn có thể xem lịch sử các vụ án, thống kê kỹ năng và bắt đầu một phiên diễn án mới.</p>
        
        <button 
          onClick={() => navigate('/setup')}
          className="bg-[#D9C3A3] text-[#1A1612] font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all shadow-lg mt-4"
        >
          + TẠO PHIÊN MÔ PHỎNG MỚI
        </button>
      </div>
    </div>
  );
};

export default Dashboard;