import React from 'react';
import { Gavel, Users, Scale, BarChart3, BookOpenText, Target, UserCheck, Settings, Zap, History, FolderDot, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Scale,
      title: "TUỲ CHỈNH HỒ SƠ AI JUDGE",
      description: "Chọn AI Thẩm Phán (Strict, Lenient, Balanced) và cấu hình phong cách của Bồi thẩm đoàn."
    },
    {
      icon: Users,
      title: "MÔ PHỎNG NHÂN CHỨNG ĐỘNG",
      description: "Chất vấn và tương tác thời gian thực với AI nhân chứng, phản ứng linh hoạt và thực tế."
    },
    {
      icon: Zap,
      title: "PHÂN TÍCH LEGAL AI THỜI GIAN THỰC",
      description: "Nhận gợi ý legal AI, phát hiện sơ hở lập luận và phân tích chiến thuật trong khi tranh tụng."
    },
    {
      icon: History,
      title: "BÁO CÁO HIỆU SUẤT CHI TIẾT",
      description: "Báo cáo chấm điểm kỹ năng và phân tích tiến bộ của bạn sau mỗi vụ án, với Radar chart cụ thể."
    }
  ];

  return (
    <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5] font-sans selection:bg-[#D9C3A3]/30 scroll-smooth">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur-sm sticky top-0 z-50 bg-[#1A1612]/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#2A241E] border border-white/5 shadow-inner">
             <Gavel className="w-7 h-7 text-[#D9C3A3]" />
          </div>
          <span className="font-bold text-2xl tracking-tighter text-[#F2E7D5]">
            COURT <span className="text-[#D9C3A3]">SIM</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium text-[#A39684]">
          <a href="#about" className="hover:text-[#F2E7D5] transition-colors">Về chúng tôi</a>
          <a href="#features" className="hover:text-[#F2E7D5] transition-colors">Tính năng</a>
          <a href="#pricing" className="hover:text-[#F2E7D5] transition-colors">Bảng giá</a>
        </div>

        <button 
          onClick={() => navigate('/auth')}
          className="bg-[#D9C3A3] text-[#1A1612] font-semibold px-6 py-2.5 rounded-full hover:brightness-110 transition-all text-sm shadow-lg"
        >
          DÙNG THỬ MIỄN PHÍ
        </button>
      </nav>

      {/* Hero Section */}
      <section id="about" className="px-8 py-20 md:py-32 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2A241E] border border-white/5 text-sm text-[#D9C3A3] shadow-inner">
            <Target className="w-4 h-4" />
            <span>Nền tảng đầu tiên tại Việt Nam</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-[#F2E7D5]">
            COURT SIM - NỀN TẢNG MÔ PHỎNG DIỄN ÁN <br />
            <span className="text-[#D9C3A3]">SỬ DỤNG TRÍ TUỆ NHÂN TẠO</span>
          </h1>
          
          <p className="text-lg md:text-xl text-[#A39684] max-w-2xl leading-relaxed">
             Trải nghiệm toàn diện - Từ cấu hình vụ án đến kết quả chi tiết, chỉ qua 5 bước đơn giản.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-4">
            <button 
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto bg-[#D9C3A3] text-[#1A1612] font-bold px-8 py-4 rounded-xl hover:brightness-110 transition-all shadow-lg text-base"
            >
               THỬ NGAY
            </button>
          </div>
        </div>

        {/* Mockup/Image area */}
        <div className="relative group">
          <div className="absolute inset-0 bg-[#D9C3A3]/10 blur-3xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="relative aspect-[16/10] bg-[#2A241E] rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-3">
             <div className="absolute top-0 left-0 right-0 h-8 bg-black/30 flex items-center px-4 gap-1.5 border-b border-white/5 z-10">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
             </div>
             <div className="w-full h-full mt-5 bg-[#14110F] rounded-xl flex items-center justify-center border border-white/5 relative">
                <Users className="w-20 h-20 text-[#2A241E]" />
                <span className="text-[#2A241E] ml-4 text-xl font-mono">[In-Session Court Mockup]</span>
                <div className="absolute top-6 left-6 p-2 bg-[#2A241E] border border-white/5 rounded-lg text-xs font-mono">Judge: A. Miller</div>
                <div className="absolute bottom-6 right-6 p-2 bg-[#2A241E] border border-white/5 rounded-lg text-xs font-mono">Witness: L. Chang</div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-8 py-24 bg-[#14110F]/50 border-t border-white/5 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-[#F2E7D5] mb-16 tracking-tight">
            Nâng Tầm Kỹ Năng Pháp Lý Với <span className="text-[#D9C3A3]">CourtSim  </span>
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-8 rounded-3xl bg-[#2A241E] border border-white/5 shadow-xl hover:border-[#D9C3A3]/20 transition-all group space-y-5 flex flex-col items-start relative">
                <div className="p-4 rounded-2xl bg-[#1A1612] border border-white/5 shadow-inner group-hover:scale-110 transition-transform">
                  <feature.icon className="w-9 h-9 text-[#D9C3A3]" />
                </div>
                <h3 className="text-xl font-bold text-[#F2E7D5] pt-2 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">{feature.title}</h3>
                <p className="text-[#A39684] leading-relaxed text-sm flex-grow">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-8 py-24 max-w-7xl mx-auto scroll-mt-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#F2E7D5] mb-4 tracking-tight">
            Đầu Tư Cho <span className="text-[#D9C3A3]">Sự Nghiệp Pháp Lý</span>
          </h2>
          <p className="text-[#A39684] max-w-xl mx-auto text-lg">
            Các gói cước được thiết kế linh hoạt, tối ưu chi phí và sức mạnh AI cho từng cấp độ hành nghề.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          
          {/* TIER 1: FREE */}
          <div className="p-8 rounded-3xl bg-[#2A241E] border border-white/5 shadow-xl flex flex-col h-full relative overflow-hidden">
            {/* Nhãn ưu đãi */}
            <div className="absolute top-0 right-0 bg-[#A39684]/20 text-[#D9C3A3] text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Ưu đãi ra mắt
            </div>
            
            <h3 className="text-2xl font-bold text-[#F2E7D5] mb-2">Trải Nghiệm</h3>
            <p className="text-[#A39684] mb-6 min-h-[48px]">Làm quen với AI diễn án. Dành cho người mới bắt đầu.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-[#F2E7D5]">0đ</span>
              <span className="text-[#A39684]"> / tháng</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                'Mở rộng 5 phiên tòa/tháng (Gốc: 2)', 
                'Tối đa 10 lượt đối thoại mỗi phiên', 
                'Mô hình AI Thẩm phán tiêu chuẩn', 
                'Tương tác hoàn toàn qua văn bản (Chat)',
                'Sử dụng các vụ án mẫu cố định'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#A39684] text-sm">
                  <Check className="w-5 h-5 text-[#D9C3A3] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-transparent border-2 border-[#D9C3A3] text-[#D9C3A3] font-bold px-6 py-3.5 rounded-xl hover:bg-[#D9C3A3] hover:text-[#1A1612] transition-all"
            >
              Bắt đầu ngay
            </button>
          </div>

          {/* TIER 2: PLUS (SWEET SPOT) */}
          <div className="p-8 rounded-3xl bg-[#1A1612] border-2 border-[#D9C3A3] shadow-2xl shadow-[#D9C3A3]/10 flex flex-col relative overflow-hidden transform lg:-translate-y-4 h-full z-10">
            <div className="absolute top-0 right-0 bg-[#D9C3A3] text-[#1A1612] text-[10px] font-bold px-3 py-1.5 rounded-bl-xl uppercase tracking-wider">
              Phổ Biến Nhất
            </div>
            <h3 className="text-2xl font-bold text-[#D9C3A3] mb-2">Sinh Viên & Cá Nhân</h3>
            <p className="text-[#A39684] mb-6 min-h-[48px]">Rèn luyện kỹ năng thực chiến với bộ LLM cao cấp.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-[#F2E7D5]">199.000đ</span>
              <span className="text-[#A39684]"> / tháng</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                '15 phiên tòa/tháng', 
                'AI Cao cấp', 
                'Mở khóa nhập liệu Giọng nói (45p/tháng)', 
                'Thư viện 20 vụ án Dân sự, Hình sự, Kinh tế',
                'Bảng điểm chi tiết từ AI cuối phiên'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#F2E7D5] text-sm">
                  <Check className="w-5 h-5 text-[#D9C3A3] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-[#D9C3A3] text-[#1A1612] font-bold px-6 py-3.5 rounded-xl hover:brightness-110 transition-all shadow-lg"
            >
              Đăng ký gói Plus
            </button>
          </div>

          {/* TIER 3: PRO / ENTERPRISE */}
          <div className="p-8 rounded-3xl bg-[#2A241E] border border-white/5 shadow-xl flex flex-col h-full relative">
             {/* Badge độc quyền */}
             <div className="absolute top-[-1px] left-8 bg-[#D9C3A3]/10 text-[#D9C3A3] border border-[#D9C3A3]/20 text-[10px] font-bold px-3 py-1 rounded-b-lg tracking-wider">
              ĐỘC QUYỀN: TẢI LÊN HỒ SƠ
            </div>
            <h3 className="text-2xl font-bold text-[#F2E7D5] mb-2 mt-4">Chuyên nghiệp</h3>
            <p className="text-[#A39684] mb-6 min-h-[48px]">Trải nghiệm đỉnh cao. Phân tích tài liệu thực tế.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-[#F2E7D5]">499.000đ</span>
              <span className="text-[#A39684]"> / tháng</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {[
                'Không giới hạn phiên (với thư viện vụ án)', 
                'Tải lên hồ sơ vụ án riêng (PDF/Word)', 
                'Nhập liệu Giọng nói nâng lên 180p/tháng', 
                'Giọng đọc AI (Text-to-Speech) truyền cảm', 
                'Xuất Bản án & Báo cáo PDF chuyên nghiệp'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[#A39684] text-sm">
                  <Check className="w-5 h-5 text-[#D9C3A3] shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: item.replace('Tải lên hồ sơ vụ án riêng (PDF/Word)', '<strong class="text-[#F2E7D5]">Tải lên hồ sơ vụ án riêng (PDF/Word)</strong>') }}></span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => navigate('/auth')}
              className="w-full bg-transparent border-2 border-white/20 text-[#F2E7D5] font-bold px-6 py-3.5 rounded-xl hover:bg-white/10 transition-all"
            >
              Đăng ký gói Pro
            </button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 bg-[#1A1612] text-center text-[#A39684] text-sm">
        <p>© 2026 COURT SIM. Tất cả quyền được bảo lưu. Nền tảng mô phỏng pháp lý hàng đầu.</p>
      </footer>
    </div>
  );
};

export default LandingPage;