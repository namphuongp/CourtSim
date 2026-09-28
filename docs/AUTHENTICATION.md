# Authentication CourtSim

## Kiến trúc và thay đổi
Trước đây: Express/Mongoose tạo User ngay khi đăng ký; bcrypt cost 12; JWT HS256 1 ngày trong localStorage; middleware đọc role/status từ MongoDB; limiter Map theo IP. Không xác thực email, không Google, logout không thu hồi JWT.

Hiện tại giữ Express routes/services/models và các tên trường `username`, `password_hash`, `system_role`. Web dùng phiên opaque ngẫu nhiên 256 bit trong cookie HttpOnly, SameSite=Lax; Secure và tiền tố __Host- trong production. DB chỉ giữ SHA-256 token. Hết hạn tuyệt đối 7 ngày, hết hạn sau 30 phút không gọi API; hoạt động hợp lệ gia hạn thời gian nhàn rỗi, không vượt 7 ngày. Không còn phát/chấp nhận JWT đăng nhập cũ, không dùng refresh token trong localStorage. JWT_SECRET vẫn dùng làm khóa HMAC cho OTP/audit; không đổi khóa tùy tiện trong lúc có OTP chờ.

Đây là chuyển đổi có chủ đích sang server session để logout có hiệu lực tức thì, không duy trì hai cơ chế authentication song song. Người dùng cũ phải đăng nhập lại. ID User, phiên học, góp ý, quyền và password hash cũ không đổi. Email cũ chưa có bằng chứng xác minh không được tự đánh dấu verified: nhập đúng mật khẩu sẽ chuyển qua OTP. Admin cũng phải xác thực email thật; tài khoản seed địa chỉ .local không nhận được email, cần người vận hành cập nhật địa chỉ thực đã kiểm tra quyền sở hữu trước khi dùng, không bỏ qua OTP.

## Schema/index
- User: thêm `google_id` (unique partial string), `email_verified` (false), `auth_providers`, updated_at; password_hash nullable và select:false. Giữ unique email.
- PendingRegistration: unique email+purpose và challenge UUID, passwordHash/otpHash select:false, OTP HMAC-SHA256 ràng buộc challenge, expiry 5 phút, 5 lần thử, cooldown 60 giây, tối đa 5 resend. TTL dữ liệu chờ 24 giờ; kiểm tra expiry trong truy vấn, không phụ thuộc tốc độ TTL.
- AuthSession: tokenHash unique, userId index, TTL absolute expiry; quyền/status/verified đọc từ User mỗi yêu cầu.
- OAuthAttempt: state hash unique, nonce, PKCE verifier, hash cookie trình duyệt, linkUserId khi đã xác thực lại, TTL 10 phút; consume nguyên tử trước đổi authorization code.
- AuthRateBucket: khóa HMAC theo IP/email/endpoint/time slot, tăng nguyên tử, TTL dọn bộ đếm. Dùng chung MongoDB giữa nhiều instance. Giới hạn 40 yêu cầu/IP/endpoint/15 phút, 10/email/endpoint/15 phút; gửi mail tối đa 5/email/15 phút. Có thể thay adapter consumeAuthLimit bằng Redis mà không đổi route.

Không ghi password/OTP/token/API key hoặc email thô vào log. Security log chỉ event, HMAC subject và thời gian. Nội dung email không được lưu plaintext trong DB. Giới hạn body, kiểu dữ liệu, trường thừa, email, password được kiểm tra ở backend. Mật khẩu mới >=8 ký tự, có chữ hoa và số, tối đa72 byte do giới hạn bcrypt; mật khẩu cũ vẫn đăng nhập được. Đăng ký/forgot/resend không trả email có tồn tại hay không.

## Cấu hình dịch vụ
Trong `backend/.env` (không commit):
```
MONGO_URI=mongodb://127.0.0.1:27017/courtsim
JWT_SECRET=<chuỗi ngẫu nhiên ít nhất 32 ký tự>
CLIENT_ORIGIN=http://localhost:5173
EMAIL_API_KEY=<Resend API key>
EMAIL_FROM=CourtSim <xac-thuc@ten-mien-da-xac-minh.example>
GOOGLE_CLIENT_ID=<OAuth web client ID>
GOOGLE_CLIENT_SECRET=<OAuth web client secret>
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```
Không cần khóa Google trong frontend; không Gmail API. EMAIL_FROM phải là địa chỉ thuộc domain được provider chấp nhận; tạo tài khoản Resend, xác minh domain/DNS và cấu hình khóa chỉ quyền gửi. Khi chưa cấu hình, giao diện báo gửi email/Google chưa thành công; tuyệt đối không trả mã qua API hoặc in console làm cách dự phòng.

Google Cloud: tạo OAuth client kiểu **Web application**, cấu hình consent screen, scopes openid/email/profile, test users khi ứng dụng ở Testing. Authorized redirect URI local chính xác:
`http://localhost:5000/api/auth/google/callback`
Authorized JavaScript Origin có thể khai báo `http://localhost:5173` (luồng này redirect phía server, không dùng Google JS SDK nên không phụ thuộc origin JS).
Production: `https://api.<domain>/api/auth/google/callback`, frontend `https://<domain>`. Không dùng wildcard. CLIENT_ORIGIN đầu tiên là frontend nhận redirect. VITE_API_URL phải trỏ API tương ứng. Frontend/API cần cùng site (ví dụ app.example.com/api.example.com hoặc reverse proxy /api) để SameSite=Lax hoạt động; không đặt trên hai site không liên quan rồi mở cookie vô điều kiện.

Backend kiểm tra signature RS256 bằng JWKS Google, issuer, audience, expiry, tuổi token, nonce, email_verified. State và PKCE ràng buộc trình duyệt. Dùng sub làm định danh. Khi trùng email đã xác minh, chỉ tự liên kết nếu Google quản lý địa chỉ đó (Gmail hoặc Workspace có hd phù hợp); email bên thứ ba phải đăng nhập mật khẩu rồi chọn **Liên kết Google** trong dashboard, xác nhận lại mật khẩu. Không liên kết tài khoản chưa xác minh hoặc ghi đè liên kết có sẵn; DB unique chống race.

Tài liệu nguồn: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email).

## API
Giữ prefix /api/auth và tên login/register; payload/response thay đổi cần deploy frontend cùng backend:
- POST /register: full_name,email,password,confirm_password → 202 data.challenge/expiresAt/resendAt.
- POST /login: email,password → user + cookie; hoặc202 verificationRequired + challenge cho account cũ.
- POST /verify-email: challenge,otp → user + cookie.
- POST /resend-verification: challenge →202 thời hạn/cooldown.
- POST /forgot-password: email →202 challenge; không tiết lộ account.
- POST /reset-password: challenge,otp,password,confirm_password → thành công, thu hồi mọi session, yêu cầu login lại.
- GET /me: user công khai; không password hash.
- POST /logout: thu hồi cookie session; gọi lặp an toàn.
- POST /google/start: returnTo tùy chọn, chỉ đường dẫn nội bộ → url Google.
- POST /google/link: cookie + password xác nhận lại → url Google.
- GET /google/callback: endpoint Google redirect; không trả token trong URL.

API ghi phải gửi Origin đúng allowlist và `X-CourtSim-Request: 1`, Content-Type JSON. Axios bật withCredentials. CORS credentials chỉ allowlist. Cookie không có Domain. API admin vẫn authenticate + requireAdmin từ DB. Response lỗi giữ envelope dự án `{error:{code,message}}`.

## Migration và chạy local
Sao lưu DB trước rollout. Từ thư mục dự án:
```
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run auth:migrate
npm --prefix backend run auth:migrate -- --apply
npm --prefix backend run dev
npm --prefix frontend run dev
```
Nếu npm/PowerShell không chuyển đối số: `cd backend; node src/scripts/migrateAuth.js --apply`.
Dry-run báo số tài khoản cũ, không hiển thị email; --apply chuẩn hóa email, thêm defaults và tạo index. Không gộp email trùng, không xóa index/dữ liệu, không đánh dấu verified hàng loạt. Dừng nếu trùng sau chuẩn hóa. Thực hiện trong maintenance window để không chạy song song bản auth cũ. Không cần seed lại. Với production tắt autoIndex, chạy migration trước mở traffic.

## Kiểm tra thủ công
1. Đăng ký email thật → kiểm tra thư/inbox spam → dán6 chữ số → vào dashboard. F5 vẫn đăng nhập; localStorage chỉ metadata người dùng, không token.
2. Sai mã, mã hết hạn, gửi lại sau60 giây, thử lại mã cũ, mở2 tab và verify đồng thời.
3. Login tài khoản cũ → OTP → giữ lịch sử. Logout rồi back/reload không truy cập API được.
4. Quên mật khẩu → OTP → mật khẩu mới; các browser session cũ bị vô hiệu.
5. Google: mới/cũ, cancel, Gmail trùng password, email bên thứ ba cần liên kết qua mật khẩu, chọn nhầm Google lúc liên kết, reload callback không tạo session lại.
6. User thường không truy cập /api/v1/admin/feedback; admin verified truy cập được.

Automated: `COURTSIM_TEST_MONGO_URI` trỏ MongoDB local, `npm --prefix backend test`; DB test ngẫu nhiên riêng. Frontend `npm --prefix frontend run lint`, `npm --prefix frontend run build`, từ frontend `node node_modules/@playwright/test/cli.js test`. Không gửi email thật hoặc gọi tài khoản Google thật trong test; adapter mail thu mã chỉ trong bộ nhớ test, Google ký RSA fixture để kiểm tra token.

## Trước production
- Cấu hình và kiểm tra thư thật (domain SPF/DKIM/DMARC, quota, bounce); Google consent/redirect/test users và quy trình publish Google.
- HTTPS frontend/API cùng site, NODE_ENV=production, secret mạnh, Mongo backup/index/monitoring. Chỉ cấu hình TRUST_PROXY subnet/IP của reverse proxy tin cậy; không đặt true tùy tiện.
- Limiter hiện đã dùng MongoDB chung; cần thêm giới hạn tổng mail/budget, WAF/CAPTCHA theo mức lạm dụng, giám sát tải và Redis nếu lưu lượng lớn. Gửi mail hiện đồng bộ, timeout10 giây; thiếu cấu hình trả lỗi an toàn, lỗi delivery tạm thời ghi log và giữ phản hồi trung tính chống dò email. Chưa có durable mail queue. Các yêu cầu song song được giới hạn nhưng vẫn nên load-test trước mở công khai.
- Chưa kiểm tra end-to-end với email và Google thật nếu chưa có credentials. Tài khoản test/chỉ Google không có password không dùng reset-password để tự ghép provider khác.
- Không gọi hệ thống này là được kiểm toán bảo mật độc lập; rà soát chuyên môn trước khi triển khai rộng.

## Tệp triển khai
Tạo mới:
- backend/src/models/AuthState.js
- backend/src/services/{authSession,emailAuthService,emailService,googleAuthService,securityAudit}.js
- backend/src/scripts/migrateAuth.js
- backend/tests/auth.integration.test.js
- frontend/src/pages/Auth/{AuthForm,AuthElements,VerifyEmail,AccountActions}.jsx và auth.css
- frontend/tests/auth.spec.js
- docs/AUTHENTICATION.md

Sửa:
- backend/src/models/User.js, routes/AuthRoutes.js, middlewares/{auth,rateLimit,security}.js, app.js, config/env.js
- backend/.env.example, package.json, package-lock.json (bản vá tương thích cho dependency bảo mật)
- frontend/src/pages/Auth/{LoginPage,RegisterPage}.jsx, App.jsx, services/{api,auth}.js
- DashboardLayout.jsx, AdminDashboard.jsx: logout phía server, liên kết Google khi chưa liên kết
- tests/learning.spec.js, landing.spec.js, feedback.spec.js và hai integration test phiên học/góp ý: cookie session thay JWT cũ
- README.md

## Thiết kế giao diện và kết quả kiểm tra
Đã xem trực tiếp [Linear login](https://linear.app/login) và [GitHub login](https://github.com/login) bằng trình duyệt. CourtSim dùng form một cột, nhãn cố định, nút Google, quên mật khẩu cạnh nhãn, hiện/ẩn mật khẩu, lỗi xác nhận ngay cạnh trường, focus và autocomplete. Giữ màu xanh CourtSim; không thêm chức năng passkey/SSO của các trang tham khảo. OTP dùng một ô6 chữ số để dán mã, hỗ trợ one-time-code và bàn phím số.

Kiểm thử toàn backend đạt51 (có MongoDB riêng), hồi quy trình duyệt64/64; bổ sung2 tình huống hiện/ẩn mật khẩu và resend trên desktop/mobile đạt, bộ auth riêng6/6. Lint, build frontend, node --check và git diff --check đạt. Audit dependency backend/frontend báo0 lỗ hổng tại lần kiểm tra này, không có nghĩa thay thế kiểm toán bảo mật. Migration dry-run trên local phát hiện2 tài khoản cũ, chưa cập nhật/xóa dữ liệu tài khoản thật.

Cơ chế chống dò email cũng duy trì challenge/cooldown cho yêu cầu không được gửi mail (email đã đăng ký hoặc không có tài khoản để reset), không trả cờ deliverySuppressed ra API. Thiếu cấu hình gửi email bị từ chối trước khi phân biệt account. Lỗi delivery tạm thời sau cấu hình được ghi log và trả cùng phản hồi trung tính; người dùng có thể gửi lại sau cooldown, tránh biến lỗi nhà cung cấp thành cách dò email. Cần giám sát email_delivery_failure vì hiện chưa có mail queue bền vững. Thời gian phản hồi chưa được làm đồng nhất tuyệt đối; cần đánh giá chống dò theo timing khi load-test trước production.
