export default function CaseSource({ courtCase, showLegalNote = true }) {
  if (!courtCase?.source_note) return null;
  const safeSource = /^https:\/\/thuvienphapluat\.vn\//.test(courtCase.source_url ?? '');
  return <div className="mb-4 space-y-2 rounded-xl border border-blue-400/30 p-3 text-sm leading-6">
    <p>{courtCase.source_note}</p>
    <p>{courtCase.reference_date_note}</p>
    {showLegalNote && <p className="text-amber-400">{courtCase.legal_scope_note}</p>}
    <p>Gợi ý: lập bảng yêu cầu → chứng cứ hỗ trợ → điểm chưa rõ; chuẩn bị câu hỏi kiểm tra lời khai cho cả hai phía.</p>
    {safeSource && <details><summary className="cursor-pointer underline">Nguồn tham khảo — có tiết lộ phán quyết</summary><a className="text-blue-400 underline" href={courtCase.source_url} target="_blank" rel="noopener noreferrer">Đọc bản án đăng lại (nên mở sau khi luyện tập)</a></details>}
  </div>;
}
