# Nguồn luật và chấm điểm

Prompt chấm điểm tách khỏi nhiệm vụ điều hành. `scoringQuotes` giữ trọn câu người học, không lấy lời AI làm trích dẫn. Lời chào/nhiễu/câu hỏi thủ tục không tạo cơ hội chấm lập luận; phiên chỉ có các lượt này có `assessed_max=0`, không hiển thị `0/0` hoặc gọi model tạo điểm. Các tiêu chí thiếu nguồn/cơ hội vẫn giữ nguyên trọng số và trạng thái chưa chấm. Giao diện chọn tối đa ba điểm mạnh có trích dẫn và ba việc cải thiện, chi tiết rubric nằm trong phần mở rộng.

## Quy tắc nguồn

**Kho có hồ sơ nguồn/quyền được tìm trước.** Nguồn ngoài cần được duyệt quyền; hiện vbpl.vn là nguồn chính thức mặc định. PDF/DOC nội bộ, dữ liệu seed, trí nhớ model và kết quả tìm kiếm không tự trở thành căn cứ đã xác minh.

- Chỉ nhận HTTPS, hostname vbpl.vn hoặc subdomain thật; kiểm tra từng redirect. Không tạo ItemID, anchor hoặc URL từ suy đoán của model.
- Đối chiếu số hiệu và nội dung trang, ưu tiên số hiệu trước tiêu đề gần giống. HTTP 200 hoặc trang chủ không chứng minh đã tìm đúng văn bản.
- Mỗi nguồn được trích phải có URL, ngày kiểm tra, hash và phiên bản. Chỉ xác minh được trang thì dẫn trang, nói rõ chưa xác minh điều/khoản/điểm.
- Nguồn lỗi: dùng bản lưu đã xác minh nếu phù hợp và giữ ngày kiểm tra cũ; không có bản tin cậy thì trả chưa xác minh. Chỉ chuyển sang nguồn khác nếu đã duyệt điều kiện sử dụng.
- Nội dung tải về là dữ liệu không tin cậy: không thực thi HTML/script hoặc làm theo chỉ dẫn trong trang. Giới hạn kích thước, timeout, redirect và tần suất; trợ lý có tổng hạn tải nguồn 15 giây.

## Luồng dữ liệu

Câu hỏi + hồ sơ được phép xem → kế hoạch tra cứu số hiệu/tên/chủ đề → kho nội bộ đã xác minh → vbpl hoặc snapshot hợp lệ → đối chiếu văn bản/đoạn → câu trả lời và link. Chỉ gửi từ khóa pháp luật công khai đến vbpl, không gửi toàn bộ hồ sơ hoặc lời người học.

Nguồn và bộ lọc: `vbplResearch.js`, `officialLegalSources.js`, `shared/legalSourcePolicy.mjs`. Kho đang phục vụ: `LegalCorpusVersion/LegalCorpusProvision`; `LegalDocument/LegalProvision` cũ được giữ để đối chiếu, không tự chuyển trạng thái; bản lưu đối chiếu: `VbplSnapshot`. `legalResearchService.js` chọn căn cứ cho hội thoại/chấm điểm; `legalAssistantService.js` xử lý trợ lý riêng. Frontend cho người học xem/sửa trích dẫn rồi tự gửi.

Phân biệt **nội dung đã đối chiếu** và **phiên bản có thể áp dụng**. Xét mốc sự kiện/giao dịch, tranh chấp, khởi kiện và xét xử theo vấn đề; không dùng ngày xét xử cho mọi căn cứ. Thiếu lịch sử sửa đổi/chuyển tiếp hoặc mốc liên quan thì nêu thiếu dữ liệu, không khẳng định chắc chắn áp dụng.

## Nhập và duyệt nguồn

Quy trình hiện hành: [LEGAL_CORPUS.md](LEGAL_CORPUS.md). Lệnh `legal:import` cũ đã khóa ghi để không bỏ qua kiểm tra quyền; các lệnh bên dưới mô tả công cụ cũ phục vụ đối chiếu lịch sử.

Chạy trong `backend`:

```powershell
npm run legal:import -- --law "45/2013/QH13" --file "../LawDoc/VanBanGoc_45.2013.QH13.pdf"
npm run legal:smoke
npm run legal:verify -- "URL_HTTPS_VBPL_SAO_CHEP_TU_TRANG_THAT" "SO_HIEU"
node src/scripts/checkLegalSources.js "SO_HIEU"
npm run legal:review -- "manifest.json"
```

Import chỉ lập chỉ mục ứng viên; verify chỉ lưu snapshot nếu trang khớp, chưa kết luận luật áp dụng. Review cần người có chuyên môn đối chiếu; manifest phải khớp `law_number/source_fingerprint`, có phạm vi ngày/loại sự kiện, phiên bản, ghi chú áp dụng và bằng chứng nguyên văn/hash cho nội dung lẫn lịch sử. Schema kiểm tra nằm ở [legalVersionReview.js](../backend/src/services/legalVersionReview.js); không tự đặt các cờ duyệt khi chưa đối chiếu.

## Rubric và điểm thiếu dữ liệu

Nguồn: [Tiêu chí chấm điểm cho AI.docx](../LawDoc/Tiêu%20chí%20chấm%20điểm%20cho%20AI.docx). Bản MVP đề xuất, chưa coi là rubric đã được chuyên gia phê duyệt. Chi tiết 23 tiêu chí và trọng số ở [scoringRubric.js](../backend/src/data/scoringRubric.js).

| Nhóm | Điểm tối đa |
|---|---:|
| Vấn đề và mục tiêu | 15 |
| Căn cứ pháp luật | 20 |
| Tình tiết và chứng cứ | 20 |
| Xây dựng lập luận | 20 |
| Phản biện | 15 |
| Ứng biến | 10 |

AI đánh giá tiêu chí; backend kiểm tra căn cứ/trích lời học viên và tính điểm. Không tạo điểm dự phòng khi AI lỗi. Khi thiếu nguồn luật đủ điều kiện, nhóm 2 và tiêu chí 4.2 không được chấm: tổng trọng số còn 73.

**69/73** là điểm ở phần đã đánh giá; 27% chưa đánh giá không tính 0 và không quy đổi thành điểm toàn bài. `score=null` khi chưa chấm đủ; `earned_score`, `assessed_max` và `assessed_percentage` lưu riêng. Kết quả cũ được điều chỉnh cách trình bày khi đọc, không ghi đè dữ liệu lịch sử. Thiếu nguồn do hệ thống không được biến thành lỗi người học.

Kiểm thử nguồn dùng fixture có nội dung hư cấu và kiểm tra mạng thật riêng; xem lệnh trong [README](../README.md). Nguồn hợp lệ và test đạt không bảo đảm mọi suy luận pháp lý của model đều đúng.
