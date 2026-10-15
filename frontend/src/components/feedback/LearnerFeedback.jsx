import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../../services/api';
import { feedbackFormUrl } from '../../services/feedbackForm';
import FeedbackModal from './FeedbackModal';

export default function LearnerFeedback({ sessionId, onDone, required = true, initialFormUrl = '' }) {
  const [formUrl, setFormUrl] = useState(() => feedbackFormUrl(initialFormUrl));
  const [message, setMessage] = useState('CourtSim đang kiểm tra giúp bạn...');
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
        setMessage('CourtSim chưa nhận được xác nhận gửi. Nếu bạn vừa gửi xong, chờ một chút rồi kiểm tra lại nhé.');
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

  return <FeedbackModal title={required ? 'Cho CourtSim xin một chút góp ý nhé 💙' : 'Phiên luyện tập của bạn thế nào?'} onClose={required ? undefined : onDone}>
    {required ? <>
      <p>Kết quả phiên luyện tập của bạn đã được lưu rồi.<br />Trước khi xem kết quả, bạn vui lòng gửi khảo sát Google Forms 1 lần duy nhất để giúp CourtSim cải thiện trải nghiệm tốt hơn.</p>
      <p className="feedback-help">Mã phiên đã được điền sẵn trong form. Bạn chỉ cần giữ nguyên mã đó, điền các câu hỏi và nhấn Gửi.</p>
      <p className="feedback-help">Sau khi gửi xong, quay lại đây và bấm 'Mình đã gửi xong' để CourtSim kiểm tra và mở kết quả cho bạn.</p>
    </> : <p>Bạn đã hoàn thành khảo sát trước đây. Bạn có thể góp ý thêm về phiên này hoặc bỏ qua để xem kết quả ngay.</p>}
    {required && <p className="feedback-help" role="status" aria-live="polite">{message}</p>}
    {error && <p className="feedback-error" role="alert">{error}</p>}
    <div className="feedback-actions feedback-survey-actions">
      {formUrl ? <a className="feedback-primary" href={formUrl} target="_blank" rel="noopener noreferrer" onClick={required ? undefined : onDone}>
        Điền khảo sát Google Forms <ExternalLink size={16} aria-hidden="true" />
      </a> : <button type="button" className="feedback-primary" disabled>Điền khảo sát Google Forms</button>}
      {required ? <button type="button" onClick={() => checkRef.current?.()} disabled={checking}>{checking ? 'Đang kiểm tra...' : 'Mình đã gửi xong'}</button>
        : <button type="button" onClick={onDone}>Bỏ qua và xem kết quả</button>}
      <Link to="/">Về trang chủ</Link>
    </div>
  </FeedbackModal>;
}
