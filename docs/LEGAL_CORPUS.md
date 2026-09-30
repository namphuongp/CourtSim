# Kho luật đất đai: nhập, duyệt và khôi phục

Đặt nguồn mới trong `LawDoc/`, giữ nguyên byte tệp tải về và thông tin nguồn tải. Theo chỉ dẫn ngày 29/09/2026, các tài liệu người dùng cung cấp được dùng trực tiếp cho mô phỏng và trợ lý, không chờ tải lại từ VBPL. Hồ sơ hiện hành là `backend/src/data/legal-reviews/LEGAL_LOCAL_USE_REVIEWS.json`. Manifest và audit được tạo lại trong `.test-artifacts/` khi cần.

## Nhập tài liệu người dùng đã cho phép

Chạy trong `backend`:

```powershell
node src/scripts/importLocalLaws.js
node src/scripts/importLocalLaws.js --apply
```

Lệnh đầu kiểm tra checksum, định danh và cấu trúc; lệnh sau nhập MongoDB, sao lưu nguyên byte vào `backend/storage/legal-sources/`. Kết quả nằm ở `.test-artifacts/LEGAL_LOCAL_USE_RESULT.json`. Đã nhập 24 bản thuộc 20 số hiệu từ 26 tệp; chạy lại không nhân đôi. Case1 và rubric không thuộc kho luật. Sao lưu thư mục nguồn cùng DB để link nguồn tiếp tục hoạt động khi chuyển máy.

Nguồn này mang `reference + local_read + allowed`, có thể trích dẫn trong hội thoại/trợ lý. Nhãn này xác nhận đã đọc tệp cung cấp, không giả lập việc đối chiếu byte với VBPL hay xác minh hiệu lực cho mọi thời điểm. API mở tệp yêu cầu đăng nhập và kiểm tra checksum; Word tải xuống, PDF xem trực tiếp. Bản PDF được ưu tiên khi trùng số hiệu/điều với Word. Giữ nguyên dấu nguồn trong tệp; không sửa phiên và trích dẫn cũ.

## Đối chiếu nguồn chính thức (tùy chọn)

Trong `backend`, dùng Node trực tiếp khi truyền tham số trên PowerShell (npm có thể làm mất cờ):

```powershell
npm run legal:inventory
node src/scripts/inventoryLegalCorpus.js --reviews src/data/legal-reviews/LEGAL_PDF_REVIEWS.json
node src/scripts/inventoryLegalCorpus.js --reviews src/data/legal-reviews/LEGAL_PDF_REVIEWS.json --apply
```

Lệnh đầu chỉ kiểm kê. Lệnh thứ hai đối chiếu không ghi DB. Lệnh cuối chỉ ghi những bản đã vượt đủ kiểm tra. `--root` đổi thư mục tài liệu; đường dẫn từng tệp review phải nằm bên trong thư mục đó, không được thoát qua symlink. `--output` chọn manifest kết quả. Báo `not_imported` là chưa nhập, kể cả tiến trình kết thúc bình thường; đọc từng mục `imports`.

## Hồ sơ duyệt

`LEGAL_PDF_REVIEWS.json` là hồ sơ đối chiếu chính thức của bốn PDF. Xác nhận nguồn `vbpl.vn` được lưu riêng theo SHA-256 trong `backend/src/data/legalFileDeclarations.json`; thay byte thì xác nhận cũ không còn khớp. Lần đối chiếu trực tiếp chưa lấy được toàn văn. Điều này không còn chặn sử dụng bản `local_read` đã được người dùng cho phép.

Mỗi review cần số hiệu lấy từ văn bản, tên, loại `original/amendment/consolidated/annex`, danh sách tệp theo thứ tự và checksum, số điều kỳ vọng, xác nhận đủ phần, bằng chứng quyền sử dụng và URL chính thức. Không tự điền `expected_articles` chỉ từ kết quả parser: phải đối chiếu mục cuối và dãy điều. `page_review_evidence` giải thích trang trắng/trang xuất bản hoặc việc đã đối chiếu trang scan; hệ thống không tự OCR rồi coi kết quả là đúng.

Hai cách xác minh nội dung:

- HTML: `official_url` trả đúng toàn văn trên VBPL; từng điều phải khớp nội dung tệp sau chuẩn hóa khoảng trắng.
- PDF: bổ sung `official_file_url` cho **từng** tệp, sao chép URL tải thực tế trên VBPL. Server tải lại với hạn dung lượng/thời gian, kiểm tra redirect và so checksum từng byte. Không dựng URL theo tên tệp. Với bộ nhiều phần, phải cung cấp đầy đủ và đúng thứ tự.

Luồng đối chiếu chính thức vẫn kiểm tra `official_original` hoặc `explicit_permission`. Luồng sử dụng nội bộ riêng ghi `user_authorized_simulation` cùng chỉ dẫn người dùng và checksum cụ thể; không tự biến thành xác nhận bản gốc chính thức. Tệp mới chưa có hồ sơ cho phép không tự được nhập.

## Schema và phiên bản

`LegalCorpusVersion`: fingerprint bất biến, định danh văn bản/loại bản, provenance, quyền, URL/hash/ngày đối chiếu, các tệp nguồn, `version_rules`, quan hệ có trích đoạn bằng chứng, trạng thái và ngày thu hồi. `LegalCorpusProvision`: điều/khoản/điểm, chương/mục, nguyên văn, vị trí trang/tệp, token tìm kiếm; index duy nhất theo phiên bản và locator. Không lưu blob vào phiên hoặc frontend bundle.

`verified` chỉ xác nhận nội dung nguồn. Muốn xác nhận **áp dụng**, review phải có `version_review.rules`: khoảng `from/to`, danh sách điều/ngoại lệ, loại mốc `event_kinds`, phiên bản, ghi chú, ngày duyệt, nguồn và bằng chứng riêng cho nội dung/lịch sử; chuyển tiếp phải `reviewed`. Bộ kiểm tra tải nguồn bằng chứng và so URL/hash/trích đoạn. Không có rule thì vẫn xem được nội dung đã đối chiếu nhưng chưa chấm luật. Văn bản hợp nhất không được tự mang khoảng hiệu lực độc lập.

Quan hệ `amends/supplements/replaces/guides` chỉ được nhập khi `target`, `source_url`, `quote` khớp nguồn; không tự sinh quan hệ từ model. Phụ lục và sửa đổi có cấu trúc chưa tách chắc chắn giữ cần duyệt, không gán nhầm số điều lồng trong nội dung sửa luật.

## Tra cứu và cập nhật

Trợ lý/mô phỏng ưu tiên kho `verified/reference + allowed + chưa thu hồi`; web bổ sung khi thiếu căn cứ và bật `LEGAL_WEB_REFERENCE_SCORING=true`. Không giới hạn tên miền, không cần `LEGAL_WEB_USAGE_GRANTS`; phạm vi là pháp luật Việt Nam phục vụ tranh chấp đất đai. Server vẫn chặn địa chỉ nội bộ, redirect nguy hiểm, nội dung quá lớn và trích dẫn chưa đọc được. Kết quả tìm kiếm chỉ có tiêu đề không trở thành nguyên văn điều luật.

Hội thoại dùng được nội dung đã đọc, kèm trạng thái áp dụng riêng. Bộ chấm vẫn để phần luật chưa đánh giá khi chưa xác định được phiên bản/thời điểm áp dụng; việc mở kho và web không tự tạo điểm luật hay tính lại phiên cũ.

Truy xuất tối đa 5 đơn vị, tổng 8.000 ký tự; số hiệu/locator được ưu tiên, không gửi cả bộ luật. Nội dung nguồn là dữ liệu, không phải chỉ dẫn. Giao diện hiển thị trạng thái áp dụng riêng với trạng thái đã đọc nguồn, ngày đối chiếu và link. Thiếu mốc thì hỏi rõ hoặc nêu giới hạn; không dùng luật mới nhất cho mọi sự kiện.

Thay đổi nguồn hoặc hồ sơ duyệt tạo fingerprint mới; chạy lại bản không đổi không nhân đôi units. Ghi bản nháp trước, chỉ công bố sau khi đếm đủ units. Lỗi giữa chừng để `needs_review`, chạy lại có thể hoàn tất. Không sửa nội dung của trích dẫn phiên cũ.

Nếu nhập sai, dùng fingerprint chính xác từ báo cáo:

```powershell
node src/scripts/inventoryLegalCorpus.js --retire FINGERPRINT_64_KY_TU --apply
```

Thu hồi chỉ ngừng phục vụ tìm kiếm mới, giữ nội dung và trích dẫn cũ để kiểm toán. Không xóa collection hoặc restore đè DB đang chạy. Muốn đưa lại vào sử dụng, sửa hồ sơ/nguồn và duyệt thành một phiên bản mới. Sao lưu DB bằng quy trình vận hành trước đợt nhập lớn.

## Kiểm tra

`node --test tests/legalCorpus.test.js` kiểm tra nguồn/quyền, thời kỳ, sửa đổi/chuyển tiếp, hợp nhất, lỗi nguồn, idempotency và thu hồi. Đặt `COURTSIM_TEST_MONGO_URI` để chạy phần tích hợp trong DB ngẫu nhiên riêng. Chạy `npm run legal:inventory` rồi `node src/scripts/auditCorpusSources.js` để đối chiếu số hiệu công khai; kết quả nằm trong `.test-artifacts/`. Kiểm thử bằng fixture không phải chứng nhận nguồn thật.
