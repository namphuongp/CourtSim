import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, ShieldCheck, BarChart3, Settings2, LayoutDashboard, BookOpenText } from 'lucide-react';

function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <nav className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6 mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <ShieldCheck className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <p className="uppercase text-2xl font-black text-white tracking-tight">
              Quản trị <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">viên</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white shadow-sm"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          Đăng xuất
        </button>
      </nav>

      {/* Stats Section */}
      <section className="grid gap-6 md:grid-cols-3 mb-8 relative z-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Người dùng</p>
              <h2 className="mt-3 text-3xl font-bold text-white">&mdash;&mdash;</h2>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Tổng quan số lượng tài khoản người dùng đang hoạt động.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Phiên mô phỏng</p>
              <h2 className="mt-3 text-3xl font-bold text-white">&mdash;&mdash;</h2>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <LayoutDashboard className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Tổng quan số lượng phiên mô phỏng đã tạo và quản lý.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Báo cáo</p>
              <h2 className="mt-3 text-3xl font-bold text-white">&mdash;&mdash;</h2>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Thông tin tổng quan về các báo cáo và phản hồi nền tảng.</p>
        </div>
      </section>

      {/* Actions Section */}
      <section className="grid gap-6 lg:grid-cols-2 relative z-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Quản lý tài khoản</h3>
              <p className="mt-2 text-sm text-slate-400">Tạo, cập nhật và phân quyền người dùng trên hệ thống.</p>
            </div>
            <Users className="w-6 h-6 text-slate-500" />
          </div>

          <div className="mt-8">
            <button className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-center font-bold text-white transition hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              Xem danh sách người dùng
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Kiểm soát mô phỏng</h3>
              <p className="mt-2 text-sm text-slate-400">Quản lý dữ liệu phiên tòa, nội dung AI và tình trạng hoạt động.</p>
            </div>
            <BookOpenText className="w-6 h-6 text-slate-500" />
          </div>

          <div className="mt-8">
            <button className="w-full rounded-2xl border-2 border-slate-800 bg-slate-950 px-5 py-3.5 text-center font-bold text-slate-300 transition hover:border-blue-500 hover:text-blue-400">
              Cấu hình AI và luật chơi
            </button>
          </div>
        </div>
      </section>

      {/* Platform Settings Section */}
      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl relative z-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Cài đặt nền tảng</h3>
            <p className="mt-1 text-sm text-slate-400">Quản lý cài đặt chung, báo cáo sự cố, và cấu hình phân phối AI.</p>
          </div>
          <Settings2 className="w-6 h-6 text-slate-500" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 border border-slate-800/60 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tập lệnh AI</p>
            <p className="mt-2 text-2xl font-bold text-white">--</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800/60 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Báo cáo chờ xử lý</p>
            <p className="mt-2 text-2xl font-bold text-white">--</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800/60 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cấu hình hệ thống</p>
            <p className="mt-2 text-2xl font-bold text-white">--</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;