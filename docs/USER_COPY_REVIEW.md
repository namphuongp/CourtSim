# Rà soát câu chữ CourtSim

## Phạm vi

Đã rà soát các trang đang được App.jsx sử dụng: giới thiệu, đăng ký/đăng nhập, hướng dẫn, tổng quan, thiết lập, phiên tòa, hồ sơ/chứng cứ, trợ lý, biên bản, xác nhận kết thúc, kết quả, lịch sử và quản trị. Kiểm tra thêm dữ liệu mẫu cũ (không được trang hiện tại import), phản hồi lỗi API, DTO hiển thị, lời mở đầu, lời dẫn kết quả và prompt chung của các vai/trợ lý.

Giữ nút “Hồ sơ phiên tòa” và hai tab “Vụ án”, “Biên bản” theo yêu cầu gộp trước đó. “Hồ sơ vụ án” chỉ nội dung vụ án. Tên vai hiển thị là Chủ tọa, Bên đối lập và Bạn.

## Thay đổi chính

- Mật khẩu: bỏ đơn vị byte khỏi nhãn, giữ kiểm tra độ dài hiện có ở backend.
- Gửi bài thất bại: thông báo rõ chưa gửi được, bản nháp được giữ và có thể thử lại. Lỗi tải/chấm/tra cứu có lời dẫn riêng, không dùng một thông báo giữ bản nháp cho mọi thao tác.
- Tên biến, host cục bộ, mã lỗi, tên model, stack và nội dung lỗi nhà cung cấp không xuất trong thông báo. API vẫn giữ mã lỗi phục vụ xử lý; log chỉ ghi mã, loại lỗi, phương thức và route, không ghi câu hỏi, bản nháp hoặc khóa.
- Prompt dùng RESPONSE_STYLE chung; không lặp cảnh báo nguồn hoặc nói về cấu hình. Viện dẫn chưa xác minh vẫn có cảnh báo cạnh nguồn.
- Phần nguyên văn tách khỏi lọc lời dẫn: content của chứng cứ, source_quote, text điều luật, quote trong đánh giá và bài người học được giữ. Không sửa tệp luật/bản án hoặc dữ liệu đã lưu.
- Rút gọn lời mở đầu; thông tin ngày nằm ở thiết lập và thanh thông tin. Kết quả dùng “Kết quả luyện tập”, không gọi là báo cáo năng lực hành nghề.
- Liên kết “Xem biên bản” mở đúng tab Biên bản; khi đủ lượt hiển thị “Đã đủ số lượt”. Lỗi kiểm tra tiến trình có nút tải lại; chấm lại sau reload dùng trạng thái chấm thực tế.
- Tiêu đề trang giới thiệu được xuống dòng, không cắt bằng dấu ba chấm.

## Ví dụ

| Trước | Sau |
| --- | --- |
| Mật khẩu (ít nhất 8 ký tự, tối đa 72 byte) | Mật khẩu (ít nhất 8 ký tự) |
| AI chưa thể phản hồi. Bản nháp được giữ lại. | Chưa thể gửi lập luận. Nội dung bạn viết vẫn được giữ lại. Vui lòng thử lại. |
| Báo cáo năng lực tranh tụng | Kết quả luyện tập |
| Tổng điểm theo rubric 100 điểm. | Điểm theo thang 100. |
| Theo tài liệu được bản án/hồ sơ đề cập; CourtSim chưa có bản gốc. | Tài liệu được bản án đề cập. CourtSim chưa có bản gốc. |

## Giới hạn

Không sửa nguyên văn nguồn bên ngoài hoặc tiêu chí/trọng số chấm điểm. Nội dung nguyên văn có thuật ngữ kỹ thuật vẫn được giữ nếu thuật ngữ thuộc tài liệu gốc. Hồ sơ cũ trộn lời dẫn với trích dẫn mà không có source_quote không thể tự động xác định mọi ranh giới nguồn; cần bổ sung phân loại khi nhập dữ liệu. Prompt đã cập nhật nhưng kiểm thử AI dùng phản hồi kiểm soát được, chưa đánh giá chất lượng từ dịch vụ AI thật. Giao diện điện thoại được kiểm tra bằng trình duyệt giả lập.

## Kết quả kiểm tra

Ngày 28/09/2026: backend 36/36 đạt (có HTTP/MongoDB, không bỏ qua); Playwright 36/36 đạt trên desktop và điện thoại giả lập. ESLint và Vite build đạt. Đã xem ảnh chụp thông báo lỗi trên cả hai kích thước; nội dung không bị cắt, không che ô nhập. Không còn alert/confirm/prompt trong mã giao diện. Các thất bại do kiểm thử còn dùng câu chữ cũ đã được cập nhật và chạy lại toàn bộ.
