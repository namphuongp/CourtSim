import { ArrowLeft, BookOpen, Gavel, MessageSquare, Scale, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
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

        <section id="usage" className="guide-notes">
          <div>
            <h2>Lưu ý khi luyện tập</h2>
            <p>CourtSim là môi trường học tập. Hãy dùng kết quả AI như phản hồi hỗ trợ, không thay thế kiểm tra pháp lý chuyên môn.</p>
          </div>
          <ul>{notes.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section id="scoring" className="guide-card">
          <h2>Hiểu kết quả chấm điểm</h2>
          <p>Chỉ có điểm toàn bài khi đủ dữ liệu đánh giá. Ví dụ 69/73 là điểm phần đã chấm, không phải điểm toàn bài trên thang 100. Các tiêu chí chưa có đủ dữ liệu được ghi rõ là chưa đánh giá.</p>
          <p>Đọc nhận xét, trích đoạn minh họa và gợi ý cải thiện để chọn kỹ năng cần luyện tiếp. Điểm số là phản hồi học tập từ AI.</p>
          <p>Freemium xem điểm và nhận xét tổng quan. Mua lượt lẻ hoặc gói Lite mở trợ lý luật và điểm chi tiết theo tiêu chí. Pro có thêm phân tích kỹ năng qua nhiều phiên. Mỗi phiên có tối đa 20 lượt trình bày và tất cả gói đều chịu hạn mức AI.</p>
        </section>
        <section id="faq" className="guide-card guide-faq">
          <h2>Câu hỏi thường gặp</h2>
          <details><summary>Tôi có thể chọn những vai nào?</summary><p>Bạn chọn vai luật sư bảo vệ nguyên đơn hoặc bị đơn, tương ứng với phía được nêu trong hồ sơ. AI đảm nhiệm Chủ tọa và bên đối lập.</p></details>
          <details><summary>Tải lại trang có làm mất phiên không?</summary><p>Các lượt đã gửi được lưu trong phiên của tài khoản. Bạn có thể mở lại phiên chưa kết thúc từ trang luyện tập. Bản nháp được giữ trong cùng thẻ trình duyệt nếu trình duyệt cho phép lưu trữ.</p></details>
          <details><summary>Tại sao một số tiêu chí chưa được chấm?</summary><p>Phiên có thể thiếu nguồn luật đủ điều kiện hoặc chưa có cơ hội thể hiện kỹ năng tương ứng. Phần chưa đánh giá không được xem là điểm 0.</p></details>
          <details><summary>Có thể tải hồ sơ riêng, dùng giọng nói hoặc xuất PDF không?</summary><p>Các chức năng này chưa có trong giao diện hiện tại. Bạn luyện tập bằng văn bản trên các hồ sơ được quản trị viên cung cấp.</p></details>
        </section>
        <section id="support" className="guide-card">
          <h2>Hỗ trợ khi gặp lỗi</h2>
          <p>Kiểm tra kết nối và dùng nút Thử lại ở màn hình báo lỗi. Nếu phiên đăng nhập hết hạn, đăng nhập lại rồi mở phiên từ lịch sử. Kiểm tra các lượt đã lưu trước khi gửi lại lập luận.</p>
          <div id="feedback"><h3>Gửi góp ý</h3><p>Sau khi kết thúc và chấm điểm, bạn có thể gửi góp ý về phiên trước khi xem kết quả. Góp ý được chuyển đến mục quản trị để xem xét. Không gửi mật khẩu hoặc mã xác thực.</p></div>
        </section>
        <section id="privacy" className="guide-card">
          <h2>Dữ liệu cá nhân</h2>
          <p>Hệ thống lưu hồ sơ tài khoản, phiên luyện tập, nội dung đã gửi, kết quả và góp ý. Quản trị viên có thể xem thông tin tài khoản và phiên để quản lý hệ thống.</p>
          <p>Nội dung luyện tập và phần hồ sơ liên quan có thể được gửi đến dịch vụ AI đã cấu hình để tạo phản hồi. Chỉ dùng tình huống đã ẩn danh, tránh nhập thông tin nhạy cảm. Bạn có thể đổi mật khẩu và đăng xuất thiết bị khác trong trang tài khoản.</p>
        </section>
        <section id="cookies" className="guide-card">
          <h2>Cookie và bản nháp</h2>
          <p>Cookie phiên giúp duy trì đăng nhập. Trình duyệt lưu thông tin tài khoản để hiển thị giao diện và giữ bản nháp trong thẻ đang mở. Khi dùng máy chung, hãy đăng xuất và đóng thẻ sau khi luyện tập.</p>
        </section>
      </div>
    </main>
  );
}
