import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './feedback.css';

export default function FeedbackModal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus?.(); };
  }, []);
  return <dialog ref={ref} className="feedback-modal" aria-labelledby="feedback-dialog-title" onCancel={event => { event.preventDefault(); onClose?.(); }}>
    <div className="feedback-modal-heading"><h2 id="feedback-dialog-title">{title}</h2>{onClose && <button className="feedback-modal-close" type="button" aria-label="Đóng" onClick={onClose}><X size={18} strokeWidth={2.4} aria-hidden="true"/></button>}</div>
    {children}
  </dialog>;
}
