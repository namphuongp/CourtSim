# Hồ sơ luyện tập từ bản án công khai

Hồ sơ đất đai được lược biên và ẩn danh, lưu tại `backend/src/data/sampleLandCase.js`. Nguồn đăng lại được ghi trong hồ sơ và giao diện; chưa xác minh hiệu lực cuối cùng. Không lưu phán quyết vào dữ liệu gửi AI, không coi kết quả xét xử là đáp án chấm điểm.

Nhập riêng hồ sơ vào MongoDB hiện tại, không thay đổi tài khoản hoặc vai AI:

```powershell
cd backend
npm run sample:import
```

Lệnh cập nhật theo tiêu đề cố định nên chạy lại không tạo bản sao; không đổi tiêu đề định danh trong tệp dữ liệu. Lệnh `npm run seed` cũng bao gồm hồ sơ này cho cài đặt mới.

Trong Thiết lập phiên tòa, chọn hồ sơ đất đai, chọn một trong hai vai luật sư và độ khó. Ngày tra cứu lịch sử được cố định ở cả giao diện và API; đây không phải ngày phát sinh tranh chấp. Nguồn bản án có phán quyết được đặt sau mục mở rộng để người học chủ động xem sau buổi luyện tập.

Giới hạn: đây là bài luyện lập luận và xác định chứng cứ cần bổ sung. Chưa có bản gốc chứng cứ hoặc bản đo đạc. Đã nhập PDF Luật Đất đai 2013 nhưng chưa kiểm chứng trọn lịch sử phiên bản; xem SCORING_AND_LEGAL_RESEARCH.md. Cần bổ sung nguồn luật đúng thời kỳ và kiểm tra quy định chuyển tiếp trước khi mở rộng thành bài đánh giá áp dụng luật chuyên sâu.
