import { useEffect, useId, useState } from 'react';
import { FilePenLine, Stamp } from 'lucide-react';
import { roleLabel } from '../services/simulation';
import { learnerText } from '../../../shared/learnerText.mjs';
import { evidenceSummary } from '../../../shared/dialogueText.mjs';
import { canCiteEvidence, EVIDENCE_ASSUMPTION, caseIntroduction, practiceText } from '../../../shared/casePresentation.mjs';
import { draftKey, readDraft, saveDraft } from '../services/auth';
import { EVIDENCE_MIME } from '../services/references';

const eventLabels = { conduct: 'Hành vi', transaction: 'Giao dịch/quyền được xác lập', dispute: 'Tranh chấp', filing: 'Khởi kiện', hearing: 'Xét xử' };

function formatDocumentDate(dateStr) {
  if (!dateStr) return 'Theo hồ sơ vụ án';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}

function resolveStampMeta(item, courtCase, index = 0) {
  const seq = String(index + 1).padStart(2, '0');
  const provider = String(item.provided_by || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const category = String(courtCase?.category || '').toLowerCase();
  if (item.stamp_authority || item.stamp_code) {
    return {
      authority: item.stamp_authority || 'CƠ QUAN ĐIỀU TRA',
      code: item.stamp_code || `HS-${item.code || seq}-26`,
      receiverName: item.receiver_name || 'Trương Văn Báu',
      receiverTitle: item.receiver_title || 'Cán bộ điều tra',
      serial: item.serial_code || `${seq}-BV/2026`,
    };
  }
  if (category.includes('hình sự') || name.includes('tường trình') || name.includes('lời khai') || provider.includes('điều tra') || provider.includes('công an')) {
    return {
      authority: 'CƠ QUAN ĐIỀU TRA',
      code: `HS-${item.code || seq}-26`,
      receiverName: 'Trương Văn Báu',
      receiverTitle: 'Cán bộ điều tra',
      serial: `${seq}-BV/${(item.date || '2026').slice(0, 4)}`,
    };
  }
  if (provider.includes('ubnd') || provider.includes('ủy ban') || name.includes('địa chính') || name.includes('giấy chứng nhận') || name.includes('hòa giải')) {
    return {
      authority: 'UBND / ĐỊA CHÍNH',
      code: `ĐC-${item.code || seq}-HS`,
      receiverName: 'Nguyễn Hữu Thắng',
      receiverTitle: 'Cán bộ Tư pháp - Địa chính',
      serial: `${seq}-ĐC/${(item.date || '2024').slice(0, 4)}`,
    };
  }
  return {
    authority: 'TÒA ÁN NHÂN DÂN',
    code: `BL-${item.code || seq}-TT`,
    receiverName: 'Lê Minh Hoàng',
    receiverTitle: 'Thư ký Tòa án tiếp nhận',
    serial: `${seq}-BL/${(item.date || '2025').slice(0, 4)}`,
  };
}

export default function CaseDossier({ courtCase, role, sessionId, onInsert, insertionDisabled = false, tabbed = false, initialTab = 'overview' }) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(initialTab === 'evidence');
  const [tab, setTab] = useState(initialTab);
  const [evidenceSelected, setEvidenceSelected] = useState(null);
  const evidenceId = useId();
  const noteInputId = useId();

  const caseId = courtCase?._id || courtCase?.id || 'default';
  const sessionNoteKey = sessionId ? draftKey(`${sessionId}:notes`) : null;
  const caseNoteKey = draftKey(`case:${caseId}:notes`);

  const [personalNotes, setPersonalNotes] = useState(() => {
    if (sessionNoteKey) {
      const fromSession = readDraft(sessionNoteKey)?.content;
      if (fromSession) return fromSession;
    }
    return readDraft(caseNoteKey)?.content ?? '';
  });

  useEffect(() => {
    if (sessionNoteKey) saveDraft(sessionNoteKey, { content: personalNotes });
    saveDraft(caseNoteKey, { content: personalNotes });
  }, [sessionNoteKey, caseNoteKey, personalNotes]);

  if (!courtCase) return <p>Chưa tải được hồ sơ vụ án. Vui lòng đóng và mở lại.</p>;
  const c = courtCase;
  const introduction = caseIntroduction(c);
  const activeEvidence = c.evidence_inventory?.find(item => item.id === evidenceSelected)?.id ?? c.evidence_inventory?.[0]?.id;

  function appendEvidenceToNote(item) {
    const codeLabel = item.code || item.id;
    const summaryText = item.summary === item.source_quote ? item.summary : learnerText(evidenceSummary(item.summary));
    const snippet = `• [${codeLabel}] ${learnerText(item.name)} (${formatDocumentDate(item.date)} — ${learnerText(item.provided_by, 'Chưa rõ nguồn')}): ${summaryText || 'Cần đối chiếu tại phiên tòa.'}`;
    setPersonalNotes((prev) => {
      if (prev.includes(snippet)) return prev;
      const next = prev.trim() ? `${prev.trim()}\n${snippet}` : snippet;
      return next.slice(0, 4000);
    });
  }

  return <div className="case-dossier space-y-5 text-sm leading-7" data-view={tabbed ? tab : 'all'}>
    {tabbed && <nav className="case-dossier-tabs" aria-label="Các phần hồ sơ">{[['overview', 'Tổng quan'], ['parties', 'Các bên & yêu cầu'], ['evidence', 'Tài liệu gốc'], ['procedure', 'Hồ sơ tố tụng'], ['law', 'Căn cứ pháp lý']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); if (id === 'evidence') setEvidenceExpanded(true); }}>{label}{id === 'evidence' ? ` (${c.evidence_inventory?.length ?? 0})` : ''}</button>)}</nav>}
    <div className="dossier-overview">
    <div><p className="text-blue-400">{learnerText(c.category)}</p><h3 className="text-lg font-bold">{learnerText(introduction.title)}</h3><p>{learnerText(introduction.summary)}</p><p className="mt-2 font-semibold">Vai của bạn: {role ? roleLabel(role, c.category, c) : 'Chọn vai ở bước tiếp theo'}</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Mốc thời gian</h3>{c.timeline?.length ? <ul className="space-y-2">{c.timeline.map((event, i) => <li key={i}><strong>{eventLabels[event.kind] ?? 'Sự kiện'} — {event.date || 'Chưa rõ ngày'}{event.date_to && event.date_to !== event.date ? ` đến ${event.date_to}` : ''}</strong><p>{learnerText(event.description)}</p></li>)}</ul> : <p>Chưa có mốc thời gian được nêu rõ trong hồ sơ.</p>}</section>
    {!!introduction.developments.length && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Tóm tắt diễn biến"><h3 className="font-bold">Tóm tắt diễn biến</h3><ol className="mt-4 space-y-4">{introduction.developments.map((item, index) => <li key={item.title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{index + 1}</span><div><h4 className="font-semibold">{item.title}</h4><p>{item.text}</p></div></li>)}</ol></section>}
    {c.practice_context && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Vấn đề cần làm rõ</h3><ul className="list-disc pl-5">{c.practice_context.issues?.map(text => <li key={text}>{practiceText(text)}</li>)}</ul></section>}
    </div>
    <section className="dossier-parties rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Các bên và yêu cầu</h3>{c.parties?.length ? c.parties.map((party, index) => <article key={index} className="mt-2 rounded-lg border border-slate-700 p-3"><strong>{{ plaintiff: 'Nguyên đơn', defendant: 'Bị đơn', other: 'Bên liên quan' }[party.side]}: {learnerText(party.name, 'Chưa có tên')}</strong>{party.claims?.length ? <ul className="list-disc pl-5">{party.claims.map((claim, i) => <li key={i}>{learnerText(practiceText(claim))}</li>)}</ul> : <p>Chưa có thông tin yêu cầu.</p>}</article>) : <p>Hồ sơ chưa cung cấp thông tin riêng về các bên và yêu cầu.</p>}</section>
    <section className="dossier-evidence rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Chứng cứ ({c.evidence_inventory?.length ?? 0})</h3><button type="button" aria-expanded={evidenceExpanded} aria-controls={evidenceId} onClick={() => setEvidenceExpanded(value => !value)} className="shrink-0 rounded-lg border border-blue-300 px-3 py-1 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{evidenceExpanded ? 'Thu gọn chứng cứ' : 'Mở rộng chứng cứ'}</button></div><div id={evidenceId} hidden={!evidenceExpanded}><p className="mt-3">{EVIDENCE_ASSUMPTION}</p>{!c.evidence_inventory?.length && <p>Hồ sơ chưa có danh sách chứng cứ.</p>}
      <div className="evidence-and-note-layout">
      <div className={tabbed ? 'evidence-workspace' : ''}>{tabbed && !!c.evidence_inventory?.length && <nav className="evidence-list" aria-label="Danh sách tài liệu">{c.evidence_inventory.map((item, index) => <button type="button" key={item.id} data-evidence-select={item.id} aria-pressed={activeEvidence === item.id} onClick={() => setEvidenceSelected(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{learnerText(item.name)}</strong><small>{learnerText(item.provided_by, 'Chưa rõ bên cung cấp')}</small></div></button>)}</nav>}<div className="evidence-detail">
      {c.evidence_inventory?.map((item, idx) => {
        const stamp = resolveStampMeta(item, c, idx);
        const docBody = item.availability === 'provided' && item.content
          ? practiceText(item.content)
          : (item.summary === item.source_quote ? item.summary : learnerText(evidenceSummary(item.summary)));
        return <article hidden={tabbed && activeEvidence !== item.id} id={'evidence-' + item.id} key={item.id} draggable={Boolean(onInsert) && !insertionDisabled && canCiteEvidence(item, c)} onDragStart={(event) => { if (!canCiteEvidence(item, c)) { event.preventDefault(); return; } event.dataTransfer.setData(EVIDENCE_MIME, item.id); event.dataTransfer.effectAllowed = 'copy'; }} className="mt-3 rounded-xl border border-slate-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{learnerText(item.name)}</h4>
          <button type="button" onClick={() => appendEvidenceToNote(item)} className="evidence-note-quick-btn">＋ Ghi vào Note cá nhân</button>
        </div>
        <span className="evidence-availability">{item.availability === 'provided' ? 'Có nội dung được cung cấp' : 'Nội dung được nhắc trong hồ sơ'}</span>
        {evidenceSummary(item.summary) && <p>{item.summary === item.source_quote ? item.summary : learnerText(evidenceSummary(item.summary))}</p>}<p className="text-xs">Bên cung cấp: {learnerText(item.provided_by, 'Chưa rõ')} · Ngày lập: {item.date || 'Chưa rõ'}</p>
        {item.verification_status === 'conflicting' && <p className="font-medium">Có số liệu chưa thống nhất — cần đối chiếu</p>}

        {/* Bút lục trực quan mô phỏng văn bản hồ sơ thực tế */}
        <div className="evidence-visual-sheet" aria-label={`Bản chụp hồ sơ: ${learnerText(item.name)}`}>
          <div className="evidence-sheet-holes" aria-hidden="true">
            <span className="sheet-hole" />
            <span className="sheet-hole" />
            <span className="sheet-serial">{stamp.serial}</span>
          </div>
          <div className="evidence-sheet-body">
            <header className="evidence-sheet-header">
              <p className="evidence-sheet-title">{learnerText(item.name).toUpperCase()}</p>
              <div className="evidence-sheet-meta">
                <p>Thời điểm lập: <strong>{formatDocumentDate(item.date)}</strong></p>
                <p>Người trình bày / Nguồn cung cấp: <strong>{learnerText(item.provided_by, 'Theo hồ sơ tố tụng')}</strong></p>
              </div>
            </header>
            <div className="evidence-sheet-content">
              <p className="evidence-sheet-label">Nội dung văn bản / chứng cứ:</p>
              <p className="evidence-sheet-text">{docBody || 'Tài liệu nằm trong danh mục bút lục đối chiếu tại phiên tòa.'}</p>
            </div>
            <footer className="evidence-sheet-footer">
              <div className="evidence-sheet-receiver">
                <p>Người tiếp nhận hồ sơ:</p>
                <strong>{stamp.receiverName}</strong>
                <span>{stamp.receiverTitle}</span>
                <span className="evidence-dotted-line">Chữ ký: ............................</span>
              </div>
              <div className="evidence-sheet-signer">
                <p>Chữ ký xác nhận: <em className="evidence-cursive-sig">{learnerText(item.provided_by, 'Đã ký')}</em></p>
                <p>Họ và tên: <strong>{learnerText(item.provided_by, 'ĐƯƠNG SỰ').toUpperCase()}</strong></p>
                <div className="evidence-red-stamp" aria-label={`Dấu xác nhận ${stamp.authority}`}>
                  <span className="stamp-title"><Stamp size={11} /> {stamp.authority} ★</span>
                  <span className="stamp-code">{stamp.code}</span>
                </div>
              </div>
            </footer>
          </div>
        </div>

        <details><summary className="cursor-pointer underline">Chi tiết chứng cứ: {learnerText(item.name)}</summary>{item.proof_scope && <p>Phạm vi chứng minh: {item.proof_scope}</p>}{item.availability === 'provided' && item.content && <p className="whitespace-pre-wrap">{practiceText(item.content)}</p>}</details>
        {onInsert && canCiteEvidence(item, c) && <button type="button" disabled={insertionDisabled} onClick={() => onInsert(item)} className="mt-2 rounded-lg border border-blue-400 px-3 py-1 disabled:opacity-40" aria-label={`Đưa vào lập luận: ${item.name}`}>Đưa vào lập luận</button>}
      </article>;
      })}</div></div>

      {/* Bảng ghi chú cá nhân đi kèm hồ sơ bằng chứng */}
      <aside className="dossier-personal-note" aria-label="Bảng ghi chú cá nhân khi đọc hồ sơ">
        <div className="dossier-note-header">
          <FilePenLine size={18} />
          <div>
            <h4>Bảng ghi chú cá nhân (Note)</h4>
            <small>Ghi lại các tình tiết, mâu thuẫn chứng cứ hoặc luận điểm quan trọng khi đọc hồ sơ</small>
          </div>
        </div>
        <label htmlFor={noteInputId} className="sr-only">Nội dung ghi chú cá nhân</label>
        <textarea
          id={noteInputId}
          value={personalNotes}
          maxLength={4000}
          onChange={(event) => setPersonalNotes(event.target.value)}
          placeholder="Ghi chú nhanh tại đây khi đọc từng chứng cứ (ví dụ: mâu thuẫn ngày tháng, lời khai cần xét hỏi, điều luật áp dụng)… Nội dung tự động đồng bộ vào Sổ tay phiên tòa."
        />
        <div className="dossier-note-footer">
          <small>{personalNotes.length}/4000 ký tự · Tự động lưu & đồng bộ Sổ tay</small>
          {onInsert && (
            <button
              type="button"
              disabled={insertionDisabled || !personalNotes.trim()}
              onClick={() => onInsert(personalNotes)}
              className="dossier-note-insert-btn"
            >
              Đưa ghi chú vào lập luận →
            </button>
          )}
        </div>
      </aside>
      </div>
    </div></section>
    <section className="dossier-procedure" hidden={!tabbed}><h3 className="font-bold">Hồ sơ tố tụng</h3>{c.timeline?.filter(event => ['filing', 'hearing'].includes(event.kind)).map((event, i) => <article key={i} className="mt-3 rounded-xl border border-slate-200 p-4"><strong>{eventLabels[event.kind]} · {event.date || 'Chưa rõ ngày'}</strong><p>{learnerText(event.description)}</p></article>)}{!c.timeline?.some(event => ['filing', 'hearing'].includes(event.kind)) && <p>Chưa có mốc khởi kiện hoặc xét xử được cung cấp riêng. Xem toàn bộ nội dung hồ sơ bên dưới.</p>}</section>
    <section className="dossier-law" hidden={!tabbed}><h3 className="font-bold">Phạm vi tra cứu pháp luật</h3><p>{learnerText(c.legal_scope_note, 'Hồ sơ chưa cung cấp danh sách căn cứ pháp lý riêng. Bạn có thể tra cứu bằng Trợ lý luật trong phiên khi gói của bạn có quyền sử dụng.')}</p><p className="mt-3">Mốc tham chiếu: {c.reference_date || 'Chọn ở bước Mốc tra cứu'}</p>{c.reference_date_note && <p>{learnerText(c.reference_date_note)}</p>}</section>
    <details className="dossier-document"><summary className="cursor-pointer font-semibold">Đọc toàn bộ nội dung hồ sơ</summary><p className="mt-2 whitespace-pre-wrap">{learnerText(practiceText(c.full_document), 'Chưa có nội dung bổ sung.')}</p></details>
    {/^https:\/\//.test(c.source_url ?? '') && <details><summary className="cursor-pointer underline">Nguồn bản án — có tiết lộ kết quả xét xử</summary><a className="text-blue-400 underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Mở nguồn bản án</a></details>}
  </div>;
}
