# Góp ý sau phiên luyện tập

## Người học
Khi kết quả tải thành công, màn hình kết quả kiểm tra quyền hiển thị lời mời góp ý. Nội dung kết quả chỉ được hiển thị sau khi gửi thành công, bỏ qua, đóng hoặc Escape. Góp ý tự nguyện, tối đa 2.000 ký tự; admin đọc được nội dung, người gửi và mã phiên. Không gửi kèm hồ sơ, biên bản hoặc điểm số.

Backend đánh dấu `feedback_prompted_at` bằng cập nhật nguyên tử trước khi trả quyền hiển thị. Tải lại, mở lại kết quả hoặc mở nhiều tab không hỏi thêm. Nếu tải lại lúc đang viết, lần mở tiếp đi thẳng tới kết quả, theo yêu cầu chỉ hỏi một lần. Lỗi gửi khi hộp đang mở giữ nguyên bản nhập, cho thử lại hoặc bỏ qua. Nếu mất phản hồi lúc xin hiển thị, có thể bỏ qua lời mời thay vì hỏi lại; góp ý không chặn việc xem kết quả.

Góp ý chưa có kết quả hoặc phiên không thuộc tài khoản bị từ chối. Dịch vụ hiện yêu cầu đăng nhập để học; không thêm luồng góp ý ẩn danh.

## Admin
Vào `/admin` → **Quản lý góp ý**, hoặc `/admin/feedback`.
- Tìm theo nội dung hoặc mã phiên; lọc Mới / Đã xem / Đã xử lý; 20 mục/trang.
- Mở chi tiết để đổi trạng thái, viết ghi chú nội bộ (2.000 ký tự) và lưu.
- Xóa bằng hộp xác nhận React. Xóa nội dung và ghi chú, giữ dấu đã hỏi/đã gửi; phiên và kết quả không bị xóa. Không tự đánh dấu Đã xem khi chỉ mở chi tiết; admin chủ động lưu trạng thái.
- Người học không được gọi API quản trị. Backend đọc quyền hiện tại từ tài khoản, không chỉ tin giao diện hoặc thông tin trên token.

## Dữ liệu và API
Bổ sung vào SimulationSession: `feedback_prompted_at`, `feedback_submitted_at`, `feedback` gồm content/status/notes/created_at/updated_at. ID phiên và user_id có sẵn, không nhân bản hồ sơ/hội thoại. Cập nhật cùng document hoạt động nguyên tử trên MongoDB standalone. Góp ý và ghi chú không xuất qua DTO phiên của người học.

- POST `/api/v1/sessions/:sessionId/feedback/prompt`: nhận quyền hiển thị một lần, chỉ chủ phiên có kết quả.
- POST `/api/v1/sessions/:sessionId/feedback`: chỉ nhận `{content}`. Gửi lại cùng nội dung trả thành công, nội dung khác bị từ chối; không ghi đè sau khi đã nhận.
- GET `/api/v1/admin/feedback?q=&status=&page=1&limit=20`: danh sách, tối đa 50 mục/trang.
- GET/PATCH/DELETE `/api/v1/admin/feedback/:id`: chi tiết, cập nhật `{status,notes}`, xóa.

Chuỗi tìm kiếm được escape trước khi dùng regex. Nội dung/gửi ghi chú được kiểm tra kiểu và độ dài, React render văn bản không dùng dangerouslySetInnerHTML. Riêng API góp ý admin không đi qua bộ lọc lời thoại người học để thông tin báo lỗi giữ nguyên văn. Không trả email, mật khẩu, hồ sơ, biên bản hoặc kết quả qua API này.

## Triển khai
Khởi động lại backend và cập nhật frontend như thông thường. Schema bổ sung tương thích dữ liệu cũ, không cần chuyển đổi hoặc xóa dữ liệu. Mongoose tạo index góp ý khi khởi động theo cấu hình dự án hiện tại. Nếu môi trường triển khai tắt autoIndex, cần tạo index đã khai báo trong SimulationSession.js trước khi có nhiều dữ liệu. Không chạy seed lại để bật chức năng.

## Kiểm tra
Backend: `COURTSIM_TEST_MONGO_URI` trỏ MongoDB local rồi `npm --prefix backend test`; kiểm thử tạo DB riêng và dọn đúng DB kiểm thử.
Frontend: `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend run test:e2e`.

Bao phủ: kết quả sẵn sàng mới hỏi; gửi lỗi/thử lại; bỏ qua/đóng/Escape/reload; quyền sở hữu và admin; gửi đồng thời; đánh dấu một lần; lọc/tìm kiếm/phân trang; ghi chú; xóa; không thực thi HTML hoặc lọt ghi chú sang API người học. Kiểm thử trình duyệt dùng API giả lập, kiểm thử backend dùng MongoDB thật; không cần gọi cloud AI cho chức năng góp ý.
