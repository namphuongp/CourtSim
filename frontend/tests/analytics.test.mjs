import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPage, createAnalytics, CONSENT_KEY } from '../src/services/analytics.js';

function fixture({ env = {}, host = 'courtsimvn.com', protocol = 'https:', storageBlocked = false } = {}) {
  const storage = new Map(), scripts = [], cookies = [], events = {};
  const browser = {
    location: { hostname: host, protocol },
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw Error('blocked'); storage.set(key, value); },
    },
    addEventListener(name, fn) { events[name] = fn; },
  };
  const document = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: script => scripts.push(script) },
    set cookie(value) { cookies.push(value); },
    addEventListener(name, fn) { events[name] = fn; },
  };
  const analytics = createAnalytics({ env: { PROD: true, MODE: 'production', ...env }, browser, document });
  const commands = () => (browser.dataLayer || []).map(args => Array.from(args));
  return { analytics, browser, storage, scripts, cookies, events, commands,
    views: () => commands().filter(([command, name]) => command === 'event' && name === 'page_view') };
}

test('không tải GA hoặc tạo hàng đợi trước consent và sau từ chối', () => {
  const f = fixture();
  f.analytics.trackPage('/');
  f.analytics.setConsent('denied');
  f.analytics.trackPage('/guide');
  assert.equal(f.scripts.length, 0);
  assert.deepEqual(f.commands(), []);
  assert.equal(f.analytics.getConsent(), 'denied');
});

test('chỉ bật production HTTPS đúng domain; hỗ trợ công tắc ngắt', () => {
  for (const options of [{ env: { PROD: false } }, { env: { MODE: 'test' } }, { env: { MODE: 'development' } },
    { env: { VITE_GA_ENABLED: 'false' } }, { host: 'localhost' }, { host: 'courtsim.onrender.com' },
    { host: 'courtsimvn.com.attacker.test' }, { protocol: 'http:' }]) {
    const f = fixture(options);
    f.analytics.setConsent('granted'); f.analytics.trackPage('/');
    assert.equal(f.scripts.length, 0, JSON.stringify(options));
  }
  const f = fixture({ host: 'www.courtsimvn.com' });
  f.analytics.setConsent('granted'); f.analytics.trackPage('/');
  assert.equal(f.scripts.length, 1);
});

test('chỉ một page_view mỗi lần chuyển pathname, hỗ trợ Back và phiên khác', () => {
  const f = fixture(); f.analytics.setConsent('granted');
  for (const path of ['/', '/', '/guide', '/guide', '/', '/simulation/private-a', '/simulation/private-b']) f.analytics.trackPage(path);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.views().length, 5);
  assert.equal(f.commands().find(([c]) => c === 'config')[2].send_page_view, false);
  assert.equal(f.commands()[0][2].analytics_storage, 'denied');
  assert.equal(f.commands()[2][2].analytics_storage, 'granted');
  assert.equal(f.commands()[2][2].ad_storage, 'denied');
});

test('dữ liệu gửi chỉ có tên trang tĩnh và mẫu URL, không có ID hay URL xác thực', () => {
  const f = fixture(); f.analytics.setConsent('granted');
  for (const path of ['/simulation/private-id', '/simulation/private-id/result', '/account/security', '/checkout/private-plan', '/admin/users/private-id', '/reset-password', '/unknown-secret']) f.analytics.trackPage(path);
  const serialized = JSON.stringify(f.commands());
  for (const value of ['private-id', 'private-plan', 'unknown-secret', 'reset-password', '"user_id"', '"user_data"']) assert.ok(!serialized.includes(value), value);
  assert.equal(f.views().length, 4);
  assert.equal(analyticsPage('/?email=secret'), null);
  assert.equal(f.scripts[0].referrerPolicy, 'no-referrer');
  assert.equal(f.browser['ga-disable-G-HFLCZYBCK9'], true);
});

test('rút consent chặn ngay, xóa đúng cookie GA, có thể đồng ý lại', () => {
  const f = fixture(); f.analytics.setConsent('granted'); f.analytics.trackPage('/');
  f.analytics.setConsent('denied'); f.analytics.trackPage('/guide');
  assert.equal(f.browser['ga-disable-G-HFLCZYBCK9'], true);
  assert.equal(f.views().length, 1);
  assert.ok(f.cookies.every(cookie => cookie.startsWith('_ga')));
  assert.ok(f.cookies.length > 0);
  f.analytics.setConsent('granted'); f.analytics.trackPage('/guide');
  assert.equal(f.browser['ga-disable-G-HFLCZYBCK9'], false);
  assert.equal(f.views().length, 2);
  assert.equal(f.scripts.length, 1);
});

test('consent hết hạn, dữ liệu hỏng và xóa storage đều không cấp quyền', () => {
  const f = fixture();
  for (const value of ['broken', '{}', JSON.stringify({ version: 1, choice: 'granted', expiresAt: Date.now() - 1 })]) {
    f.storage.set(CONSENT_KEY, value); f.analytics.trackPage('/');
    assert.equal(f.analytics.getConsent(), null);
  }
  assert.equal(f.scripts.length, 0);
  f.analytics.setConsent('granted'); f.analytics.trackPage('/');
  f.storage.clear(); f.events.storage({ key: null });
  assert.equal(f.browser['ga-disable-G-HFLCZYBCK9'], true);
});

test('storage bị chặn vẫn cho phép từ chối/đồng ý trong bộ nhớ', () => {
  const f = fixture({ storageBlocked: true });
  f.analytics.setConsent('granted'); f.analytics.trackPage('/');
  assert.equal(f.views().length, 1);
  f.analytics.setConsent('denied'); f.analytics.trackPage('/guide');
  assert.equal(f.views().length, 1);
});

test('lỗi tải script không ném lỗi, có thể thử lại ở trang sau', () => {
  const f = fixture(); f.analytics.setConsent('granted'); f.analytics.trackPage('/');
  f.scripts[0].onerror();
  assert.equal(f.browser['ga-disable-G-HFLCZYBCK9'], true);
  assert.deepEqual(f.commands(), []);
  f.analytics.trackPage('/guide');
  assert.equal(f.scripts.length, 2);
  assert.equal(f.views().length, 1);
});
