import { useEffect, useRef } from 'react';
import './feedback.css';

export default function FeedbackModal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus?.(); };
  }, []);
  return <dialog ref={ref} className="feedback-modal" aria-labelledby="feedback-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="feedback-modal-heading"><h2 id="feedback-dialog-title">{title}</h2><button type="button" aria-label="Đóng" onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
