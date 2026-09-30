import { learnerText } from '../../../shared/learnerText.mjs';
import { isVbplUrl, isPublicWebUrl, isLocalLawUrl } from '../../../shared/legalSourcePolicy.mjs';

import { legalReferenceText, legalSourceHref } from '../services/references';

export function LegalCitations({ citations = [], onInsert, insertionDisabled = false }) {
  if (!citations.length) return null;
  return <div className="mt-3 space-y-3">{citations.map((item) => <article key={item.id} className="rounded-xl border border-slate-700 p-3 text-sm">
    <p className="font-semibold">{item.title} — {item.law_number}</p>
    <p>{item.document_type} {item.locator ? `· ${item.locator}` : ''}</p>
    {item.source_verification === 'verified' && item.checked_at && <p className="text-slate-600">{item.retrieval_mode === 'live' ? 'Đối chiếu trực tiếp vbpl.vn' : 'Bản lưu đã đối chiếu vbpl.vn'} · {new Date(item.checked_at).toLocaleString('vi-VN')}</p>}
    {item.source_verification === 'web_read' && <p className="text-amber-700">Đã đọc nội dung nguồn web · Pháp luật Việt Nam · Chưa xác minh đầy đủ hiệu lực</p>}
    {item.source_verification === 'local_read' && <p className="text-slate-600">Tài liệu pháp luật trong kho mô phỏng · Nội dung đọc từ tệp được cung cấp</p>}
    {item.source_verification === 'local_read' && isLocalLawUrl(item.source_url) && <a className="text-blue-700 underline" href={legalSourceHref(item.source_url)} target="_blank" rel="noopener noreferrer">Mở tệp nguồn</a>}
    {item.source_verification === 'web_read' && isPublicWebUrl(item.source_url) && <a className="text-blue-700 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn luật đã đọc</a>}
    {item.provision_note && <p>{item.provision_note}</p>}
    {item.excerpt && item.text && <p className="whitespace-pre-wrap">Trích đoạn: {item.excerpt}{item.text.length > item.excerpt.length ? '…' : ''}</p>}
    {item.application_status !== 'verified' && <p className="my-1 text-amber-700">Chưa xác minh đầy đủ thời điểm và điều kiện áp dụng.</p>}
    <p>Mốc tra cứu: {item.application_date ?? 'Chưa rõ'}{item.application_date_to && item.application_date_to !== item.application_date ? ` → ${item.application_date_to}` : ''}</p>
    {learnerText(item.application_reason) && <p>{learnerText(item.application_reason)}</p>}
    {item.source_verification === 'verified' && isVbplUrl(item.source_url) && <a className="text-blue-400 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn vbpl.vn</a>}
    <details className="mt-2"><summary className="cursor-pointer">Đọc điều luật{learnerText(item.version) ? ` · ${learnerText(item.version)}` : ''}</summary><p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap leading-6">{item.text || 'Mở liên kết nguồn để xem nội dung.'}</p></details>
    {onInsert && item.reference_id && item.text && ((item.source_verification === 'verified' && isVbplUrl(item.source_url)) || (item.source_verification === 'web_read' && isPublicWebUrl(item.source_url)) || (item.source_verification === 'local_read' && isLocalLawUrl(item.source_url))) && <button disabled={insertionDisabled} onClick={() => onInsert(legalReferenceText(item))} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40">Đưa trích dẫn vào lập luận</button>}
  </article>)}</div>;
}

export function LegalResearchResult({ research }) {
  if (!research?.candidates?.length) return null;
  return <details className="mt-4 text-sm"><summary className="cursor-pointer">Nguồn tham khảo cần kiểm tra thêm</summary><LegalCitations citations={research.candidates} /></details>;
}
