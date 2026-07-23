import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Gavel, Mic, BookOpen, X, ShieldCheck, User, Users, Zap, LogOut, MessageSquareText, AlertOctagon, Activity, Paperclip, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Hàm tiện ích để giả lập thời gian chờ (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SimulationRoom = () => {
    const navigate = useNavigate();
    const [showCaseFile, setShowCaseFile] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [judgeSentiment, setJudgeSentiment] = useState(65); 
    const [activeSpeakerName, setActiveSpeakerName] = useState('Thẩm phán AI');

    // State mới để chặn bấm nhiều lần khi đang chạy Demo
    const [isRunningDemo, setIsRunningDemo] = useState(false);

    const [logs, setLogs] = useState([
        { time: '10:12', speaker: 'Thẩm phán AI', text: 'Mời Luật sư bào chữa bắt đầu trình bày lập luận mở đầu.' }
    ]);

    const messagesEndRef = useRef(null);

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

    // --- HÀM MỚI: CHẠY DEMO LIÊN HOÀN CÁC ROLE ---
    const runFullDemoSequence = async () => {
        if (isRunningDemo) return; // Nếu đang chạy thì không cho bấm nữa
        setIsRunningDemo(true);
        setLogs([]); // Xóa log cũ cho sạch
        setJudgeSentiment(50); // Đặt lại thái độ HĐXX về mức trung lập

        // 1. Thẩm phán nói
        setActiveSpeakerName('Thẩm phán AI');
        setIsAIThinking(true);
        await sleep(1500); // Thẩm phán nghĩ 1.5s
        setIsAIThinking(false);
        setLogs(prev => [...prev, { time: '10:20', speaker: 'Thẩm phán AI', text: 'Phiên tòa bắt đầu. Đề nghị các bên tập trung vào tài liệu số 04.' }]);
        
        await sleep(3000); // Dừng 3s để người dùng đọc chữ

        // 2. Luật sư (Bạn) nói
        setActiveSpeakerName('Luật sư bào chữa');
        setIsAIThinking(true);
        await sleep(1000); 
        setIsAIThinking(false);
        setLogs(prev => [...prev, { time: '10:21', speaker: 'Luật sư bào chữa', text: 'Kính thưa HĐXX, tôi xin nộp bổ sung chứng cứ ngoại phạm mới cho thân chủ.' }]);
        setJudgeSentiment(60); // Tăng thiện cảm
        
        await sleep(3000); 

        // 3. AI Kiểm sát phản đối
        setActiveSpeakerName('AI Kiểm sát');
        setIsAIThinking(true);
        await sleep(2000); // AI Kiểm sát mất 2s tra cứu luật
        setIsAIThinking(false);
        setLogs(prev => [...prev, { time: '10:22', speaker: 'AI Kiểm sát', text: 'Tôi phản đối! Chứng cứ này chưa qua giám định pháp y theo quy định.' }]);
        setJudgeSentiment(40); // Giảm thiện cảm
        
        await sleep(3000);

        // 4. Thẩm phán ra quyết định
        setActiveSpeakerName('Thẩm phán AI');
        setIsAIThinking(true);
        await sleep(1500); 
        setIsAIThinking(false);
        setLogs(prev => [...prev, { time: '10:23', speaker: 'Thẩm phán AI', text: 'HĐXX chấp nhận phản đối. Yêu cầu luật sư trình bày lập luận khác hợp lệ hơn.' }]);
        
        setIsRunningDemo(false);
    };

    // Hàm gửi tin nhắn bình thường ở ô input
    const handleManualSend = () => {
        if (isRunningDemo) return;
        setLogs([...logs, { time: '10:25', speaker: 'Luật sư bào chữa', text: 'Lập luận mới được gửi lên HĐXX...' }]);
        setActiveSpeakerName('AI Kiểm sát');
        setIsAIThinking(true);
        
        setTimeout(() => {
            setIsAIThinking(false);
            setLogs(prev => [...prev, { time: '10:25', speaker: 'AI Kiểm sát', text: 'Lập luận này hoàn toàn suy diễn.' }]);
            setJudgeSentiment(35);
        }, 2000);
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
            {/* HEADER */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/90 backdrop-blur-md z-20 relative shadow-md">
                <div className="flex items-center gap-4">
                    <Gavel className="w-6 h-6 text-blue-400" />
                    <span className="font-bold text-lg tracking-tight text-white">CourtSim</span>
                    <span className="text-slate-500 text-sm border-l border-slate-800 pl-4">Vụ án số 04/2026</span>
                </div>

                <div className="hidden md:flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-4 py-1.5 rounded-full w-64 relative overflow-hidden group">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Khuynh hướng:</span>
                    <div className="flex-1 h-1.5 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full relative">
                        <motion.div 
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                            animate={{ left: `${judgeSentiment}%` }}
                            transition={{ type: 'spring', stiffness: 100 }}
                            style={{ transform: 'translate(-50%, -50%)' }}
                        />
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
            <div 
                className="flex-1 relative overflow-hidden bg-cover bg-center bg-no-repeat shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"
                style={{ backgroundImage: `url('/nền.jfif')` }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80 z-0"></div>

                <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-10">
                    <CharacterAvatar
                        {...personas.judge}
                        active={activeSpeakerName === personas.judge.name}
                        currentMessage={activeSpeakerName === personas.judge.name ? currentSpokenText : null}
                        isThinking={activeSpeakerName === personas.judge.name && isAIThinking}
                        messagePosition="right" 
                    />
                </div>

                <div className="absolute bottom-[20%] left-[15%] z-10">
                    <CharacterAvatar
                        {...personas.prosecutor}
                        active={activeSpeakerName === personas.prosecutor.name}
                        currentMessage={activeSpeakerName === personas.prosecutor.name ? currentSpokenText : null}
                        isThinking={activeSpeakerName === personas.prosecutor.name && isAIThinking}
                        messagePosition="right"
                    />
                </div>

                <div className="absolute bottom-[20%] right-[15%] z-10">
                    <CharacterAvatar
                        {...personas.defense}
                        active={activeSpeakerName === personas.defense.name}
                        currentMessage={activeSpeakerName === personas.defense.name ? currentSpokenText : null}
                        isThinking={activeSpeakerName === personas.defense.name && isAIThinking}
                        messagePosition="left"
                    />
                </div>
            </div>

            {/* FOOTER */}
            <div className="h-[35vh] min-h-[300px] bg-slate-950 border-t border-slate-800 flex flex-col z-20 relative shadow-[0_-20px_50px_rgba(0,0,0,0.6)]">
                
                <div className="px-6 py-3 border-b border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-900/50">
                    <div className="flex gap-2">
                        {/* NÚT CHẠY DEMO ĐƯỢC THÊM VÀO ĐÂY */}
                        <motion.button 
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={runFullDemoSequence}
                            disabled={isRunningDemo}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                                isRunningDemo 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30'
                            }`}
                        >
                            <PlayCircle className={`w-4 h-4 ${isRunningDemo ? 'animate-spin' : ''}`} /> 
                            {isRunningDemo ? 'Đang chạy...' : 'Demo'}
                        </motion.button>
                        
                        <div className="w-px h-6 bg-slate-700 mx-2 self-center"></div>

                        <motion.button 
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 px-4 py-1.5 rounded-lg text-sm font-black tracking-widest uppercase transition-colors"
                        >
                            <AlertOctagon className="w-4 h-4" /> Phản đối!
                        </motion.button>
                        
                        <button className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                            <Paperclip className="w-4 h-4" /> Đệ trình chứng cứ
                        </button>
                    </div>

                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <MessageSquareText className="w-3 h-3" /> Biên bản
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 font-mono text-sm bg-slate-950/80">
                    {logs.map((log, i) => (
                        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={i} className="mb-2">
                            <span className="text-slate-600">[{log.time}]</span>
                            <span className={`font-bold mx-2 ${log.speaker === personas.judge.name ? 'text-yellow-400' : log.speaker === personas.prosecutor.name ? 'text-red-400' : 'text-blue-400'}`}>{log.speaker}:</span>
                            <span className="text-slate-300 leading-relaxed">{log.text}</span>
                        </motion.p>
                    ))}
                    {isAIThinking && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-500 italic mb-2">
                            Đang xử lý thông tin...
                        </motion.p>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-slate-900 flex items-center gap-4 shrink-0 border-t border-slate-800">
                    <button onClick={() => setIsRecording(!isRecording)} className={`flex-none p-4 rounded-xl transition-all ${isRecording ? 'bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                    <input
                        type="text"
                        placeholder="Nhập lập luận của bạn (Ví dụ: Theo khoản 2 Điều...)"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                        onKeyDown={(e) => e.key === 'Enter' && handleManualSend()}
                        disabled={isRunningDemo}
                    />
                    <button onClick={handleManualSend} disabled={isRunningDemo} className={`flex-none px-8 py-4 rounded-xl font-bold transition-all ${isRunningDemo ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}>
                        Gửi lập luận
                    </button>
                </div>
            </div>
        </div>
    );
};

const CharacterAvatar = ({ role, name, active, icon: Icon, color, currentMessage, messagePosition = 'top', isThinking = false }) => {
    const bubbleVariants = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px]",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-4 w-[280px]", 
        left: "right-full top-1/2 -translate-y-1/2 mr-4 w-[280px]",
        right: "left-full top-1/2 -translate-y-1/2 ml-4 w-[280px]",
    };

    return (
        <div className="flex flex-col items-center gap-2 relative">
            <AnimatePresence mode="wait">
                {active && (isThinking || currentMessage) && (
                    <motion.div
                        key={isThinking ? 'thinking' : 'speaking'}
                        initial={{ opacity: 0, scale: 0.9, y: messagePosition === 'bottom' ? -10 : messagePosition === 'top' ? 10 : 0, x: messagePosition === 'left' ? 10 : messagePosition === 'right' ? -10 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        className={`absolute z-30 ${bubbleVariants[messagePosition]}`}
                    >
                        <div className="bg-slate-900/90 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-slate-700/50">
                            {isThinking ? (
                                <div className="flex gap-1.5 items-center justify-center h-5 px-2">
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-blue-400 rounded-full" />
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed font-sans text-slate-100">{currentMessage}</p>
                            )}
                            
                            <div className={`absolute w-3 h-3 bg-slate-900/90 border-slate-700/50 rotate-45 backdrop-blur-xl ${
                                messagePosition === 'top' ? 'bottom-[-6.5px] left-1/2 -translate-x-1/2 border-b border-r' :
                                messagePosition === 'bottom' ? 'top-[-6.5px] left-1/2 -translate-x-1/2 border-t border-l' :
                                messagePosition === 'left' ? 'right-[-6.5px] top-1/2 -translate-y-1/2 border-t border-r' :
                                'left-[-6.5px] top-1/2 -translate-y-1/2 border-b border-l'
                            }`}></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 relative backdrop-blur-md transition-all ${
                    active ? `border-${color.split('-')[1]}-500 bg-slate-900/80 shadow-[0_0_20px_rgba(0,0,0,0.5)]` : 'border-white/10 bg-slate-900/30'
                }`}
            >
                {active && (
                    <motion.div 
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute inset-[-6px] rounded-full border border-${color.split('-')[1]}-400 blur-sm`}
                    />
                )}
                <Icon className={`w-5 h-5 ${active ? color : 'text-slate-400'}`} />
            </motion.div>
            
            <div className={`text-center px-3 py-1 rounded-full backdrop-blur-md border ${active ? `bg-slate-900/90 border-${color.split('-')[1]}-500/30` : 'bg-slate-900/40 border-white/5'}`}>
                <p className="text-xs font-bold text-white shadow-black drop-shadow-md">{name}</p>
            </div>
        </div>
    );
};

export default SimulationRoom;