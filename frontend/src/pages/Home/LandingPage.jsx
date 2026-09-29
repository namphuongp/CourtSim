import CourtSimBrand from '../../components/CourtSimBrand';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, BookOpen, FileText, GitBranch, MessagesSquare, Search, Sparkles, Target } from 'lucide-react';
import './landing.css';
import LandingFooter from '../../components/landing/LandingFooter';

const START_PATH = '/dashboard/setup';
const processSteps = [
  ['Chọn vụ án và vai luật sư', 'Chọn hồ sơ bạn muốn luyện tập và bên bạn sẽ bảo vệ.'],
  ['Đọc hồ sơ, xem chứng cứ', 'Tìm hiểu yêu cầu của các bên, mốc thời gian và nguồn của từng tài liệu.'],
  ['Trình bày và phản biện', 'Viết lập luận, nhận phản biện từ bên đối lập và trả lời câu hỏi của chủ tọa.'],
  ['Nhìn lại cách lập luận', 'Kết thúc phiên để xem điểm, góp ý theo tiêu chí và đọc lại toàn bộ biên bản.'],
];
const skills = [
  [BookOpen, 'Đọc đúng tình tiết', 'Phân biệt sự việc được ghi nhận, lời trình bày của một bên và điều còn cần chứng minh.'],
  [GitBranch, 'Nối chứng cứ với luận điểm', 'Giải thích tài liệu hỗ trợ điều gì, đồng thời nhận ra giới hạn của thông tin trong hồ sơ.'],
  [MessagesSquare, 'Phản biện có trọng tâm', 'Trả lời đúng luận điểm đối phương và điều chỉnh cách bảo vệ quan điểm khi cần.'],
  [Search, 'Kiểm tra căn cứ pháp luật', 'Dùng trợ lý luật để tra cứu, đối chiếu nguồn và thời điểm áp dụng. Nguồn chưa xác minh được sẽ được báo rõ.'],
];
function StartLink({ className = '' }) {
  return <Link to={START_PATH} className={`landing-cta ${className}`}>Bắt đầu luyện tập <ArrowRight size={18} aria-hidden="true" /></Link>;
}

function Reveal({ children, className = '' }) {
  const element = useRef(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    // Chạy một lần khi phần nội dung đi vào màn hình; không tạo vòng lặp hoặc trì hoãn thao tác.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('landing-entered');
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={element} className={`landing-reveal ${className}`}>{children}</div>;
}

function LearningFlow() {
  const flow = [[FileText, 'Hồ sơ vụ án', 'Hiểu sự việc'], [GitBranch, 'Lập luận', 'Kết nối căn cứ'], [MessagesSquare, 'Phản biện', 'Đối chiếu quan điểm'], [Sparkles, 'Góp ý', 'Biết cách cải thiện']];
  return <Reveal className="landing-flow">
    <p className="landing-eyebrow">Từ hồ sơ đến lập luận của bạn</p>
    <ol aria-label="Quy trình luyện tập" className="landing-flow-list">
      {flow.map(([Icon, title, detail], index) => <li key={title} style={{ '--step': index }}>
        <span className="landing-flow-icon"><Icon size={24} aria-hidden="true" /></span>
        <div><strong>{title}</strong><span>{detail}</span></div>
        <span className="landing-flow-number" aria-hidden="true">0{index + 1}</span>
      </li>)}
    </ol>
    <p className="landing-flow-note">Một quan điểm. Nhiều cách để làm rõ.</p>
  </Reveal>;
}

export default function LandingPage() {
  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Đến nội dung chính</a>
    <header className="landing-header">
      <CourtSimBrand/>
      <nav aria-label="Điều hướng trang chủ"><a href="#how-it-works">Cách học</a><a href="#skills">Kỹ năng</a><a href="#feedback">Cách nhận góp ý</a></nav>
      <Link className="landing-login" to="/login">Đăng nhập <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero landing-container" aria-labelledby="hero-heading">
        <div>
          <p className="landing-eyebrow"><span className="landing-dot" /> Không gian luyện tranh tụng</p>
          <h1 id="hero-heading">Đọc kỹ hồ sơ.<br /><span>Bảo vệ quan điểm.</span></h1>
          <p className="landing-lead">CourtSim giúp bạn luyện lập luận qua phiên tòa mô phỏng có AI phản biện. Thử sức trong vai luật sư, rồi nhìn lại điểm mạnh và điều cần cải thiện sau mỗi phiên.</p>
          <div className="landing-hero-actions"><StartLink /><a className="landing-text-link" href="#how-it-works">Tìm hiểu cách học <ArrowDown size={17} aria-hidden="true" /></a></div>
          <p className="landing-audience">Dành cho sinh viên luật và người muốn rèn kỹ năng lập luận pháp lý.</p>
        </div>
        <LearningFlow />
      </section>

      <section id="how-it-works" className="landing-section landing-process" aria-labelledby="process-heading">
        <div className="landing-container">
          <div className="landing-section-heading"><p className="landing-eyebrow">Một phiên luyện tập</p><h2 id="process-heading">Bạn sẽ làm gì trong CourtSim?</h2><p>Từ việc hiểu hồ sơ đến việc tự bảo vệ một quan điểm bằng lời viết.</p></div>
          <Reveal><ol className="landing-process-grid">{processSteps.map(([title, description], index) => <li key={title} style={{ '--step': index }}><span className="landing-step-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol></Reveal>
        </div>
      </section>

      <section id="skills" className="landing-section landing-container" aria-labelledby="skills-heading">
        <div className="landing-split-heading"><div><p className="landing-eyebrow">Kỹ năng qua từng lượt</p><h2 id="skills-heading">Không chỉ nêu quan điểm.<br />Hãy làm rõ cơ sở.</h2></div><p>Mỗi lượt là cơ hội đọc kỹ hơn, chọn đúng thông tin và diễn đạt lập luận thuyết phục hơn.</p></div>
        <Reveal className="landing-skills">{skills.map(([Icon, title, description]) => <article key={title}><Icon size={27} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></article>)}</Reveal>
      </section>

      <section id="feedback" className="landing-section landing-feedback-section" aria-labelledby="feedback-heading">
        <Reveal className="landing-container landing-feedback-summary">
          <div><p className="landing-eyebrow">Sau phiên luyện tập</p><h2 id="feedback-heading">Nhận góp ý.<br />Luyện tập tốt hơn.</h2><p>Nhìn lại cách dùng căn cứ, phân tích chứng cứ, xây dựng lập luận và phản biện qua từng lượt.</p></div>
          <div className="landing-feedback-points">
            <div><Target size={24} aria-hidden="true" /><div><h3>Điểm số kèm giải thích</h3><p>Xem điểm ở phần đủ dữ liệu để đánh giá, kèm nhận xét và các mục chưa chấm. Chỉ có điểm toàn bài khi đủ dữ liệu cho cả thang 100.</p></div></div>
            <div><Sparkles size={24} aria-hidden="true" /><div><h3>Biết cách cải thiện</h3><p>Xem điểm mạnh, điều cần sửa và gợi ý cụ thể. Mở lại biên bản để đối chiếu với lập luận của bạn.</p></div></div>
          </div>
        </Reveal>
      </section>

      <section className="landing-final" aria-labelledby="start-heading"><div className="landing-container"><p className="landing-eyebrow">Bắt đầu từ một hồ sơ</p><h2 id="start-heading">Đến lượt bạn xây dựng lập luận.</h2><p>Chọn vụ án, đọc yêu cầu của các bên và thử bảo vệ một quan điểm.</p><StartLink /></div></section>
    </main>
    <LandingFooter />
  </div>;
}
