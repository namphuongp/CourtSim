# Google Analytics 4 — CourtSim

Measurement ID: `G-HFLCZYBCK9`. Tích hợp trực tiếp `gtag.js`, không thêm thư viện hay Google Tag Manager.

## Hành vi

- Bật mặc định trong bản build `production`, chỉ trên HTTPS `courtsimvn.com` và `www.courtsimvn.com`. Localhost, preview `onrender.com`, development và mode test không tải GA, dù đã có consent.
- Consent Mode v2 theo cách basic: trước khi đồng ý hoặc khi từ chối từ đầu, không tải script Google, không tạo hàng đợi sự kiện và không gửi cookieless ping. Không gửi lại các lượt xem trước consent.
- Banner có hai lựa chọn rõ ràng, nằm trong luồng trang, không phủ nội dung. Trang `/privacy` và liên kết cuối trang cho phép đổi lựa chọn mà không cần đăng nhập.
- Chỉ lưu lựa chọn/version/hạn dùng trong `courtsim.analytics-consent.v1` tại localStorage, tối đa 180 ngày. Storage bị chặn thì nhớ trong bộ nhớ đến khi đóng/tải lại trang. Lựa chọn riêng trên từng origin/trình duyệt.
- Khi rút consent: đặt cờ chặn GA ngay, cập nhật consent, xóa `_ga` và `_ga_HFLCZYBCK9` tại path `/`. Không đụng cookie đăng nhập. Đồng bộ thay đổi qua các tab cùng origin. Yêu cầu đã gửi trước khi rút consent không thể thu hồi.
- Cookie GA chỉ được dùng sau đồng ý, `Secure; SameSite=Lax`, tối đa 180 ngày và không tự gia hạn theo mỗi lượt xem. Consent quảng cáo luôn denied; Google Signals/cá nhân hóa quảng cáo bị tắt trong mã.
- Một `page_view` cho mỗi pathname đã hiển thị, kể cả Back/Forward và tải lại. Rerender, StrictMode, thay đổi query/hash không tạo thêm lượt xem. Hai mã phiên khác nhau vẫn được tính là hai lần truy cập, nhưng chỉ gửi mẫu URL.
- GA tự tính người dùng/phiên từ các lượt truy cập đã đồng ý; không tự gửi thêm `session_start` hoặc `first_visit`.

## Dữ liệu được gửi

Chỉ gửi `page_location`, `page_path`, `page_title`, `page_referrer` từ danh sách tên/mẫu trang cố định; referrer chỉ là trang nội bộ đã lọc. Không đọc DOM/biểu mẫu, nội dung phiên tòa, thông tin tài khoản hoặc storage đăng nhập. Không gửi `user_id`, email, token, query/hash hay mã phiên. Không giữ UTM/referrer bên ngoài, vì vậy báo cáo nguồn chiến dịch bị hạn chế.

Ví dụ `/simulation/abc123/result?token=...#transcript` trở thành `https://courtsimvn.com/simulation/session/result`, tiêu đề `CourtSim | Kết quả luyện tập`. Trang admin, callback, xác thực/đặt lại mật khẩu và URL không biết không được theo dõi.

Google vẫn xử lý kết nối mạng và dữ liệu thiết bị/trình duyệt theo GA4 khi được đồng ý. Không mô tả GA4 là hoàn toàn vô danh hoặc không xử lý dữ liệu cá nhân. Trang `/privacy` công bố mục đích, bên nhận, lưu lựa chọn và cách rút lại; chủ website cần rà soát chính sách bảo vệ dữ liệu, thời hạn giữ dữ liệu và nghĩa vụ áp dụng với đối tượng truy cập trước khi phát hành. Consent UI không tự chứng minh toàn bộ yêu cầu pháp lý đã hoàn tất.

## Bắt buộc kiểm tra trong GA4 trước khi deploy

1. Mở **Admin → Data streams → Web stream `G-HFLCZYBCK9`**. Kiểm tra website là `https://courtsimvn.com`.
2. **Tắt toàn bộ Enhanced Measurement** trong stream. Điều này cũng tắt tự đo scroll, outbound click, search, video, download, form interaction có thể thu dữ liệu ngoài allowlist. Riêng Page views, bảo đảm **Page changes based on browser history events** đã tắt. `send_page_view: false` trong mã chỉ tắt page view khi config; không tắt được page view do Enhanced Measurement theo dõi history.
3. Kiểm tra **Google tag → Configure tag settings**: không có tag đích bổ sung, tự thu thập user-provided data, cross-domain tracking hay cấu hình tự tạo sự kiện khác. Không chèn thêm gtag/GTM cùng Measurement ID qua HTML, hosting hoặc công cụ khác.
4. Trong Data collection, để Google Signals và user-provided data collection tắt. Rà soát Data retention (chọn thời hạn ngắn phù hợp), liên kết Ads và quyền truy cập property.
5. Nếu hosting đang đặt CSP, cho phép script `https://www.googletagmanager.com` và kết nối `https://www.google-analytics.com`, `https://region1.google-analytics.com` theo nhu cầu thực tế; không mở wildcard hoặc `unsafe-inline` chỉ để bật GA. Giữ chính sách referrer `strict-origin-when-cross-origin` hoặc chặt hơn. Script GA dùng `referrerPolicy=no-referrer`.

Các thiết lập tài khoản GA4 không nằm trong repository và chưa được xác minh bằng quyền truy cập tài khoản. Chưa deploy cho đến khi hoàn tất các bước trên. Không có cách dùng riêng `send_page_view: false` để thay thế bước 2.

## Deploy lại frontend trên Render

- Không cần đổi backend, database hay OAuth.
- Nếu Render có Root Directory `frontend`: Build Command `npm ci && npm run build`, Publish Directory `dist`. Nếu root ở repository thì dùng lệnh và thư mục tương đương với cấu hình hiện có. Giữ nguyên proxy `/api` và SPA fallback; `/privacy` phải mở trực tiếp/tải lại được.
- `VITE_GA_ENABLED=true` bật tracking sau consent (không khai báo cũng bật). Nếu đang có giá trị `false`, đổi thành `true` rồi build/deploy lại. Biến `VITE_*` được gắn vào bundle lúc build, không đổi bằng restart đơn thuần.
- ID đã đặt cố định trong service và là mã công khai, không phải secret. Không đưa Google API secret vào frontend.
- Dùng build production mặc định, không chạy Vite dev server. Domain preview `*.onrender.com` cố ý không ghi nhận; kiểm tra trên domain thật.
- Có thể ngắt bằng `VITE_GA_ENABLED=false` rồi rebuild/deploy.

## Xác minh sau deploy

1. Mở cửa sổ riêng tư tại `https://courtsimvn.com`, tắt ad blocker chỉ cho lần kiểm tra. DevTools → Network, lọc `gtag` hoặc `collect`. Trước consent phải không có request Analytics; Application → Cookies không có `_ga*` mới.
2. Chọn **Từ chối**, chuyển trang và reload: vẫn không có request Analytics. Mở **Cài đặt quyền riêng tư** từ cuối trang.
3. Chọn **Đồng ý**: script `gtag/js?id=G-HFLCZYBCK9` tải một lần. Kiểm tra request GA `g/collect`: `tid=G-HFLCZYBCK9`, sự kiện `en=page_view`, các trường `dl`, `dt`, `dr` đã lọc. Một request có thể chứa nhiều sự kiện; đếm sự kiện `page_view`, không đếm tổng số request. `session_start`, `first_visit`, `user_engagement` là sự kiện tự động riêng, không phải page view trùng.
4. Chuyển trang bằng liên kết nội bộ, Back/Forward, reload: mỗi lần một page view. Thay đổi query/hash cùng pathname không thêm page view. Kiểm tra một phiên dùng dữ liệu thử: không có ID/email/token/nội dung trong URL/payload gửi đến Google.
5. Mở **Reports → Realtime** trong đúng property, kiểm tra người dùng hoạt động và `page_view`. Dùng [Google Tag Assistant](https://tagassistant.google.com/) cùng **Admin → DebugView** để xem từng sự kiện khi cần; không bật debug toàn production. Báo cáo tổng hợp thường cần 24–48 giờ. Dữ liệu chỉ bao gồm khách đồng ý và không chặn Analytics.
6. Quay lại `/privacy`, chọn **Từ chối**: cookie `_ga*` của CourtSim bị xóa, không có sự kiện Analytics mới; reload không tải script. Kiểm tra một tab khác cùng origin cũng dừng. Request đã bắt đầu trước thao tác có thể vẫn hoàn thành.

## Kiểm tra cục bộ

Chạy trong `frontend`:

```powershell
npm run test:analytics
npm run test:analytics:e2e
npm run lint
npm run build
```

Unit test kiểm tra môi trường, consent, hết hạn/storage bị chặn, lọc dữ liệu, chống lặp và lỗi tải script. Playwright dùng bundle production cục bộ được phục vụ dưới origin production giả lập, API và Google script đều bị mock/chặn; không gửi dữ liệu vào property thật. Các kết quả này không thay thế việc kiểm tra request thật và Realtime sau deploy.

Kết quả kiểm tra ngày 14/10/2026: 8/8 unit tests, 8/8 Playwright desktop/mobile, lint, build frontend và `git diff --check` đạt. Đã xem ảnh render banner trên desktop/mobile và trang quyền riêng tư. Cookie trong bài kiểm tra xóa cookie là dữ liệu fixture; chưa kiểm tra cookie/request của Google thật trên production.

## File thêm hoặc sửa

| File | Mục đích |
|---|---|
| `frontend/src/services/analytics.js` | Consent, giới hạn môi trường/domain, tải GA và lọc dữ liệu |
| `frontend/src/components/analytics/AnalyticsTracker.jsx` | Theo dõi React Router, loại lượt chạy lặp |
| `frontend/src/components/analytics/useAnalyticsConsent.js` | Đồng bộ consent với React |
| `frontend/src/components/analytics/ConsentBanner.jsx` | Thông báo và hai lựa chọn |
| `frontend/src/components/analytics/analytics.css` | Giao diện responsive của banner và cài đặt |
| `frontend/src/pages/Privacy/PrivacySettings.jsx` | Trang `/privacy`, công bố thông tin và đổi lựa chọn |
| `frontend/src/App.jsx` | Gắn banner, tracker, route và liên kết cuối trang |
| `frontend/src/pages/Account/AccountSettings.jsx` | Liên kết quyền riêng tư trong cài đặt tài khoản |
| `frontend/src/pages/Home/landing.css` | Giữ header/skip link không chồng lên banner |
| `frontend/.env.example` | Công tắc bật/tắt GA khi build |
| `frontend/package.json` | Lệnh chạy kiểm tra Analytics |
| `frontend/playwright.config.js` | Tách bộ kiểm tra Analytics khỏi E2E hiện có |
| `frontend/playwright.analytics.config.js` | Cấu hình kiểm tra desktop/mobile |
| `frontend/tests/analytics.test.mjs` | Kiểm tra logic và giới hạn dữ liệu |
| `frontend/tests/analytics-browser/consent.spec.js` | Kiểm tra giao diện, điều hướng, cookie và nhiều tab |
| `docs/ANALYTICS.md` | Cấu hình GA4, deploy, giới hạn và xác minh thực tế |

## Tài liệu đối chiếu

- [Google: page views và nguy cơ trùng từ Enhanced Measurement](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google: basic/advanced consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Google: cấu hình consent và rút lại consent](https://developers.google.com/tag-platform/security/guides/consent)
- [Google: tránh gửi PII](https://support.google.com/analytics/answer/6366371)
- [Vite: deploy lên Render](https://vite.dev/guide/static-deploy.html#render)
