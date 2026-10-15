export const CONSENT_KEY = 'courtsim.analytics-consent.v1';
const CONSENT_AGE = 180 * 24 * 60 * 60 * 1000;
const MEASUREMENT_ID = 'G-HFLCZYBCK9';
const ORIGIN = 'https://courtsimvn.com';
const DENIED = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
const PAGES = new Map([
  ['/', 'Trang chủ'], ['/login', 'Đăng nhập'], ['/register', 'Đăng ký'],
  ['/guide', 'Hướng dẫn'], ['/privacy', 'Quyền riêng tư'],
  ['/dashboard', 'Tổng quan'], ['/dashboard/sessions', 'Phiên luyện tập'],
  ['/dashboard/history', 'Lịch sử'], ['/dashboard/analytics', 'Thống kê'],
  ['/dashboard/setup', 'Thiết lập phiên'],
]);

export function analyticsPage(pathname) {
  if (PAGES.has(pathname)) return { path: pathname, title: PAGES.get(pathname) };
  // Chỉ gửi mẫu đường dẫn, không gửi ID tài khoản, phiên hoặc gói thanh toán.
  if (/^\/simulation\/[^/]+\/result\/?$/.test(pathname)) return { path: '/simulation/session/result', title: 'Kết quả luyện tập' };
  if (/^\/simulation\/[^/]+\/?$/.test(pathname)) return { path: '/simulation/session', title: 'Phòng luyện tập' };
  if (/^\/account(?:\/(?:profile|security|linked))?\/?$/.test(pathname)) return { path: '/account', title: 'Tài khoản' };
  if (/^\/checkout\/[^/]+\/?$/.test(pathname)) return { path: '/checkout', title: 'Thanh toán' };
  // Bỏ qua admin, URL không xác định và các trang chứa token xác thực.
  return null;
}

export function createAnalytics({ env, browser, document }) {
  const enabled = env.PROD === true && env.MODE === 'production' && env.VITE_GA_ENABLED !== 'false'
    && browser.location.protocol === 'https:'
    && ['courtsimvn.com', 'www.courtsimvn.com'].includes(browser.location.hostname);
  const disableKey = `ga-disable-${MEASUREMENT_ID}`;
  const listeners = new Set();
  let memoryConsent = null;
  let storageUnavailable = false;
  let expiryTimer;
  let initialized = false;
  let lastPath = null;
  let previousLocation = '';
  let script;

  function readConsent() {
    if (storageUnavailable) return memoryConsent;
    let raw;
    try {
      raw = browser.localStorage.getItem(CONSENT_KEY);
    } catch { return memoryConsent; }
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getConsent() {
    const saved = readConsent();
    return saved?.version === 1 && ['granted', 'denied'].includes(saved.choice)
      && saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + CONSENT_AGE
      ? saved.choice : null;
  }

  function clearCookies() {
    const names = ['_ga', `_ga_${MEASUREMENT_ID.slice(2)}`];
    for (const name of names) {
      for (const domain of ['', browser.location.hostname, 'courtsimvn.com']) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? `; Domain=${domain}` : ''}`;
      }
    }
  }

  function stop() {
    browser[disableKey] = true;
    lastPath = null;
    previousLocation = '';
    if (initialized) {
      // Chặn gửi trước khi cập nhật consent, kể cả khi gtag còn đang tải.
      browser.gtag('consent', 'update', DENIED);
      clearCookies();
    }
  }

  function setConsent(choice) {
    if (!['granted', 'denied'].includes(choice)) return;
    memoryConsent = { version: 1, choice, expiresAt: Date.now() + CONSENT_AGE };
    try {
      browser.localStorage.setItem(CONSENT_KEY, JSON.stringify(memoryConsent));
    } catch { storageUnavailable = true; /* Chỉ nhớ lựa chọn trong lần mở trang này. */ }
    if (choice !== 'granted') stop();
    else if (initialized) {
      browser[disableKey] = false;
      browser.gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
    }
    listeners.forEach(listener => listener());
    scheduleExpiry();
  }

  function trackPage(pathname) {
    if (!enabled || getConsent() !== 'granted') { stop(); return; }
    const page = analyticsPage(pathname);
    if (!page) {
      browser[disableKey] = true;
      lastPath = null;
      previousLocation = '';
      return;
    }
    if (lastPath === pathname) return;
    const location = ORIGIN + page.path;
    const fields = { page_location: location, page_path: page.path, page_title: `CourtSim | ${page.title}`, page_referrer: previousLocation };
    browser[disableKey] = false;
    if (!initialized) {
      browser.dataLayer = browser.dataLayer || [];
      browser.gtag = function () { browser.dataLayer.push(arguments); };
      browser.gtag('consent', 'default', DENIED);
      browser.gtag('set', { ...fields, ads_data_redaction: true, url_passthrough: false });
      browser.gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
      browser.gtag('js', new Date());
      browser.gtag('config', MEASUREMENT_ID, {
        ...fields, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: browser.location.hostname,
        cookie_path: '/', cookie_flags: 'SameSite=Lax;Secure', cookie_expires: CONSENT_AGE / 1000,
        cookie_update: false,
      });
      initialized = true;
      script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      script.onerror = () => {
        // GA bị chặn hoặc mất mạng không được ảnh hưởng đến phiên luyện tập.
        browser[disableKey] = true;
        script.remove();
        browser.dataLayer.length = 0;
        initialized = false;
        lastPath = null;
      };
      script.onload = () => { if (getConsent() !== 'granted') stop(); };
      document.head.appendChild(script);
    } else {
      // Cập nhật cả mặc định cho sự kiện tự động, không chỉ riêng page_view.
      browser.gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
      browser.gtag('set', fields);
      browser.gtag('config', MEASUREMENT_ID, { ...fields, update: true, send_page_view: false });
    }
    browser.gtag('event', 'page_view', { ...fields, send_to: MEASUREMENT_ID });
    lastPath = pathname;
    previousLocation = location;
  }

  function syncConsent() {
    if (getConsent() !== 'granted') stop();
    listeners.forEach(listener => listener());
    scheduleExpiry();
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!getConsent()) return;
    // Hẹn tối đa một ngày để không vượt giới hạn timer và vẫn kiểm tra khi tab mở lâu.
    const remaining = Math.min(24 * 60 * 60 * 1000, Math.max(1, readConsent().expiresAt - Date.now() + 1));
    expiryTimer = setTimeout(syncConsent, remaining);
    expiryTimer.unref?.();
  }
  browser.addEventListener('storage', event => {
    if (event.key === CONSENT_KEY || event.key === null) syncConsent();
  });
  document.addEventListener('visibilitychange', syncConsent);
  browser[disableKey] = true;
  scheduleExpiry();

  return { enabled, getConsent, setConsent, trackPage, subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  } };
}

export const analytics = typeof window === 'undefined' ? null : createAnalytics({ env: import.meta.env, browser: window, document });
