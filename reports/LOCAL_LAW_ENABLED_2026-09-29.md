# Sử dụng tài liệu nội bộ và web — 29/09/2026

Theo chỉ dẫn người dùng, 26 tệp pháp luật đã được nhập thành 24 bản thuộc 20 số hiệu, gồm 5.905 điều chính và 28.477 đơn vị điều/khoản/điểm. Đây là số bản có phiên bản trùng, không phải số điều duy nhất. Case1 và rubric không được nhập làm luật.

- Import thật vào MongoDB thành công; chạy lại trả 24 `unchanged`, không tạo thêm bản.
- Không sửa hoặc xóa dữ liệu phiên cũ. Lưu nguyên byte nguồn trong `backend/storage/legal-sources/`, checksum kiểm tra khi mở tệp.
- Trợ lý và mô phỏng ưu tiên kho nội bộ; trả được Điều 202 Luật Đất đai 2013 và Điều 252 Luật Đất đai 2024 kèm link nguồn.
- AI thật đã tạo một lượt phản biện và dùng một trích dẫn Điều 202 từ kho. Kiểm thử dùng tình huống giả định công khai, không dùng hồ sơ cá nhân.
- Công cụ web thật đã tìm được nguồn trên `btllang.mod.gov.vn`, `vbpl.vn`, `vanban.chinhphu.vn`, không có bộ lọc tên miền. Đây là bằng chứng tìm kiếm; không phải xác nhận đã đọc toàn văn mọi kết quả đó.
- Web chỉ phục vụ luật Việt Nam liên quan tranh chấp đất đai. URL nội bộ/redirect nguy hiểm vẫn bị chặn; trích dẫn web cần đọc được nội dung.
- Nhãn `local_read` xác nhận đã đọc tệp người dùng cho phép. Xác minh phiên bản/thời điểm áp dụng riêng; thiếu điều kiện này vẫn có thể chưa chấm phần luật.

Kiểm chứng: backend với MongoDB thử riêng đạt 77/77, không bỏ qua; lint/build frontend đạt. Kiểm tra trình duyệt đã xác nhận mở nguồn HTTP 200 và giữ trích dẫn sau tải lại; luồng toàn phiên còn gặp timeout ở bước biên bản, chưa ghi nhận toàn bộ E2E đạt.

Bằng chứng chi tiết: `LEGAL_LOCAL_USE_REVIEWS.json`, `LEGAL_LOCAL_USE_RESULT.json`, `LEGAL_CORPUS_LIVE_QUERIES.json`; kết quả AI thật lưu cục bộ ở `LEGAL_LOCAL_AI_SMOKE.json`.
