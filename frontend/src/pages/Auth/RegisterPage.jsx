import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Gavel, User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

const RegisterPage = () => {
    const [formData, setFormData] = useState({ full_name: '', email: '', password: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });
        try {
            const res = await axios.post('http://localhost:5000/api/auth/register', formData);
            setStatus({ type: 'success', message: res.data.message });
        } catch (error) {
            setStatus({
                type: 'error',
                message: error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại!'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5] font-sans flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[#D9C3A3]/5 blur-3xl rounded-full translate-x-1/3 translate-y-1/3"></div>

            <div className="relative w-full max-w-md bg-[#2A241E] border border-white/5 rounded-3xl p-8 shadow-2xl transition-all">
                {/* Logo / Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="p-3.5 rounded-2xl bg-[#1A1612] border border-white/5 shadow-inner mb-4">
                        <Gavel className="w-8 h-8 text-[#D9C3A3]" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#F2E7D5] font-serif">
                        COURT <span className="text-[#D9C3A3]">SIM</span>
                    </h2>
                    <p className="text-sm text-[#A39684] mt-2">Gia nhập nền tảng mô phỏng diễn án AI đầu tiên</p>
                </div>

                {/* Status Message */}
                {status.message && (
                    <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 text-sm border ${status.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span>{status.message}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Họ và Tên */}
                    <div> {/* Bỏ space-y đi để tự kiểm soát */}
                        <label className="block text-xs font-semibold text-[#A39684] uppercase tracking-wider mb-2.5">Họ và Tên</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#A39684]">
                                <User className="w-5 h-5" />
                            </span>
                            <input
                                type="text"
                                name="full_name"
                                onChange={handleChange}
                                required
                                placeholder="Họ và tên của bạn"
                                className="w-full bg-[#1A1612] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-[#F2E7D5] placeholder-[#A39684]/50 focus:outline-none focus:border-[#D9C3A3] focus:ring-1 focus:ring-[#D9C3A3] transition-all"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold text-[#A39684] uppercase tracking-wider mb-2.5">Email liên hệ</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#A39684]">
                                <Mail className="w-5 h-5" />
                            </span>
                            <input
                                type="email"
                                name="email"
                                onChange={handleChange}
                                required
                                placeholder="name@example.com"
                                className="w-full bg-[#1A1612] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-[#F2E7D5] placeholder-[#A39684]/50 focus:outline-none focus:border-[#D9C3A3] focus:ring-1 focus:ring-[#D9C3A3] transition-all"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu */}
                    <div>
                        <label className="block text-xs font-semibold text-[#A39684] uppercase tracking-wider mb-2.5">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#A39684]">
                                <Lock className="w-5 h-5" />
                            </span>
                            <input
                                type="password"
                                name="password"
                                onChange={handleChange}
                                required
                                placeholder="••••••••"
                                className="w-full bg-[#1A1612] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-[#F2E7D5] placeholder-[#A39684]/50 focus:outline-none focus:border-[#D9C3A3] focus:ring-1 focus:ring-[#D9C3A3] transition-all"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#D9C3A3] text-[#1A1612] font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg text-sm tracking-wide mt-2"
                    >
                        {loading ? 'Đang khởi tạo...' : 'TẠO TÀI KHOẢN'}
                    </button>

                    {/* Navigation Link */}
                    <p className="text-center text-sm text-[#A39684] mt-6">
                        Đã có tài khoản?{' '}
                        <Link to="/login" className="text-[#D9C3A3] font-semibold hover:underline transition-all">
                            Đăng nhập tại đây
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default RegisterPage;