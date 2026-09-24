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
      <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
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
          <a href="#pricing" className="hover:text-blue-400 transition-colors">Bảng giá</a>
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
          
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
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
                <span className="text-slate-600 ml-4 text-xl font-mono">[In-Session Court Mockup]</span>
                <div className="absolute top-6 left-6 p-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-xs font-mono shadow-sm">Judge: AI Model Strict</div>
                <div className="absolute bottom-6 right-6 p-2 bg-blue-900/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-mono shadow-sm">Witness: Responding...</div>
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

      {/* Pricing Section */}
      <section id="pricing" className="px-8 py-24 max-w-7xl mx-auto scroll-mt-24 relative">
        {/* Glow background for pricing */}
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="text-center mb-16 relative z-10">
          <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Đầu Tư Cho <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">Sự Nghiệp Pháp Lý</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            Lộ trình luyện tập linh hoạt theo nhu cầu học tập của bạn.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-center relative z-10">
          
          {/* TIER 1: FREE */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 border-b border-l border-blue-500/20">
              <Sparkles className="w-3 h-3" /> Ưu đãi ra mắt
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Court Free</h3>
            <p className="text-slate-400 mb-6 min-h-[48px]">Làm quen với AI diễn án, trải nghiệm miễn phí.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-white">Miễn phí</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                '5 phiên tòa/tháng', 
                'Mô hình AI Thẩm phán tiêu chuẩn', 
                'Sử dụng các vụ án mẫu có sẵn',
                'Kết quả phiên tòa và đánh giá kỹ năng cơ bản'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300 text-sm font-medium">
                  <Check className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-transparent border-2 border-slate-700 text-slate-300 font-bold px-6 py-3.5 rounded-xl hover:border-blue-500 hover:text-blue-400 transition-all"
            >
              Bắt đầu ngay
            </button>
          </div>

          {/* TIER 2: PLUS (SWEET SPOT) */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-blue-50 to-violet-50 shadow-[0_18px_48px_rgba(37,99,235,0.14)] flex flex-col relative overflow-hidden transform lg:-translate-y-4 h-full z-10 border border-blue-400 backdrop-blur-xl">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
              Phổ Biến Nhất
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Court Plus</h3>
            <p className="text-slate-600 mb-6 min-h-[48px]">Rèn luyện kỹ năng thực chiến với bộ AI phản biện nâng cao.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-white">199k</span>
              <span className="text-slate-500 font-medium"> / tháng</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                '15 phiên tòa/tháng', 
                'Model AI Thẩm phán nâng cao', 
                'Mở khóa nhập liệu Giọng nói', 
                'Thư viện 20 vụ án thực tế đa dạng',
                'Đánh giá và báo cáo chi tiết sau mỗi phiên tòa'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                  <Check className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-blue-600 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all shadow-lg"
            >
              Đăng ký gói Plus
            </button>
          </div>

          {/* TIER 3: PRO */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col h-full relative">
             <div className="absolute top-[-1px] left-8 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold px-3 py-1 rounded-b-lg tracking-wider">
              ĐỘC QUYỀN: TẢI LÊN HỒ SƠ
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 mt-4">Court Pro</h3>
            <p className="text-slate-400 mb-6 min-h-[48px]">Trải nghiệm đỉnh cao. Phân tích tài liệu thực tế.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-white">499k</span>
              <span className="text-slate-500 font-medium"> / tháng</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                'Không giới hạn phiên (thư viện vụ án)', 
                'Tải lên hồ sơ vụ án riêng (PDF/Word)', 
                'Nhập liệu Giọng nói lên đến 180p/tháng', 
                'Giọng đọc AI (Text-to-Speech) chuẩn', 
                'Xuất Bản án & Báo cáo PDF chuyên nghiệp'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300 text-sm font-medium">
                  <Check className="w-5 h-5 text-violet-400 shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: item.replace('Tải lên hồ sơ vụ án riêng (PDF/Word)', '<strong class="text-white">Tải lên hồ sơ vụ án riêng (PDF/Word)</strong>') }}></span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-transparent border-2 border-slate-700 text-slate-300 font-bold px-6 py-3.5 rounded-xl hover:border-violet-500 hover:text-violet-400 transition-all"
            >
              Đăng ký gói Pro
            </button>
          </div>

        </div>
      </section>

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
