import { useEffect, useRef, useState } from 'react';
import { Gavel, LoaderCircle } from 'lucide-react';

export default function ConfirmEndDialog({ open, pending, hasDraft, userTurns = 1, onCancel, onConfirm }) {
  const ref = useRef(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 30_000);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [pending]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus?.(); };
  }, [open]);
  return <dialog ref={ref} aria-labelledby="end-title" aria-describedby="end-description" onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }} className="court-end-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-200 backdrop:bg-black/70">
    <span className={`end-dialog-icon${pending ? ' is-pending' : ''}`} aria-hidden="true">{pending ? <LoaderCircle size={28}/> : <Gavel size={23}/>}</span>
    <h2 id="end-title" className="text-xl font-bold">{pending ? 'Đang chấm điểm' : 'Kết thúc và nhận đánh giá?'}</h2>
    <p id="end-description" className="my-4 leading-7">{pending ? 'Đang đánh giá các lượt đã gửi. Bạn không cần gửi lại yêu cầu, kết quả sẽ hiện khi chấm xong.' : 'Hội đồng xét xử sẽ khép lại phần tranh tụng, nghị án và chấm điểm các lượt đã gửi theo 6 nhóm tiêu chí. Sau khi hoàn thành, bạn có thể xem lại biên bản và kết quả.'}</p>
    {hasDraft && !pending && <p className="mb-4 text-amber-300">Bạn còn bản nháp chưa gửi. Bản nháp không được tính vào kết quả nếu chọn kết thúc ngay, hoặc bạn có thể chọn Gửi bản nháp và kết thúc.</p>}
    {pending && <p role="status" className="mb-4 text-blue-300">{slow ? 'Phản hồi đang lâu hơn thường lệ. Bạn có thể về danh sách phiên và mở lại để kiểm tra kết quả, các lượt đã gửi vẫn được lưu.' : 'Đang chấm điểm...'}</p>}
    {pending && <a className="mb-4 inline-block underline" href="/dashboard/sessions">Về danh sách phiên</a>}
    <div className="flex flex-wrap justify-end gap-3">
      <button autoFocus disabled={pending} onClick={onCancel} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Tiếp tục tranh luận</button>
      {hasDraft && !pending && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm({ sendDraft: true })}
          className="rounded-lg border border-emerald-500/60 bg-emerald-700/80 px-4 py-2 text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Gửi bản nháp và kết thúc
        </button>
      )}
      {(!hasDraft || userTurns > 0) && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onConfirm({ sendDraft: false })}
          className="rounded-lg bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {pending ? 'Đang chấm điểm...' : 'Xác nhận kết thúc'}
        </button>
      )}
    </div>
  </dialog>;
}
