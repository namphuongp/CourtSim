import React from 'react';
import { Gavel, Users, Scale, BarChart3, BookOpenText, Target, UserCheck, Settings, Zap, History, FolderDot, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Scale,
      title: "LUYỆN TẬP CÓ HƯỚNG DẪN",
      description: "Chọn hồ sơ, vai tranh tụng và mức độ phản biện phù hợp với trình độ của bạn."
    },
    {
      icon: Users,
      title: "THỰC HÀNH TRANH TỤNG",
      description: "Trình bày lập luận, nhận phản biện và rèn cách sử dụng chứng cứ theo từng lượt."
    },
    {
      icon: Zap,
      title: "PHẢN HỒI CÓ CẤU TRÚC",
      description: "Nhận góp ý về lập luận, chứng cứ và kỹ năng trình bày sau khi hoàn thành phiên học."
    },
    {
      icon: History,
      title: "THEO DÕI TIẾN BỘ",
      description: "Xem lại các phiên đã học và xác định kỹ năng cần cải thiện ở lần luyện tập sau."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30 scroll-smooth">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 py-4 gap-3 flex-wrap border-b border-slate-800 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 shadow-sm">
             <Gavel className="w-7 h-7 text-blue-400" />
          </div>
          <span className="font-bold text-2xl tracking-tighter text-white">
            COURT<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">SIM</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
          <a href="#about" className="hover:text-blue-400 transition-colors">Về chúng tôi</a>
          <a href="#features" className="hover:text-blue-400 transition-colors">Tính năng</a>
          <a href="#pricing" className="hover:text-blue-400 transition-colors">Bắt đầu học</a>
        </div>

        <button 
          onClick={() => navigate('/auth')}
          className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 transition-all text-sm"
        >
          DÙNG THỬ MIỄN PHÍ
        </button>
      </nav>

      {/* Hero Section */}
      <section id="about" className="px-8 py-20 md:py-32 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative">
        {/* Glow background */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-sm font-medium text-blue-400">
            <Target className="w-4 h-4" />
            <span>Không gian thực hành pháp lý dành cho người học</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
            HỌC TRANH TỤNG <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              SỬ DỤNG TRÍ TUỆ NHÂN TẠO
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
             Luyện lập luận pháp lý trong môi trường mô phỏng an toàn: đọc hồ sơ, bảo vệ quan điểm, nhận phản biện và tự đánh giá tiến bộ.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-4">
            <button 
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto bg-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:-translate-y-1 transition-all text-base flex items-center justify-center gap-2"
            >
               BẮT ĐẦU LUYỆN TẬP <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mockup/Image area */}
        <div className="relative group z-10">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-violet-500 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
          <div className="relative aspect-[16/10] bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden p-3">
             <div className="absolute top-0 left-0 right-0 h-8 bg-black/40 flex items-center px-4 gap-2 border-b border-slate-800 z-10">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
             </div>
             <div className="w-full h-full mt-5 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 relative shadow-inner">
                <Users className="w-20 h-20 text-slate-800" />
                <span className="text-slate-600 m-4 text-sm">Đọc hồ sơ → Tranh luận → Nhận góp ý</span>
                <div className="absolute top-6 left-6 p-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-xs font-mono shadow-sm">Thẩm phán điều hành trung lập</div>
                <div className="absolute bottom-6 right-6 p-2 bg-blue-900/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-mono shadow-sm">Minh họa luồng học tập</div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-8 py-24 bg-slate-900/50 border-y border-slate-800 scroll-mt-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="text-4xl font-extrabold text-center text-white mb-16 tracking-tight">
            Nâng Tầm Kỹ Năng Cùng <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">CourtSim</span>
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg hover:border-blue-500/50 hover:bg-slate-800/50 hover:-translate-y-1 transition-all group space-y-5 flex flex-col items-start">
                <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white pt-2 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
                  {feature.title}
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm flex-grow">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-5 py-16 text-center"><h2 className="text-3xl font-bold">Bắt đầu với hồ sơ mẫu</h2><p className="my-5 text-slate-400">Bản hiện tại hỗ trợ tranh tụng bằng văn bản, đánh giá và lịch sử học tập. Gói trả phí, giọng nói và tải hồ sơ riêng chưa được cung cấp.</p><button onClick={() => navigate('/register')} className="rounded-xl bg-blue-600 px-6 py-3">Tạo tài khoản luyện tập</button></section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 bg-slate-950 text-center text-slate-500 text-sm">
        <div className="flex justify-center items-center gap-2 mb-4">
           <Gavel className="w-5 h-5 text-blue-500" />
           <span className="font-bold text-lg tracking-tighter text-white">
             COURT<span className="text-blue-500">SIM</span>
           </span>
        </div>
        <p>© 2026 COURT SIM. Công cụ hỗ trợ học tập, không thay thế tư vấn pháp lý chuyên môn.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
