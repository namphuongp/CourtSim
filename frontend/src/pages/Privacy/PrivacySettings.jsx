import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import WorkspaceHeader from '../../components/WorkspaceHeader';
import { analytics } from '../../services/analytics';
import { ConsentChoices } from '../../components/analytics/ConsentBanner';
import { useAnalyticsConsent } from '../../components/analytics/useAnalyticsConsent';
import '../../components/analytics/analytics.css';

export default function PrivacySettings() {
  const consent = useAnalyticsConsent();
  return <div className="user-shell"><WorkspaceHeader/><main className="privacy-page">
    <section className="privacy-card">
      <ShieldCheck size={30} aria-hidden="true" />
      <h1>Cài đặt quyền riêng tư</h1>
      <p>Bạn có thể dùng CourtSim dù đồng ý hay từ chối cookie phân tích.</p>
      <div className="privacy-preferences">
        {[['Cần thiết', 'Duy trì đăng nhập, bảo mật và lưu lựa chọn quyền riêng tư.', true, true], ['Chức năng', 'Bản nháp được lưu trong thẻ trình duyệt để tiếp tục luyện tập. Hiện chưa có tùy chọn tắt riêng.', true, true], ['Phân tích', 'Cho phép Google Analytics đo lượt truy cập để cải thiện CourtSim.', consent === 'granted', false], ['Tiếp thị', 'CourtSim hiện không sử dụng cookie quảng cáo hoặc tiếp thị.', false, true]].map(([label, description, checked, locked], index) => <div className="privacy-preference" key={label}><div><strong id={`privacy-preference-${index}`}>{label}</strong><p>{description}</p>{locked && <small>{checked ? 'Đang dùng để vận hành CourtSim' : 'Không sử dụng'}</small>}</div><button type="button" role="switch" aria-labelledby={`privacy-preference-${index}`} aria-checked={checked} disabled={locked} onClick={() => analytics.setConsent(checked ? 'denied' : 'granted')}><span/></button></div>)}
      </div>
      <p role="status" className="privacy-status">{consent === 'granted' ? 'Hiện tại: đã đồng ý cookie phân tích.' : consent === 'denied' ? 'Hiện tại: đã từ chối cookie phân tích.' : 'Hiện tại: chưa cho phép cookie phân tích.'}</p>
      <ConsentChoices />
      <details className="privacy-disclosure"><summary>Thông tin xử lý và lưu dữ liệu</summary>
      <h2>Cookie phân tích</h2>
      <p>Khi bạn đồng ý, Google Analytics nhận lượt xem trang, loại trình duyệt, thiết bị và thông tin truy cập để giúp cải thiện CourtSim. Cookie phân tích nhận diện trình duyệt giữa các lần truy cập.</p>
      <p>CourtSim không gửi họ tên, email, mã tài khoản, token, mã phiên, nội dung phiên tòa hoặc dữ liệu biểu mẫu đến Google Analytics. Đường dẫn được rút gọn, không kèm tham số hay phần sau dấu #.</p>
      <p>Google xử lý dữ liệu tại hạ tầng của họ, có thể ở ngoài Việt Nam. Xem <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Chính sách quyền riêng tư của Google</a>.</p>
      <p>Lựa chọn được lưu trên trình duyệt này trong tối đa 180 ngày. Bạn có thể đổi bất cứ lúc nào tại đây. Từ chối sẽ dừng thu thập tiếp và xóa cookie phân tích của CourtSim; dữ liệu đã gửi trước đó không tự động bị xóa.</p>
      <h2>Dữ liệu cần thiết</h2>
      <p>Cookie đăng nhập và dữ liệu cần thiết để vận hành CourtSim vẫn hoạt động, không phụ thuộc lựa chọn phân tích.</p>
      </details>
      <Link className="privacy-back" to="/">← Quay lại CourtSim</Link>
    </section>
  </main></div>;
}
