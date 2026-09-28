import { useState } from 'react';
import api from '../services/api';

export function LegalCitations({ citations = [] }) {
  if (!citations.length) return <p className="text-sm text-slate-400">Chưa có căn cứ đủ điều kiện viện dẫn trong phần này.</p>;
  return <div className="space-y-3">{citations.map((item) => <details key={item.id} className="rounded-xl border border-slate-700 p-3 text-sm">
    <summary className="cursor-pointer font-semibold">{item.locator} — {item.law_number} · {item.verification_status === 'verified' ? 'Đã xác minh nguồn và phạm vi tra cứu' : 'Chưa xác minh'}</summary>
    <p className="mt-2">Phiên bản: {item.version ?? 'Kết quả cũ chưa lưu phiên bản chi tiết'}</p>
    <p>Mốc: {item.application_date ?? 'Chưa xác định'}{item.application_date_to && item.application_date_to !== item.application_date ? ` → ${item.application_date_to}` : ''}</p>
    <p className="my-2">{item.application_reason ?? 'Chưa lưu giải thích áp dụng.'}</p>
    {/^https:\/\//.test(item.source_url ?? '') && <a className="text-blue-400 underline" href={item.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn văn bản</a>}
    {item.history_url && <a className="ml-3 text-blue-400 underline" href={item.history_url} target="_blank" rel="noopener noreferrer">Lịch sử hiệu lực</a>}
    <p className="mt-2 text-xs text-slate-400">{item.page_source_file ?? item.source_files?.join(', ')}{item.page_from ? ` · Trang ${item.page_from}` : ''}</p>
    <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap leading-6">{item.text}</p>
  </details>)}</div>;
}

export function LegalResearchResult({ research }) {
  if (!research) return null;
  return <div className="space-y-3 text-sm">
    <p className="text-amber-300">{research.legal_assessment_available ? 'Đã đối chiếu các mốc trong phạm vi dữ liệu hiện có; cần kiểm tra điều kiện áp dụng cụ thể.' : 'Chưa xác minh được căn cứ pháp luật đầy đủ. Bạn vẫn có thể luyện lập luận và đánh giá chứng cứ.'}</p>
    {research.issues?.map((issue) => <p key={issue.id}><strong>{issue.label}:</strong> {issue.date ? `${issue.date}${issue.date_to !== issue.date ? ` → ${issue.date_to}` : ''}` : 'Chưa rõ'} — {issue.verification_status === 'verified' ? 'Đã xác minh phạm vi tra cứu' : 'Chưa xác minh'}. {issue.reason}</p>)}
    {research.warnings?.map((warning) => <p key={warning} className="text-amber-300">{warning}</p>)}
    {research.citations && <LegalCitations citations={research.citations} />}
    {!!research.candidates?.length && <details><summary className="cursor-pointer underline">Văn bản tham khảo cần đối chiếu — không phải căn cứ AI đã dùng</summary><LegalCitations citations={research.candidates} /></details>}
  </div>;
}

export default function LegalBasis({ sessionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function search() {
    if (loading) return;
    setLoading(true); setError('');
    try { const response = await api.get(`/v1/sessions/${sessionId}/legal-basis`); setData(response.data.data); }
    catch { setError('Chưa xác minh được căn cứ pháp luật. Bạn có thể thử tra cứu lại và tiếp tục phiên.'); }
    finally { setLoading(false); }
  }
  return <section className="my-4 space-y-3 border-t border-slate-700 pt-3"><h3 className="font-bold">Tra cứu căn cứ pháp luật</h3>
    <button disabled={loading} onClick={search} className="rounded-lg bg-blue-600 px-3 py-2 disabled:opacity-50">{loading ? 'Đang đối chiếu nguồn...' : data || error ? 'Tra cứu lại' : 'Tra cứu theo hồ sơ và các mốc'}</button>
    {error && <p role="status" className="text-sm text-amber-300">{error}</p>}<LegalResearchResult research={data} />
  </section>;
}
