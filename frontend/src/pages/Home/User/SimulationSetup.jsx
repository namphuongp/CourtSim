import React, { useState } from 'react';
import { Gavel, FileText, Upload, Brain, ChevronRight, Scale, Users, ShieldCheck, UserPlus, UserMinus, Briefcase, CheckCircle2, Book } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SimulationSetup = () => {
    const navigate = useNavigate();
    const [judgeStyle, setJudgeStyle] = useState('Chưa chọn');
    const [selectedRole, setSelectedRole] = useState(null); // State mới cho Role
    const [mode, setMode] = useState('upload'); // 'upload' hoặc 'library'
    const [selectedCase, setSelectedCase] = useState(null);
    const roles = [
        { id: 'judge', name: 'Thẩm phán', icon: Gavel },
        { id: 'defense_lawyer', name: 'Luật sư bào chữa', icon: Briefcase },
        { id: 'prosecutor', name: 'Kiểm sát viên', icon: ShieldCheck },
    ];

    const judgeStyles = [
        { id: 'lenient', name: 'Khoan dung', desc: 'Mức độ dễ dành cho người mới làm quen', icon: Users },
        { id: 'balanced', name: 'Cân bằng', desc: 'Mức độ trung bình, phù hợp để luyện tập', icon: Brain },
        { id: 'strict', name: 'Nghiêm khắc', desc: 'Mức độ khó, phù hợp cho người có kinh nghiệm', icon: Scale },
        
        
    ];
    const caseLibrary = [
        { id: 'LIB-001', name: 'Tranh chấp hợp đồng thuê mặt bằng', difficulty: 'Trung bình' },
        { id: 'LIB-002', name: 'Vụ án dân sự: Chia tài sản thừa kế', difficulty: 'Khó' },
        { id: 'LIB-003', name: 'Vi phạm quy định giao thông gây hậu quả', difficulty: 'Dễ' },
    ];
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-white">Thiết lập phiên mô phỏng</h1>
                <p className="text-slate-400 mt-2">Cấu hình vai trò và tham số AI để bắt đầu tranh tụng.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">

                    {/* Step 1: Thông tin vụ án */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            Nguồn dữ liệu vụ án
                        </h3>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 mb-6 bg-slate-950 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('upload')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'upload' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Tải lên file cá nhân
                            </button>
                            <button
                                onClick={() => setMode('library')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'library' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Chọn từ thư viện
                            </button>
                        </div>

                        {mode === 'upload' ? (
                            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-500 hover:border-blue-500/50 transition-colors cursor-pointer">
                                <Upload className="w-8 h-8 mb-2 text-blue-400" />
                                <p>Kéo thả tệp vào đây hoặc nhấn để tải lên</p>
                                <p className="text-xs mt-1">Hỗ trợ PDF, Word (tối đa 20MB)</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {caseLibrary.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedCase(item.id)}
                                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedCase === item.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Book className="w-5 h-5 text-slate-400" />
                                            <div>
                                                <p className="text-sm font-bold text-white">{item.name}</p>
                                                <p className="text-[10px] text-slate-500">Độ khó: {item.difficulty}</p>
                                            </div>
                                        </div>
                                        {selectedCase === item.id && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Step 2: Chọn vai trò (MỚI) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            Chọn vai trò của bạn
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {roles.map((role) => (
                                <div
                                    key={role.id}
                                    onClick={() => setSelectedRole(role.id)}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center ${selectedRole === role.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    <role.icon className={`w-6 h-6 mb-2 ${selectedRole === role.id ? 'text-blue-400' : 'text-slate-400'}`} />
                                    <p className="font-bold text-xs text-white">{role.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 3: AI Judge */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                            Cấu hình AI 
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            {judgeStyles.map((style) => (
                                <div
                                    key={style.id}
                                    onClick={() => setJudgeStyle(style.name)}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${judgeStyle === style.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    <style.icon className="w-6 h-6 text-slate-400 mb-2" />
                                    <p className="font-bold text-sm text-white">{style.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{style.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Tóm tắt */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sticky top-24">
                    <h3 className="font-bold text-white mb-4">Tóm tắt thiết lập</h3>
                    <div className="space-y-3 text-sm text-slate-400">
                        <p>
                            Vụ án:
                            <span className="text-white font-semibold ml-1">
                                {/* Tìm vụ án dựa trên ID đã chọn */}
                                {selectedCase
                                    ? caseLibrary.find(c => c.id === selectedCase)?.name
                                    : 'Chưa chọn'}
                            </span>
                        </p>
                        <p>
                            Vai trò:
                            <span className="text-white font-semibold ml-1">
                                {selectedRole
                                    ? roles.find(r => r.id === selectedRole)?.name
                                    : 'Chưa chọn'}
                            </span>
                        </p>
                        <p>
                            Thẩm phán:
                            <span className="text-white font-semibold ml-1">{judgeStyle}</span>
                        </p>

                        <div className="pt-4 border-t border-slate-400">
                            <button
                                // Điều kiện để bắt đầu: Phải chọn Role VÀ đã chọn Case (hoặc upload)
                                disabled={!selectedRole || !selectedCase}
                                onClick={() => navigate('/simulation', {
                                    state: {
                                        caseId: selectedCase
                                    }
                                })}
                                className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all ${!selectedRole || !selectedCase
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                    }`}
                            >
                                BẮT ĐẦU PHIÊN TÒA <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    </div>
            </div>
        </div>
    );
};

export default SimulationSetup;