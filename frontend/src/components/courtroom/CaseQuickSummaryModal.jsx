import { BookOpen } from 'lucide-react';
import FeedbackModal from '../feedback/FeedbackModal';
import { roleLabel } from '../../services/simulation';
import TrialPhaseStepper from './TrialPhaseStepper';

export default function CaseQuickSummaryModal({
  open,
  onClose,
  courtCase,
  session,
  stageIndex,
  completed,
  onOpenFullDossier,
}) {
  if (!open || !courtCase) return null;

  const parties = courtCase.parties ?? [];
  const role = roleLabel(session?.user_court_role, courtCase.category, courtCase);
  const eventDate = session?.case_event_date || courtCase.reference_date || 'Chưa xác định';
  const currentIssue = session?.conversation?.hearing_state?.current_issue?.label;
  const evidences = courtCase.evidence_inventory ?? [];

  return (
    <FeedbackModal title="Thông tin vụ án" onClose={onClose}>
      <div className="room-case-details">
        <h3 className="summary-case-title">{courtCase.title}</h3>
        <dl className="room-case-context">
          {courtCase.category && <div><dt>Lĩnh vực</dt><dd>{courtCase.category}</dd></div>}
          <div><dt>Vai của bạn</dt><dd>{role}</dd></div>
          <div><dt>Mốc tra cứu</dt><dd>{eventDate}</dd></div>
          {currentIssue && !completed && <div><dt>Trọng tâm</dt><dd>{currentIssue}</dd></div>}
        </dl>
        <TrialPhaseStepper currentStageIndex={stageIndex} completed={completed} />

        <section className="summary-section">
          <h3 className="summary-section-heading">Các bên và yêu cầu</h3>
          <div className="summary-parties-grid">
            {[
              ['plaintiff', 'Nguyên đơn', 'Yêu cầu được nêu chi tiết trong đơn khởi kiện.'],
              ['defendant', 'Bị đơn', 'Quan điểm được nêu trong bản tự khai và ý kiến tại tòa.'],
            ].map(([side, label, fallback]) => {
              const party = parties.find(item => item.side === side);
              return (
                <div key={side} className={'party-card party-' + side}>
                  <h4 className="party-card-header"><span>{label}</span> <strong className="party-name">{party?.name ?? label}</strong></h4>
                  {party?.claims?.length ? (
                    <ul className="party-claims-list">
                      {party.claims.map((claim, index) => <li key={index}>{claim}</li>)}
                    </ul>
                  ) : <p className="party-claims-list">{fallback}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="summary-section">
          <h3 className="summary-section-heading">Tình tiết vụ việc</h3>
          <div className="summary-content-box">
            <p>{courtCase.summary || 'Không có tóm tắt vụ việc.'}</p>
          </div>
        </section>

        {evidences.length > 0 && (
          <section className="summary-section">
            <h3 className="summary-section-heading">Chứng cứ tiêu biểu ({evidences.length} tài liệu)</h3>
            <ul className="summary-evidence-list">
              {evidences.slice(0, 4).map(evidence => (
                <li key={evidence.id || evidence.code} className="summary-evidence-item">
                  <div className="evidence-header">
                    <strong className="evidence-name">{evidence.name || evidence.id}</strong>
                    {evidence.provided_by && <span className="evidence-provider">Nguồn: {evidence.provided_by}</span>}
                  </div>
                  {evidence.summary && <p className="evidence-summary-text">{evidence.summary}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {onOpenFullDossier && (
          <button
            type="button"
            className="summary-btn-dossier"
            onClick={() => {
              onClose();
              onOpenFullDossier();
            }}
          >
            <BookOpen size={15} aria-hidden="true" /> Mở hồ sơ đầy đủ
          </button>
        )}
      </div>
    </FeedbackModal>
  );
}
