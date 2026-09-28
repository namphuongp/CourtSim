# Giao diện phòng xử án

## Cách xem

Chạy `npm --prefix backend run dev` và `npm --prefix frontend run dev` từ thư mục dự án (cấu hình môi trường theo README). Mở http://localhost:5173, đăng nhập rồi mở hoặc tạo một phiên mô phỏng.

- Cảnh phòng xử án chiếm toàn bộ chiều ngang vùng nội dung; desktop phân chia chiều cao cửa sổ cho tiêu đề, cảnh và ô nhập; cắt phần đáy cảnh bằng CSS. Màn hình quá thấp và điện thoại vẫn cuộn.
- Hồ sơ phiên tòa và Trợ lý luật chỉ mở khi nhấn. Hồ sơ phiên tòa gồm hai tab Vụ án và Biên bản. Danh sách chứng cứ chỉ nằm trong hồ sơ; dùng nút Đưa vào lập luận hoặc kéo thả từ hồ sơ.
- Lời trước/Lời tiếp theo đổi lời đang xem và ảnh vai tương ứng. Nội dung dài cuộn ngay trong khung bằng chuột hoặc bàn phím. Đọc đầy đủ mở toàn văn; Tab Biên bản hiển thị đầy đủ từng phát biểu theo thứ tự, kèm căn cứ được viện dẫn; không cắt dòng hoặc rút gọn bằng dấu ba chấm. Nút Xem tại phiên tòa chuyển tới phát biểu tương ứng. Escape đóng panel và trả focus về nút mở.
- Trên điện thoại, ba vai và lời thoại được xếp lại thành lưới; không thu nhỏ cảnh desktop. Ô nhập nằm trong luồng trang để không che chứng cứ.

## Asset đã kiểm tra

Nền: `frontend/public/courtsim-courtroom-background-v2.png`, 1672 × 940, RGB, không trong suốt.
Nhân vật trong `frontend/public/courtsim-characters/`, đều PNG RGBA có pixel trong suốt:

| Tệp | Kích thước |
| --- | --- |
| judge-listening.png, judge-speaking.png | 1024 × 1536 |
| opposing-lawyer-listening.png, opposing-lawyer-speaking.png | 1024 × 1536 |
| learner-lawyer-listening.png, learner-lawyer-speaking.png | 1145 × 1374 |

Giữ nguyên bảy asset. Lớp CSS dùng lại chính ảnh nền và clip-path để bàn che phần thân dưới; không dùng hình giấy tờ từ mockup. Các ảnh nhân vật có viền/bóng sẵn trong asset.

## Trạng thái và dữ liệu

Backend hiện trả một lượt hoàn chỉnh, không streaming. Khi gửi, hiển thị đúng bài người học vừa gửi; khi nhận xong, hiển thị lời chủ tọa mới nhất. Người học xem phản biện qua nút Lời trước hoặc lịch sử. Không thêm thời gian chờ, lời giả hay tự chạy các vai bằng timer. Ảnh speaking biểu thị lời đang được xem, không tuyên bố âm thanh đang phát. Trong lúc backend xử lý sau reload hoặc chấm điểm, các vai ở trạng thái nghe.

Tên vụ án, vai, lời và chứng cứ lấy từ phiên/API. Không đổi schema hay API backend. Cơ chế request_id chống gửi trùng, lưu bản nháp theo tab, khôi phục sau lỗi và chấm điểm được giữ nguyên.

## Kiểm tra

`npm --prefix frontend run lint`
`npm --prefix frontend run build`
`npm --prefix frontend run test:e2e`
`npm --prefix backend test`

Để chạy cả kiểm thử HTTP/MongoDB, đặt COURTSIM_TEST_MONGO_URI theo máy; bộ test dùng database riêng. Kiểm thử trình duyệt dùng phản hồi API kiểm soát được, gồm chuyển ảnh theo yêu cầu thật, chặn gửi trùng, lời dài, lịch sử, bản nháp, focus, giảm chuyển động, chứng cứ và trợ lý. Không thay thế việc kiểm tra chất lượng phản hồi của dịch vụ AI thật.

## Hướng dẫn trong ứng dụng

Nút Hướng dẫn mở tour tại chỗ: viền sáng chỉ đúng thao tác, nền ngoài được làm mờ, chú thích di chuyển theo bước và có hỗ trợ giảm chuyển động. Sáu bước: hồ sơ, tra cứu luật, đọc lời thoại, gửi lập luận, biên bản và kết thúc. Có Tiếp theo, Quay lại và chọn trực tiếp số bước. Đóng bằng Escape, Bỏ qua hoặc Bắt đầu thực hành; trả focus về nút mở, giữ bản nháp. Hướng dẫn chỉ giải thích thao tác, không tự gửi/chấm hoặc thay đổi dữ liệu phiên.

## Rà soát hoàn tất ngày 28/09/2026

- Backend: 33/33 kiểm thử đạt, gồm HTTP với MongoDB; không bỏ qua test.
- Frontend: toàn bộ 30/30 kiểm thử desktop/mobile đạt. Sau chỉnh thanh nút điện thoại thành hai cột, chạy lại 4/4 kiểm thử bố cục/tour liên quan và đều đạt.
- ESLint, Vite build và git diff --check đạt.
- Bổ sung kiểm tra vị trí cuộn được đặt lại khi đổi lời, laptop 1024 × 768 không tràn chiều cao, tour phiên đã kết thúc bỏ bước nhập bài, chú thích vừa màn hình thấp, giữ focus và giảm chuyển động.
- Đã kiểm tra ảnh chụp desktop, laptop và điện thoại giả lập. Chưa xác nhận trên thiết bị iOS/Android thật; phản hồi AI trong test được kiểm soát, không gọi dịch vụ AI thật.
