import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

const LoginPage = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            localStorage.setItem('userToken', res.data.token);
            localStorage.setItem('userRole', res.data.user.role || 'user');

            setStatus({ type: 'success', message: `Chào mừng ${res.data.user.full_name} đã đăng nhập thành công!` });

            const redirectPath = res.data.user.role === 'admin' ? '/admin' : '/dashboard';
            setTimeout(() => navigate(redirectPath), 1000);
        } catch (error) {
            setStatus({
                type: 'error',
                message: error.response?.data?.message || 'Đăng nhập thất bại. Sai tài khoản hoặc mật khẩu!'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5] font-sans flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[#D9C3A3]/5 blur-3xl rounded-full -translate-x-1/3 -translate-y-1/3"></div>

            <div className="relative w-full max-w-md bg-[#2A241E] border border-white/5 rounded-3xl p-8 shadow-2xl transition-all">
                {/* Logo / Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="p-3.5 rounded-2xl bg-[#1A1612] border border-white/5 shadow-inner mb-4">
                        <Gavel className="w-8 h-8 text-[#D9C3A3]" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#F2E7D5] font-serif">
                        ĐĂNG NHẬP <span className="text-[#D9C3A3]">COURT SIM</span>
                    </h2>
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
                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold text-[#A39684] uppercase tracking-wider mb-2.5">Email</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#A39684]">
                                <Mail className="w-5 h-5" />
                            </span>
                            <input
                                type="email"
                                name="email"
                                onChange={handleChange}
                                required
                                placeholder="admin@gmail.com"
                                className="w-full bg-[#1A1612] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-[#F2E7D5] placeholder-[#A39684]/50 focus:outline-none focus:border-[#D9C3A3] focus:ring-1 focus:ring-[#D9C3A3] transition-all"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-semibold text-[#A39684] uppercase tracking-wider mb-2.5">Password</label>
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
                        {loading ? 'Đang chứng thực...' : 'VÀO PHIÊN TÒA'}
                    </button>

                    {/* Navigation Link */}
                    <p className="text-center text-sm text-[#A39684] mt-6">
                        Bạn chưa có tài khoản?{' '}
                        <Link to="/register" className="text-[#D9C3A3] font-semibold hover:underline transition-all">
                            Đăng ký ngay
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;