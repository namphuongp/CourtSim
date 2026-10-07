import { ArrowLeft, BookOpen, Gavel, MessageSquare, Scale, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../services/auth';
import './guide.css';

const steps = [
  { icon: BookOpen, title: '1. Chọn hồ sơ', text: 'Đọc tình tiết, yêu cầu của các bên và chứng cứ trước khi chọn vụ án. Trong bài tập, các chứng cứ được nhắc trong hồ sơ được giả định có bản gốc và tài liệu kèm theo. Chỉ lập luận trên nội dung đã nêu.' },
  { icon: Scale, title: '2. Chọn vai luật sư', text: 'Chọn phía bạn bảo vệ. Bên đối lập sẽ phản biện, Chủ tọa điều hành phiên.' },
  { icon: MessageSquare, title: '3. Tranh luận theo lượt', text: 'Đọc lời Chủ tọa và bên đối lập, bấm Tiếp tục khi có lời tiếp theo. Khi đến lượt, chọn Trình bày ý kiến, viết và gửi lập luận. Có thể đưa chứng cứ từ Hồ sơ phiên tòa hoặc trích dẫn từ Trợ lý luật vào bài viết.' },
  { icon: Trophy, title: '4. Xem kết quả', text: 'Sau ít nhất một lượt trình bày, bạn có thể kết thúc phiên để xem nhận xét và gợi ý cải thiện. Gửi phần lập luận còn dang dở trước khi kết thúc. Phiên đã hoàn tất có thể xem lại trong lịch sử.' },
];

const argumentShape = [
  'Nêu rõ vấn đề pháp lý hoặc yêu cầu cần giải quyết.',
  'Viện dẫn tình tiết và chứng cứ trong hồ sơ.',
  'Nêu căn cứ pháp luật nếu bạn chắc chắn, không bịa số điều.',
  'Phản biện luận điểm gần nhất của phía đối lập.',
  'Kết luận ngắn gọn về đề nghị gửi Hội đồng xét xử.',
];

const notes = [
  'AI có thể trả lời sai hoặc viện dẫn chưa chính xác, hãy kiểm tra với văn bản pháp luật chính thức.',
  'Không tải lên thông tin cá nhân, bí mật nghề nghiệp hoặc hồ sơ vụ án thật chưa được ẩn danh.',
  'Khi dùng Trợ lý luật, đọc trích đoạn và mở văn bản nguồn để kiểm tra nội dung, thời điểm áp dụng trước khi viện dẫn.',
];

export default function GuidePage() {
  const authenticated = Boolean(getCurrentUser()?.id);
  return (
    <main className="guide-page">
      <section className="guide-hero">
        <div className="guide-container">
          <Link to={authenticated ? '/dashboard/setup' : '/'} className="guide-back"><ArrowLeft size={17} /> Quay lại</Link>
          <div className="guide-hero-grid">
            <div>
              <p className="guide-eyebrow"><Sparkles size={16} /> Hướng dẫn thực hành CourtSim</p>
              <h1>Hướng dẫn luyện tập tranh tụng</h1>
              <p>Các bước bắt đầu, hoàn thành một phiên luyện tập và tự cải thiện lập luận pháp lý theo cách chủ động hơn.</p>
              {authenticated && <Link to="/dashboard/setup" className="guide-primary">Thiết lập phiên mới</Link>}
            </div>
            <div className="guide-visual" aria-hidden="true">
              <div className="guide-visual-mark"><Gavel size={44} /></div>
              <div className="guide-flow">
                <span>Hồ sơ</span>
                <span>Lập luận</span>
                <span>Phản biện</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="guide-container guide-body">
        <section className="guide-steps" aria-label="Các bước luyện tập">
          {steps.map(({ icon: Icon, title, text }) => <article key={title} className="guide-card">
            <span className="guide-icon"><Icon size={27} aria-hidden="true" /></span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>)}
        </section>

        <section className="guide-argument">
          <div>
            <p className="guide-eyebrow dark"><MessageSquare size={16} /> Mẫu tư duy khi trình bày</p>
            <h2>Cấu trúc một lượt trình bày tốt</h2>
            <p>Giữ bài nói ngắn, có căn cứ và phản hồi đúng vấn đề vừa được đặt ra.</p>
          </div>
          <ol>
            {argumentShape.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </section>

        <section className="guide-notes">
          <div>
            <h2>Lưu ý khi luyện tập</h2>
            <p>CourtSim là môi trường học tập. Hãy dùng kết quả AI như phản hồi hỗ trợ, không thay thế kiểm tra pháp lý chuyên môn.</p>
          </div>
          <ul>{notes.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
    </main>
  );
}
