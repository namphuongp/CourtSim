import { ExternalLink } from 'lucide-react';
import { feedbackFormUrl } from '../../services/feedbackForm';
import FeedbackModal from './FeedbackModal';

const formUrl = feedbackFormUrl(import.meta.env.VITE_FEEDBACK_FORM_URL);

export default function LearnerFeedback({ onDone }) {
  return <FeedbackModal title="Phiên luyện tập của bạn thế nào?" onClose={onDone}>
    <p>Kết quả đã sẵn sàng. Mời bạn chia sẻ trải nghiệm qua khảo sát Google Forms để giúp CourtSim cải thiện.</p>
    <p className="feedback-help">Khảo sát mở trong tab mới. Bạn có thể xem kết quả ngay, không cần hoàn thành khảo sát.</p>
    {!formUrl && <p className="feedback-help" role="status">Khảo sát hiện chưa sẵn sàng. Bạn vẫn có thể xem kết quả.</p>}
    <div className="feedback-actions feedback-survey-actions">
      <button type="button" onClick={onDone}>Bỏ qua và xem kết quả</button>
      {formUrl ? <a className="feedback-primary" href={formUrl} target="_blank" rel="noopener noreferrer"
        onClick={onDone} onAuxClick={event => { if (event.button === 1) onDone(); }}>
        Góp ý qua Google Forms <ExternalLink size={16} aria-hidden="true" />
      </a> : <button type="button" className="feedback-primary" disabled>Góp ý qua Google Forms</button>}
    </div>
  </FeedbackModal>;
}
