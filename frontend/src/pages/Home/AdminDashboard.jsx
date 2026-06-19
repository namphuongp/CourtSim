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
    <div className="min-h-screen bg-[#111116] text-[#F4F4F5] font-sans p-8">
      <nav className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/10 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#1B1B25] border border-white/10">
            <ShieldCheck className="w-7 h-7 text-[#C9A84C]" />
          </div>
          <div>
            <p className="uppercase text-2xl font-bold ">Quản trị viên</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#22222B] px-4 py-3 text-sm text-[#E5E7EB] transition hover:bg-[#2f2f39]"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </nav>

      <section className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-3xl border border-white/10 bg-[#16161E] p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#A3A3C2]">Người dùng</p>
              <h2 className="mt-3 text-3xl font-semibold">&mdash;&mdash;</h2>
            </div>
            <Users className="w-10 h-10 text-[#C9A84C]" />
          </div>
          <p className="mt-4 text-sm text-[#8889A0]">Tổng quan số lượng tài khoản người dùng đang hoạt động.</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#16161E] p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#A3A3C2]">Phiên mô phỏng</p>
              <h2 className="mt-3 text-3xl font-semibold">&mdash;&mdash;</h2>
            </div>
            <LayoutDashboard className="w-10 h-10 text-[#C9A84C]" />
          </div>
          <p className="mt-4 text-sm text-[#8889A0]">Tổng quan số lượng phiên mô phỏng đã tạo và quản lý.</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#16161E] p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#A3A3C2]">Báo cáo</p>
              <h2 className="mt-3 text-3xl font-semibold">&mdash;&mdash;</h2>
            </div>
            <BarChart3 className="w-10 h-10 text-[#C9A84C]" />
          </div>
          <p className="mt-4 text-sm text-[#8889A0]">Thông tin tổng quan về các báo cáo và phản hồi nền tảng.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-[#16161E] p-8 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Quản lý tài khoản</h3>
              <p className="mt-2 text-sm text-[#A3A3C2]">Tạo, cập nhật và phân quyền người dùng trên hệ thống.</p>
            </div>
            <Users className="w-8 h-8 text-[#C9A84C]" />
          </div>

          <div className="mt-6 space-y-4">
            <button className="w-full rounded-2xl bg-[#C9A84C] px-5 py-4 text-left font-semibold text-[#111827] transition hover:bg-[#b7a14a]">Xem danh sách người dùng</button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#16161E] p-8 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Kiểm soát mô phỏng</h3>
              <p className="mt-2 text-sm text-[#A3A3C2]">Quản lý dữ liệu phiên tòa, nội dung AI và tình trạng hoạt động.</p>
            </div>
            <BookOpenText className="w-8 h-8 text-[#C9A84C]" />
          </div>

          <div className="mt-6 space-y-4">
            <button className="w-full rounded-2xl border border-white/10 px-5 py-4 text-left text-[#E5E7EB] transition hover:bg-white/5">Cấu hình AI và luật chơi</button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-[#16161E] p-8 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Cài đặt nền tảng</h3>
            <p className="mt-2 text-sm text-[#A3A3C2]">Quản lý cài đặt chung, báo cáo sự cố, và cấu hình phân phối AI.</p>
          </div>
          <Settings2 className="w-8 h-8 text-[#C9A84C]" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-[#111117] p-5">
            <p className="text-sm text-[#A3A3C2]">Tập lệnh AI</p>
            <p className="mt-2 text-2xl font-semibold">--</p>
          </div>
          <div className="rounded-3xl bg-[#111117] p-5">
            <p className="text-sm text-[#A3A3C2]">Báo cáo chờ xử lý</p>
            <p className="mt-2 text-2xl font-semibold">--</p>
          </div>
          <div className="rounded-3xl bg-[#111117] p-5">
            <p className="text-sm text-[#A3A3C2]">Cấu hình hệ thống</p>
            <p className="mt-2 text-2xl font-semibold">--</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;