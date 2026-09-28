import { learnerText } from '../../../shared/learnerText.mjs';

import { legalReferenceText } from '../services/references';

export function LegalCitations({ citations = [], onInsert, insertionDisabled = false }) {
  if (!citations.length) return null;
  return <div className="mt-3 space-y-3">{citations.map((item) => <article key={item.id} className="rounded-xl border border-slate-700 p-3 text-sm">
    <p className="font-semibold">{item.locator} — {item.law_number}</p>
    {item.verification_status !== 'verified' && <p className="my-1 text-amber-400">Cần kiểm tra hiệu lực của điều luật này.</p>}
    <p>Mốc tra cứu: {item.application_date ?? 'Chưa rõ'}{item.application_date_to && item.application_date_to !== item.application_date ? ` → ${item.application_date_to}` : ''}</p>
    {item.verification_status === 'verified' && learnerText(item.application_reason) && <p>{learnerText(item.application_reason)}</p>}
    {/^https:\/\//.test(item.source_url ?? '') && <a className="text-blue-400 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Xem nguồn văn bản</a>}
    <details className="mt-2"><summary className="cursor-pointer">Đọc điều luật{learnerText(item.version) ? ` · ${learnerText(item.version)}` : ''}</summary><p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap leading-6">{item.text || 'Mở liên kết nguồn để xem nội dung.'}</p></details>
    {onInsert && item.reference_id && item.verification_status === 'verified' && <button disabled={insertionDisabled} onClick={() => onInsert(legalReferenceText(item))} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40">Đưa trích dẫn vào lập luận</button>}
  </article>)}</div>;
}

export function LegalResearchResult({ research }) {
  if (!research?.candidates?.length) return null;
  return <details className="mt-4 text-sm"><summary className="cursor-pointer">Nguồn tham khảo cần kiểm tra thêm</summary><LegalCitations citations={research.candidates} /></details>;
}
