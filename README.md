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
4. Nhập ngày sự kiện làm phát sinh tranh chấp, rồi trình bày lập luận; backend lọc căn cứ theo ngày, lưu transcript rồi lần lượt gọi AI phía đối lập và Thẩm phán.
5. Kết thúc phiên để model đánh giá tạo điểm rubric và feedback.

## Nhập và kiểm tra văn bản pháp luật

Backend nhận tệp PDF và DOC cũ qua CLI; nội dung được tách thành điều, khoản, điểm trong MongoDB cùng số hiệu, ngày ban hành/hiệu lực, dấu vết tệp, SHA-256, số trang và nguồn chính thức. Chạy lại cùng các tệp sẽ cập nhật đúng phiên bản có cùng dấu vân tay nguồn thay vì nhân đôi điều luật. Tệp gốc vẫn cần được giữ để đối chiếu; CLI không sửa hoặc chép tệp vào repository.

Sau khi MongoDB đã chạy, từ PowerShell:

```powershell
Set-Location backend
npm run legal:import -- --law "31/2024/QH15" --file "C:\Users\pnhac\AppData\Local\Temp\VanBanGoc_31-2024-qh15_1.pdf" --file "C:\Users\pnhac\AppData\Local\Temp\VanBanGoc_31-2024-qh15_2.pdf" --file "C:\Users\pnhac\AppData\Local\Temp\VanBanGoc_31-2024-qh15_3.pdf"
npm run legal:import -- --law "91/2015/QH13" --file "C:\Users\pnhac\Documents\91.2015.QH13.doc"
npm run legal:import -- --law "92/2015/QH13" --file "C:\Users\pnhac\Documents\92.2015.QH13.doc"
```

Đường dẫn trong ví dụ là vị trí tệp đính kèm của người dùng; thay bằng đường dẫn thực tế nếu tệp được lưu nơi khác. Metadata được rà soát và chính sách phiên bản nằm tại `backend/src/data/legalAuthorities.js`; các trạng thái xác minh được khóa đến ngày 28/09/2026, ngày đối chiếu nguồn chính thức. Luật Đất đai 31/2024/QH15 đã được Điều 1 Luật 43/2024/QH15 sửa khoản 1 Điều 252 (hiệu lực chung từ 01/08/2024); văn bản sửa đổi được ban hành 29/06/2024. Điều 252 bản đính kèm còn ghi ngày gốc 01/01/2025 và các ngoại lệ Điều 190, 248 từ 01/04/2024. Bộ luật Tố tụng dân sự 92/2015/QH13 có bản hợp nhất chính thức 11/VBHN-VPQH ngày 16/09/2024, liệt kê các luật sửa đổi: Bộ luật Lao động 45/2019/QH14 (hiệu lực 01/01/2021), Luật Doanh nghiệp 59/2020/QH14 (01/01/2021), Luật Phòng, chống bạo lực gia đình 13/2022/QH15 (01/07/2023), Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 (01/07/2024), và Luật Tổ chức Tòa án nhân dân 34/2024/QH15 (01/01/2025). Luật 85/2025/QH15 sửa đổi tiếp, có hiệu lực 01/07/2025; ngày ban hành chưa xác minh được trong nguồn truy cập được. Vì chỉ có bản gốc cho hai văn bản đã sửa đổi này, chúng được lưu làm nguồn lưu trữ nhưng không dùng để viện dẫn như bản hiện hành. Hệ thống hiện chỉ cho AI viện dẫn phiên bản có trạng thái xác minh; các giới hạn nguồn được hiển thị trong phiên/kết quả. Không dùng căn cứ cho ngày sự kiện sau ngày xác minh nếu chưa rà soát nguồn luật mới hơn.

Bộ luật Dân sự 91/2015/QH13 ghi hiệu lực từ 01/01/2017 tại Điều 689 và được cơ sở dữ liệu VBPL tra cứu ngày 28/09/2026 xác định còn hiệu lực. Nguồn tra cứu chính thức:

- [Tra cứu Công báo Luật Đất đai 31/2024/QH15](https://congbao.chinhphu.vn/tim-kiem-van-ban.html?keyword=31%2F2024%2FQH15)
- [Tra cứu Công báo Luật sửa đổi 43/2024/QH15](https://congbao.chinhphu.vn/tim-kiem-van-ban.html?keyword=43%2F2024%2FQH15)
- [Bản hợp nhất 11/VBHN-VPQH — Bộ luật Tố tụng dân sự](https://vbpl.vn/van-ban/chi-tiet/van-ban-hop-nhat-so-11-vbhn-vpqh-to-tung-dan-su--175590)
- [Tra cứu Công báo Luật sửa đổi 85/2025/QH15](https://congbao.chinhphu.vn/tim-kiem-van-ban.html?keyword=85%2F2025%2FQH15)
- [Tra cứu Công báo Bộ luật Dân sự 91/2015/QH13](https://congbao.chinhphu.vn/tim-kiem-van-ban.html?keyword=91%2F2015%2FQH13)

Chạy kiểm thử nhập/phân tích, lọc hiệu lực và kiểm tra trích dẫn:

```powershell
Set-Location backend
npm test
```

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
