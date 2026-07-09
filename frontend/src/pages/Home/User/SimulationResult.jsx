import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BarChart2, MessageSquare, ArrowLeft, RotateCcw } from 'lucide-react';

const SimulationResult = () => {
    const navigate = useNavigate();

    // Dữ liệu giả định (Thực tế bạn sẽ lấy từ API hoặc State)
    const result = {
        score: 85,
        verdict: 'Thắng kiện',
        feedback: 'Bạn đã trình bày rất tốt phần lập luận về Điều 102, tuy nhiên cần cải thiện phản xạ khi đối phương đưa ra bằng chứng mới.',
        skills: [
            { name: 'Kiến thức pháp lý', score: 90 },
            { name: 'Lập luận & Logic', score: 85 },
            { name: 'Xử lý tình huống', score: 80 },
            { name: 'Khả năng đối kháng', score: 88 },
        ]
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-12 text-slate-200">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold text-white">Kết quả phiên tòa</h1>
                    <p className="text-slate-400">Vụ án số 04/2026: Tranh chấp bản quyền phần mềm</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Điểm tổng kết */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center">
                        <div className="w-40 h-40 rounded-full border-[8px] border-blue-600/20 flex items-center justify-center relative mb-4">
                            <span className="text-5xl font-black text-white">{result.score}</span>
                            <span className="absolute bottom-6 text-blue-400 font-bold">/100</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Xếp hạng: Xuất sắc</h3>
                        <p className="text-slate-400 text-sm mt-2">Phán quyết: {result.verdict}</p>
                    </div>

                    {/* Chi tiết kỹ năng */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-blue-400" /> Phân tích kỹ năng
                        </h3>
                        {result.skills.map((skill) => (
                            <div key={skill.name}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">{skill.name}</span>
                                    <span className="font-bold text-white">{skill.score}</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${skill.score}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Feedback AI */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2 mb-4">
                        <MessageSquare className="w-5 h-5 text-yellow-500" /> Nhận xét từ AI Judge
                    </h3>
                    <p className="text-slate-300 italic leading-relaxed">"{result.feedback}"</p>
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-center">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold">
                        <ArrowLeft className="w-4 h-4" /> Về trang chủ
                    </button>
                    <button onClick={() => navigate('/dashboard/setup')} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold">
                        <RotateCcw className="w-4 h-4" /> Bắt đầu phiên mới
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimulationResult;