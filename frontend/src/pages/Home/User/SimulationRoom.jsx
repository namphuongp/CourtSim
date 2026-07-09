import React, { useState } from 'react';
import { Gavel, Mic, BookOpen, X, ShieldCheck, User, Users, ChevronRight, Zap, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
const SimulationRoom = () => {
    const [showCaseFile, setShowCaseFile] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [activeSpeaker, setActiveSpeaker] = useState('Thẩm phán AI'); // Để biết ai đang nói

    const [logs] = useState([
        { time: '10:12', speaker: 'Thẩm phán AI', text: 'Mời Luật sư bào chữa bắt đầu trình bày...' },
        { time: '10:13', speaker: 'Luật sư bào chữa', text: 'Kính thưa Hội đồng xét xử, thân chủ của tôi hoàn toàn vô tội dựa trên bằng chứng...' },
    ]);
    const navigate = useNavigate();
    return (
        <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
            {/* HEADER: Glassmorphism */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Gavel className="w-6 h-6 text-blue-400" />
                    <span onClick={() => navigate('/dashboard')} className="font-bold text-lg tracking-tight text-white cursor-pointer hover:text-blue-400">CourtSim</span>
                    <span className="text-slate-600 text-sm border-l border-slate-800 pl-4">Vụ án số 04/2026</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCaseFile(true)}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-xl text-sm border border-slate-800 transition-all"
                    >
                        <BookOpen className="w-4 h-4 text-blue-400" /> HỒ SƠ
                    </button>
                    <button
                        onClick={() => navigate('/simulation-result')}
                        className="flex items-center gap-2 bg-rose-900/20 hover:bg-rose-900/40 px-4 py-2 rounded-xl text-sm border border-rose-900/50 text-rose-400 transition-all"
                    >
                        <LogOut className="w-4 h-4" /> KẾT THÚC PHIÊN TÒA
                    </button>
                </div>
            </header>

            {/* ARENA: Sử dụng Grid và hiệu ứng Glow */}
            <div className="flex-1 grid grid-rows-2 gap-4 p-4 relative">
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-yellow-500/5 blur-[100px]"></div>
                    <CharacterAvatar
                        role="Thẩm phán" name="AI THẨM PHÁN" active={activeSpeaker === 'Thẩm phán AI'}
                        icon={Gavel} color="text-yellow-400"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 flex items-center justify-center">
                        <CharacterAvatar role="Kiểm sát viên" name="AI KIỂM SÁT" active={false} />
                    </div>
                    <div className="bg-blue-900/10 rounded-3xl border border-blue-500/30 flex items-center justify-center ring-2 ring-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)]">
                        <CharacterAvatar role="Luật sư bào chữa" name="BẠN" active={true} />
                    </div>
                </div>
            </div>

            {/* FOOTER TRANSCRIPT */}
            <div className="h-48 bg-slate-900/80 border-t border-slate-800 flex flex-col backdrop-blur-md">
                <div className="px-6 py-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
                    Biên bản phiên tòa
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-sm">
                    {logs.map((log, i) => (
                        <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i}>
                            <span className="text-slate-600">[{log.time}]</span>
                            <span className="font-bold text-blue-400 mx-2">{log.speaker}:</span>
                            <span className="text-slate-300">{log.text}</span>
                        </motion.p>
                    ))}
                </div>

                <div className="h-20 bg-slate-950 flex items-center px-6 gap-4">

                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`flex items-center gap-3 px-8 py-3 rounded-xl font-bold transition-all ${isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                        <Mic className="w-5 h-5" /> {isRecording ? 'ĐANG GHI ÂM...' : 'BẤM ĐỂ NÓI'}
                    </button>
                    <input
                        type="text"
                        placeholder="Nhập lập luận của bạn tại đây..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                    />
                    <button
                        className="flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >Gửi</button>
                    <div className="ml-auto flex items-center gap-4 text-slate-500 text-sm">
                        <button className="hover:text-blue-400 transition-colors">Yêu cầu tạm nghỉ</button>
                        <button className="flex items-center gap-1 hover:text-yellow-400 transition-colors">
                            <Zap className="w-4 h-4" /> Gợi ý AI
                        </button>
                    </div>
                </div>
            </div>

            {/* POPUP HỒ SƠ: Glassmorphism */}
            <AnimatePresence>
                {showCaseFile && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-10"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border border-slate-700 w-full max-w-2xl p-8 rounded-3xl shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-white">HỒ SƠ VỤ ÁN: CS-1043</h3>
                                <button onClick={() => setShowCaseFile(false)} className="text-slate-500 hover:text-white"><X /></button>
                            </div>
                            <div className="text-slate-400 space-y-4 text-sm leading-relaxed">
                                <p><strong>Nội dung:</strong> Tranh chấp hợp đồng mua bán...</p>
                                <p><strong>Bằng chứng:</strong> Tệp đính kèm A, B...</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CharacterAvatar = ({ role, name, active }) => (
    <div className="flex flex-col items-center gap-3">
        <motion.div
            animate={{ scale: active ? 1.1 : 1 }}
            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${active ? 'border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 'border-slate-800 bg-slate-800'}`}
        >
            <Users className={`w-10 h-10 ${active ? 'text-blue-400' : 'text-slate-600'}`} />
        </motion.div>
        <div className="text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{role}</p>
            <p className="text-sm font-bold text-white">{name}</p>
        </div>
    </div>
);

export default SimulationRoom;