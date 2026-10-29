import { learnerText } from '../../../shared/learnerText.mjs';
import { isPublicWebUrl, isLocalLawUrl } from '../../../shared/legalSourcePolicy.mjs';

import { legalReferenceText, legalSourceHref } from '../services/references';
import { useState } from 'react';
import { BookOpen, Maximize2 } from 'lucide-react';
import FeedbackModal from './feedback/FeedbackModal';
import './legalBasis.css';

export function LegalCitations({ citations = [], onInsert, insertionDisabled = false }) {
  const [reading, setReading] = useState(null);
  if (!citations.length) return null;
  return <div className="legal-citations mt-3 space-y-3">{citations.map((item, index) => <article key={item.id ?? index} className="legal-citation rounded-xl border border-slate-700 p-3 text-sm">
    <span className="legal-source-badge"><BookOpen size={12}/>{item.source_verification === 'local_read' ? 'Kho tài liệu mô phỏng' : item.source_verification === 'verified' ? 'Nội dung đã đối chiếu' : 'Nguồn cần đối chiếu áp dụng'}</span>
    <p className="font-semibold">{item.title} — {item.law_number}</p>
    <p>{item.document_type} {item.locator ? `· ${item.locator}` : ''}</p>
    {item.source_verification === 'verified' && item.checked_at && <p className="text-slate-600">{item.retrieval_mode === 'live' ? 'Đã đối chiếu nội dung nguồn' : 'Bản lưu đã đối chiếu nội dung'} · {new Date(item.checked_at).toLocaleString('vi-VN')}</p>}
    {item.source_verification === 'web_read' && <p className="text-amber-700">Đã đọc nội dung nguồn web · Pháp luật Việt Nam · Chưa xác minh đầy đủ hiệu lực</p>}
    {item.source_verification === 'local_read' && <p className="text-slate-600">Tài liệu pháp luật trong kho mô phỏng · Nội dung đọc từ tệp được cung cấp</p>}
    {item.source_verification === 'local_read' && isLocalLawUrl(item.source_url) && <a className="text-blue-700 underline" href={legalSourceHref(item.source_url)} target="_blank" rel="noopener noreferrer">Mở tệp nguồn</a>}
    {item.source_verification === 'web_read' && isPublicWebUrl(item.source_url) && <a className="text-blue-700 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn luật đã đọc</a>}
    {item.provision_note && <p>{item.provision_note}</p>}
    {item.excerpt && item.text && <p className="whitespace-pre-wrap">Trích đoạn: {item.excerpt}{item.text.length > item.excerpt.length ? '…' : ''}</p>}
    {item.application_status !== 'verified' && <p className="my-1 text-amber-700">Chưa xác minh đầy đủ thời điểm và điều kiện áp dụng.</p>}
    <p>Mốc tra cứu: {item.application_date ?? 'Chưa rõ'}{item.application_date_to && item.application_date_to !== item.application_date ? ` → ${item.application_date_to}` : ''}</p>
    {learnerText(item.application_reason) && <p>{learnerText(item.application_reason)}</p>}
    {item.source_verification === 'verified' && isPublicWebUrl(item.source_url) && <a className="text-blue-400 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn luật</a>}
    <details className="mt-2"><summary className="cursor-pointer">Đọc điều luật{learnerText(item.version) ? ` · ${learnerText(item.version)}` : ''}</summary><p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap leading-6">{item.text || 'Mở liên kết nguồn để xem nội dung.'}</p></details>
    <button type="button" className="legal-reader-open" onClick={() => setReading(item)}><Maximize2 size={12}/>Mở rộng điều luật</button>
    {onInsert && item.reference_id && item.text && ((['verified', 'web_read'].includes(item.source_verification) && isPublicWebUrl(item.source_url)) || (item.source_verification === 'local_read' && isLocalLawUrl(item.source_url))) && <button disabled={insertionDisabled} onClick={() => onInsert(legalReferenceText(item))} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40">Đưa trích dẫn vào lập luận</button>}
  </article>)}{reading && <FeedbackModal title={reading.title || 'Nội dung điều luật'} onClose={() => setReading(null)}><div className="legal-reader"><div className="legal-reader-meta"><span>{reading.law_number} · {reading.locator}</span><span>{learnerText(reading.version)}</span></div><p className="legal-reader-note">{reading.application_status === 'verified' ? 'Điều kiện áp dụng đã được xác minh theo dữ liệu nguồn.' : 'Chưa xác minh đầy đủ thời điểm và điều kiện áp dụng.'} Mốc tra cứu: {reading.application_date || 'Chưa rõ'}.</p><div className="legal-reader-content" tabIndex={0}>{reading.text || 'Chưa có nội dung điều luật. Mở tệp nguồn ở thẻ trích dẫn để đối chiếu.'}</div><button type="button" onClick={() => setReading(null)}>Quay lại phần tra cứu →</button></div></FeedbackModal>}</div>;
}

export function LegalResearchResult({ research }) {
  if (!research?.candidates?.length) return null;
  return <details className="mt-4 text-sm"><summary className="cursor-pointer">Nguồn tham khảo cần kiểm tra thêm</summary><LegalCitations citations={research.candidates} /></details>;
}
