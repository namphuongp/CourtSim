# Chấm điểm và tra cứu căn cứ — 28/09/2026

## Tài liệu rubric và đối chiếu

Nguồn: `LawDoc/Tiêu chí chấm điểm cho AI.docx`, “COURTSIM – AI LEGAL EVALUATION & SCORING SPECIFICATION”, MVP v1.0. SHA-256: `013f659a3b6aba483da5ffc755633c2cee02a4d3c2111f16609f2816d81482d4`. Đã đọc toàn bộ nội dung, gồm bảng và tiêu chí con.

| Nhóm theo tài liệu | Điểm | Phân bổ tiêu chí con |
|---|---:|---|
| Vấn đề pháp lý và mục tiêu bảo vệ | 15 | 1.1: 7; 1.2: 5; 1.3: 3 |
| Xác định và áp dụng căn cứ pháp luật | 20 | 2.1: 7; 2.2: 5; 2.3: 6; 2.4: 2 |
| Phân tích tình tiết và chứng cứ | 20 | 3.1: 5; 3.2: 5; 3.3: 7; 3.4: 3 |
| Xây dựng lập luận pháp lý | 20 | 4.1: 5; 4.2: 7; 4.3: 5; 4.4: 3 |
| Phản biện và xử lý lập luận đối phương | 15 | 5.1: 3; 5.2: 4; 5.3: 5; 5.4: 3 |
| Ứng biến và điều chỉnh chiến lược | 10 | 6.1: 3; 6.2: 3; 6.3: 2; 6.4: 2 |

Trước đây có bốn nhóm 25% và không chấm tiêu chí con. Hiện AI phải trả đúng 23 tiêu chí con với giải thích, điểm mạnh, cách sửa và trích đoạn lời người học. Backend xác minh phạm vi điểm, ID/trích đoạn, cộng điểm theo trọng số gốc và lưu snapshot rubric trong kết quả. AI không quyết định điểm tổng. Kết quả cũ giữ nguyên, không tự chấm lại.

Theo yêu cầu bổ sung của người dùng: `score = round(earned_score / assessed_max * 100, 2)`. Ví dụ 38,4/48 → 80/100; UI đồng thời ghi đã đánh giá 48% trọng số. Không tính tiêu chí chưa đủ điều kiện là 0. Dashboard/histories nhận cùng điểm từ API; analytics giữ từng nhóm rubric riêng, không gộp nhóm cũ thành nhóm mới.

## Các điểm chưa rõ và quyết định triển khai

- Tài liệu ghi đây là **đề xuất chờ chuyên gia xác nhận**. Sản phẩm lưu/hiển thị trạng thái đề xuất, không tuyên bố đã được chuyên gia duyệt.
- Bảng tổng là 100, ví dụ cuối dùng /10. Chọn thang 100 theo bảng và chỉ đạo mới nhất, giữ hai chữ số thập phân khi cần.
- Tài liệu chưa quy định mức điểm chi tiết từng mức năng lực; không sáng tác thang mô tả mới. AI giải thích số điểm trong trần điểm từng mục, cần giảng viên kiểm định chất lượng thực tế.
- Thiếu căn cứ được xác minh: tạm không chấm nhóm 2 và mục 4.2. Các mục khác chỉ chấm trong phạm vi lời trình bày/chứng cứ, không kết luận chắc chắn đúng/sai pháp luật.
- Chưa có lượt trả lời phía đối lập: chưa chấm nhóm 5 và 6; mục 5.4 cần hai lượt trả lời phản biện. Đây là chính sách xử lý thiếu cơ hội quan sát của ứng dụng, không phải quy tắc có sẵn trong DOCX.
- “Ứng biến” cho phép đánh giá phản ứng với lập luận mới, phù hợp phần mô tả tài liệu. Không cho AI tự tạo chứng cứ/tình tiết mới; tài liệu đề xuất khả năng này nhưng chưa có cơ chế tình huống được biên soạn và duyệt.
- Thắng/thua kiện còn là nội dung xin ý kiến trong tài liệu. Không thêm outcome giả và không dùng thắng/thua làm điểm.
- Điểm 0 vì không thể hiện cho phép quote/record_id rỗng; điểm dương phải dẫn đúng lời người học. Phần chưa đủ điều kiện do backend quyết định, không tùy AI bỏ tiêu chí.

## Kết thúc phiên

Thay toàn bộ `window.confirm` trong frontend bằng `ConfirmEndDialog` dùng React và phần tử dialog. Focus ban đầu ở “Tiếp tục tranh luận”, Escape đóng khi chưa gửi, focus trở về nút mở. Lúc chấm khóa thao tác xác nhận, hiển thị tiến trình. Lỗi giữ biên bản/bản nháp; kiểm tra lại trạng thái trước khi thử chấm tiếp. Khi reload/rời trang trong lúc xử lý, client kiểm tra khóa phiên và lấy kết quả đã lưu; không tự gửi thêm POST complete. Dấu yêu cầu kết thúc nằm trong sessionStorage theo tài khoản/phiên.

Backend vẫn dùng khóa MongoDB/token fence và ghi kết quả cùng trạng thái hoàn thành nguyên tử. Complete lặp trả kết quả đã lưu. Nếu tiến trình backend chết, lease tối đa 10 phút mới hết; không có hàng đợi bền vững tự tiếp tục tác vụ AI sau restart.

## Kho nguồn và mốc thời gian

Đã kiểm tra `LawDoc`: hai DOC 91/2015, 92/2015; ba PDF 31/2024; PDF 45/2013; DOCX tiêu chí chấm điểm (không nhập DOCX này như luật). Luật 45/2013 có 212 điều, 1.592 đơn vị điều/khoản/điểm, 118 trang; lưu nguyên văn trích xuất, tệp/SHA-256, trang, nguồn, phiên bản và trạng thái. Tệp gốc không bị sửa. Parser loại tiêu đề chương tiếp theo và phần ký/xuất bản khỏi điều cuối; vẫn giữ trong source_text.

Nguồn yêu cầu:
- https://vbpl.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=32833
- https://vbpl.vn/TW/Pages/vbpq-lichsu.aspx?ItemID=32833

Các nguồn hiện chưa truy cập đầy đủ, kể cả khi thử ngoài sandbox. Trang thuộc tính truy cập được có thông tin chưa đồng nhất về mốc hết hiệu lực; chưa xác minh trọn lịch sử sửa đổi/chuyển tiếp. Do đó **không bật viện dẫn Luật Đất đai 2013 chỉ vì đã có PDF**.

Case.timeline tách hành vi, giao dịch/quyền, tranh chấp, khởi kiện, xét xử. Khoảng năm được biểu diễn từ/đến, không giả tạo ngày chính xác. Admin POST case có thể gửi timeline; mỗi mốc phải có source_quote nằm trong full_document. Mốc chưa có được đánh dấu chưa rõ; không tự rút ngày từ lời AI. Ngày chọn ở setup của hồ sơ không có timeline là giả định tra cứu, không phải sự kiện được chứng minh. Phiên cũ giữ snapshot; tạo phiên mới để dùng timeline mẫu vừa bổ sung.

Danh sách luật theo thời kỳ chỉ để tìm ứng viên. `version_rules` quyết định có được viện dẫn hay không: fingerprint nguồn, khoảng thời gian, điều được phép/loại trừ, loại mốc, kiểm tra nguyên văn, lịch sử và chuyển tiếp. Khoảng vượt phiên bản, điều đã bị loại trừ, luật chưa lưu hoặc phiên bản xung đột đều bị chặn. Truy xuất theo tiêu đề/hồ sơ và hai lượt mới nhất, giữ toàn điều trong giới hạn ngữ cảnh; chỉ citations đã xác minh được đưa cho AI. Ứng viên chưa xác minh chỉ hiển thị riêng cho người học.

`evidence_inventory` tách provided và mentioned_only. Hồ sơ bản án mẫu chỉ có tài liệu được bản án đề cập, không có bản gốc chứng cứ. Prompt không cho gọi luật là chứng cứ của vụ án hoặc coi tài liệu được nhắc đến là đã được cung cấp.

## Cập nhật dữ liệu

Từ thư mục backend, MongoDB đang chạy:

```powershell
node src/scripts/importLegalDocuments.js --law "45/2013/QH13" --file "../LawDoc/VanBanGoc_45.2013.QH13.pdf"
node src/scripts/checkLegalSources.js "45/2013/QH13" "../LawDoc/official-source-review.json"
npm run sample:import
```

Lệnh đầu có thể chạy lại theo fingerprint, không nhân bản. Lệnh thứ hai tải lại nguồn chính thức và tùy chọn xuất snapshot để đối chiếu; không tự chứng nhận luật. Khi thiếu nguồn, mỗi lượt/tra cứu tự kiểm tra URL chính thức đã đăng ký, timeout 4 giây, tối đa 2MB/trang, không theo redirect, cache 6 giờ và gộp yêu cầu đồng thời. Không gửi hồ sơ/lời người học ra nguồn tra cứu. Đặt `LEGAL_ONLINE_LOOKUP=false` để dùng ngoại tuyến.

Sau khi có mạng và người quản trị đối chiếu được nguyên văn, quan hệ sửa đổi/thay thế, thời kỳ và chuyển tiếp, tạo manifest rồi chạy:

```powershell
node src/scripts/reviewLegalVersion.js "../LawDoc/reviewed-version.json"
```

Manifest gồm `law_number`, `source_fingerprint` và `rules`. Mỗi rule: `version`, `from`, `to`, `reviewed_at`, `articles` (rỗng = mọi điều), `excluded_articles`, `event_kinds`, `source_checked:true`, `history_checked:true`, `transition_status:"reviewed"`, `application_note`, `review_sources`, `evidence`. Evidence có `kind:"text"|"history"`, `url`, `sha256`, `quote` khớp nguyên văn snapshot đã tải. CLI từ chối fingerprint sai, thiếu bằng chứng nội dung/lịch sử hoặc kỳ xác minh tương lai. Việc xác định phạm vi pháp lý vẫn cần người có chuyên môn; script không chứng minh được kết luận của người duyệt là đúng. Không tạo manifest đã duyệt giả trong repository.

Nguồn mới ngoài registry: bổ sung metadata/URL trong legalAuthorities.js sau khi đối chiếu; nhập bản sửa đổi/hợp nhất như một fingerprint khác. Chưa có trình thu thập Internet tùy ý hoặc tự hợp nhất luật bằng AI. Luồng hiện hỗ trợ tài liệu PDF/DOC đã đăng ký, mốc/phiên bản được duyệt và xử lý thiếu nguồn an toàn.

## API, giao diện và kiểm tra

`GET /api/v1/sessions/:id/legal-basis` yêu cầu quyền sở hữu phiên, trả issues/citations/candidates/warnings. Tranh luận và chấm điểm đều tra cứu trước khi gọi AI; lưu snapshot căn cứ trong kết quả để reload không thay nguồn. Giao diện có mốc, phiên bản, nguyên văn, nguồn, trạng thái và lý do liên quan; mất nguồn không chặn phiên.

Kiểm thử: rubric/trọng số/quy đổi, thiếu nguồn và cơ hội, điểm ngoài biên, trích đoạn giả; luật đúng thời kỳ, phiên bản thiếu, điều sửa đổi/chuyển tiếp, nguồn offline/403 và URL ngoài allowlist; HTTP MongoDB với AI giả lập; Playwright desktop/mobile cho hộp xác nhận, focus/Escape, lỗi/retry, chống lặp, reload đang chấm, kết quả cũ/mới và tra cứu lỗi. AI thật chưa được kiểm tra lại trong lần cập nhật này.

Kết quả chạy: 24/24 kiểm thử backend với MongoDB riêng; 14/14 Playwright desktop/mobile. Chạy lại 4 ca bị ảnh hưởng sau bổ sung dấu trạng thái kết thúc: 4/4 đạt. ESLint, Vite build và git diff --check đạt; health backend HTTP 200. Đã kiểm tra ảnh giao diện kết quả mới. Kiểm tra dữ liệu MongoDB thực: 212 điều, 1.592 đơn vị của luật 45/2013; hồ sơ mẫu trả 5 nhóm mốc, 10 ứng viên tham khảo, 0 căn cứ được chứng nhận, đúng trạng thái chờ xác minh.
