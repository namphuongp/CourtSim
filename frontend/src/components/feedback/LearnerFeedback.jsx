import { useRef, useState } from 'react';
import api, { getApiError } from '../../services/api';
import FeedbackModal from './FeedbackModal';

export default function LearnerFeedback({ sessionId, onDone }) {
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function send(event) {
    event.preventDefault();
    if (busy.current || !content.trim()) return;
    busy.current = true; setPending(true); setError('');
    try {
      await api.post(`/v1/sessions/${sessionId}/feedback`, { content }, { timeout: 15000 });
      onDone(true);
    } catch (error) { setError(getApiError(error, 'Chưa gửi được góp ý. Nội dung vẫn được giữ lại. Bạn có thể thử lại hoặc bỏ qua để xem kết quả.')); }
    finally { busy.current = false; setPending(false); }
  }
  return <FeedbackModal title="Phiên luyện tập của bạn thế nào?" onClose={() => onDone(false)}>
    <p>Kết quả đã sẵn sàng. Bạn có điều gì muốn CourtSim cải thiện?</p>
    <form onSubmit={send}>
      <label htmlFor="learner-feedback">Góp ý của bạn <span>(không bắt buộc)</span></label>
      <textarea id="learner-feedback" autoFocus rows={5} maxLength={2000} value={content} onChange={event => setContent(event.target.value)} placeholder="Chia sẻ điều hữu ích hoặc điều khiến bạn gặp khó khăn…" disabled={pending} aria-describedby="feedback-privacy" />
      <p id="feedback-privacy" className="feedback-help">Admin CourtSim có thể đọc góp ý cùng tài khoản và mã phiên của bạn. Hội thoại, hồ sơ và điểm số không được gửi kèm.</p>
      {error && <p role="alert" className="feedback-error">{error}</p>}
      <div className="feedback-actions"><button type="button" onClick={() => onDone(false)}>Bỏ qua và xem kết quả</button><button type="submit" className="feedback-primary" disabled={pending || !content.trim()}>{pending ? 'Đang gửi góp ý…' : 'Gửi góp ý'}</button></div>
    </form>
  </FeedbackModal>;
}
