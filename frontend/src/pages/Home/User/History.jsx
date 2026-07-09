import React, { useState } from 'react';
import { History as HistoryIcon, Search, FileText, AlertCircle } from 'lucide-react';
import { casesData } from '../../../data/mockData';

const History = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Tất cả trạng thái');

  // Lọc dữ liệu dựa trên ô tìm kiếm và dropdown
  const filteredCases = casesData.filter(c => {
    if (c.status === 'Đang xử') return false; // Chỉ lấy phiên đã kết thúc
    
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Tất cả trạng thái' || c.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lịch sử vụ án</h1>
        <p className="text-slate-400 mt-1 text-sm">Xem lại hồ sơ, kết quả và bản án của các phiên đã hoàn thành.</p>
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Tìm theo mã vụ án, tên..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option>Tất cả trạng thái</option>
          <option>Hoàn thành</option>
          <option>Đã hủy</option>
        </select>
      </div>

      {/* Render Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
        {filteredCases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-5">Mã Vụ Án</th>
                  <th className="px-6 py-5">Tên Vụ Án</th>
                  <th className="px-6 py-5">Ngày Xử</th>
                  <th className="px-6 py-5">Điểm Đánh Giá</th>
                  <th className="px-6 py-5">Trạng Thái</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                    <td className="px-6 py-4 text-slate-400">{c.date}</td>
                    <td className="px-6 py-4">
                      {c.score ? (
                         <span className="font-bold text-violet-400">{c.score}/10</span>
                      ) : (
                         <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        c.status === 'Hoàn thành' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-all hover:bg-blue-500/20">
                        <FileText className="w-4 h-4"/> Xem Báo Cáo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
            <p>Không tìm thấy kết quả phù hợp với yêu cầu tìm kiếm.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;