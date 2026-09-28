# Trang giới thiệu CourtSim

## Nội dung hiện tại
- Hero có sơ đồ quy trình bằng CSS, không dùng ảnh phòng xử án, nhân vật, video hoặc ảnh chụp giao diện.
- Giới thiệu cách học và kỹ năng thực hành theo luồng hiện có: chọn vụ án/vai luật sư, đọc hồ sơ, viết lập luận, nhận phản biện, xem điểm/góp ý và biên bản.
- Đã bỏ toàn bộ vụ án minh họa theo yêu cầu mới. Phần chấm điểm chỉ giải thích ngắn về điểm /100, giới hạn dữ liệu và gợi ý cải thiện; không hiển thị sáu bảng trọng số trên trang chủ.
- Footer có thương hiệu và mạng xã hội, ba nhóm Sản phẩm / Hỗ trợ / Pháp lý, lưu ý học tập, năm bản quyền và nút về đầu trang nằm cùng hàng liên kết trên desktop; không có hàng đáy riêng hoặc mục ngôn ngữ. Các mục chưa có nội dung (chính sách, FAQ, liên hệ, góp ý, mạng xã hội) là liên kết chưa kích hoạt, aria-disabled và không có href. Không tự tạo email, địa chỉ hoặc nội dung chính sách. Chỉ cần bổ sung to/href trong cấu hình groups khi có trang đích.
- Tham khảo bố cục nhóm liên kết của https://www.notion.com/ và https://linear.app/; không sao chép nội dung hoặc nhận diện của các trang này.

## Căn cứ nội dung
Đã đọc LawDoc/Tiêu chí chấm điểm cho AI.docx và đối chiếu scoringRubric.js, scoringService.js, SimulationSetup.jsx, SimulationResult.jsx cùng tài liệu hồ sơ/trợ lý. Điểm /100 được quy đổi từ phần đủ dữ liệu; phần thiếu dữ liệu không bị tính 0. Không hứa AI chính xác tuyệt đối, không đưa kết quả thắng/thua làm tiêu chí. Không thay đổi logic chấm điểm trong đợt thiết kế trang chủ này.

## Tệp chính
- frontend/src/components/landing/LandingFooter.jsx: footer riêng với cấu hình nhóm liên kết và mục chờ.
- frontend/src/pages/Home/LandingPage.jsx, landing.css: nội dung, footer, responsive, chuyển động một lần theo cuộn, hover/focus và giảm chuyển động.
- frontend/src/pages/Auth/LoginPage.jsx, RegisterPage.jsx: giữ returnTo qua đăng ký/đăng nhập để về đúng danh sách vụ án; kiểm tra đích bằng safeReturnPath.
- frontend/tests/landing.spec.js: nội dung giản lược, footer/anchor, CTA qua đăng ký/đăng nhập, không tạo phiên khi xem trang, bàn phím, responsive và chế độ chuyển động.

## Xem và kiểm tra
Từ thư mục dự án: `npm --prefix frontend run dev`, mở `/` khi chưa đăng nhập. CTA mở `/dashboard/setup`; người chưa đăng nhập đi qua xác thực rồi trở lại chọn vụ án.

Chạy `npm --prefix frontend run lint`, `npm --prefix frontend run build`, `npm --prefix frontend run test:e2e`. Kiểm thử xác thực dùng API giả lập, không kiểm định cloud AI hoặc nguồn luật bên ngoài.
