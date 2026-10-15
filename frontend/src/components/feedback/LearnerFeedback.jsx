import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { feedbackFormUrl } from '../../services/feedbackForm';
import FeedbackModal from './FeedbackModal';

export default function LearnerFeedback({ sessionId, onDone, required = true, initialFormUrl = '' }) {
  const [formUrl, setFormUrl] = useState(() => feedbackFormUrl(initialFormUrl));
  const [message, setMessage] = useState('Đang kiểm tra trạng thái khảo sát...');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const checkRef = useRef(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (!required) return;
    let active = true;
    let pending = false;
    let finished = false;
    const controller = new AbortController();
    async function check() {
      if (pending || finished || !active) return;
      pending = true;
      setChecking(true);
      try {
        const { data } = await api.get(`/v1/sessions/${sessionId}/feedback/survey`, { signal: controller.signal });
        if (!active) return;
        if (data.data?.verified === true) {
          finished = true;
          doneRef.current();
          return;
        }
        const url = feedbackFormUrl(data.data?.form_url);
        if (!url) throw new Error('Survey unavailable');
        setFormUrl(url);
        setError('');
        setMessage('Chưa nhận được xác nhận gửi. Sau khi gửi form, hãy quay lại đây; kết quả sẽ tự mở.');
      } catch (requestError) {
        if (active) setError(getApiError(requestError, 'Chưa kiểm tra được khảo sát. Kết quả đã được lưu, bạn có thể thử lại.'));
      } finally {
        pending = false;
        if (active) setChecking(false);
      }
    }
    checkRef.current = check;
    void check();
    // Chỉ kiểm tra khi tab hiện; tránh yêu cầu chồng nhau khi mạng chậm.
    const visibleCheck = () => { if (document.visibilityState === 'visible') void check(); };
    const interval = window.setInterval(visibleCheck, 5000);
    window.addEventListener('focus', visibleCheck);
    document.addEventListener('visibilitychange', visibleCheck);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('focus', visibleCheck);
      document.removeEventListener('visibilitychange', visibleCheck);
      checkRef.current = null;
    };
  }, [sessionId, required]);

  return <FeedbackModal title={required ? 'Hoàn thành khảo sát để xem kết quả' : 'Phiên luyện tập của bạn thế nào?'} onClose={required ? undefined : onDone}>
    <p>{required ? 'Kết quả luyện tập đã được lưu. Tài khoản của bạn cần gửi khảo sát Google Forms một lần trước khi xem kết quả.' : 'Bạn đã hoàn thành khảo sát trước đây. Bạn có thể góp ý thêm về phiên này hoặc bỏ qua để xem kết quả ngay.'}</p>
    {required && <p className="feedback-help">Mở form bằng nút bên dưới để mã phiên được điền sẵn. Giữ nguyên mã này và nhấn Gửi sau khi trả lời các câu hỏi.</p>}
    {required && <p className="feedback-help" role="status" aria-live="polite">{message}</p>}
    {error && <p className="feedback-error" role="alert">{error}</p>}
    <div className="feedback-actions feedback-survey-actions">
      {formUrl ? <a className="feedback-primary" href={formUrl} target="_blank" rel="noopener noreferrer" onClick={required ? undefined : onDone}>
        Điền khảo sát Google Forms <ExternalLink size={16} aria-hidden="true" />
      </a> : <button type="button" className="feedback-primary" disabled>Điền khảo sát Google Forms</button>}
      {required ? <button type="button" onClick={() => checkRef.current?.()} disabled={checking}>{checking ? 'Đang kiểm tra...' : 'Kiểm tra xác nhận gửi'}</button>
        : <button type="button" onClick={onDone}>Bỏ qua và xem kết quả</button>}
      <Link to="/">Trở về trang chủ</Link>
    </div>
  </FeedbackModal>;
}
