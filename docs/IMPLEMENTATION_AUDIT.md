# Kiểm kê và hoàn thiện CourtSim — 28/09/2026

Báo cáo giai đoạn trước. Rubric và tra cứu luật đã được cập nhật tiếp theo [SCORING_AND_LEGAL_RESEARCH.md](SCORING_AND_LEGAL_RESEARCH.md); các mô tả 4 tiêu chí/ngày đơn dưới đây là lịch sử triển khai.

## Kiến trúc

React/Vite → Axios → Express → xác thực JWT và kiểm tra tài khoản hiện tại → dịch vụ mô phỏng → MongoDB. AI được gọi từ backend, tuần tự bên đối lập rồi Thẩm phán; giám khảo chỉ chạy khi kết thúc. Nguồn luật đi qua nhập tệp → LegalDocument/LegalProvision → lọc phiên bản/ngày → xếp hạng → kiểm tra trích dẫn trước khi lưu/hiển thị.

Đã đọc mã nguồn ứng dụng, model, route, service, script, test, tài liệu và cấu hình; cấu hình bí mật chỉ kiểm tra sự hiện diện, không đưa giá trị vào báo cáo. Giữ các thay đổi pháp luật có sẵn và dữ liệu người dùng.

## Kiểm kê trước và sau

| Chức năng | Trước | Sau |
|---|---|---|
| Đăng ký/đăng nhập | Nối API; lỗi kiểu dữ liệu có thể thành 500; token giữ quyền cũ | Validate kiểu/giới hạn; kiểm tra tài khoản bị khóa mỗi request; hết phiên trở về đăng nhập rồi quay lại đường dẫn |
| Thư viện/thiết lập | Chỉ tóm tắt, tải 20 hồ sơ đầu | Tải đủ các trang, xem hồ sơ đầy đủ, vai theo loại vụ án, trạng thái rỗng/lỗi/thử lại, chống lặp tạo phiên |
| Tranh tụng | Ghi nhiều collection từng bước; thao tác có thể chạy đồng thời | Khóa MongoDB có token và hạn, một lần ghi cho cả lượt; mã chống lặp, kiểm tra biên bản cũ, tối đa 20 lượt |
| Khôi phục | Không lưu bản nháp, phiên cũ thiếu ngày không tiếp tục được | Bản nháp theo tài khoản/phiên trong tab; khôi phục sau reload; bổ sung ngày cho phiên cũ chưa có ngày |
| Kết thúc | Có thể chấm/hoàn thành chồng nhau | Cùng khóa với gửi lượt, kết quả và trạng thái ghi nguyên tử; gọi lại trả kết quả đã lưu |
| AI đối lập | Persona Kiểm sát viên cho cả dân sự | Quy tắc bắt buộc theo loại vụ án/phía người học; mức độ gợi mở theo độ khó |
| Đánh giá | Chỉ 24 bản ghi cuối; điểm tổng do AI tự trả | Đọc toàn bộ biên bản; 4 tiêu chí bằng trọng số; lý do, điểm mạnh, hành động sửa và trích đúng lời người học |
| Dữ kiện AI | Kiểm tra loại mảng | Thêm lời người học riêng; đối chiếu trích đoạn hồ sơ/lời trình bày; suy luận và thông tin thiếu tách riêng |
| Tổng quan/phiên/lịch sử/thống kê | Dữ liệu mẫu, nút thiếu hành động | API thật, liên kết tiếp tục/xem biên bản/kết quả, tìm kiếm, trạng thái tải/rỗng/lỗi, thang 100 |
| Giao diện nhỏ | Mất menu và hồ sơ | Điều hướng xuống dòng; hồ sơ mở rộng trên mobile; phiên hoàn thành chỉ đọc |
| Quản trị/giọng nói/thanh toán | Placeholder và quảng bá như đã có | Ghi rõ chưa triển khai, bỏ nút giả và gói bán chưa có backend; admin có thể vào luyện tập |

Các trường mẫu `id/name/date/scores.legalKnowledge/logic/situational/defensive` không tương thích `_id/case_id.title/created_at/result.rubric_scores` của API. Các trang học tập đã bỏ phụ thuộc mockData và đọc schema thật. Thang `/10` cũ đổi thành `/100`.

## Thay đổi lưu trữ và API

- Bổ sung snapshot hồ sơ khi tạo phiên, tránh sửa hồ sơ trong thư viện làm thay đổi bài tập đang học.
- `SimulationSession.opening`, `.turns`, `.evaluation` là dữ liệu chuẩn cho phiên/lượt mới. `CourtRecord` và `TrialResult` cũ vẫn được đọc, không xóa hay migrate phá hủy.
- GET session trả dữ liệu công khai; không lộ token khóa, receipt hoặc toàn bộ kết quả nội bộ.
- `request_id` tùy chọn để tương thích client cũ; frontend mới luôn gửi và giữ nguyên khi thử lại. `expected_turn_count` chặn gửi từ biên bản cũ.
- `PATCH /api/v1/sessions/:sessionId` chỉ bổ sung `case_event_date` cho phiên đang học chưa có ngày. Không tự sửa ngày 47 phiên cũ của người dùng.
- Các công cụ đọc collection trực tiếp cần đọc cấu trúc mới; các API kết quả/biên bản vẫn giữ định dạng trả về.

## Văn bản luật

Đã trích xuất toàn bộ 5 tệp, kiểm tra số hiệu, thứ tự liên tục và số điều, nhập MongoDB và chạy lại để kiểm tra khả năng cập nhật không nhân bản:

| Nguồn | Số điều | Đơn vị điều/khoản/điểm | Chính sách |
|---|---:|---:|---|
| 91.2015.QH13.doc | 689 | 2419 | Đủ metadata trong phạm vi đối chiếu hiện có để truy xuất |
| 92.2015.QH13.doc | 517 | 2590 | Bản gốc đã có sửa đổi; lưu đối chiếu, không viện dẫn hiện hành |
| Ba PDF 31/2024/QH15 | 260 | 2567 | Bản gốc đã có sửa đổi; lưu đối chiếu, không viện dẫn hiện hành |

Parser giữ nguyên điều khi số khoản/điểm lặp trong trích dẫn sửa đổi, tránh ghi đè nhầm locator. Chỉ mục cũ được giữ để đối chiếu nhưng vô hiệu hóa viện dẫn nếu parser không còn xác định chắc chắn.

Các bản trong `LawDoc/` giống hệt tệp đính kèm theo SHA-256. Nguồn giữ số hiệu, cơ quan, thời điểm ban hành/hiệu lực, phạm vi Điều 1, mốc đối chiếu, trạng thái phiên bản, dấu vân tay và trang PDF. DOC không có số trang ổn định nên không tự tạo số trang.

Đối chiếu lại thông tin Bộ luật Dân sự tại [Công báo Chính phủ](https://congbao.chinhphu.vn/van-ban/luat-so-91-2015-qh13-18397.htm). Metadata của hai nguồn đã sửa đổi tiếp tục giữ chính sách không viện dẫn. Không bổ sung điều luật từ trí nhớ.

Truy xuất đã sửa lỗi ưu tiên điều dài chứa từ chung: dùng trọng số từ hiếm, tiêu đề và lời người học gần nhất. Không cắt nửa điều làm mất điều kiện áp dụng. Chỉ đưa toàn bộ điều vừa dung lượng ngữ cảnh; không truy xuất nguồn dân sự để thay cho luật lao động chưa được cung cấp. Đối chiếu ID, số luật, điều/khoản/điểm và nguồn đang được truy xuất; không tự tin cậy trích dẫn từ lời AI trước.

## Kiểm tra

- Backend: 14/14 test qua, bao gồm HTTP thật với MongoDB riêng và AI HTTP giả lập. Kiểm tra tạo trùng, quyền sở hữu, lỗi JSON, không ghi dở, khóa/gửi đồng thời, payload đổi khi dùng lại mã, biên bản cũ, chấm lỗi/chấm đồng thời, hoàn thành lặp, giới hạn lượt, phiên cũ và tài khoản bị khóa.
- Frontend: ESLint và build thành công.
- Playwright: 6/6 test qua trên Edge desktop và kích thước iPhone 13 (Chromium mô phỏng mobile, không phải Safari/iPhone thật). API được giả lập: đăng ký, đăng nhập, chọn hồ sơ, lỗi gửi, giữ bản nháp sau reload, retry cùng mã, kết quả, chỉ đọc, lịch sử/thống kê, trở lại đường dẫn và API 401.
- Đã xem ảnh kết quả desktop/mobile; không tràn ngang trong kiểm tra responsive.
- Kiểm thử Gemini thật với tình huống hư cấu cố định: endpoint trả HTTP 503 sau retry. Không thể xác nhận chất lượng phản hồi AI thật hoặc độ trễ hoạt động bình thường ở môi trường này.
- `git diff --check`: qua, chỉ có cảnh báo đổi LF/CRLF của Git trên Windows.

## Giới hạn và bước tiếp theo

1. Dịch vụ AI đang trả 503: kiểm tra tình trạng endpoint/quota/model đã cấu hình rồi chạy `node src/scripts/smokeAi.js`. Script không dùng hồ sơ hoặc phiên người dùng và không ghi lịch sử. Không có điểm hay phản hồi giả để che lỗi dịch vụ.
2. Cần bản sửa đổi/hợp nhất đủ nguồn, phiên bản và điều khoản chuyển tiếp trước khi bật viện dẫn Luật Đất đai/Bộ luật Tố tụng dân sự. Chưa có nguồn lao động và hình sự để xác nhận quy định chuyên ngành.
3. Kiểm tra tự động xác nhận nguồn/locator/trích đoạn, không chứng minh suy luận pháp lý hay quyết định áp dụng luật của AI luôn đúng. Nên có bộ đánh giá do giảng viên duyệt trước khi phát hành rộng.
4. Ngày sự kiện không đủ để tự xác định toàn bộ quy định chuyển tiếp và thời điểm áp dụng tố tụng; giao diện và prompt coi đây là mốc tra cứu của bài tập.
5. Bản nháp giữ trong cùng tab; chưa đồng bộ nhiều thiết bị. Khóa sau tiến trình chết có thể cần chờ tối đa 10 phút. Client cũ không gửi mã yêu cầu không được bảo đảm chống lặp qua mất mạng.
6. Quản trị đầy đủ, giọng nói, thanh toán và xuất PDF nằm ngoài luồng học tập đã hoàn thiện và chưa triển khai.
7. Node đang có là 22.12. Build/test đã chạy, nhưng ESLint yêu cầu Node 22.13+ hoặc 24+; nên nâng runtime trước khi triển khai.

## File chính

- backend/src/routes/SessionRoutes.js; services/sessionStore.js; models/SimulationSession.js: vòng đời và tính nguyên tử.
- backend/src/services/simulationService.js; aiClient.js: quy tắc vai, định dạng, dữ kiện và đánh giá.
- backend/src/services/legalImportService.js; legalRetrievalService.js; legalTextParser.js: nhập, truy xuất và kiểm tra luật.
- frontend/src/components/LearningOverview.jsx; pages/Home/User/SimulationSetup.jsx, SimulationRoom.jsx, SimulationResult.jsx: luồng học tập.
- backend/tests/session.integration.test.js; backend/src/services/*.test.js; frontend/tests/learning.spec.js: kiểm thử.
- README.md: cách chạy, nhập nguồn, kiểm thử và tương thích lưu trữ.
