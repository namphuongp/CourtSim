import { useEffect, useId, useRef, useState } from 'react';
import api, { getApiError } from '../../services/api';
import FeedbackModal from './FeedbackModal';

function FeedbackSheet({ title, children, onClose }) {
  const titleId = useId();
  return <dialog open aria-labelledby={titleId} className="feedback-modal feedback-sheet"><header className="feedback-modal-heading"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="Đóng góp ý">×</button></header>{children}</dialog>;
}

export default function LearnerFeedback({ sessionId, onDone, embedded = false }) {
  const inputId = useId();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function submit(event) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    setError('');
    try {
      await api.post(`/v1/sessions/${sessionId}/feedback`, { content: trimmed }, { signal: controller.signal, timeout: 10000 });
      if (!controller.signal.aborted) onDone();
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getApiError(requestError, 'Chưa gửi được góp ý. Bạn có thể thử lại hoặc bỏ qua để xem kết quả.'));
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  const Surface = embedded ? FeedbackSheet : FeedbackModal;
  return <Surface title="Phiên luyện tập của bạn thế nào?" onClose={onDone}>
    <p>Góp ý của bạn giúp CourtSim cải thiện trải nghiệm. Bạn có thể bỏ qua để xem kết quả ngay.</p>
    <form onSubmit={submit}>
      <label htmlFor={inputId}>Góp ý của bạn <span>(không bắt buộc)</span></label>
      <textarea id={inputId} value={content} onChange={event => setContent(event.target.value)} maxLength={2000} disabled={sending} aria-describedby={`${inputId}-help`} placeholder="Chia sẻ điều bạn hài lòng hoặc muốn CourtSim cải thiện…" />
      <p id={`${inputId}-help`} className="feedback-help">{content.length}/2000 ký tự</p>
      {error && <p className="feedback-error" role="alert">{error}</p>}
      <div className="feedback-actions feedback-submit-actions">
        <button type="submit" className="feedback-primary" disabled={sending || !content.trim()}>{sending ? 'Đang gửi góp ý…' : 'Gửi góp ý và xem kết quả'}</button>
        <button type="button" onClick={onDone}>Bỏ qua và xem kết quả</button>
      </div>
    </form>
  </Surface>;
}
