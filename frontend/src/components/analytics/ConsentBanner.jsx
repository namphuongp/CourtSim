import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { analytics } from '../../services/analytics';
import { useAnalyticsConsent } from './useAnalyticsConsent';
import './analytics.css';

export function ConsentChoices() {
  return <div className="consent-actions">
    <button type="button" onClick={() => analytics.setConsent('denied')}>Từ chối</button>
    <button type="button" className="consent-accept" onClick={() => analytics.setConsent('granted')}>Đồng ý</button>
  </div>;
}

export default function ConsentBanner() {
  const consent = useAnalyticsConsent();
  const { pathname } = useLocation();
  if (!analytics.enabled || consent || pathname === '/privacy' || pathname.startsWith('/admin')) return null;
  return <aside className="consent-banner" aria-label="Lựa chọn cookie phân tích">
    <ShieldCheck size={23} aria-hidden="true" />
    <div className="consent-copy"><strong>Bạn quyết định về cookie</strong>
      <p>CourtSim dùng Google Analytics để đo lượt truy cập khi bạn đồng ý. Không gửi email hoặc nội dung phiên tòa. <Link to="/privacy">Cài đặt quyền riêng tư</Link></p>
    </div>
    <ConsentChoices />
  </aside>;
}
