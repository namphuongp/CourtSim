import ScoringSummary from '../../../components/ScoringSummary';
import LearnerFeedback from '../../../components/feedback/LearnerFeedback';
import { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import './simulationResult.css';
import UpgradeNotice from '../../../components/membership/UpgradeNotice';
import UserHeader from '../../../components/UserHeader';
import { LoadingState } from '../../../components/WorkspaceStates';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

export default function SimulationResult() {
  const { sessionId } = useParams();
  return <div className="user-shell"><UserHeader/><SessionResult key={sessionId} sessionId={sessionId} /></div>;
}

function SessionResult({ sessionId }) {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [optionalFeedback, setOptionalFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [detailView, setDetailView] = useState(false);
  const [activeGroup, setActiveGroup] = useState('all');

  useEffect(() => {
    let active = true;
    api.get(`/v1/sessions/${sessionId}/result`).then(async ({ data }) => {
      if (!active) return;
      let invitation = null;
      try {
        const response = await api.post(`/v1/sessions/${sessionId}/feedback/prompt`, {}, { timeout: 5000 });
        if (response.data.data?.show === true) invitation = response.data.data;
      } catch { /* Tài khoản đã xác minh; lỗi lời mời góp ý không khóa kết quả. */ }
      if (active) { setOptionalFeedback(invitation); setFeedbackOpen(false); setResult(data.data); setError(''); }
    }).catch((requestError) => {
      if (!active) return;
      if (requestError.response?.data?.error?.code === 'SURVEY_REQUIRED') setFeedbackOpen(true);
      else setError(getApiError(requestError, 'Chưa tải được kết quả. Vui lòng thử lại hoặc trở về phiên.'));
    });
    return () => { active = false; };
  }, [sessionId, reload]);

  if (error) return <main className="result-page result-state"><section className="result-card"><p role="alert">{error}</p><button onClick={() => { setError(''); setReload((n) => n + 1); }}>Thử lại</button><Link to={`/simulation/${sessionId}`}>Trở lại phiên</Link></section></main>;
  const finishFeedback = () => {
    setFeedbackOpen(false);
    setReload(n => n + 1);
  };
  if (feedbackOpen || optionalFeedback) return <main className="result-page result-feedback"><div className="result-container"><header className="result-hero"><p>HOÀN THÀNH PHIÊN LUYỆN TẬP</p><h1>Phản hồi trước khi xem kết quả</h1><p>Kết quả đã được lưu. Hoàn tất bước phản hồi để tiếp tục.</p></header><div className="result-feedback-layout"><LearnerFeedback embedded sessionId={sessionId} required={feedbackOpen} initialFormUrl={optionalFeedback?.form_url} onDone={feedbackOpen ? finishFeedback : () => setOptionalFeedback(null)}/><aside className="result-card"><h2>Các bước tiếp theo</h2><ol><li><strong>01 · Kết thúc phiên</strong><p>Các lượt trình bày đã được lưu.</p></li><li><strong>02 · Gửi phản hồi</strong><p>{feedbackOpen ? 'Máy chủ kiểm tra xác nhận từ Google Forms.' : 'Bạn có thể góp ý thêm hoặc bỏ qua.'}</p></li><li><strong>03 · Xem kết quả</strong><p>Đọc nhận xét và chọn kỹ năng luyện tập tiếp.</p></li></ol><Link to="/dashboard/history">Về lịch sử luyện tập →</Link></aside></div></div></main>;
  if (!result) return <main className="result-page result-state"><LoadingState>Đang tải kết quả...</LoadingState></main>;
  return (
    <main className="result-page"><div className="result-container space-y-6">
      <header className="result-hero flex flex-wrap items-center justify-between gap-4"><div><p>Kết quả phiên mô phỏng</p><h1 id="result-heading" tabIndex={-1}>{detailView ? 'Điểm & nhận xét chi tiết' : 'Kết quả luyện tập'}</h1></div><div className="result-hero-actions">{result.criteria?.length > 0 && result.features?.detailedScoring !== false && <button className="result-view-switch" onClick={() => { setDetailView(value => !value); setActiveGroup('all'); }}>{detailView ? 'Xem tổng quan phiên' : 'Điểm & nhận xét chi tiết'}</button>}<button onClick={() => navigate('/dashboard')}><Home size={17} /> Tổng quan</button></div></header>
      {detailView && <nav className="result-group-tabs" aria-label="Lọc nhóm kỹ năng"><button aria-pressed={activeGroup === 'all'} onClick={() => setActiveGroup('all')}>Tất cả tiêu chí</button>{result.criteria.map(group => <button key={group.id} aria-pressed={activeGroup === group.id} onClick={() => setActiveGroup(group.id)}>{group.label}</button>)}</nav>}
      <ScoringSummary key={detailView ? 'detail' : 'overview'} detailsOnly={detailView} activeGroup={activeGroup} result={result} sessionId={sessionId} />
      {result.features?.detailedScoring === false ? <UpgradeNotice /> : <details className="result-details"><summary>Nhận xét lưu cùng kết quả và nguồn pháp luật</summary>
      {result.assessed_max < 100 && <p className="my-3 text-sm">Nhận xét này không xác nhận năng lực ở các tiêu chí chưa chấm.</p>}
      {result.rubric_feedback && <section className="result-rubric-grid grid gap-4 md:grid-cols-2">{Object.entries(result.rubric_feedback).map(([key, item]) => <article key={key} className="result-card space-y-3"><h2>{labels[key]}</h2><p>{item.reason}</p><blockquote>“{item.quote}”</blockquote><p><strong>Điểm mạnh:</strong> {item.strength}</p><p><strong>Thực hành tiếp:</strong> {item.improvement}</p></article>)}</section>}
      <section className="result-two-col grid gap-6 md:grid-cols-2"><article className="result-card"><h2>Nhận xét</h2><p className="whitespace-pre-wrap">{result.feedback}</p></article><article className="result-card result-improvement"><h2>Hướng cải thiện</h2><p className="whitespace-pre-wrap">{result.improvement_suggestions}</p></article></section>
      <section className="result-card result-law"><h2>Căn cứ pháp luật đã sử dụng</h2>{!result.citations?.length && <p>Chưa có căn cứ pháp luật được xác minh trong kết quả này.</p>}<LegalCitations citations={result.citations} /><LegalResearchResult research={result.legal_research} /></section>
      </details>}
      <p className="result-disclaimer">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
