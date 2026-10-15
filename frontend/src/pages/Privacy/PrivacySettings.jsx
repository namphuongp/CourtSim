import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import CourtSimBrand from '../../components/CourtSimBrand';
import { ConsentChoices } from '../../components/analytics/ConsentBanner';
import { useAnalyticsConsent } from '../../components/analytics/useAnalyticsConsent';
import '../../components/analytics/analytics.css';

export default function PrivacySettings() {
  const consent = useAnalyticsConsent();
  return <main className="privacy-page">
    <CourtSimBrand />
    <section className="privacy-card">
      <ShieldCheck size={30} aria-hidden="true" />
      <h1>Cài đặt quyền riêng tư</h1>
      <p>Bạn có thể dùng CourtSim dù đồng ý hay từ chối cookie phân tích.</p>
      <h2>Cookie phân tích</h2>
      <p>Khi bạn đồng ý, Google Analytics nhận lượt xem trang, loại trình duyệt, thiết bị và thông tin truy cập để giúp cải thiện CourtSim. Cookie phân tích nhận diện trình duyệt giữa các lần truy cập.</p>
      <p>CourtSim không gửi họ tên, email, mã tài khoản, token, mã phiên, nội dung phiên tòa hoặc dữ liệu biểu mẫu đến Google Analytics. Đường dẫn được rút gọn, không kèm tham số hay phần sau dấu #.</p>
      <p>Google xử lý dữ liệu tại hạ tầng của họ, có thể ở ngoài Việt Nam. Xem <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Chính sách quyền riêng tư của Google</a>.</p>
      <p>Lựa chọn được lưu trên trình duyệt này trong tối đa 180 ngày. Bạn có thể đổi bất cứ lúc nào tại đây. Từ chối sẽ dừng thu thập tiếp và xóa cookie phân tích của CourtSim; dữ liệu đã gửi trước đó không tự động bị xóa.</p>
      <p role="status" className="privacy-status">{consent === 'granted' ? 'Hiện tại: đã đồng ý cookie phân tích.' : consent === 'denied' ? 'Hiện tại: đã từ chối cookie phân tích.' : 'Hiện tại: chưa cho phép cookie phân tích.'}</p>
      <ConsentChoices />
      <h2>Dữ liệu cần thiết</h2>
      <p>Cookie đăng nhập và dữ liệu cần thiết để vận hành CourtSim vẫn hoạt động, không phụ thuộc lựa chọn phân tích.</p>
      <Link className="privacy-back" to="/">← Quay lại CourtSim</Link>
    </section>
  </main>;
}
