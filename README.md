# CourtSim

Ứng dụng luyện tranh tụng bằng React/Vite, Node.js/Express và MongoDB. Chủ tọa và bên đối lập phát biểu từng lượt; người học chủ động bấm **Tiếp tục**. Chỉ dùng **vbpl.vn** làm nguồn pháp luật bên ngoài.

## Chạy tại máy phát triển

Dùng Node.js **24 LTS** (hoặc 22.13+), MongoDB đang chạy. Không chép đè cấu hình đã có.

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
# Đặt JWT_SECRET ngẫu nhiên ít nhất 32 ký tự và thông tin dịch vụ trong .env.
npm run dev
# Terminal thứ hai:
cd frontend
npm ci
npm run dev
```

Frontend: http://localhost:5173. Backend bind 127.0.0.1:5000; Vite proxy /api đến backend. Nếu đã có frontend/.env cũ chứa VITE_API_URL, bỏ giá trị localhost hoặc dùng /api khi build production.

Lần đầu chuẩn bị dữ liệu: cấu hình SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD rồi chạy npm run seed trong backend. Seed cập nhật hồ sơ/persona và mật khẩu admin theo cấu hình; **không chạy seed như một bước khởi động production**. Migration auth: npm run auth:migrate mặc định chỉ kiểm tra; đọc hướng dẫn trước khi --apply.

## Chức năng và lưu trữ

- Email/OTP, Google, cookie HttpOnly, hồ sơ tài khoản, đổi/đặt mật khẩu, thu hồi phiên đăng nhập.
- Danh sách vụ án, hồ sơ/chứng cứ, vai luật sư, phiên theo từng lời thoại, bản nháp qua reload, trợ lý luật, kết thúc, góp ý, kết quả và lịch sử.
- Admin: người dùng, phiên/biên bản, góp ý, thống kê, usage AI và nhật ký. Tạo vụ án có API admin; chưa có trình biên tập vụ án trong giao diện admin.
- Thanh toán/gói trả phí, giọng nói, xuất PDF và tải hồ sơ riêng **chưa triển khai**; schema dự kiến được giữ để không ảnh hưởng dữ liệu cũ.
- Phiên, trạng thái hội thoại, cursor, điểm và góp ý nằm trong SimulationSession; API vẫn đọc CourtRecord/TrialResult cũ. Không xóa collection cũ.
- Điểm thiếu dữ liệu ghi rõ earned_score/assessed_max (ví dụ 69/73), **chưa có điểm toàn bài**; không quy đổi thành 94,52/100. Vẫn giữ đủ rubric 23 tiêu chí.
- Không có nguồn vbpl đã đối chiếu thì nói chưa xác minh. Bản lưu có ngày kiểm tra cũ không được mô tả là vừa kiểm tra trực tiếp.

## Cấu hình dịch vụ

Backend .env.example liệt kê biến cấu hình. Chỉ đặt khóa ở backend. OPENAI_API_KEY dùng endpoint OpenAI chính thức; GEMINI_API_KEY có ưu tiên nếu cùng tồn tại. Endpoint tùy chỉnh cần AI_BASE_URL và khóa riêng AI_API_KEY. Các vai dùng AI_JUDGE_MODEL, AI_OPPONENT_MODEL, AI_EVALUATOR_MODEL; không phải chạy seed để đổi model.

Email cần EMAIL_API_KEY/EMAIL_FROM của Resend và domain gửi đã xác minh. Google cần client ID/secret/redirect URI. Bỏ qua OTP chỉ dùng development, không có hiệu lực production. Hạn mức AI tính cả retry, lưu Mongo dùng chung; xem cấu hình trong hướng dẫn vận hành.

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

- 7 nhóm backend: xác thực, tài khoản, admin, hội thoại, luật/chấm điểm, streaming và hạn mức/usage AI.
- 2 bài trình duyệt chạy cả desktop/mobile: hành trình đăng ký → phiên nhiều lượt → kết quả → khôi phục mật khẩu/phân quyền dùng API/Mongo thật; màn hình điểm thiếu dữ liệu dùng fixture.

Backend dùng node:test; khi thiếu COURTSIM_TEST_MONGO_URI, các ca Mongo bị skip. Mỗi ca tích hợp dùng DB courtsim_test_<uuid> riêng. Email/model trong E2E là fixture, không chứng minh dịch vụ ngoài hoạt động. Kết quả tạm gom trong `.test-artifacts/`, chỉ giữ trace/ảnh khi lỗi; `npm run test:clean` dọn thư mục này. Windows dùng Edge; Linux/CI cài Chromium bằng `npx playwright install --with-deps chromium`. Dự án JavaScript chưa có TypeScript typecheck; check-source chỉ kiểm tra cú pháp.

CI chạy tại .github/workflows/ci.yml. Từ backend: `npm run legal:smoke` kiểm tra vbpl trực tiếp; `node src/scripts/smokeAi.js` kiểm tra AI bằng tình huống hư cấu, có phát sinh phí. Kết quả kiểm tra nằm trong `reports/`. Không commit report JSON, log, ảnh có dữ liệu người dùng, file .env hoặc bản sao DB.

## Tài liệu

- [Kiến trúc, xác thực và luồng dữ liệu](docs/ARCHITECTURE.md)
- [Nguồn luật và chấm điểm](docs/SCORING_AND_LEGAL_RESEARCH.md)
- [Vận hành, cấu hình domain, backup/restore và giới hạn](docs/OPERATIONS.md)

`docs/` chỉ giữ ba hướng dẫn trên. Báo cáo và bằng chứng lịch sử nằm trong `reports/`, không thay thế hướng dẫn hiện tại. Chưa tự triển khai hoặc đổi cấu hình production.
