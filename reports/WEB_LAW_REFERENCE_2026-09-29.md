# Tra cứu và chấm luật tham khảo — 29/09/2026

Ghi nhận lịch sử: chế độ chấm tham khảo dưới đây đã được thay bằng quy trình nguồn/quyền và chấm nghiêm ngặt trong [LEGAL_CORPUS_INTEGRATION_2026-09-29.md](LEGAL_CORPUS_INTEGRATION_2026-09-29.md). Không dùng các chỉ dẫn bật chấm ở báo cáo này cho phiên mới.

Đã bổ sung chế độ tạm thời cho các vụ tranh chấp đất đai theo pháp luật Việt Nam. Không giới hạn tên miền; quy định dân sự và tố tụng liên quan cũng thuộc phạm vi tìm kiếm. Cờ `LEGAL_WEB_REFERENCE_SCORING` đã bật trong môi trường local; cấu hình mẫu mặc định tắt. Cách vận hành và tắt chế độ nằm trong `docs/OPERATIONS.md`.

Model evaluator được cấu hình tìm nguồn bằng web search. Backend tải nội dung thực tế, loại trang không đọc được, mục lục thiếu nội dung và điều khoản trùng số có nội dung mâu thuẫn. Nguồn đủ nội dung được chia sẻ cho hội thoại, trợ lý pháp luật và chấm điểm, mang trạng thái `web_read`; không tuyên bố đã xác minh hiệu lực hoặc đủ điều kiện áp dụng. Nhãn điểm tham khảo được lưu và hiển thị lại trong kết quả/lịch sử. Kết quả đã hoàn tất trước đó không tự chấm lại.

Tìm kiếm chỉ nhận từ khóa pháp luật được chọn sẵn, số điều/số hiệu và năm tham khảo. Tải trang chặn IP nội bộ, kiểm tra redirect, ghim DNS, giới hạn thời gian và kích thước. Cache nguồn web tách khỏi kho nguồn xác minh, dùng tối đa 6 giờ. Các nguồn chỉ có PDF hoặc chặn truy cập hiện bị bỏ qua. Không có nguồn đọc được thì không tự cho điểm luật.

## Kiểm chứng

- Backend: 65/65 tests qua, không skip. Có kiểm tra giới hạn đất đai, nguồn Việt Nam, chống truy cập mạng nội bộ, mục lục/điều khoản mơ hồ, cache và bật/tắt chấm tham khảo.
- Frontend: lint và build qua; `git diff --check` qua.
- Playwright Case1: desktop và mobile đều báo `ok`, gồm điểm luật, nhãn tham khảo và tải lại lịch sử. Runner treo ở teardown trên Windows nên phải dừng thủ công sau khi hai ca hoàn thành; không coi đây là lượt CLI kết thúc sạch.
- AI thật với tình huống đất đai tổng hợp công khai, không đọc Case1 hoặc phiên người dùng: lần cuối thành công ngay lượt đầu, 56/97 điểm được đánh giá; chỉ số nhóm `legal_application` là 15/100. Mẫu có ít lượt nên không đủ dữ liệu đánh giá toàn bộ rubric. Đây là kết quả kiểm tra cơ chế, không phải kết luận chất lượng pháp lý tổng quát.
- Nguồn đọc thật: bản Bộ luật số 92/2015/QH13 trên Wikisource, trích các Điều 6, 21, 70, 91, 96. Lượt cuối dùng lại cache nguồn đã tải trong kiểm thử trước. Artifact tại `.test-artifacts/web-law-smoke.json`; không xác nhận bản này đầy đủ sửa đổi hoặc phù hợp toàn bộ thời điểm của vụ án.

Benchmark Case1 trước đây cố định nguồn luật rỗng. Khi cờ mới bật, nhãn benchmark `case1` nay dùng tra cứu thật; những nhãn dùng so sánh prompt vẫn giữ nguồn rỗng để giữ điều kiện so sánh.

Tài liệu API tham chiếu: [OpenAI Web search](https://developers.openai.com/api/docs/guides/tools-web-search). Chi phí tool chưa định giá đầy đủ; theo dõi token nhưng không trình bày giá token như tổng chi phí.
