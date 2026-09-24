# CourtSim

Web mô phỏng phiên tòa phục vụ học tập pháp luật Việt Nam. Frontend sử dụng React; backend sử dụng Node.js, Express và MongoDB local.

## Yêu cầu

- Node.js 20+
- MongoDB Community Server đang chạy tại máy local

## Chạy backend
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Mặc định backend kết nối `mongodb://127.0.0.1:27017/courtsim` và chạy tại `http://localhost:5000`.


## API nền

- `GET /api/v1/health`: kiểm tra server và MongoDB
- `POST /api/auth/register`: đăng ký
- `POST /api/auth/login`: đăng nhập
- `GET /api/v1/cases`: danh sách vụ án
- `GET /api/v1/cases/:caseId`: chi tiết vụ án
- `POST /api/v1/cases`: tạo vụ án, chỉ dành cho admin
- `GET /api/v1/sessions`: lịch sử phiên của người dùng
- `POST /api/v1/sessions`: tạo phiên mô phỏng
- `GET /api/v1/sessions/:sessionId/records`: lấy biên bản phiên
- `POST /api/v1/sessions/:sessionId/messages`: gửi lập luận và nhận phản biện AI
- `POST /api/v1/sessions/:sessionId/complete`: kết thúc và chấm điểm
- `GET /api/v1/sessions/:sessionId/result`: lấy kết quả chấm điểm

Các API phiên mô phỏng yêu cầu header `Authorization: Bearer <token>`.

## Luồng sử dụng chính

1. Đăng ký hoặc đăng nhập.
2. Mở trang hướng dẫn tại `/guide`.
3. Vào `/dashboard/setup`, chọn vụ án, vai luật sư và độ khó.
4. Trình bày lập luận; backend lưu transcript rồi lần lượt gọi AI phía đối lập và Thẩm phán.
5. Kết thúc phiên để model đánh giá tạo điểm rubric và feedback.

## AI Gemini

Đặt `GEMINI_API_KEY` trong `backend/.env`. Khi biến này tồn tại, backend tự dùng Gemini qua endpoint OpenAI-compatible và mặc định chọn `gemini-3.6-flash`. Tên model của từng vai có thể được ghi đè bằng `AI_JUDGE_MODEL`, `AI_OPPONENT_MODEL`, `AI_EVALUATOR_MODEL`, sau đó đồng bộ bằng `npm run seed`.

Không đưa `GEMINI_API_KEY` vào biến môi trường frontend hoặc commit file `.env` lên Git.

Hướng dẫn vận hành, chuẩn bị dữ liệu và fine-tune: [docs/AI_MODELS.md](docs/AI_MODELS.md).

## Seed dữ liệu local

Đặt `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trong `.env`, sau đó chạy:

```powershell
cd backend
npm run seed
```

Seed có thể chạy nhiều lần an toàn; dữ liệu mẫu sẽ được cập nhật theo `email`, `role_name` và `title` thay vì tạo bản ghi trùng.
