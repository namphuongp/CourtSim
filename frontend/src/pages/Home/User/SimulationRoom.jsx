import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Gavel, Mic, BookOpen, X, ShieldCheck, User, Users, Zap, LogOut, MessageSquareText, AlertOctagon, Activity, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SimulationRoom = () => {
    const navigate = useNavigate();
    const [showCaseFile, setShowCaseFile] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    
    // Nâng cấp: Trạng thái AI đang suy nghĩ
    const [isAIThinking, setIsAIThinking] = useState(false);
    
    // Nâng cấp: Thanh thái độ Thẩm phán (0-100). >50 là đang nghiêng về bạn
    const [judgeSentiment, setJudgeSentiment] = useState(65); 

    const [activeSpeakerName, setActiveSpeakerName] = useState('Thẩm phán AI');

    const [logs, setLogs] = useState([
        { time: '10:12', speaker: 'Thẩm phán AI', text: 'Mời Luật sư bào chữa bắt đầu trình bày lập luận mở đầu.' },
        { time: '10:13', speaker: 'Luật sư bào chữa', text: 'Kính thưa HĐXX, thân chủ của tôi hoàn toàn vô tội. Theo khoản 1 Điều 428...' },
    ]);

    // Thêm Ref để tham chiếu đến cuối khung chat
    const messagesEndRef = useRef(null);

    // Thêm Effect để tự động cuộn xuống cuối mỗi khi có log mới hoặc AI đang gõ
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, isAIThinking]);

    const currentSpokenText = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].speaker === activeSpeakerName) return logs[i].text;
        }
        return null;
    }, [logs, activeSpeakerName]);

    const personas = {
        judge: { name: 'Thẩm phán AI', role: 'Thẩm phán', icon: Gavel, color: 'text-yellow-400' },
        prosecutor: { name: 'AI Kiểm sát', role: 'Kiểm sát viên', icon: ShieldCheck, color: 'text-red-400' },
        defense: { name: 'Luật sư bào chữa', role: 'BẠN', icon: User, color: 'text-blue-400' }
    };

    // Hàm giả lập Demo: Khi bạn gửi tin nhắn, AI sẽ "suy nghĩ" rồi mới trả lời
    const handleDemoSend = () => {
        setLogs([...logs, { time: '10:15', speaker: 'Luật sư bào chữa', text: 'Lập luận mới được gửi lên HĐXX...' }]);
        setActiveSpeakerName('AI Kiểm sát');
        setIsAIThinking(true);
        
        // Giả lập sau 3 giây AI tra cứu xong luật
        setTimeout(() => {
            setIsAIThinking(false);
            setLogs(prev => [...prev, { time: '10:15', speaker: 'AI Kiểm sát', text: 'Tôi phản đối! Lập luận này thiếu căn cứ pháp lý.' }]);
            setJudgeSentiment(45); // Tụt điểm thái độ thẩm phán
        }, 3000);
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
            {/* HEADER */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md z-20 relative">
                <div className="flex items-center gap-4">
                    <Gavel className="w-6 h-6 text-blue-400" />
                    <span className="font-bold text-lg tracking-tight text-white">CourtSim</span>
                    <span className="text-slate-600 text-sm border-l border-slate-800 pl-4">Vụ án số 04/2026</span>
                </div>

                {/* Nâng cấp: Thanh Thái độ Thẩm phán (Sentiment Meter) */}
                <div className="hidden md:flex items-center gap-3 bg-slate-900/80 border border-slate-700 px-4 py-1.5 rounded-full w-64 relative overflow-hidden group">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Khuynh hướng HĐXX:</span>
                    <div className="flex-1 h-1.5 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full relative">
                        <motion.div 
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                            animate={{ left: `${judgeSentiment}%` }}
                            transition={{ type: 'spring', stiffness: 100 }}
                            style={{ transform: 'translate(-50%, -50%)' }}
                        />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        AI chấm điểm lập luận: {judgeSentiment}/100
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setShowCaseFile(true)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-xl text-sm border border-slate-800 transition-all">
                        <BookOpen className="w-4 h-4 text-blue-400" /> HỒ SƠ
                    </button>
                    <button onClick={() => navigate('/simulation-result')} className="flex items-center gap-2 bg-rose-900/20 hover:bg-rose-900/40 px-4 py-2 rounded-xl text-sm border border-rose-900/50 text-rose-400 transition-all">
                        <LogOut className="w-4 h-4" /> KẾT THÚC
                    </button>
                </div>
            </header>

            {/* ARENA */}
            <div className="flex-1 grid grid-rows-[1fr_auto_1fr] gap-4 p-6 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                
                {/* Thẩm phán */}
                <div className="flex items-center justify-center relative z-10">
                    <div className="bg-slate-900/80 rounded-3xl border border-slate-800/80 px-10 py-6 flex items-center justify-center relative shadow-2xl backdrop-blur-sm">
                        <CharacterAvatar
                            {...personas.judge}
                            active={activeSpeakerName === personas.judge.name}
                            currentMessage={activeSpeakerName === personas.judge.name ? currentSpokenText : null}
                            isThinking={activeSpeakerName === personas.judge.name && isAIThinking}
                        />
                    </div>
                </div>

                <div className="h-px bg-slate-800/50 my-2 relative">
                    <MessageSquareText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-slate-700 bg-slate-950 p-1.5 rounded-full border border-slate-800" />
                </div>

                {/* Hai bên tranh tụng */}
                <div className="grid grid-cols-2 gap-8 relative z-10">
                    <div className="bg-slate-900/40 rounded-3xl border border-slate-800 p-6 flex items-center justify-center">
                        <CharacterAvatar
                            {...personas.prosecutor}
                            active={activeSpeakerName === personas.prosecutor.name}
                            currentMessage={activeSpeakerName === personas.prosecutor.name ? currentSpokenText : null}
                            isThinking={activeSpeakerName === personas.prosecutor.name && isAIThinking}
                            messagePosition="right" 
                        />
                    </div>
                    <div className="bg-blue-900/10 rounded-3xl border border-blue-500/30 p-6 flex items-center justify-center ring-1 ring-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.05)]">
                        <CharacterAvatar
                            {...personas.defense}
                            active={activeSpeakerName === personas.defense.name}
                            currentMessage={activeSpeakerName === personas.defense.name ? currentSpokenText : null}
                            messagePosition="left"
                        />
                    </div>
                </div>
            </div>

            {/* FOOTER (Đã đổi h-52 thành h-[45vh] để chat box dài hơn) */}
            <div className="h-[35vh] min-h-[300px] bg-slate-900/95 border-t border-slate-800 flex flex-col backdrop-blur-xl z-20 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                
                {/* Action Bar Nâng cấp */}
                <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex gap-2">
                        {/* Nút Phản Đối */}
                        <motion.button 
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 px-4 py-1.5 rounded-lg text-sm font-black tracking-widest uppercase transition-colors"
                        >
                            <AlertOctagon className="w-4 h-4" /> Phản đối!
                        </motion.button>
                        
                        <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                            <Paperclip className="w-4 h-4" /> Đệ trình chứng cứ
                        </button>
                    </div>

                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Biên bản phiên tòa
                    </div>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 font-mono text-sm">
                    {logs.map((log, i) => (
                        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={i} className="mb-2">
                            <span className="text-slate-600">[{log.time}]</span>
                            <span className={`font-bold mx-2 ${log.speaker === personas.judge.name ? 'text-yellow-400' : log.speaker === personas.prosecutor.name ? 'text-red-400' : 'text-blue-400'}`}>{log.speaker}:</span>
                            <span className="text-slate-300 leading-relaxed">{log.text}</span>
                        </motion.p>
                    ))}
                    {/* Hiển thị dòng typing trong log nếu AI đang nghĩ */}
                    {isAIThinking && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-500 italic mb-2">
                           Đang phân tích lập luận và tra cứu án lệ...
                        </motion.p>
                    )}
                    {/* Element ẩn dùng để làm mỏ neo tự động cuộn */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-950 flex items-center gap-4 shrink-0 border-t border-slate-900">
                    <button onClick={() => setIsRecording(!isRecording)} className={`flex-none p-4 rounded-xl transition-all ${isRecording ? 'bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                    <input
                        type="text"
                        placeholder="Nhập lập luận của bạn (Ví dụ: Theo khoản 2 Điều...)"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                        onKeyDown={(e) => e.key === 'Enter' && handleDemoSend()} // Nút Enter để test Demo
                    />
                    <button onClick={handleDemoSend} className="flex-none bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        Gửi lập luận
                    </button>
                </div>
            </div>

            {/* Popup Hồ Sơ... */}
        </div>
    );
};

// --- COMPONENT CHARACTERAVATAR NÂNG CẤP ---
const CharacterAvatar = ({ role, name, active, icon: Icon, color, currentMessage, messagePosition = 'top', isThinking = false }) => {
    
    const bubbleVariants = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px]",
        left: "right-full top-0 mr-6 w-[280px]",
        right: "left-full top-0 ml-6 w-[280px]",
    };

    return (
        <div className="flex flex-col items-center gap-3 relative">
            
            {/* Bóng thoại hoặc Trạng thái đang suy nghĩ */}
            <AnimatePresence mode="wait">
                {active && (isThinking || currentMessage) && (
                    <motion.div
                        key={isThinking ? 'thinking' : 'speaking'}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        className={`absolute z-30 ${bubbleVariants[messagePosition]}`}
                    >
                        <div className="bg-slate-800/95 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700">
                            {isThinking ? (
                                // Hiệu ứng Typing Dots
                                <div className="flex gap-1.5 items-center h-5 px-2">
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                </div>
                            ) : (
                                <p className="text-xs leading-relaxed font-sans text-slate-200">{currentMessage}</p>
                            )}
                            
                            {/* Đuôi bóng thoại */}
                            <div className={`absolute w-3 h-3 bg-slate-800 border-b border-r border-slate-700 rotate-45 ${
                                messagePosition === 'top' ? 'bottom-[-6.5px] left-1/2 -translate-x-1/2' :
                                messagePosition === 'left' ? 'right-[-6.5px] top-4 border-l border-t border-b-0 border-r-0' :
                                'left-[-6.5px] top-4 border-l border-t border-b-0 border-r-0 rotate-[225deg]'
                            }`}></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Avatar Circle */}
            <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center border-4 relative ${active ? `border-${color.split('-')[1]}-500 bg-slate-800` : 'border-slate-800 bg-slate-900'}`}
            >
                {/* Viền sáng bao quanh khi active */}
                {active && (
                    <motion.div 
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute inset-[-8px] rounded-full border-2 border-${color.split('-')[1]}-400 blur-md`}
                    />
                )}
                <Icon className={`w-10 h-10 ${active ? color : 'text-slate-600'}`} />
            </motion.div>
            
            {/* Info */}
            <div className="text-center mt-1">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${active ? color : 'text-slate-500'}`}>{role}</p>
                <p className="text-sm font-bold text-white">{name}</p>
            </div>
        </div>
    );
};

export default SimulationRoom;