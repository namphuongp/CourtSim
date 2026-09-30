import { roleLabel } from '../services/simulation';
import { learnerText } from '../../../shared/learnerText.mjs';
import { evidenceSummary } from '../../../shared/dialogueText.mjs';
import { canCiteEvidence } from '../../../shared/casePresentation.mjs';

const eventLabels = { conduct: 'Hành vi', transaction: 'Giao dịch/quyền được xác lập', dispute: 'Tranh chấp', filing: 'Khởi kiện', hearing: 'Xét xử' };
import { EVIDENCE_MIME } from '../services/references';

export default function CaseDossier({ courtCase, role, onInsert, insertionDisabled = false }) {
  if (!courtCase) return <p>Chưa tải được hồ sơ vụ án. Vui lòng đóng và mở lại.</p>;
  const c = courtCase;
  return <div className="space-y-5 text-sm leading-7">
    <div><p className="text-blue-400">{learnerText(c.category)}</p><h3 className="text-lg font-bold">{learnerText(c.title)}</h3><p>{learnerText(c.summary)}</p><p className="mt-2 font-semibold">Vai của bạn: {role ? roleLabel(role, c.category, c) : 'Chọn vai ở bước tiếp theo'}</p></div>
    {c.practice_context && <section><h3 className="font-bold">Bối cảnh luyện tập phúc thẩm</h3><p>{c.practice_context.overview}</p><p>Ngày phúc thẩm: {c.practice_context.hearing_date || 'Chưa xác định'} · Số bản án phúc thẩm: {c.practice_context.judgment_number || 'Chưa xác định'}</p><details><summary className="cursor-pointer underline">Giới hạn nguồn và số liệu cần đối chiếu</summary><ul className="list-disc pl-5">{c.practice_context.limitations?.map(text => <li key={text}>{text}</li>)}</ul></details><h4 className="mt-3 font-semibold">Vấn đề cần xử lý</h4><ul className="list-disc pl-5">{c.practice_context.issues?.map(text => <li key={text}>{text}</li>)}</ul></section>}
    <section><h3 className="font-bold">Các bên và yêu cầu</h3>{c.parties?.length ? c.parties.map((party, index) => <article key={index} className="mt-2 rounded-lg border border-slate-700 p-3"><strong>{{ plaintiff: 'Nguyên đơn', defendant: 'Bị đơn', other: 'Bên liên quan' }[party.side]}: {learnerText(party.name, 'Chưa có tên')}</strong>{party.claims?.length ? <ul className="list-disc pl-5">{party.claims.map((claim, i) => <li key={i}>{learnerText(claim)}</li>)}</ul> : <p>Chưa có thông tin yêu cầu.</p>}</article>) : <p>Hồ sơ chưa cung cấp thông tin riêng về các bên và yêu cầu.</p>}</section>
    <section><h3 className="font-bold">Mốc thời gian</h3>{c.timeline?.length ? <ul className="space-y-2">{c.timeline.map((event, i) => <li key={i}><strong>{eventLabels[event.kind] ?? 'Sự kiện'} — {event.date || 'Chưa rõ ngày'}{event.date_to && event.date_to !== event.date ? ` đến ${event.date_to}` : ''}</strong><p>{learnerText(event.description)}</p></li>)}</ul> : <p>Chưa có mốc thời gian được nêu rõ trong hồ sơ.</p>}</section>
    {!!c.recorded_events?.length && <section><h3 className="font-bold">Thông tin được hồ sơ ghi nhận</h3><ul className="list-disc pl-5">{c.recorded_events.map((event, index) => <li key={index}>{event.source_quote ?? learnerText(event.text)}</li>)}</ul></section>}
    <section><h3 className="font-bold">Chứng cứ</h3>{!c.evidence_inventory?.length && <p>Hồ sơ chưa có danh sách chứng cứ.</p>}
      {c.evidence_inventory?.map((item) => <article id={'evidence-' + item.id} key={item.id} draggable={Boolean(onInsert) && !insertionDisabled && canCiteEvidence(item, c)} onDragStart={(event) => { if (!canCiteEvidence(item, c)) { event.preventDefault(); return; } event.dataTransfer.setData(EVIDENCE_MIME, item.id); event.dataTransfer.effectAllowed = 'copy'; }} className="mt-3 rounded-xl border border-slate-700 p-3">
        <h4 className="font-semibold">{learnerText(item.name)}</h4>
        {evidenceSummary(item.summary) && <p>{item.summary === item.source_quote ? item.summary : learnerText(evidenceSummary(item.summary))}</p>}<p className="text-xs">Bên cung cấp: {learnerText(item.provided_by, 'Chưa rõ')} · Ngày lập: {item.date || 'Chưa rõ'}</p>
        {item.source_kind?.startsWith('transcript_') && <p className="font-medium">Nội dung từ bản chép lời — không phải chứng cứ gốc</p>}
        {item.verification_status === 'conflicting' && <p className="font-medium">Có bất nhất trong bản chép — cần đối chiếu</p>}
        <details><summary className="cursor-pointer underline">Chi tiết chứng cứ: {learnerText(item.name)}</summary><p className="text-xs text-slate-400">{item.availability === 'provided' ? 'Có nội dung trong hồ sơ; tính xác thực chưa được xác minh.' : 'Tài liệu chỉ được nhắc đến. CourtSim chưa có bản gốc.'}</p>{item.source_locator && <p>{item.source_locator}</p>}{item.proof_scope && <p>Phạm vi chứng minh: {item.proof_scope}</p>}{item.availability === 'provided' && item.content && <p className="whitespace-pre-wrap">{item.content}</p>}</details>
        {onInsert && canCiteEvidence(item, c) && <button type="button" disabled={insertionDisabled} onClick={() => onInsert(item)} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40" aria-label={`Đưa vào lập luận: ${item.name}`}>Đưa vào lập luận</button>}
      </article>)}
    </section>
    <details><summary className="cursor-pointer font-semibold">Đọc toàn bộ nội dung hồ sơ</summary><p className="mt-2 whitespace-pre-wrap">{learnerText(c.full_document, 'Chưa có nội dung bổ sung.')}</p></details>
    {/^https:\/\//.test(c.source_url ?? '') && <details><summary className="cursor-pointer underline">Nguồn bản án — có tiết lộ kết quả xét xử</summary><a className="text-blue-400 underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn bản án</a></details>}
  </div>;
}
