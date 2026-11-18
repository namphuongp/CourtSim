import ScoringSummary from '../../../components/ScoringSummary';
import LearnerFeedback from '../../../components/feedback/LearnerFeedback';
import { LegalCitations, LegalResearchResult } from '../../../components/LegalBasis';
import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiError } from '../../../services/api';
import { PRACTICE_CASES_PATH } from '../../../services/simulation';
import './simulationResult.css';
import UpgradeNotice from '../../../components/membership/UpgradeNotice';
import PdfExportModal from '../../../components/courtroom/PdfExportModal';
import UserHeader from '../../../components/UserHeader';
import { LoadingState } from '../../../components/WorkspaceStates';

const labels = {
  legal_knowledge: 'Kiến thức pháp lý',
  reasoning: 'Lập luận',
  evidence_use: 'Sử dụng chứng cứ',
  courtroom_skill: 'Kỹ năng tranh tụng'
};

export default function SimulationResult() {
  const { sessionId } = useParams();
  return (
    <div className="user-shell">
      <UserHeader />
      <SessionResult key={sessionId} sessionId={sessionId} />
    </div>
  );
}

function SessionResult({ sessionId }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [pdfExportOpen, setPdfExportOpen] = useState(false);
  const [detailView, setDetailView] = useState(false);
  const [activeGroup, setActiveGroup] = useState('all');

  useEffect(() => {
    let active = true;
    api.get(`/v1/sessions/${sessionId}/result`).then(async ({ data }) => {
      if (!active) return;
      let inviteFeedback = false;
      try {
        const response = await api.post(`/v1/sessions/${sessionId}/feedback/prompt`, {}, { timeout: 5000 });
        inviteFeedback = response.data.data?.show === true;
      } catch {
        /* Tài khoản đã xác minh; lỗi lời mời góp ý không khóa kết quả. */
      }
      if (active) {
        setShowFeedback(inviteFeedback);
        setResult(data.data || {});
        setError('');
      }
    }).catch((requestError) => {
      if (!active) return;
      setError(getApiError(requestError, 'Chưa tải được kết quả. Vui lòng thử lại hoặc trở về phiên.'));
    });
    return () => { active = false; };
  }, [sessionId, reload]);

  if (error) {
    return (
      <main className="result-page result-state">
        <section className="result-card">
          <p role="alert">{error}</p>
          <button onClick={() => { setError(''); setReload((n) => n + 1); }}>Thử lại</button>
          <Link to={`/simulation/${sessionId}`}>Trở lại phiên</Link>
        </section>
      </main>
    );
  }

  if (showFeedback) {
    return (
      <main className="result-page result-feedback">
        <div className="result-container">
          <header className="result-heading">
            <h1>Phiên luyện tập đã kết thúc</h1>
            <p>Kết quả của bạn đã sẵn sàng.</p>
          </header>
          <div className="result-feedback-layout">
            <LearnerFeedback embedded sessionId={sessionId} onDone={() => {
              setShowFeedback(false);
              requestAnimationFrame(() => document.getElementById('result-heading')?.focus());
            }} />
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="result-page result-state">
        <LoadingState>Đang tải kết quả...</LoadingState>
      </main>
    );
  }

  const canViewDetailedScoring = result.features?.detailedScoring !== false;
  const hasCriteria = Array.isArray(result.criteria) && result.criteria.length > 0;
  const isFreeTrial = result.features?.isFreeTrial === true;

  return (
    <main className="result-page">
      <div className="result-container space-y-6">
        <header className="result-heading result-overview-heading">
          <h1 id="result-heading" tabIndex={-1}>{detailView ? 'Điểm & nhận xét chi tiết' : 'Kết quả luyện tập'}</h1>
          <Link className="result-practice-link" to={PRACTICE_CASES_PATH}>Chọn vụ án</Link>
        </header>
        <nav className="result-tools" aria-label="Công cụ kết quả">
          {hasCriteria && canViewDetailedScoring && (
            <button type="button" onClick={() => { setDetailView(value => !value); setActiveGroup('all'); }}>
              {detailView ? 'Xem tổng quan phiên' : 'Điểm & nhận xét chi tiết'}
            </button>
          )}
          <button type="button" onClick={() => setPdfExportOpen(true)}>
            <FileDown size={16} aria-hidden="true" /> Xuất PDF
          </button>
        </nav>

        {detailView && hasCriteria && canViewDetailedScoring && (
          <nav className="result-group-tabs" aria-label="Lọc nhóm kỹ năng">
            <button aria-pressed={activeGroup === 'all'} onClick={() => setActiveGroup('all')}>
              Tất cả tiêu chí
            </button>
            {result.criteria.map(group => (
              <button key={group.id} aria-pressed={activeGroup === group.id} onClick={() => setActiveGroup(group.id)}>
                {group.label}
              </button>
            ))}
          </nav>
        )}

        {/* Khối Điểm tổng quan & Bảng tiêu chí chấm điểm */}
        <ScoringSummary
          key={detailView ? 'detail' : 'overview'}
          detailsOnly={detailView}
          activeGroup={activeGroup}
          result={result}
          sessionId={sessionId}
        />

        {/* Thông báo quyền lợi nếu tài khoản Free ngoài 2 case dùng thử bị giới hạn */}
        {!canViewDetailedScoring && <UpgradeNotice />}

        {result.assessed_max < 100 && (
          <p className="my-2 text-sm text-slate-500">
            Lưu ý: Nhận xét này căn cứ trên các tiêu chí đã đối chiếu dữ liệu đủ điều kiện, không tính điểm phạt ở các mục chưa đủ cơ sở đánh giá.
          </p>
        )}

        {/* Nhận xét chuyên sâu theo 4 kỹ năng tố tụng nếu có và được phép xem */}
        {canViewDetailedScoring && result.rubric_feedback && Object.keys(result.rubric_feedback).length > 0 && (
          <section className="result-rubric-grid grid gap-4 md:grid-cols-2" aria-label="Nhận xét theo nhóm kỹ năng">
            {Object.entries(result.rubric_feedback).map(([key, item]) => (
              <article key={key} className="result-card space-y-3">
                <h2>{labels[key] || key}</h2>
                <p>{item.reason}</p>
                {item.quote && <blockquote>“{item.quote}”</blockquote>}
                {item.strength && <p><strong>Điểm mạnh:</strong> {item.strength}</p>}
                {item.improvement && <p><strong>Thực hành tiếp:</strong> {item.improvement}</p>}
              </article>
            ))}
          </section>
        )}

        {/* Khối Nhận xét của Hội đồng & Gợi ý hướng cải thiện */}
        {canViewDetailedScoring && (
          <section className={detailView ? 'result-two-col grid gap-6 md:grid-cols-2' : 'result-two-col'} aria-label="Đánh giá và gợi ý cải thiện">
            {detailView && (
              <article className="result-card">
                <h2>Nhận xét của Hội đồng</h2>
                <p className="whitespace-pre-wrap">{result.feedback || 'Chưa có nhận xét tổng quan được lưu cho phiên này.'}</p>
              </article>
            )}
            <article className="result-card result-improvement">
              <h2>Gợi ý hướng cải thiện</h2>
              <p className="whitespace-pre-wrap">{result.improvement_suggestions || 'Chưa có gợi ý cải thiện được lưu cho phiên này.'}</p>
            </article>
          </section>
        )}

        {/* Căn cứ pháp luật đã sử dụng */}
        <section className="result-card result-law" aria-label="Căn cứ pháp luật đã sử dụng">
          <h2>Căn cứ pháp luật đã sử dụng</h2>
          {!result.citations?.length && <p>Chưa có căn cứ pháp luật được xác minh trong kết quả này.</p>}
          <LegalCitations citations={result.citations} />
          <LegalResearchResult research={result.legal_research} />
        </section>

        {isFreeTrial && (
          <details className="result-card result-trial">
            <summary>Quyền sử dụng trong phiên dùng thử</summary>
            <p>Hai phiên dùng thử có bảng điểm chi tiết, nhận xét và gợi ý luyện tập, Trợ lý luật, hồ sơ chứng cứ, sổ tay, giọng đọc và xuất PDF.</p>
            <p>Gói Pro có thêm phân tích tiến bộ dài hạn và không giới hạn số lượt mở phiên.</p>
          </details>
        )}

        <p className="result-disclaimer">Kết quả chỉ phục vụ học tập, không phải tư vấn hoặc kết luận pháp lý.</p>
      </div>

      <PdfExportModal
        open={pdfExportOpen}
        onClose={() => setPdfExportOpen(false)}
        sessionId={sessionId}
        result={result}
        initialType="result"
      />
    </main>
  );
}
