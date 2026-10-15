import { useId, useState } from 'react';
import { roleLabel } from '../services/simulation';
import { learnerText } from '../../../shared/learnerText.mjs';
import { evidenceSummary } from '../../../shared/dialogueText.mjs';
import { canCiteEvidence, EVIDENCE_ASSUMPTION, caseIntroduction, practiceText } from '../../../shared/casePresentation.mjs';

const eventLabels = { conduct: 'Hành vi', transaction: 'Giao dịch/quyền được xác lập', dispute: 'Tranh chấp', filing: 'Khởi kiện', hearing: 'Xét xử' };
import { EVIDENCE_MIME } from '../services/references';

export default function CaseDossier({ courtCase, role, onInsert, insertionDisabled = false }) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const evidenceId = useId();
  if (!courtCase) return <p>Chưa tải được hồ sơ vụ án. Vui lòng đóng và mở lại.</p>;
  const c = courtCase;
  const introduction = caseIntroduction(c);
  return <div className="space-y-5 text-sm leading-7">
    <div><p className="text-blue-400">{learnerText(c.category)}</p><h3 className="text-lg font-bold">{learnerText(introduction.title)}</h3><p>{learnerText(introduction.summary)}</p><p className="mt-2 font-semibold">Vai của bạn: {role ? roleLabel(role, c.category, c) : 'Chọn vai ở bước tiếp theo'}</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Mốc thời gian</h3>{c.timeline?.length ? <ul className="space-y-2">{c.timeline.map((event, i) => <li key={i}><strong>{eventLabels[event.kind] ?? 'Sự kiện'} — {event.date || 'Chưa rõ ngày'}{event.date_to && event.date_to !== event.date ? ` đến ${event.date_to}` : ''}</strong><p>{learnerText(event.description)}</p></li>)}</ul> : <p>Chưa có mốc thời gian được nêu rõ trong hồ sơ.</p>}</section>
    {!!introduction.developments.length && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Tóm tắt diễn biến"><h3 className="font-bold">Tóm tắt diễn biến</h3><ol className="mt-4 space-y-4">{introduction.developments.map((item, index) => <li key={item.title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{index + 1}</span><div><h4 className="font-semibold">{item.title}</h4><p>{item.text}</p></div></li>)}</ol></section>}
    {c.practice_context && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Vấn đề cần làm rõ</h3><ul className="list-disc pl-5">{c.practice_context.issues?.map(text => <li key={text}>{practiceText(text)}</li>)}</ul></section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Các bên và yêu cầu</h3>{c.parties?.length ? c.parties.map((party, index) => <article key={index} className="mt-2 rounded-lg border border-slate-700 p-3"><strong>{{ plaintiff: 'Nguyên đơn', defendant: 'Bị đơn', other: 'Bên liên quan' }[party.side]}: {learnerText(party.name, 'Chưa có tên')}</strong>{party.claims?.length ? <ul className="list-disc pl-5">{party.claims.map((claim, i) => <li key={i}>{learnerText(practiceText(claim))}</li>)}</ul> : <p>Chưa có thông tin yêu cầu.</p>}</article>) : <p>Hồ sơ chưa cung cấp thông tin riêng về các bên và yêu cầu.</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Chứng cứ ({c.evidence_inventory?.length ?? 0})</h3><button type="button" aria-expanded={evidenceExpanded} aria-controls={evidenceId} onClick={() => setEvidenceExpanded(value => !value)} className="shrink-0 rounded-lg border border-blue-300 px-3 py-1 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{evidenceExpanded ? 'Thu gọn chứng cứ' : 'Mở rộng chứng cứ'}</button></div><div id={evidenceId} hidden={!evidenceExpanded}><p className="mt-3">{EVIDENCE_ASSUMPTION}</p>{!c.evidence_inventory?.length && <p>Hồ sơ chưa có danh sách chứng cứ.</p>}
      {c.evidence_inventory?.map((item) => <article id={'evidence-' + item.id} key={item.id} draggable={Boolean(onInsert) && !insertionDisabled && canCiteEvidence(item, c)} onDragStart={(event) => { if (!canCiteEvidence(item, c)) { event.preventDefault(); return; } event.dataTransfer.setData(EVIDENCE_MIME, item.id); event.dataTransfer.effectAllowed = 'copy'; }} className="mt-3 rounded-xl border border-slate-700 p-3">
        <h4 className="font-semibold">{learnerText(item.name)}</h4>
        {evidenceSummary(item.summary) && <p>{item.summary === item.source_quote ? item.summary : learnerText(evidenceSummary(item.summary))}</p>}<p className="text-xs">Bên cung cấp: {learnerText(item.provided_by, 'Chưa rõ')} · Ngày lập: {item.date || 'Chưa rõ'}</p>
        {item.verification_status === 'conflicting' && <p className="font-medium">Có số liệu chưa thống nhất — cần đối chiếu</p>}
        <details><summary className="cursor-pointer underline">Chi tiết chứng cứ: {learnerText(item.name)}</summary>{item.proof_scope && <p>Phạm vi chứng minh: {item.proof_scope}</p>}{item.availability === 'provided' && item.content && <p className="whitespace-pre-wrap">{practiceText(item.content)}</p>}</details>
        {onInsert && canCiteEvidence(item, c) && <button type="button" disabled={insertionDisabled} onClick={() => onInsert(item)} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 text-blue-400 disabled:opacity-40" aria-label={`Đưa vào lập luận: ${item.name}`}>Đưa vào lập luận</button>}
      </article>)}
    </div></section>
    <details><summary className="cursor-pointer font-semibold">Đọc toàn bộ nội dung hồ sơ</summary><p className="mt-2 whitespace-pre-wrap">{learnerText(practiceText(c.full_document), 'Chưa có nội dung bổ sung.')}</p></details>
    {/^https:\/\//.test(c.source_url ?? '') && <details><summary className="cursor-pointer underline">Nguồn bản án — có tiết lộ kết quả xét xử</summary><a className="text-blue-400 underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn bản án</a></details>}
  </div>;
}
