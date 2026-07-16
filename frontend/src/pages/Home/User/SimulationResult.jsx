import React from 'react';
import { Award, FileText, Download, Home, CheckCircle2, AlertTriangle, TrendingUp, BarChart3, Scale } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SimulationResult = () => {
    const navigate = useNavigate();

    // Giả lập dữ liệu điểm số từ AI
    const scores = [
        { label: 'Tư duy Logic & Lập luận', score: 85, color: 'bg-blue-500' },
        { label: 'Trích dẫn & Áp dụng Luật', score: 92, color: 'bg-emerald-500' },
        { label: 'Sức thuyết phục & Tác phong', score: 78, color: 'bg-purple-500' },
        { label: 'Phản biện & Xử lý tình huống', score: 80, color: 'bg-amber-500' },
    ];

    // Variants cho hiệu ứng stagger (hiện tuần tự)
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6 md:p-10 flex flex-col items-center">
            
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-emerald-900/10 rounded-full blur-[100px]"></div>
            </div>

            <motion.div 
                className="w-full max-w-5xl relative z-10 space-y-8"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                {/* HEADER: Tiêu đề & Nút thao tác */}
                <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <p className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-1">Kết thúc mô phỏng</p>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <Scale className="w-8 h-8 text-blue-500" /> Vụ án số 04/2026
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold transition-colors">
                            <FileText className="w-4 h-4 text-slate-400" /> Xem Biên Bản
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold transition-colors">
                            <Download className="w-4 h-4 text-slate-400" /> Tải PDF
                        </button>
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-colors">
                            <Home className="w-4 h-4" /> Về Dashboard
                        </button>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CỘT TRÁI: Phán quyết của Tòa (Verdict) */}
                    <motion.div variants={itemVariants} className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-gradient-to-b from-emerald-900/40 to-slate-900/40 rounded-3xl border border-emerald-500/30 p-8 text-center shadow-[0_0_40px_rgba(16,185,129,0.1)] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
                            
                            <motion.div 
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
                                className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/50"
                            >
                                <Award className="w-10 h-10 text-emerald-400" />
                            </motion.div>
                            
                            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-2">Phán quyết Tòa án</h2>
                            <h3 className="text-3xl font-black text-white mb-4">THẮNG KIỆN</h3>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                HĐXX chấp nhận toàn bộ yêu cầu của Nguyên đơn. Lập luận bào chữa chặt chẽ, chứng minh được hành vi vi phạm hợp đồng dựa trên Điều 428 BLDS 2015.
                            </p>
                        </div>

                        {/* Điểm tổng hợp */}
                        <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm font-bold">Điểm AI Đánh giá</p>
                                <p className="text-3xl font-black text-white mt-1">84<span className="text-lg text-slate-500">/100</span></p>
                            </div>
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                                <BarChart3 className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </motion.div>

                    {/* CỘT PHẢI: Phân tích chi tiết (Analytics & Feedback) */}
                    <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                        
                        {/* Bảng điểm chi tiết (Progress Bars) */}
                        <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" /> Phân tích Kỹ năng Tranh tụng
                            </h3>
                            <div className="space-y-5">
                                {scores.map((item, index) => (
                                    <div key={index}>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-semibold text-slate-300">{item.label}</span>
                                            <span className="text-sm font-bold text-white">{item.score}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.score}%` }}
                                                transition={{ duration: 1.2, delay: 0.5 + (index * 0.1), ease: "easeOut" }}
                                                className={`h-full rounded-full ${item.color}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nhận xét từ AI Mentor */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Điểm mạnh */}
                            <div className="bg-blue-900/10 rounded-3xl border border-blue-500/20 p-6">
                                <h4 className="text-blue-400 font-bold mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" /> Điểm sáng (Strengths)
                                </h4>
                                <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                    <li className="flex gap-2">
                                        <span className="text-blue-500">•</span>
                                        Phát hiện chính xác lỗ hổng trong lời khai của Nhân chứng số 2.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-blue-500">•</span>
                                        Trích dẫn đúng và kịp thời Án lệ số 14/2017/AL.
                                    </li>
                                </ul>
                            </div>

                            {/* Điểm cần cải thiện */}
                            <div className="bg-rose-900/10 rounded-3xl border border-rose-500/20 p-6">
                                <h4 className="text-rose-400 font-bold mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" /> Cần cải thiện (Improvements)
                                </h4>
                                <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                    <li className="flex gap-2">
                                        <span className="text-rose-500">•</span>
                                        Câu hỏi xét hỏi ở phút 12:05 còn rườm rà, tạo cơ hội cho đối phương vòng vo.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-rose-500">•</span>
                                        Nên nhấn mạnh hơn vào thiệt hại thực tế để tăng sức nặng cho yêu cầu bồi thường.
                                    </li>
                                </ul>
                            </div>
                        </div>

                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

export default SimulationResult;