# CourtSim

Cập nhật mới: [Chấm điểm theo DOCX và tra cứu luật theo mốc/phiên bản](docs/SCORING_AND_LEGAL_RESEARCH.md). Rubric mới có 6 nhóm, 23 tiêu chí con; điểm được quy đổi về /100 từ phần đủ dữ liệu và hiển thị tỷ lệ trọng số đã đánh giá. Kết quả cũ giữ nguyên.

Web mô phỏng phiên tòa phục vụ học tập pháp luật Việt Nam. Frontend sử dụng React; backend sử dụng Node.js, Express và MongoDB local.

## Yêu cầu

- Node.js 22.13+ hoặc 24+ (môi trường kiểm tra hiện tại 22.12 vẫn build được nhưng npm cảnh báo engine của ESLint)
- MongoDB Community Server đang chạy tại máy local

## Chạy backend

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
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

Luật Đất đai 2013 trong LawDoc đã được nhập, trạng thái chưa xác minh lịch sử đầy đủ. Luồng mới yêu cầu version_rules được đối chiếu cho mốc cụ thể; source_status cũ chỉ là thông tin nguồn, không đủ để chấm chắc chắn luật áp dụng. Xem tài liệu cập nhật ở đầu trang để nhập, kiểm tra nguồn và duyệt phạm vi phiên bản.

Backend nhận tệp PDF và DOC cũ qua CLI; nội dung được tách thành điều, khoản, điểm trong MongoDB cùng số hiệu, ngày ban hành/hiệu lực, dấu vết tệp, SHA-256, số trang và nguồn chính thức. Chạy lại cùng các tệp sẽ cập nhật đúng phiên bản có cùng dấu vân tay nguồn thay vì nhân đôi điều luật. Tệp gốc vẫn cần được giữ để đối chiếu; CLI không sửa hoặc chép tệp vào repository.

Sau khi MongoDB đã chạy, từ PowerShell:

```powershell
Set-Location backend
node src/scripts/importLegalDocuments.js --law "31/2024/QH15" --file "..\LawDoc\VanBanGoc_31-2024-qh15_1 (2).pdf" --file "..\LawDoc\VanBanGoc_31-2024-qh15_2 (2).pdf" --file "..\LawDoc\VanBanGoc_31-2024-qh15_3 (2).pdf"
node src/scripts/importLegalDocuments.js --law "91/2015/QH13" --file "..\LawDoc\91.2015.QH13.doc"
node src/scripts/importLegalDocuments.js --law "92/2015/QH13" --file "..\LawDoc\92.2015.QH13.doc"
```

Các tệp trong LawDoc đã được đối chiếu SHA-256 và trùng nội dung với tệp người dùng đính kèm; ví dụ dùng đường dẫn tương đối từ backend. Metadata được rà soát và chính sách phiên bản nằm tại `backend/src/data/legalAuthorities.js`; các trạng thái xác minh được khóa đến ngày 28/09/2026, ngày đối chiếu nguồn chính thức. Luật Đất đai 31/2024/QH15 đã được Điều 1 Luật 43/2024/QH15 sửa khoản 1 Điều 252 (hiệu lực chung từ 01/08/2024); văn bản sửa đổi được ban hành 29/06/2024. Điều 252 bản đính kèm còn ghi ngày gốc 01/01/2025 và các ngoại lệ Điều 190, 248 từ 01/04/2024. Bộ luật Tố tụng dân sự 92/2015/QH13 có bản hợp nhất chính thức 11/VBHN-VPQH ngày 16/09/2024, liệt kê các luật sửa đổi: Bộ luật Lao động 45/2019/QH14 (hiệu lực 01/01/2021), Luật Doanh nghiệp 59/2020/QH14 (01/01/2021), Luật Phòng, chống bạo lực gia đình 13/2022/QH15 (01/07/2023), Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 (01/07/2024), và Luật Tổ chức Tòa án nhân dân 34/2024/QH15 (01/01/2025). Luật 85/2025/QH15 sửa đổi tiếp, có hiệu lực 01/07/2025; ngày ban hành chưa xác minh được trong nguồn truy cập được. Vì chỉ có bản gốc cho hai văn bản đã sửa đổi này, chúng được lưu làm nguồn lưu trữ nhưng không dùng để viện dẫn như bản hiện hành. Hệ thống hiện chỉ cho AI viện dẫn phiên bản có trạng thái xác minh; các giới hạn nguồn được hiển thị trong phiên/kết quả. Không dùng căn cứ cho ngày sự kiện sau ngày xác minh nếu chưa rà soát nguồn luật mới hơn.

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


## Chạy frontend

Trong terminal thứ hai:

```powershell
cd frontend
npm ci
npm run dev
```

Mở http://localhost:5173. Khi dùng cổng khác, cập nhật CLIENT_ORIGIN ở backend và VITE_API_URL ở frontend. Không chép đè .env đang có; chỉ tạo từ .env.example cho lần cài mới. Seed đồng bộ persona/hồ sơ mẫu và cập nhật mật khẩu admin theo cấu hình, không cần chạy lại để dùng dữ liệu hiện có.

## Trạng thái hoàn thiện và lưu trữ

- Dashboard, phiên đang học, lịch sử và thống kê dùng API thật, điểm 0–100.
- Bản nháp và mã yêu cầu được lưu trong sessionStorage theo tài khoản/phiên, tồn tại qua reload trong cùng tab. Trình duyệt riêng tư có thể không cho lưu.
- Một phiên mới tối đa 20 lượt. Người học chọn ngày tra cứu nếu hồ sơ thiếu ngày; đây là giả định bài tập, không tự tạo tình tiết. Phiên cũ thiếu ngày được bổ sung bằng PATCH /api/v1/sessions/:sessionId với case_event_date; ngày đã có không được sửa.
- Gửi request_id ổn định khi tạo phiên/gửi lại cùng lập luận. Client cũ không gửi trường này vẫn hoạt động nhưng không có bảo đảm chống lặp qua lỗi mạng. expected_turn_count giúp phát hiện biên bản cũ ở nhiều tab.
- Lượt mới (người học + hai AI), số lượt và mã chống lặp được ghi nguyên tử trong SimulationSession.turns. Kết quả mới nằm trong SimulationSession.evaluation, được ghi cùng trạng thái completed. Điều này hoạt động với MongoDB standalone, không bắt buộc replica set.
- CourtRecord và TrialResult cũ không bị xóa; API hợp nhất biên bản cũ/mới và đọc kết quả cũ. Công cụ đọc trực tiếp collection phải hiểu định dạng mới, thay vì chỉ đọc CourtRecord/TrialResult.
- Khóa MongoDB có token chống ghi từ tác vụ hết hạn, hết hạn sau 10 phút nếu tiến trình chết. Trong thời gian đó, tải lại biên bản và chờ; thao tác mới bị từ chối thay vì ghi chồng.
- Giám khảo đọc toàn bộ biên bản, chấm 23 tiêu chí con theo tài liệu MVP v1.0. Backend cộng theo trọng số 15–20–20–20–15–10, quy đổi điểm từ phần đủ dữ liệu, kiểm tra quote/record_id và lưu phiên bản rubric. Không tự tạo điểm khi AI lỗi.
- Các phần quản trị nâng cao, thanh toán, giọng nói, xuất PDF và tải hồ sơ riêng chưa triển khai; giao diện không cung cấp nút giả cho các chức năng này.

## Kiểm thử

```powershell
cd backend
npm test
# Tùy chọn tích hợp MongoDB: tự tạo DB courtsim_test_<uuid> và chỉ xóa DB kiểm thử này.
$env:COURTSIM_TEST_MONGO_URI='mongodb://127.0.0.1:27017'
npm test

cd ../frontend
npm run lint
npm run build
npm run test:e2e
```

Playwright dùng Edge có sẵn trên Windows; trên hệ điều hành khác cài Chromium bằng npx playwright install chromium. Có thể đặt PLAYWRIGHT_CHANNEL để chọn trình duyệt. Test giao diện dùng API giả lập; test backend dùng MongoDB thật và HTTP AI giả lập, không cần khóa AI.

Kiểm thử dịch vụ thật: node src/scripts/smokeAi.js từ backend. Script chỉ dùng tình huống hư cấu cố định, đọc persona và văn bản luật công khai, không đọc tài khoản/hồ sơ/biên bản người dùng và không ghi kết quả vào lịch sử. Chỉ cho endpoint Gemini chính thức; có phát sinh lượt gọi dịch vụ.

Báo cáo kiểm kê và giới hạn: [docs/IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md).
