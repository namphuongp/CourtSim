import ScoringSummary from '../../../components/ScoringSummary';
import LearnerFeedback from '../../../components/feedback/LearnerFeedback';
import { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import './simulationResult.css';

const labels = { legal_knowledge: 'Kiến thức pháp lý', reasoning: 'Lập luận', evidence_use: 'Sử dụng chứng cứ', courtroom_skill: 'Kỹ năng tranh tụng' };

export default function SimulationResult() {
  const { sessionId } = useParams();
  return <SessionResult key={sessionId} sessionId={sessionId} />;
}

function SessionResult({ sessionId }) {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [optionalFeedback, setOptionalFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

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
  if (feedbackOpen) return <main className="result-page result-feedback"><LearnerFeedback sessionId={sessionId} onDone={finishFeedback} /></main>;
  if (optionalFeedback) return <main className="result-page result-feedback"><LearnerFeedback required={false} initialFormUrl={optionalFeedback.form_url} onDone={() => setOptionalFeedback(null)} /></main>;
  if (!result) return <main className="result-page result-state" role="status"><section className="result-card">Đang tải kết quả...</section></main>;
  return (
    <main className="result-page"><div className="result-container space-y-6">
      <header className="result-hero flex flex-wrap items-center justify-between gap-4"><div><p>Kết quả phiên mô phỏng</p><h1 id="result-heading" tabIndex={-1}>Kết quả luyện tập</h1></div><button onClick={() => navigate('/dashboard')}><Home size={17} /> Tổng quan</button></header>
      <ScoringSummary result={result} sessionId={sessionId} />
      <details className="result-details"><summary>Nhận xét lưu cùng kết quả và nguồn pháp luật</summary>
      {result.assessed_max < 100 && <p className="my-3 text-sm">Nhận xét này không xác nhận năng lực ở các tiêu chí chưa chấm.</p>}
      {result.rubric_feedback && <section className="result-rubric-grid grid gap-4 md:grid-cols-2">{Object.entries(result.rubric_feedback).map(([key, item]) => <article key={key} className="result-card space-y-3"><h2>{labels[key]}</h2><p>{item.reason}</p><blockquote>“{item.quote}”</blockquote><p><strong>Điểm mạnh:</strong> {item.strength}</p><p><strong>Thực hành tiếp:</strong> {item.improvement}</p></article>)}</section>}
      <section className="result-two-col grid gap-6 md:grid-cols-2"><article className="result-card"><h2>Nhận xét</h2><p className="whitespace-pre-wrap">{result.feedback}</p></article><article className="result-card result-improvement"><h2>Hướng cải thiện</h2><p className="whitespace-pre-wrap">{result.improvement_suggestions}</p></article></section>
      <section className="result-card result-law"><h2>Căn cứ pháp luật đã sử dụng</h2>{!result.citations?.length && <p>Chưa có căn cứ pháp luật được xác minh trong kết quả này.</p>}<LegalCitations citations={result.citations} /><LegalResearchResult research={result.legal_research} /></section>
      </details>
      <p className="result-disclaimer">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
    </div></main>
  );
}
