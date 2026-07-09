import React from 'react';
import { BarChart3, Target, Brain, MessageSquare, Award, TrendingUp, ShieldCheck } from 'lucide-react';
import { casesData } from '../../../data/mockData';

const Analytics = () => {
  // 1. Lọc các vụ án đã hoàn thành
  const completedCases = casesData.filter(c => c.status === 'Hoàn thành');
  
  // 2. Logic tính trung bình cộng
  const totalSessions = completedCases.length;
  
  const calculateAverage = (key) => {
    if (totalSessions === 0) return 0;
    const sum = completedCases.reduce((acc, curr) => acc + curr.scores[key], 0);
    return (sum / totalSessions).toFixed(1);
  };

  const avgSkills = [
    { name: 'Kiến thức pháp lý', score: calculateAverage('legalKnowledge'), icon: Brain, color: 'bg-violet-500' },
    { name: 'Lập luận & Logic', score: calculateAverage('logic'), icon: MessageSquare, color: 'bg-blue-500' },
    { name: 'Xử lý tình huống', score: calculateAverage('situational'), icon: Target, color: 'bg-emerald-500' },
    { name: 'Khả năng tranh luận', score: calculateAverage('defensive'), icon: TrendingUp, color: 'bg-orange-500' },
  ];

  // Tính điểm tổng thể (Trung bình cộng của tất cả các kỹ năng)
  const totalAvg = ((avgSkills.reduce((acc, curr) => acc + parseFloat(curr.score), 0)) / 4).toFixed(1);

  if (totalSessions === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
        <p className="text-slate-400">Chưa có dữ liệu. Hãy hoàn thành ít nhất một phiên tòa để xem báo cáo đánh giá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Đánh giá kỹ năng tổng hợp</h1>
        <p className="text-slate-400 mt-1 text-sm">Bạn đã hoàn thành {totalSessions} phiên tòa.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Điểm tổng thể */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px]"></div>
          <div className="w-40 h-40 rounded-full border-[8px] border-slate-800 flex items-center justify-center relative mb-4">
             <div className="text-center">
               <span className="text-4xl font-black text-white">{totalAvg}</span>
               <span className="text-sm text-slate-400 block">/100</span>
             </div>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-yellow-500" /> Hiệu suất trung bình
          </h2>
        </div>

        {/* Biểu đồ chi tiết */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" /> Chỉ số thành phần
          </h3>
          
          {avgSkills.map((skill) => (
            <div key={skill.name}>
              <div className="flex justify-between text-sm mb-3">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <skill.icon className={`w-4 h-4 ${skill.color.replace('bg-', 'text-')}`} /> 
                  {skill.name}
                </span>
                <span className="font-bold text-white">{skill.score}/100</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div 
                  className={`${skill.color} h-3 rounded-full transition-all duration-1000`} 
                  style={{ width: `${skill.score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;