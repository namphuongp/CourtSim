import { useSyncExternalStore } from 'react';
import { analytics } from '../../services/analytics';

export function useAnalyticsConsent() {
  return useSyncExternalStore(analytics.subscribe, analytics.getConsent, () => null);
}
