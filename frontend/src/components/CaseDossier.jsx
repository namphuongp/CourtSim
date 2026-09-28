import { roleLabel } from '../services/simulation';
import { learnerText } from '../../../shared/learnerText.mjs';

const eventLabels = { conduct: 'Hành vi', transaction: 'Giao dịch/quyền được xác lập', dispute: 'Tranh chấp', filing: 'Khởi kiện', hearing: 'Xét xử' };
import { EVIDENCE_MIME } from '../services/references';

export default function CaseDossier({ courtCase, role, onInsert, insertionDisabled = false }) {
  if (!courtCase) return <p>Chưa tải được hồ sơ.</p>;
  const c = courtCase;
  return <div className="space-y-5 text-sm leading-7">
    <div><p className="text-blue-400">{learnerText(c.category)}</p><h3 className="text-lg font-bold">{learnerText(c.title)}</h3><p>{learnerText(c.summary)}</p><p className="mt-2 font-semibold">Vai của bạn: {role ? roleLabel(role, c.category) : 'Chọn vai ở bước tiếp theo'}</p></div>
    <section><h3 className="font-bold">Các bên và yêu cầu</h3>{c.parties?.length ? c.parties.map((party, index) => <article key={index} className="mt-2 rounded-lg border border-slate-700 p-3"><strong>{{ plaintiff: 'Nguyên đơn', defendant: 'Bị đơn', other: 'Bên liên quan' }[party.side]}: {learnerText(party.name, 'Chưa có tên')}</strong>{party.claims?.length ? <ul className="list-disc pl-5">{party.claims.map((claim, i) => <li key={i}>{learnerText(claim)}</li>)}</ul> : <p>Chưa có thông tin yêu cầu.</p>}</article>) : <p>Hồ sơ chưa cung cấp thông tin riêng về các bên và yêu cầu.</p>}</section>
    <section><h3 className="font-bold">Mốc thời gian</h3>{c.timeline?.length ? <ul className="space-y-2">{c.timeline.map((event, i) => <li key={i}><strong>{eventLabels[event.kind] ?? 'Sự kiện'} — {event.date || 'Chưa rõ ngày'}{event.date_to && event.date_to !== event.date ? ` đến ${event.date_to}` : ''}</strong><p>{learnerText(event.description)}</p></li>)}</ul> : <p>Chưa có mốc thời gian được nêu rõ trong hồ sơ.</p>}</section>
    <section><h3 className="font-bold">Chứng cứ và tài liệu được nhắc đến</h3>{!c.evidence_inventory?.length && <p>Chưa có danh sách tài liệu riêng. Không mặc định có bản gốc của tài liệu được nhắc trong phần tóm tắt.</p>}
      {c.evidence_inventory?.map((item) => <article key={item.id} draggable={Boolean(onInsert) && !insertionDisabled} onDragStart={(event) => { event.dataTransfer.setData(EVIDENCE_MIME, item.id); event.dataTransfer.effectAllowed = 'copy'; }} className="mt-3 rounded-xl border border-slate-700 p-3">
        <h4 className="font-semibold">{item.code} — {learnerText(item.name)}</h4><p className="text-xs text-slate-400">{item.availability === 'provided' ? 'Có nội dung trong hồ sơ' : 'Chỉ được nhắc đến — chưa có nội dung tài liệu'}</p>
        <p>{learnerText(item.summary, 'Chưa có trích yếu.')}</p><p className="text-xs">Bên cung cấp: {learnerText(item.provided_by, 'Chưa rõ')} · Ngày lập: {item.date || 'Chưa rõ'}</p>
        {item.availability === 'provided' && item.content && <details><summary className="cursor-pointer underline">Đọc nội dung tài liệu</summary><p className="whitespace-pre-wrap">{learnerText(item.content)}</p></details>}
        {onInsert && <button type="button" disabled={insertionDisabled} onClick={() => onInsert(item)} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40" aria-label={`Đưa vào lập luận: ${item.name}`}>Đưa vào lập luận</button>}
      </article>)}
    </section>
    <details><summary className="cursor-pointer font-semibold">Đọc toàn bộ nội dung hồ sơ</summary><p className="mt-2 whitespace-pre-wrap">{learnerText(c.full_document, 'Chưa có nội dung bổ sung.')}</p></details>
    {/^https:\/\//.test(c.source_url ?? '') && <details><summary className="cursor-pointer underline">Nguồn bản án — có tiết lộ kết quả xét xử</summary><a className="text-blue-400 underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn bản án</a></details>}
  </div>;
}
