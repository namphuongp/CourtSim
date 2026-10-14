# CourtSim

Ứng dụng luyện tranh tụng bằng React/Vite, Node.js/Express và MongoDB. Chủ tọa và bên đối lập phát biểu từng lượt; người học chủ động bấm **Tiếp tục**. Ưu tiên kho tài liệu pháp luật nội bộ, kết hợp web về pháp luật Việt Nam.

## Chạy tại máy phát triển

Dùng Node.js **24 LTS** (hoặc 22.13+), MongoDB đang chạy. Không chép đè cấu hình đã có.

`npm run dev` của backend dùng `node --watch`, tự khởi động lại khi mã nguồn thay đổi. Trên PowerShell chặn `npm.ps1`, dùng `npm.cmd` cho các lệnh npm bên dưới.

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
# Đặt JWT_SECRET ngẫu nhiên ít nhất 32 ký tự, SEED_ADMIN_PASSWORD riêng và cấu hình AI trong .env.
npm run seed
npm run dev
# Terminal thứ hai:
cd frontend
npm ci
npm run dev
```

Frontend: http://localhost:5173. Backend bind 127.0.0.1:5000; Vite proxy /api đến backend. Nếu đã có frontend/.env cũ chứa VITE_API_URL, bỏ giá trị localhost hoặc dùng /api khi build production.

Hướng dẫn khởi tạo đầy đủ dữ liệu: [SEED.md](docs/SEED.md). Chạy lại seed giữ nguyên dữ liệu và mật khẩu admin đã có. Migration auth: `npm run auth:migrate` mặc định chỉ kiểm tra; đọc hướng dẫn trước khi `--apply`.

## Chức năng và lưu trữ

- Email/OTP, Google, cookie HttpOnly, hồ sơ tài khoản, đổi/đặt mật khẩu, thu hồi phiên đăng nhập.
- Danh sách vụ án, hồ sơ/chứng cứ, vai luật sư, phiên theo từng lời thoại, bản nháp qua reload, trợ lý luật, kết thúc, góp ý, kết quả và lịch sử.
- Admin: người dùng, phiên/biên bản, góp ý, thống kê, usage AI, thanh toán và nhật ký. Mục **Hồ sơ vụ án** (`/admin/cases`) cho phép tạo tình huống, thêm chứng cứ, xem hồ sơ và phân trang. Có nội dung chứng cứ thì chọn “Có nội dung được cung cấp”; tài liệu chỉ được nhắc đến không nhập thành tài liệu đã cung cấp. Chưa có giao diện sửa/xóa vụ án hiện có.
- Thanh toán chuyển khoản có tạo đơn, webhook SePay, xác nhận quản trị và cấp lượt/gói. Cần cấu hình ngân hàng và khóa webhook, chưa chứng minh đối soát với dịch vụ ngân hàng thật. Giọng nói, xuất PDF và tải hồ sơ riêng **chưa triển khai**.
- Trang hướng dẫn có FAQ, giải thích điểm phần đã chấm, cách gửi góp ý và thông tin dữ liệu/cookie. Nội dung này chưa thay thế bộ điều khoản và chính sách chính thức của đơn vị vận hành.
- Phiên, trạng thái hội thoại, cursor, điểm và góp ý nằm trong SimulationSession; API vẫn đọc CourtRecord/TrialResult cũ. Không xóa collection cũ.
- Điểm thiếu dữ liệu ghi rõ earned_score/assessed_max (ví dụ 69/73), **chưa có điểm toàn bài**; không quy đổi thành 94,52/100. Vẫn giữ đủ rubric 23 tiêu chí.
- Không có nguồn vbpl đã đối chiếu thì nói chưa xác minh. Bản lưu có ngày kiểm tra cũ không được mô tả là vừa kiểm tra trực tiếp.

## Cấu hình dịch vụ

Quyền thành viên được khai báo chung trong `shared/membershipPolicy.mjs` và kiểm tra ở backend:

| Gói | Lượt mở phiên | Trợ lý luật | Điểm chi tiết | Phân tích kỹ năng |
|---|---|---|---|---|
| Freemium | 2 lượt miễn phí cho mỗi tài khoản | Không | Tổng quan | Không |
| Pay-per-use | Mỗi lần mua cộng 1 lượt | Có | Có | Không |
| Lite | Mỗi lần mua cộng 5 lượt | Có | Có | Không |
| Pro | Không trừ lượt mở phiên | Có | Có | Có |

Tất cả gói vẫn chịu hạn mức AI và tối đa 20 lượt trình bày mỗi phiên. Khi hết lượt, người học vẫn có thể tiếp tục phiên đã mở và xem lịch sử/biên bản. Quyền và số lượt hiện ở `/account/membership` và màn hình thiết lập. `GET /api/auth/membership` trả trạng thái mới từ server; sửa gói hoặc số lượt ở trình duyệt không cấp quyền.

Lượt đã mua được dùng trước, sau đó mới dùng lượt miễn phí còn lại. Gói trả phí được cập nhật khi thanh toán được server xác nhận, mua lượt lẻ không hạ Lite/Pro. Giá trị `plus` cũ được đọc như Lite, giữ nguyên dữ liệu và lượt đã mua. Các phiên có quyền trả phí đã ghi nhận tiếp tục có trợ lý và điểm chi tiết, kể cả khi tài khoản hết lượt mới. Freemium chỉ nhận dữ liệu chấm điểm tổng quan từ API, điểm chi tiết vẫn được lưu trong DB. Cấp quyền mở phiên dùng khóa và bản ghi trừ lượt để retry không bị trừ lần nữa; phiên đang cấp quyền chưa xuất hiện trong danh sách luyện tập.

Backend .env.example liệt kê biến cấu hình. Chỉ đặt khóa ở backend. OPENAI_API_KEY dùng endpoint OpenAI chính thức; GEMINI_API_KEY có ưu tiên nếu cùng tồn tại. Endpoint tùy chỉnh cần AI_BASE_URL và khóa riêng AI_API_KEY. Các vai dùng AI_JUDGE_MODEL, AI_OPPONENT_MODEL, AI_EVALUATOR_MODEL; không phải chạy seed để đổi model.

Email cần EMAIL_API_KEY/EMAIL_FROM của Resend và domain gửi đã xác minh. Google cần client ID/secret/redirect URI. Bỏ qua OTP chỉ dùng development, không có hiệu lực production. Hạn mức AI tính cả retry, lưu Mongo dùng chung; xem cấu hình trong hướng dẫn vận hành.

Thanh toán cần `SEPAY_WEBHOOK_SECRET` (hoặc `PAYMENT_WEBHOOK_SECRET`) trong mọi môi trường. Thiếu khóa thì webhook trả 503, không cấp quyền. Cấu hình `SEPAY_BANK_ACCOUNT`, `PAYMENT_BANK_CODE`, `PAYMENT_BANK_ACCOUNT_NUMBER`, `PAYMENT_BANK_ACCOUNT_NAME` cho ngân hàng nhận. URL webhook chính: `/api/payments/sepay/webhook`; kiểm thử nội bộ dùng khóa và giao dịch giả, không chuyển tiền.

## Kiểm tra

```powershell
# Tại gốc:
node scripts/check-source.mjs
cd backend
$env:COURTSIM_TEST_MONGO_URI='mongodb://127.0.0.1:27017'
npm test
cd ../frontend
npm run lint
$env:VITE_API_URL='/api'
npm run build
npm run test:e2e
# Dọn trace/ảnh chỉ sinh ra khi test lỗi:
npm run test:clean
```

Test chỉ nằm trong `backend/tests` và `frontend/tests`:

- Backend: xác thực, tài khoản, admin/tạo vụ án, hội thoại, luật/chấm điểm, streaming, hạn mức/usage AI và thanh toán (xác thực webhook, gửi trùng, số tiền, hết hạn, xử lý đồng thời).
- Trình duyệt chạy cả desktop/mobile: hành trình đăng ký → phiên nhiều lượt → kết quả → khôi phục mật khẩu/phân quyền → admin tạo hồ sơ dùng API/Mongo thật. Các bài fixture kiểm tra dashboard, kỹ năng, điểm thiếu dữ liệu, liên kết trang chủ/FAQ và giữ nội dung tạo hồ sơ khi API lỗi.

Backend dùng node:test; khi thiếu COURTSIM_TEST_MONGO_URI, các ca Mongo bị skip. Mỗi ca tích hợp dùng DB courtsim_test_<uuid> riêng. Email/model trong E2E là fixture, không chứng minh dịch vụ ngoài hoạt động. Kết quả tạm gom trong `.test-artifacts/`, chỉ giữ trace/ảnh khi lỗi; `npm run test:clean` dọn thư mục này. Windows dùng Edge; Linux/CI cài Chromium bằng `npx playwright install --with-deps chromium`. Dự án JavaScript chưa có TypeScript typecheck; check-source chỉ kiểm tra cú pháp.

CI chạy tại .github/workflows/ci.yml. Từ backend: `npm run legal:smoke` kiểm tra vbpl trực tiếp; `node src/scripts/smokeAi.js` kiểm tra AI bằng tình huống hư cấu, có phát sinh phí. Kết quả kiểm tra nằm trong `.test-artifacts/`. Không commit report JSON, log, ảnh có dữ liệu người dùng, file .env hoặc bản sao DB.

## Tài liệu

- [Kiến trúc, xác thực và luồng dữ liệu](docs/ARCHITECTURE.md)
- [Nguồn luật và chấm điểm](docs/SCORING_AND_LEGAL_RESEARCH.md)
- [Vận hành, cấu hình domain, backup/restore và giới hạn](docs/OPERATIONS.md)

Hướng dẫn nhập kho luật: [LEGAL_CORPUS.md](docs/LEGAL_CORPUS.md). Hồ sơ đầu vào nhập luật nằm trong `backend/src/data/legal-reviews/`; không xóa thư mục này khi chuyển máy. Kết quả kiểm thử có thể dọn bằng `npm run test:clean` trong frontend. Chưa tự triển khai hoặc đổi cấu hình production.
