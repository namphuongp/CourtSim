import { learnerText } from '../../../shared/learnerText.mjs';
import { isPublicWebUrl, isLocalLawUrl } from '../../../shared/legalSourcePolicy.mjs';

import { legalReferenceText, legalSourceHref } from '../services/references';
import { useState } from 'react';
import { BookOpen, Maximize2, AlertTriangle, History, CheckCircle, Info } from 'lucide-react';
import FeedbackModal from './feedback/FeedbackModal';
import './legalBasis.css';

export function LegalCitations({ citations = [], onInsert, insertionDisabled = false }) {
  const [reading, setReading] = useState(null);
  if (!citations.length) return null;
  return (
    <div className="legal-citations mt-3 space-y-3">
      {citations.map((item, index) => {
        const isExpired = item.validity_status === 'expired';
        const isAmended = item.validity_status === 'amended';
        const isActive = item.validity_status === 'active';
        return (
          <article
            key={item.id ?? index}
            className={`legal-citation rounded-xl border p-3 text-sm ${
              isExpired ? 'border-amber-300/60 bg-amber-50/20' : 'border-slate-700'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="legal-source-badge">
                <BookOpen size={12} />
                {item.source_verification === 'local_read'
                  ? 'Kho tài liệu mô phỏng'
                  : item.source_verification === 'verified'
                  ? 'Nội dung đã đối chiếu'
                  : 'Nguồn cần đối chiếu áp dụng'}
              </span>

              {isExpired && (
                <span className="legal-validity-badge expired">
                  <AlertTriangle size={11} /> Hết hiệu lực hiện hành
                </span>
              )}
              {isAmended && (
                <span className="legal-validity-badge amended">
                  <Info size={11} /> Đã sửa đổi, bổ sung
                </span>
              )}
              {isActive && (
                <span className="legal-validity-badge active">
                  <CheckCircle size={11} /> Đang có hiệu lực
                </span>
              )}
            </div>

            <p className="font-semibold text-slate-800">
              {item.title} — {item.law_number}
            </p>
            <p className="text-slate-600">
              {item.document_type} {item.locator ? `· ${item.locator}` : ''}
            </p>

            {/* Cảnh báo tình trạng hiệu lực văn bản pháp luật */}
            {item.validity_warning && (
              <div className="legal-validity-box">
                <AlertTriangle size={14} className="validity-box-icon" />
                <div className="validity-box-text">
                  <strong>Cảnh báo tình trạng hiệu lực:</strong>
                  <p>{item.validity_warning}</p>
                </div>
              </div>
            )}

            {item.source_verification === 'verified' && item.checked_at && (
              <p className="text-slate-600 text-[11px]">
                {item.retrieval_mode === 'live' ? 'Đã đối chiếu nội dung nguồn' : 'Bản lưu đã đối chiếu nội dung'} ·{' '}
                {new Date(item.checked_at).toLocaleString('vi-VN')}
              </p>
            )}
            {item.source_verification === 'web_read' && (
              <p className="text-amber-700 text-[11px]">
                Đã đọc nội dung nguồn web · Pháp luật Việt Nam · Chưa xác minh đầy đủ hiệu lực
              </p>
            )}
            {item.source_verification === 'local_read' && (
              <p className="text-slate-600 text-[11px]">
                Tài liệu pháp luật trong kho mô phỏng · Nội dung đọc từ tệp được cung cấp
              </p>
            )}
            {item.source_verification === 'local_read' && isLocalLawUrl(item.source_url) && (
              <a
                className="text-blue-700 underline text-xs"
                href={legalSourceHref(item.source_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở tệp nguồn
              </a>
            )}
            {item.source_verification === 'web_read' && isPublicWebUrl(item.source_url) && (
              <a
                className="text-blue-700 underline text-xs"
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở nguồn luật đã đọc
              </a>
            )}

            {item.provision_note && <p className="text-slate-600 text-xs italic">{item.provision_note}</p>}
            {item.excerpt && item.text && (
              <p className="whitespace-pre-wrap text-slate-700 my-1 bg-slate-50 p-2 rounded border border-slate-200">
                Trích đoạn: {item.excerpt}
                {item.text.length > item.excerpt.length ? '…' : ''}
              </p>
            )}
            {item.application_status !== 'verified' && (
              <p className="my-1 text-amber-700 text-xs">Chưa xác minh đầy đủ thời điểm và điều kiện áp dụng.</p>
            )}
            <p className="text-slate-500 text-[11px]">
              Mốc tra cứu:{' '}
              <strong>
                {item.application_date ?? 'Chưa rõ'}
                {item.application_date_to && item.application_date_to !== item.application_date
                  ? ` → ${item.application_date_to}`
                  : ''}
              </strong>
            </p>
            {learnerText(item.application_reason) && (
              <p className="text-slate-600 text-xs">{learnerText(item.application_reason)}</p>
            )}
            {item.source_verification === 'verified' && isPublicWebUrl(item.source_url) && (
              <a
                className="text-blue-600 underline text-xs block my-1"
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở nguồn luật chính thức ↗
              </a>
            )}

            {/* Lịch sử thay đổi văn bản pháp luật qua các thời kỳ */}
            {item.change_history && item.change_history.length > 0 && (
              <details className="legal-history-details mt-2">
                <summary className="cursor-pointer font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1.5 text-xs select-none">
                  <History size={13} />
                  <span>Lịch sử thay đổi văn bản qua các thời kỳ ({item.change_history.length} mốc)</span>
                </summary>
                <div className="legal-history-timeline mt-2 space-y-2 border-l-2 border-blue-400 pl-3">
                  {item.change_history.map((h, hIdx) => (
                    <div key={hIdx} className="history-step text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`history-tag ${h.type}`}>
                          {h.type === 'original'
                            ? 'Văn bản gốc'
                            : h.type === 'replacement'
                            ? 'Văn bản thay thế'
                            : h.type === 'amendment'
                            ? 'Sửa đổi, bổ sung'
                            : 'Văn bản tiền nhiệm'}
                        </span>
                        <strong className="text-slate-800">{h.title}</strong>
                        {h.law_number && <span className="font-mono text-slate-500">({h.law_number})</span>}
                      </div>
                      {h.effective_from && (
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Ngày bắt đầu có hiệu lực: <strong>{h.effective_from}</strong>
                        </p>
                      )}
                      {h.note && <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">{h.note}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-slate-700">
                Đọc điều luật{learnerText(item.version) ? ` · ${learnerText(item.version)}` : ''}
              </summary>
              <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap leading-6 text-slate-800">
                {item.text || 'Mở liên kết nguồn để xem nội dung.'}
              </p>
            </details>

            <button type="button" className="legal-reader-open" onClick={() => setReading(item)}>
              <Maximize2 size={12} />
              Mở rộng điều luật
            </button>

            {onInsert &&
              item.reference_id &&
              item.text &&
              ((['verified', 'web_read'].includes(item.source_verification) && isPublicWebUrl(item.source_url)) ||
                (item.source_verification === 'local_read' && isLocalLawUrl(item.source_url))) && (
                <button
                  disabled={insertionDisabled}
                  onClick={() => onInsert(legalReferenceText(item))}
                  className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-500 disabled:opacity-40 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  Đưa trích dẫn vào lập luận
                </button>
              )}
          </article>
        );
      })}

      {reading && (
        <FeedbackModal title={reading.title || 'Nội dung điều luật'} onClose={() => setReading(null)}>
          <div className="legal-reader">
            <div className="legal-reader-meta">
              <span>
                {reading.law_number} · {reading.locator}
              </span>
              <span>{learnerText(reading.version)}</span>
            </div>

            {/* Cảnh báo trong modal phóng to */}
            {reading.validity_warning && (
              <div className="legal-validity-box modal-warning">
                <AlertTriangle size={16} className="validity-box-icon" />
                <div className="validity-box-text">
                  <strong>Cảnh báo tình trạng hiệu lực hiện nay:</strong>
                  <p>{reading.validity_warning}</p>
                </div>
              </div>
            )}

            <p className="legal-reader-note">
              {reading.application_status === 'verified'
                ? 'Điều kiện áp dụng đã được xác minh theo dữ liệu nguồn.'
                : 'Chưa xác minh đầy đủ thời điểm và điều kiện áp dụng.'}{' '}
              Mốc tra cứu: {reading.application_date || 'Chưa rõ'}.
            </p>

            {/* Lịch sử thay đổi trong modal */}
            {reading.change_history && reading.change_history.length > 0 && (
              <div className="legal-modal-history my-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <h4 className="font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                  <History size={14} className="text-blue-600" />
                  Lịch sử thay đổi văn bản pháp luật qua các thời kỳ
                </h4>
                <div className="space-y-2 border-l-2 border-blue-400 pl-3">
                  {reading.change_history.map((h, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`history-tag ${h.type}`}>
                          {h.type === 'original'
                            ? 'Văn bản gốc'
                            : h.type === 'replacement'
                            ? 'Văn bản thay thế'
                            : h.type === 'amendment'
                            ? 'Sửa đổi, bổ sung'
                            : 'Văn bản tiền nhiệm'}
                        </span>
                        <strong className="text-slate-800">{h.title}</strong>
                        {h.law_number && <span className="font-mono text-slate-500">({h.law_number})</span>}
                      </div>
                      {h.effective_from && (
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Ngày bắt đầu có hiệu lực: <strong>{h.effective_from}</strong>
                        </p>
                      )}
                      {h.note && <p className="text-slate-600 text-[11px] mt-0.5">{h.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="legal-reader-content" tabIndex={0}>
              {reading.text || 'Chưa có nội dung điều luật. Mở tệp nguồn ở thẻ trích dẫn để đối chiếu.'}
            </div>

            <button type="button" onClick={() => setReading(null)}>
              Quay lại phần tra cứu →
            </button>
          </div>
        </FeedbackModal>
      )}
    </div>
  );
}

export function LegalResearchResult({ research }) {
  if (!research?.candidates?.length) return null;
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium text-slate-700">Nguồn tham khảo cần kiểm tra thêm</summary>
      <LegalCitations citations={research.candidates} />
    </details>
  );
}
