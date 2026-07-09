import React from 'react';
import { Gavel, Play, Plus } from 'lucide-react';
import { casesData } from '../../../data/mockData';
import { useNavigate } from 'react-router-dom';
const Sessions = () => {
  // Lọc ra các phiên đang xử
  const activeSessions = casesData.filter(c => c.status === 'Đang xử');
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Phiên diễn án</h1>
          <p className="text-slate-400 mt-1 text-sm">Quản lý và tiếp tục các phiên tòa đang xử hoặc tạo mới.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/setup')}
          className="flex items-center gap-2 bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-blue-500 transition-all text-sm">
          <Plus className="w-4 h-4" /> TẠO PHIÊN
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Render danh sách đang xử */}
        {activeSessions.map(session => (
          <div key={session.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group flex flex-col">
            <div className="absolute top-0 right-0 p-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Đang xử
              </span>
            </div>
            <Gavel className="w-10 h-10 text-slate-500 mb-4" />
            <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{session.name}</h3>
            <p className="text-slate-500 text-xs font-mono mb-3">{session.id}</p>
            <p className="text-slate-400 text-sm mb-6 flex-grow">Thẩm phán: {session.judge}</p>
            <button className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-semibold py-3 rounded-xl group-hover:bg-blue-600 transition-colors">
              <Play className="w-4 h-4" /> Tiếp tục tranh tụng
            </button>
          </div>
        ))}

        {/* Nút Khởi tạo phiên mới luôn nằm ở cuối */}
        <div
          onClick={() => navigate('/dashboard/setup')}
          className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-900 hover:border-slate-700 transition-all min-h-[240px]">
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-white">Tạo phiên mới</p>
          <p className="text-slate-500 text-sm mt-1">Chọn từ thư viện vụ án hoặc tải lên hồ sơ.</p>
        </div>
      </div>
    </div>
  );
};

export default Sessions;