import React from 'react';
import { Plus, Scale, BarChart3, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userStats, casesData } from '../../../data/mockData'; // Import dữ liệu (chỉnh đường dẫn cho đúng)

const Dashboard = () => {
  const navigate = useNavigate();
  // Lấy 3 vụ án mới nhất cho màn hình Dashboard
  const recentCases = casesData.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-blue-600">Không gian luyện tập của bạn</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Rèn tư duy pháp lý, từng lượt một</h1>
          <p className="text-slate-400 mt-1 text-sm">Chọn một hồ sơ, xây dựng lập luận và nhận phản hồi để cải thiện kỹ năng tranh tụng.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/setup')} 
          className="flex items-center gap-2 bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all text-sm"
        >          <Plus className="w-5 h-5" /> TẠO PHIÊN MỚI
        </button>
      </div>

      {/* Render số liệu từ mockData */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <Scale className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase">Phiên đã luyện</p>
            <p className="text-2xl font-bold text-white mt-1">{userStats.totalCases}</p>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20">
            <BarChart3 className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase">Điểm tự đánh giá</p>
            <p className="text-2xl font-bold text-white mt-1">{userStats.skillScore}/10</p>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <Clock className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase">Thời gian luyện tập</p>
            <p className="text-2xl font-bold text-white mt-1">{userStats.practiceHours}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-white">Phiên luyện tập gần đây</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu minh hoạ sẽ được thay bằng lịch sử học tập của bạn.</p></div>
          <button onClick={() => navigate('/dashboard/history')} className="text-sm text-blue-400 font-medium hover:underline flex items-center">
            Xem tất cả <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Mã Vụ Án</th>
                <th className="px-6 py-4">Tên Vụ Án</th>
                <th className="px-6 py-4">Vai Trò</th>
                <th className="px-6 py-4">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recentCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400">{c.id}</td>
                  <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                  <td className="px-6 py-4 text-slate-400">{c.role}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${c.status === 'Hoàn thành' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        c.status === 'Đang xử' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
