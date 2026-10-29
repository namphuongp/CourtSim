import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, FileText, Gavel, Scale, Sparkles } from 'lucide-react';
import CourtSimBrand from '../../components/CourtSimBrand';
import LandingFooter from '../../components/landing/LandingFooter';
import ArenaIllustration from '../../components/landing/ArenaIllustration';
import FeedbackModal from '../../components/feedback/FeedbackModal';
import CaseDossier from '../../components/CaseDossier';
import api, { getApiError } from '../../services/api';
import { caseIntroduction } from '../../../../shared/casePresentation.mjs';
import './landing.css';

const START_PATH = '/dashboard/setup';
const filters = ['Tất cả', 'Đất đai', 'Phúc thẩm', 'Sơ thẩm'];
function StartLink({ children = 'Bắt đầu miễn phí', className = '' }) {
  return <Link to={START_PATH} className={`landing-cta ${className}`}>{children}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

export default function LandingPage() {
  const [catalog, setCatalog] = useState({ loading: true, cases: [], error: '' });
  const [filter, setFilter] = useState('Tất cả');
  const [reload, setReload] = useState(0);
  const [dossier, setDossier] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/v1/cases?limit=50', { signal: controller.signal, skipAuthRedirect: true }).then(({ data }) => setCatalog({ loading: false, cases: data.data ?? [], error: '' }))
      .catch(error => { if (!controller.signal.aborted) setCatalog({ loading: false, cases: [], error: getApiError(error) }); });
    return () => controller.abort();
  }, [reload]);
  async function openDossier(id) {
    setDossier({ loading: true, id });
    try { const { data } = await api.get(`/v1/cases/${id}`, { skipAuthRedirect: true }); setDossier(current => current?.id === id ? { id, data: data.data } : current); }
    catch (error) { setDossier(current => current?.id === id ? { id, error: getApiError(error) } : current); }
  }
  const visibleCases = catalog.cases.filter(item => filter === 'Tất cả' || `${item.title} ${item.category} ${item.summary ?? ''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')));
  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Đến nội dung chính</a>
    <header className="landing-header"><div className="landing-container landing-header-inner">
      <CourtSimBrand />
      <nav aria-label="Điều hướng trang chủ"><a href="#workflow">Cách hoạt động</a><a href="#cases">Thư viện vụ án</a><a href="#feedback">Phản hồi AI</a><Link to="/pricing">Bảng giá</Link><Link to="/guide">Hướng dẫn</Link></nav>
      <div className="landing-header-actions"><Link to="/login">Đăng nhập</Link><StartLink /></div>
    </div></header>
    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-container hero-grid">
          <div className="hero-copy"><p className="landing-eyebrow"><Sparkles size={15} /> Mô phỏng phiên tòa bằng AI</p><h1 id="hero-heading">LUYỆN TRANH TỤNG<br />THỰC CHIẾN</h1><p className="hero-subheading">Như đứng trước<br />Hội đồng xét xử</p>
            <div className="landing-hero-actions"><StartLink /><a className="landing-secondary" href="#workflow">Xem cách học <ArrowRight size={16} /></a></div>
            <ul className="hero-benefits"><li><CheckCircle2 />2 vụ án đầu tiên miễn phí</li><li><CheckCircle2 />Tối đa 20 lượt mỗi phiên</li><li><CheckCircle2 />Chấm điểm sau phiên</li></ul>
          </div><ArenaIllustration />
        </div>
        <div className="hero-evidence-strip" aria-hidden="true">CHỨNG CỨ #14 ⚖ LƯỢT 03/20 ⚖ HỒ SƠ VỤ ÁN ⚖ PHẢN BIỆN ⚖ ĐƠN KHÁNG CÁO ⚖ CHỨNG CỨ #14</div>
      </section>
      <div className="landing-info-strip" aria-label="Đặc điểm phiên luyện tập">PHẢN HỒI TỨC THÌ <span>✦</span> CHẤM ĐIỂM SAU PHIÊN <span>✦</span> 20 LƯỢT MỖI PHIÊN <span>✦</span> PHIÊN TÒA MÔ PHỎNG <span>✦</span> AI CHỦ TỌA</div>

      <section id="workflow" className="landing-section workflow-section"><div className="landing-container">
        <div className="landing-section-heading"><p className="section-kicker">CÁCH HOẠT ĐỘNG</p><h2>Bắt đầu phiên đầu tiên trong 3 bước</h2><p>Không cần đọc hướng dẫn dài. Chọn hồ sơ, chọn phía bảo vệ và bước vào phòng xử án.</p></div>
        <div className="workflow-cards">
          <article><FileText className="landing-icon" /><b className="step-number">01</b><h3>Chọn vụ án</h3><p>Đọc tóm tắt, các bên, mốc thời gian và chứng cứ trong hồ sơ trước khi vào phiên.</p><div className="step-preview"><span>HỒ SƠ VỤ ÁN</span><strong>Tình tiết rõ ràng, đầy đủ dữ kiện</strong><small><FileText size={13} />Nghiên cứu hồ sơ trước khi tranh luận</small></div></article>
          <article><Scale className="landing-icon" /><b className="step-number">02</b><h3>Chọn vai của bạn</h3><p>Bảo vệ nguyên đơn hoặc bị đơn. AI đảm nhận Chủ tọa và bên đối lập để phiên diễn ra liền mạch.</p><div className="step-preview role-preview"><span>◉ Luật sư bảo vệ bị đơn</span><span>○ Luật sư bảo vệ nguyên đơn</span></div></article>
          <article><Gavel className="landing-icon" /><b className="step-number">03</b><h3>Tranh luận và nhận phản hồi</h3><p>Trình bày theo lượt, tra cứu luật bằng Trợ lý, rồi kết thúc phiên để nhận điểm và góp ý.</p><div className="step-preview"><span>Tiến trình phiên <strong>Lượt 3 / 20</strong></span><div className="preview-progress"><i /></div><small>✦ Trợ lý luật  ▤ Biên bản</small></div></article>
        </div>
      </div></section>

      <section id="cases" className="landing-section case-library"><div className="landing-container">
        <p className="section-kicker">THƯ VIỆN VỤ ÁN</p><div className="library-heading"><div><h2>Hồ sơ gần với thực tế, đủ dữ<br className="desktop-break" /> kiện để tranh luận</h2><p>Mỗi vụ án có tóm tắt diễn biến, vấn đề cần làm rõ, các bên và chứng cứ.</p></div><div className="library-filters" aria-label="Lọc thư viện vụ án">{filters.map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</div></div>
        {catalog.loading ? <p className="library-notice" role="status">Đang tải thư viện vụ án…</p> : catalog.error ? <div className="library-notice" role="alert"><p>{catalog.error}</p><button onClick={() => { setCatalog(current => ({ ...current, loading: true })); setReload(n => n + 1); }}>Thử lại thư viện</button></div> : <div className="landing-case-grid">
          {visibleCases.slice(0, 2).map((item, index) => <article className="landing-case-card" key={item._id}>
            <div className={`case-art case-art-${index}`} aria-hidden="true"><span className="case-category">{item.category}</span><Scale /><div className="case-paper"><FileText /><i /><i /><i /></div><BookOpen /></div>
            <div className="case-card-body"><span className="case-type">{item.category}</span><h3>{caseIntroduction(item).title}</h3><p>{caseIntroduction(item).summary}</p><div className="case-card-meta">2 vai luật sư <span>□ 20 lượt</span>{item.evidence_inventory && <span>▤ {item.evidence_inventory.length} chứng cứ</span>}</div><div className="case-card-actions"><Link className="landing-cta" to={`${START_PATH}?case=${encodeURIComponent(item._id)}`}>Chọn vụ án <ArrowRight size={15} /></Link><button onClick={() => openDossier(item._id)}>Xem hồ sơ <ArrowRight size={15} /></button></div></div>
          </article>)}
          <article className="library-empty"><BookOpen /><h3>{visibleCases.length ? 'Vụ án mới đang được biên soạn' : 'Chưa có hồ sơ phù hợp'}</h3><p>{visibleCases.length ? 'Thư viện được bổ sung thường xuyên theo lĩnh vực và cấp xét xử.' : 'Thử bộ lọc khác hoặc quay lại khi có hồ sơ được công bố.'}</p><Link to="/guide#feedback">Đề xuất tình huống</Link></article>
        </div>}
      </div></section>

      <section id="feedback" className="landing-feedback landing-section"><div className="landing-container feedback-grid">
        <div><p className="section-kicker">PHẢN HỒI SAU PHIÊN</p><h2>Biết rõ mình mạnh ở đâu<br />và cần luyện gì tiếp theo</h2><p>AI đánh giá toàn bộ lượt trình bày của bạn theo từng nhóm kỹ năng tranh tụng, kèm nhận xét cụ thể.</p><ul>{['Chấm điểm theo các nhóm kỹ năng tranh tụng', 'Nhận xét điểm mạnh và điểm cần cải thiện', 'Mục tiêu luyện tập cho phiên tiếp theo', 'Biên bản phiên để xem lại toàn bộ trao đổi'].map(text => <li key={text}><CheckCircle2 />{text}</li>)}</ul><Link to="/guide#scoring" className="landing-cta light-cta">Xem cách đánh giá <ArrowRight size={17} /></Link></div>
        <article className="feedback-preview"><span className="floating-icon"><Gavel /></span><p className="section-kicker">BÁO CÁO SAU PHIÊN · MINH HỌA</p><h3>Từng lập luận đều có cơ hội để tốt hơn</h3><div className="feedback-preview-top"><span className="preview-score"><ClipboardList size={38} /><small>Theo dữ liệu phiên</small></span><div><span className="case-type">Phản hồi theo tiêu chí</span><p>Điểm và nhận xét của bạn xuất hiện sau khi phiên được hệ thống chấm xong.</p></div></div><div className="preview-skills">{['Lập luận pháp lý', 'Phân tích chứng cứ', 'Phản biện', 'Áp dụng pháp luật', 'Trình bày', 'Kỹ năng tranh tụng'].map((text, i) => <div key={text}><span>{text}</span><div className="preview-progress"><i style={{ width: `${85 - i * 5}%` }} /></div></div>)}</div><div className="preview-goal"><Sparkles size={20} /><div><strong>Mục tiêu phiên tiếp theo</strong><p>Nhận gợi ý luyện tập dựa trên các lượt đã trình bày.</p></div></div><p className="scoring-note">Chỉ có điểm toàn bài khi đủ dữ liệu đánh giá.</p><Link to="/guide#scoring">Tìm hiểu báo cáo chi tiết <ArrowRight size={15} /></Link></article>
      </div></section>

      <section id="features" className="landing-section courtroom-tools"><div className="landing-container"><div className="landing-section-heading"><p className="section-kicker">TRONG PHÒNG XỬ ÁN</p><h2>Mọi công cụ cần thiết luôn ở bên cạnh</h2><p>Không phải chuyển tab hay mở tài liệu rời. Hồ sơ, luật và biên bản đều nằm ngay trong phiên.</p></div><div className="landing-tool-grid">{[[FileText, 'Hồ sơ phiên tòa', 'Tình tiết, các bên, mốc thời gian và chứng cứ luôn mở bên cạnh khi tranh luận.', 'Mở hồ sơ mẫu', '#cases'], [Sparkles, 'Trợ lý luật', 'Tra cứu theo vấn đề hoặc số hiệu văn bản, kèm nguồn và trích đoạn để bạn tự kiểm tra.', 'Tìm hiểu trợ lý', '/guide'], [ClipboardList, 'Biên bản phiên', 'Mọi lời trao đổi được lưu lại theo lượt để xem lại và đối chiếu sau phiên.', 'Tìm hiểu biên bản', '/guide']].map(([Icon, title, text, action, to], index) => <article key={title} className={index === 1 ? 'is-blue' : ''}><span className="floating-icon"><Icon /></span><h3>{title}</h3><p>{text}</p>{to.startsWith('#') ? <a href={to}>{action}<ArrowRight size={16} /></a> : <Link to={to}>{action}<ArrowRight size={16} /></Link>}</article>)}</div></div></section>

      <section id="pricing" className="landing-start-section"><div className="landing-container"><div className="landing-final-banner"><Scale className="banner-scale" aria-hidden="true" /><h2>Sẵn sàng bước vào phiên tòa đầu tiên?</h2><p>2 vụ án đầu tiên miễn phí. Nhập vai luật sư, đối đáp với AI và nhận chấm điểm ngay sau phiên.</p><div className="final-actions"><StartLink className="light-cta" /><Link className="landing-secondary" to="/pricing">Xem bảng giá</Link></div></div></div></section>
    </main><LandingFooter />
    {dossier && <FeedbackModal title="Hồ sơ vụ án" onClose={() => setDossier(null)}>{dossier.loading ? <p role="status">Đang tải hồ sơ…</p> : dossier.error ? <p role="alert">{dossier.error}</p> : <CaseDossier courtCase={dossier.data} />}</FeedbackModal>}
  </div>;
}
