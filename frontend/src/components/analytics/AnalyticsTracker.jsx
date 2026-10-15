import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../../services/analytics';
import { useAnalyticsConsent } from './useAnalyticsConsent';

export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  const consent = useAnalyticsConsent();
  useEffect(() => {
    // Chờ redirect hoàn tất; cleanup loại bỏ lượt chạy thử của StrictMode.
    const timer = setTimeout(() => analytics.trackPage(pathname), 0);
    return () => clearTimeout(timer);
  }, [pathname, consent]);
  return null;
}
