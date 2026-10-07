import CourtSimBrand from '../../components/CourtSimBrand';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  MessageCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import './landing.css';
import LandingFooter from '../../components/landing/LandingFooter';
import { checkoutPath, pricingPlans } from '../../services/pricingPlans';

const START_PATH = '/dashboard/setup';

function StartLink({ className = '', children = 'Trải nghiệm ngay' }) {
  return <Link to={START_PATH} className={`landing-cta ${className}`}>{children}<ArrowRight size={18} aria-hidden="true" /></Link>;
}

const audiences = [
  [Landmark, 'Trường đại học & học luật'],
  [UsersRound, 'Các CLB học thuật về pháp luật'],
  [BookOpenCheck, 'Trung tâm đào tạo kỹ năng'],
  [Scale, 'Tổ chức nghiên cứu và chính sách'],
  [ShieldCheck, 'Cộng đồng sinh viên luật'],
];

const tools = [
  [FileText, 'Tình huống pháp lý mô phỏng', 'Tiếp cận các vụ việc gần với thực tế để rèn luyện phân tích.', 'blue'],
  [UsersRound, 'Chọn vai trò tham gia', 'Trở thành Thẩm phán, Luật sư, Kiểm sát viên hoặc các bên liên quan.', 'orange'],
  [BrainCircuit, 'AI nhập vai đa tác nhân', 'AI đảm nhiệm các vai trò còn lại trong phiên tòa mô phỏng.', 'green'],
  [MessageCircle, 'Lập luận & phản biện', 'Rèn kỹ năng xây dựng luận điểm, trả lời và đối đáp tương phản.', 'orange'],
  [Trophy, 'Chấm điểm sau phiên', 'Đánh giá mức độ logic, căn cứ và khả năng bảo vệ quan điểm.', 'purple'],
  [BarChart3, 'Feedback cải thiện kỹ năng', 'Nhận gợi ý cụ thể để phát triển mạnh ở đâu và cần cải thiện gì.', 'blue'],
];

const workflow = [
  ['Tình huống', ['Xem thông tin vụ việc', 'Nghiên cứu hồ sơ', 'Tóm tắt điểm chính'], FileText],
  ['Vai trò của bạn', ['Luật sư', 'Kiểm sát viên', 'Thẩm phán', 'Bị đơn'], UserRound],
  ['Kết quả sau phiên', ['Phân tích chuyên sâu', 'Lập luận 8.5', 'Phản biện 8.0', 'Tư duy pháp lý 8.8'], Trophy],
];

function HeroMockup() {
  return <div className="hero-mockup" aria-hidden="true">
    <div className="browser-card">
      <div className="browser-dots"><span /><span /><span /></div>
      <div className="browser-body">
        <aside>
          <div className="mock-brand"><Landmark size={18} aria-hidden="true" />Court<span>Sim</span></div>
          {['Trang chủ', 'Tình huống pháp lý', 'Thực hành', 'Báo cáo', 'Tài khoản'].map((item) => <span key={item}>{item}</span>)}
        </aside>
        <section>
          <div className="mockup-topline">
            <div><p>Vụ án dân sự</p><span>Lựa chọn vai trò của bạn để bắt đầu phiên tòa mô phỏng</span></div>
            <div className="mockup-icons"><span /><span /><span /></div>
          </div>
          <div className="role-grid">
            {['Thẩm phán', 'Luật sư bào chữa', 'Kiểm sát viên', 'Luật sư'].map((role) => <div key={role}><UserRound size={18} />{role}</div>)}
          </div>
          <div className="court-preview">
            <img src="/courtsim-courtroom-background-v2.png" alt="" />
            <span className="judge-chip">Thẩm phán AI</span>
            <span className="lawyer-chip left">Luật sư</span>
            <span className="lawyer-chip right">Kiểm sát viên</span>
          </div>
        </section>
      </div>
    </div>
    <div className="ai-card">
      <Sparkles size={24} />
      <h3>AI Phản hồi</h3>
      <p>Lập luận của bạn khá chặt chẽ, nhưng cần làm rõ hơn về yếu tố chủ quan của hành vi.</p>
      <span>Phân tích tiếp <ArrowRight size={15} /></span>
    </div>
    <div className="score-card">
      <h3>Đánh giá sau phiên</h3>
      {['Lập luận', 'Phản biện', 'Tư duy pháp lý', 'Trình bày'].map((item, index) => <div key={item}><span>{item}</span><b>{[8.5, 8.0, 8.8, 7.5][index]}</b></div>)}
      <strong>8.3<small>/10</small></strong>
    </div>
  </div>;
}

export default function LandingPage() {
  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Đến nội dung chính</a>
    <header className="landing-header">
      <CourtSimBrand />
      <nav aria-label="Điều hướng trang chủ">
        <a href="#product">Sản phẩm</a>
        <a href="#features">Tính năng</a>
        <a href="#workflow">Cách hoạt động</a>
        <a href="#pricing">Bảng giá</a>
        <a href="#resources">Tài nguyên</a>
      </nav>
      <Link className="landing-login" to="/login">Đăng nhập / Đăng ký</Link>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section id="product" className="landing-hero" aria-labelledby="hero-heading">
        <div className="hero-bg" />
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <p className="landing-eyebrow"><Sparkles size={16} /> Nền tảng mô phỏng phiên tòa bằng AI</p>
            <h1 id="hero-heading">Bước vào<br /><span>tình huống pháp lý</span></h1>
            <p className="landing-lead">CourtSim giúp sinh viên Luật thực hành tranh tụng qua các tình huống mô phỏng, với sự hỗ trợ của AI thông minh và phản hồi chi tiết.</p>
            <div className="landing-hero-actions">
              <StartLink />
            </div>
            <div className="hero-benefits" aria-label="Lợi ích chính">
              <span><GraduationCap size={28} />Thực hành tranh tụng thực tế</span>
              <span><BrainCircuit size={28} />AI phản hồi đa chiều</span>
              <span><BarChart3 size={28} />Phân tích điểm mạnh, điểm yếu</span>
            </div>
          </div>
          <HeroMockup />
        </div>
      </section>

      <section className="audience-strip" aria-label="Phù hợp cho">
        <p>Phù hợp cho sinh viên luật, CLB học thuật và môi trường đào tạo thực hành</p>
        <div className="audience-row">
          {audiences.map(([Icon, label]) => <div key={label}><Icon size={28} aria-hidden="true" /><span>{label}</span></div>)}
        </div>
      </section>

      <section id="features" className="landing-section feature-section" aria-labelledby="features-heading">
        <div className="landing-container">
          <p className="section-pill">Tại sao chọn CourtSim?</p>
          <h2 id="features-heading">Mọi công cụ để học luật bằng thực hành và phản biện</h2>
          <p className="section-lead">Từ đọc vụ việc đến tranh luận, phản hồi và tự cải thiện, CourtSim giúp việc học luật trở nên sống động hơn.</p>
          <div className="tool-grid">
            {tools.map(([Icon, title, description, tone]) => <article key={title} className={`tool-card tone-${tone}`}>
              <span><Icon size={28} aria-hidden="true" /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section id="workflow" className="landing-section workflow-section" aria-labelledby="workflow-heading">
        <div className="landing-container workflow-grid">
          <div className="workflow-copy">
            <p className="landing-eyebrow"><ClipboardCheck size={16} /> Quy trình mô phỏng</p>
            <h2 id="workflow-heading">Từ lý thuyết đến một phiên tòa mô phỏng hoàn chỉnh</h2>
            <p>Nghiên cứu hồ sơ, chọn vai trò, tranh luận với AI và nhận phản hồi chi tiết sau phiên.</p>
            <StartLink>Khởi tạo phiên mô phỏng</StartLink>
          </div>
          <div className="workflow-cards">
            {workflow.map(([title, items, Icon], index) => <article key={title}>
              <b>{index + 1}</b>
              <h3>{title}</h3>
              <Icon size={22} aria-hidden="true" />
              <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
              {index === 0 && <a href="#features">Xem toàn bộ tình huống</a>}
              {index === 2 && <a href="#pricing">Xem đánh giá chi tiết</a>}
            </article>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="final-cta" aria-labelledby="start-heading">
        <div id="pricing-details" className="landing-container pricing-block" aria-labelledby="pricing-heading">
          <p className="section-pill">Bảng giá</p>
          <h2 id="pricing-heading">Linh hoạt cho từng nhịp luyện tập</h2>
          <p className="pricing-intro">CourtSim sử dụng chiến lược Penetration Pricing để giảm rào cản gia nhập cho sinh viên luật. Bên cạnh đó, CourtSim kết hợp Freemium, Pay-per-use và Bundle Pricing để đáp ứng các mức độ nhu cầu khác nhau.</p>
          <div className="pricing-grid">
            {pricingPlans.map((plan) => <article className={`pricing-card ${plan.name === 'Pro' ? 'is-featured' : ''}`} key={plan.id}>
              <div>
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <span className="pricing-cadence">{plan.cadence}</span>
                <p>{plan.description}</p>
              </div>
              <ul>{plan.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
              <Link className="pricing-action" to={checkoutPath(plan.id)}>{plan.checkoutLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
            </article>)}
          </div>
          <p className="pricing-note">Các gói bundle giúp người dùng tiết kiệm hơn so với việc mua từng case riêng lẻ, đồng thời khuyến khích luyện tập thường xuyên hơn.</p>
        </div>
        <div className="landing-container final-grid">
          <div className="hand-note left-note">Hiểu luật để phản biện tốt hơn</div>
          <div>
            <h2 id="start-heading">Sẵn sàng luyện tư duy pháp lý theo cách chủ động hơn?</h2>
            <p>CourtSim đồng hành cùng bạn trên hành trình trở thành phiên bản tốt hơn của chính mình.</p>
            <div className="final-actions"><StartLink>Đăng ký trải nghiệm</StartLink><a className="outline-cta" href="#pricing-details">Xem bảng giá</a></div>
            <div className="final-badges"><span>Dễ sử dụng</span><span>Mô phỏng sát thực tế</span><span>Phù hợp nhiều trình độ</span></div>
          </div>
          <div id="resources" className="book-stack" aria-hidden="true">
            <span>Luật dân sự</span><span>Luật hình sự</span><span>Tố tụng dân sự</span><span>Tố tụng hình sự</span>
          </div>
        </div>
      </section>
    </main>
    <LandingFooter />
  </div>;
}
