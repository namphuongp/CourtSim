import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ClipboardList, FileText, Gavel, Scale, Search, UserRound } from 'lucide-react';
import CourtSimBrand from '../../components/CourtSimBrand';
import LandingFooter from '../../components/landing/LandingFooter';
import FeedbackModal from '../../components/feedback/FeedbackModal';
import CaseDossier from '../../components/CaseDossier';
import { LogoutButton } from '../Auth/AccountActions';
import { useCurrentUser } from '../../services/auth';
import api, { getApiError } from '../../services/api';
import { PRACTICE_CASES_PATH } from '../../services/simulation';
import { caseIntroduction } from '../../../../shared/casePresentation.mjs';
import './landing.css';

const SETUP_PATH = '/dashboard/setup';
const filters = ['Tất cả', 'Đất đai', 'Phúc thẩm', 'Sơ thẩm'];

const workflow = [
  [FileText, 'Chọn vụ án', 'Đọc diễn biến, yêu cầu của các bên và chứng cứ trong hồ sơ.'],
  [Scale, 'Chọn vai luật sư', 'Chọn bên bạn muốn bảo vệ. AI đảm nhiệm vai Chủ tọa và bên đối lập.'],
  [Gavel, 'Trình bày và phản biện', 'Đối đáp theo lượt, sau đó xem nhận xét về phần trình bày của bạn.'],
];

const courtroomTools = [
  [FileText, 'Hồ sơ phiên tòa', 'Đối chiếu tình tiết và chứng cứ ngay khi chuẩn bị lập luận.', 'Mở thư viện vụ án', '#cases'],
  [Search, 'Trợ lý luật', 'Tra cứu theo vấn đề hoặc số hiệu văn bản, kèm nguồn để bạn kiểm tra.', 'Tìm hiểu trợ lý', '/guide'],
  [ClipboardList, 'Biên bản phiên', 'Xem lại từng lượt trình bày, câu hỏi và phản biện trong phiên.', 'Tìm hiểu biên bản', '/guide'],
];

function StartLink() {
  const user = useCurrentUser();
  const label = user?.id ? 'Chọn vụ án' : 'Bắt đầu miễn phí';
  return <Link to={PRACTICE_CASES_PATH} className="landing-cta">{label}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

function LandingPublicLinks({ onNavigate }) {
  return <>
    <a href="#workflow" onClick={onNavigate}>Cách hoạt động</a>
    <a href="#cases" onClick={onNavigate}>Thư viện vụ án</a>
    <a href="#feedback" onClick={onNavigate}>Đánh giá</a>
    <Link to="/pricing" onClick={onNavigate}>Bảng giá</Link>
    <Link to="/guide" onClick={onNavigate}>Hướng dẫn</Link>
  </>;
}

function LandingAccountActions({ user }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event) {
      if (!container.current?.contains(event.target)) setOpen(false);
    }
    function dismissWithEscape(event) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, [open]);

  return <div className="landing-header-actions landing-signed-in-actions">
    <Link to="/dashboard" className="landing-auth-link">Tổng quan</Link>
    <div className="landing-account" ref={container} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} type="button" className="landing-account-trigger" aria-expanded={open}
        aria-controls="landing-account-panel" onClick={() => setOpen(value => !value)}>
        <UserRound size={16} aria-hidden="true" />
        <span>Tài khoản</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id="landing-account-panel" className="landing-account-panel" hidden={!open}>
        {(user.full_name || user.email) && <p className="landing-account-name">{user.full_name || user.email}</p>}
        <Link to="/account" onClick={() => setOpen(false)}>Hồ sơ cá nhân</Link>
        {user.role === 'admin' && <Link to="/admin" onClick={() => setOpen(false)}>Quản trị</Link>}
        <LogoutButton />
        <nav className="landing-account-public-nav" aria-label="Khám phá CourtSim">
          <LandingPublicLinks onNavigate={() => setOpen(false)} />
        </nav>
      </div>
    </div>
  </div>;
}

export default function LandingPage() {
  const currentUser = useCurrentUser();
  const [catalog, setCatalog] = useState({ loading: true, cases: [], error: '' });
  const [filter, setFilter] = useState('Tất cả');
  const [reload, setReload] = useState(0);
  const [dossier, setDossier] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/v1/cases?limit=50', { signal: controller.signal, skipAuthRedirect: true })
      .then(({ data }) => setCatalog({ loading: false, cases: data.data ?? [], error: '' }))
      .catch(error => {
        if (!controller.signal.aborted) setCatalog({ loading: false, cases: [], error: getApiError(error) });
      });
    return () => controller.abort();
  }, [reload]);

  async function openDossier(id) {
    setDossier({ loading: true, id });
    try {
      const { data } = await api.get(`/v1/cases/${id}`, { skipAuthRedirect: true });
      setDossier(current => current?.id === id ? { id, data: data.data } : current);
    } catch (error) {
      setDossier(current => current?.id === id ? { id, error: getApiError(error) } : current);
    }
  }

  const visibleCases = catalog.cases.filter(item => filter === 'Tất cả' ||
    `${item.title} ${item.category} ${item.summary ?? ''}`.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')));

  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Đến nội dung chính</a>
    <header className={currentUser?.id ? 'landing-header landing-header--signed-in' : 'landing-header'}>
      <div className="landing-container landing-header-inner">
        <CourtSimBrand />
        <nav className="landing-public-nav" aria-label="Điều hướng trang chủ"><LandingPublicLinks /></nav>
        {currentUser?.id ? <LandingAccountActions user={currentUser} /> : (
          <div className="landing-header-actions">
            <Link to="/login" className="landing-auth-link">Đăng nhập</Link>
            <StartLink />
          </div>
        )}
      </div>
    </header>

    <main id="main-content" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <h1 id="hero-heading">Luyện <span>tranh tụng</span> qua <span>phiên tòa</span> mô phỏng</h1>
            <p className="hero-subheading">Chọn vụ án, nhập vai luật sư và nhận góp ý sau khi trình bày và phản biện tại phiên tòa.</p>
            <div className="landing-hero-actions">
              <StartLink />
              <a className="landing-secondary" href="#cases">Xem hồ sơ mẫu</a>
            </div>
            <p className="hero-note">2 lượt luyện tập miễn phí cho mỗi tài khoản.</p>
          </div>
          <img className="hero-photo" src="/courtsim-landing-courtroom.webp" width={1400} height={787} alt="Minh họa phòng xử án với bục Hội đồng xét xử" fetchPriority="high" />
        </div>
      </section>

      <section id="workflow" className="landing-section workflow-section" aria-labelledby="workflow-heading">
        <div className="landing-container">
          <div className="landing-section-heading">
            <h2 id="workflow-heading">Bắt đầu phiên đầu tiên trong 3 bước</h2>
          </div>
          <ol className="workflow-cards">
            {workflow.map(([Icon, title, description]) => <li key={title}>
              <Icon className="landing-icon" size={23} aria-hidden="true" />
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>)}
          </ol>
        </div>
      </section>

      <section id="cases" className="landing-section case-library" aria-labelledby="case-library-heading" tabIndex={-1}>
        <div className="landing-container">
          <div className="library-heading">
            <div className="landing-section-heading">
              <h2 id="case-library-heading">Thư viện vụ án</h2>
              <p>Xem tình tiết, yêu cầu của các bên và chứng cứ trước khi chọn vụ án để luyện tập.</p>
            </div>
            <div className="library-filters" aria-label="Lọc thư viện vụ án">
              {filters.map(label => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
            </div>
          </div>
          {catalog.loading ? <p className="library-notice" role="status">Đang tải thư viện vụ án…</p> : catalog.error ? (
            <div className="library-notice" role="alert">
              <p>{catalog.error}</p>
              <button type="button" onClick={() => { setCatalog(current => ({ ...current, loading: true })); setReload(n => n + 1); }}>Thử lại thư viện</button>
            </div>
          ) : <>
            <div className="landing-case-grid">
              {visibleCases.slice(0, 2).map(item => {
                const description = caseIntroduction(item);
                return <article className="landing-case-card" key={item._id}>
                  <h3>{description.title}</h3>
                  <p className="case-category">{item.category}</p>
                  <p className="case-summary">{description.summary}</p>
                  <ul className="case-card-meta">
                    <li>2 vai luật sư</li><li>Tối đa 20 lượt</li>
                    {item.evidence_inventory && <li>{item.evidence_inventory.length} chứng cứ</li>}
                  </ul>
                  <div className="case-card-actions">
                    <button type="button" className="landing-cta" onClick={() => openDossier(item._id)}>Xem hồ sơ</button>
                    <Link className="landing-secondary" to={`${SETUP_PATH}?case=${encodeURIComponent(item._id)}`}>Chọn vụ án</Link>
                  </div>
                </article>;
              })}
              {visibleCases.length === 0 && <div className="library-notice">
                <h3>Chưa có hồ sơ phù hợp</h3>
                <p>Thử bộ lọc khác hoặc quay lại khi có hồ sơ được công bố.</p>
              </div>}
            </div>
            <Link className="landing-text-link library-suggestion" to="/guide#feedback">Đề xuất tình huống <ArrowRight size={16} aria-hidden="true" /></Link>
          </>}
        </div>
      </section>

      <section id="feedback" className="landing-section landing-feedback" aria-labelledby="feedback-heading">
        <div className="landing-container feedback-grid">
          <div className="landing-section-heading">
            <h2 id="feedback-heading">Đánh giá sau mỗi phiên</h2>
            <p>AI nhận xét phần trình bày của bạn theo từng nhóm kỹ năng tranh tụng. Dùng góp ý để chọn nội dung cần luyện tiếp.</p>
            <Link to="/guide#scoring" className="landing-text-link">Xem cách đánh giá <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className="feedback-details">
            <ClipboardList className="landing-icon" size={23} aria-hidden="true" />
            <div>
              <h3>Kết quả phiên luyện tập</h3>
              <ul>
                <li>Điểm và nhận xét theo tiêu chí</li>
                <li>Điểm mạnh và phần cần cải thiện</li>
                <li>Gợi ý cho phiên luyện tập tiếp theo</li>
              </ul>
              <p className="scoring-note">Chỉ có điểm toàn bài khi đủ dữ liệu đánh giá.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section courtroom-tools" aria-labelledby="courtroom-tools-heading">
        <div className="landing-container">
          <div className="landing-section-heading">
            <h2 id="courtroom-tools-heading">Công cụ trong phòng xử án</h2>
          </div>
          <div className="landing-tool-grid">
            {courtroomTools.map(([Icon, title, description, action, to]) => <article key={title}>
              <Icon className="landing-icon" size={23} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
              {to.startsWith('#') ? <a className="landing-text-link" href={to}>{action}<ArrowRight size={16} aria-hidden="true" /></a>
                : <Link className="landing-text-link" to={to}>{action}<ArrowRight size={16} aria-hidden="true" /></Link>}
            </article>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section landing-start-section">
        <div className="landing-container">
          <div className="landing-final-banner">
            <h2>Bắt đầu phiên luyện tập đầu tiên</h2>
            <div className="final-actions"><StartLink /><Link className="landing-secondary" to="/pricing">Xem bảng giá</Link></div>
          </div>
        </div>
      </section>
    </main>

    <LandingFooter />
    {dossier && <FeedbackModal title="Hồ sơ vụ án" onClose={() => setDossier(null)}>
      {dossier.loading ? <p role="status">Đang tải hồ sơ…</p> : dossier.error ? <p role="alert">{dossier.error}</p> : <CaseDossier courtCase={dossier.data} />}
    </FeedbackModal>}
  </div>;
}
