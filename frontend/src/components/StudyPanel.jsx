import { useEffect, useId, useRef } from 'react';

// Panel không modal để vẫn kéo được tài liệu sang ô lập luận trên desktop.
export default function StudyPanel({ open, title, onClose, children, compact = false }) {
  const id = useId();
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      // Trên điện thoại panel che màn hình: giữ Tab ở các thao tác đang nhìn thấy.
      if (event.key === 'Tab' && window.matchMedia('(max-width: 767px)').matches) {
        const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), a[href], textarea:not(:disabled), summary, input:not(:disabled), [role=tabpanel]')].filter((element) => element.getClientRects().length && element.tabIndex >= 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return <aside ref={panelRef} role="region" aria-labelledby={id} className={`study-panel ${compact ? 'study-panel-compact' : ''} fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col break-words border-l border-slate-700 bg-slate-900 text-slate-200 shadow-2xl`}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-700 p-4"><h2 id={id} className="text-lg font-bold">{title}</h2><button ref={closeRef} onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-2" aria-label={`Đóng ${title.toLocaleLowerCase('vi')}`}>Đóng</button></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
  </aside>;
}
