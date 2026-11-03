import { BookOpen, Calendar, Check, ExternalLink, FileText, Scale, Shield, Users, X } from 'lucide-react';
import { roleLabel } from '../../services/simulation';

export default function CaseQuickSummaryModal({
  open,
  onClose,
  courtCase,
  session,
  onOpenFullDossier,
}) {
  if (!open || !courtCase) return null;

  const parties = courtCase.parties || [];
  const plaintiff = parties.find((p) => p.side === 'plaintiff') || { name: 'Nguyên đơn', claims: [] };
  const defendant = parties.find((p) => p.side === 'defendant') || { name: 'Bị đơn', claims: [] };
  const userRoleText = roleLabel(session?.user_court_role, courtCase.category, courtCase);
  const eventDate = session?.case_event_date || courtCase.reference_date || 'Chưa xác định';
  const evidences = (courtCase.evidence_inventory || []).slice(0, 4);

  return (
    <div
      className="case-summary-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-quick-summary-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="case-summary-modal-card">
        {/* Modal Header */}
        <div className="case-summary-modal-header">
          <div className="flex items-center gap-2">
            <div className="summary-header-icon" aria-hidden="true">
              <Scale size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 id="case-quick-summary-title" className="summary-modal-title">
                Tóm tắt hồ sơ vụ án
              </h2>
              <p className="summary-modal-subtitle">
                Thông tin tranh chấp cốt lõi và các đương sự
              </p>
            </div>
          </div>
          <button
            type="button"
            className="summary-close-btn"
            onClick={onClose}
            aria-label="Đóng bảng tóm tắt"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="case-summary-modal-body">
          {/* Case Title & Tags Bar */}
          <div className="summary-case-header-block">
            <h3 className="summary-case-title">{courtCase.title}</h3>
            <div className="summary-badges-row">
              {courtCase.category && (
                <span className="summary-badge summary-badge-category">
                  🏷️ {courtCase.category.toUpperCase()}
                </span>
              )}
              <span className="summary-badge summary-badge-date">
                <Calendar size={12} className="inline mr-1" />
                Mốc sự kiện: <strong>{eventDate}</strong>
              </span>
              <span className="summary-badge summary-badge-role">
                Tư cách của bạn: <strong>{userRoleText}</strong>
              </span>
            </div>
          </div>

          {/* Đương sự 2 bên (Parties Comparison) */}
          <div className="summary-parties-grid">
            <div className="party-card party-plaintiff">
              <div className="party-card-header">
                <span className="party-role-tag plaintiff-tag">⚖️ NGUYÊN ĐƠN</span>
                <strong className="party-name">{plaintiff.name}</strong>
              </div>
              <div className="party-claims-list">
                <span className="claims-heading">Yêu cầu khởi kiện:</span>
                {plaintiff.claims && plaintiff.claims.length > 0 ? (
                  <ul>
                    {plaintiff.claims.map((claim, idx) => (
                      <li key={idx}>• {claim}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 italic text-xs">Yêu cầu được nêu chi tiết trong đơn khởi kiện.</p>
                )}
              </div>
            </div>

            <div className="party-card party-defendant">
              <div className="party-card-header">
                <span className="party-role-tag defendant-tag">🛡️ BỊ ĐƠN</span>
                <strong className="party-name">{defendant.name}</strong>
              </div>
              <div className="party-claims-list">
                <span className="claims-heading">Quan điểm phản bác / bảo vệ:</span>
                {defendant.claims && defendant.claims.length > 0 ? (
                  <ul>
                    {defendant.claims.map((claim, idx) => (
                      <li key={idx}>• {claim}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 italic text-xs">Quan điểm được nêu trong bản tự khai và ý kiến tại tòa.</p>
                )}
              </div>
            </div>
          </div>

          {/* Tóm tắt nội dung tranh chấp cốt lõi */}
          <div className="summary-section">
            <h4 className="summary-section-heading">
              <FileText size={15} className="text-sky-600 inline mr-1.5" />
              Tình tiết vụ việc cốt lõi
            </h4>
            <div className="summary-content-box">
              <p>{courtCase.summary || 'Không có tóm tắt vụ việc.'}</p>
            </div>
          </div>

          {/* Tài liệu chứng cứ then chốt */}
          {evidences.length > 0 && (
            <div className="summary-section">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="summary-section-heading m-0">
                  <BookOpen size={15} className="text-indigo-600 inline mr-1.5" />
                  Chứng cứ tiêu biểu ({courtCase.evidence_inventory?.length || 0} tài liệu)
                </h4>
                {onOpenFullDossier && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullDossier();
                    }}
                    className="view-all-dossier-link"
                  >
                    Mở hồ sơ đầy đủ <ExternalLink size={12} className="inline ml-1" />
                  </button>
                )}
              </div>
              <div className="summary-evidence-list">
                {evidences.map((ev) => (
                  <div key={ev.id || ev.code} className="summary-evidence-item">
                    <div className="evidence-header">
                      <strong className="evidence-name">{ev.name || ev.id}</strong>
                      {ev.provided_by && (
                        <span className="evidence-provider">Nguồn: {ev.provided_by}</span>
                      )}
                    </div>
                    {ev.summary && <p className="evidence-summary-text">{ev.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="case-summary-modal-footer">
          {onOpenFullDossier && (
            <button
              type="button"
              className="summary-btn-dossier"
              onClick={() => {
                onClose();
                onOpenFullDossier();
              }}
            >
              <BookOpen size={14} className="inline mr-1.5" />
              Mở toàn bộ Hồ sơ vụ án (Dossier)
            </button>
          )}
          <button
            type="button"
            className="summary-btn-close"
            onClick={onClose}
          >
            Đóng bảng tóm tắt
          </button>
        </div>
      </div>
    </div>
  );
}
