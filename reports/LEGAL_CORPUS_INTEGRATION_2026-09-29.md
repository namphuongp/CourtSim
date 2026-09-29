# Tích hợp kho luật đất đai — 29/09/2026

> Báo cáo lịch sử của cơ chế đối chiếu nguồn chính thức. Chỉ dẫn sau đó của người dùng đã cho phép dùng trực tiếp tài liệu nội bộ; đã nhập 24 bản thuộc 20 số hiệu. Trạng thái hiện hành xem `docs/LEGAL_CORPUS.md` và `reports/LOCAL_LAW_ENABLED_2026-09-29.md`.

Pipeline kiểm kê, duyệt quyền/nguồn, nhập có phiên bản, tra cứu ưu tiên kho và chấm luật nghiêm ngặt đã triển khai. **Chưa có văn bản mới đủ điều kiện được nhập**: sau khi người dùng phê duyệt rõ hồ sơ PDF, apply đã chạy nhưng hai bộ luật đều trả OFFICIAL_CONTENT_UNAVAILABLE. Không đổi trạng thái nguồn để vượt lỗi này.

## Số liệu thực tế

- 28 tệp trong LawDoc: 26 tệp ứng viên pháp luật và 2 tệp hồ sơ/rubric loại khỏi kho luật.
- 20 Word tải từ Thư Viện Pháp Luật: pending_permission theo thông tin ADS/nhận diện nguồn; không đưa nguyên văn vào prompt, phản hồi hoặc log.
- 2 Word cũ (91.2015.QH13.doc, 92.2015.QH13.doc): needs_review, quyền chưa rõ. Không mặc định chúng có cùng điều kiện sử dụng với bản Word mới cùng số hiệu.
- 4 PDF được người dùng xác nhận nguồn vbpl.vn, quyền allowed theo checksum; vẫn needs_review về URL cụ thể/đối chiếu nội dung và hiệu lực.
- PDF Luật Đất đai 2013: 118 trang, 212 điều. Ba phần Luật Đất đai 2024: 94 + 95 + 66 trang, các dãy 1–90, 91–170, 171–260, tổng 260 điều. Tổng 472 điều / 4159 đơn vị điều-khoản-điểm trích được cục bộ; đây là số parser, **không phải số đã xác minh**.
- Hai trang ít chữ của PDF 2024 đã render: trang 94 phần 1 là thông tin xuất bản, trang 95 phần 2 trắng. Không cần OCR hai trang này. Chưa thực hiện kiểm tra hình ảnh toàn bộ 373 trang PDF; tính đầy đủ mới kiểm tra ở mức chuỗi điều và các trang bất thường.
- Đã xác minh/nhập vào kho mới: **0 văn bản, 0 đơn vị**. Đã đọc lại MongoDB để xác nhận. Kho cũ vẫn 4 văn bản/9.203 đơn vị, không bị xóa hoặc ghi đè; không tự cấp quyền phục vụ AI theo chính sách mới.
- Không phát hiện trùng byte trong đợt kiểm kê. Manifest lưu thêm hash văn bản và nhóm cùng số hiệu; cùng số hiệu không đồng nghĩa cùng phiên bản hay cùng quyền sử dụng.

## Danh sách tệp

| Tệp | Số hiệu đọc được | Số điều parser | Trạng thái |
|---|---|---:|---|
| 01_2017_ND-CP_337031.doc | 01/2017/NĐ-CP | 6 | pending_permission |
| 101_2024_ND-CP_613131.doc | 101/2024/NĐ-CP | 71 | pending_permission |
| 102_2024_ND-CP_603982.doc | 102/2024/NĐ-CP | 162 | pending_permission |
| 181_2004_ND-CP_52514.docx | 181/2004/NĐ-CP | 186 | pending_permission |
| 24_2004_QH11_52189.docx | 24/2004/QH11 | 416 | pending_permission |
| 33_2005_QH11_2463.doc | 33/2005/QH11 | 777 | pending_permission |
| 43_2014_ND-CP_230680.doc | 43/2014/NĐ-CP | 103 | pending_permission |
| 43_2024_QH15_612195.doc | 43/2024/QH15 | 5 | pending_permission |
| 44-L_CTN_39391.doc | 44-L/CTN | 838 | pending_permission |
| 65_2011_QH12_122220.docx | 65/2011/QH12 | 7 | pending_permission |
| 84_2007_ND-CP_20495.docx | 84/2007/NĐ-CP | 68 | pending_permission |
| 88_2009_ND-CP_96275.docx | 88/2009/NĐ-CP | 29 | pending_permission |
| 91.2015.QH13.doc | 91/2015/QH13 | 689 | needs_review |
| 91_2015_QH13_296215.docx | 91/2015/QH13 | 689 | pending_permission |
| 92.2015.QH13.doc | 92/2015/QH13 | 517 | needs_review |
| 92_2015_QH13_296861.doc | 92/2015/QH13 | 517 | pending_permission |
| Case1.docx | Chưa xác định / không phải luật | — | needs_review |
| Luật đất đai 1987.doc | 3-LCT/HĐNN8 | 57 | pending_permission |
| Luật đất đai 1993.doc | 24-L/CTN | 89 | pending_permission |
| Luật đất đai 2003.doc | 13/2003/QH11 | 146 | pending_permission |
| Luật đất đai 2013.doc | 45/2013/QH13 | 212 | pending_permission |
| Luật đất đai 2024.doc | 31/2024/QH15 | 260 | pending_permission |
| Luật đất đai sửa đổi 1998.doc | 10/1998/QH10 | 2 | pending_permission |
| Tiêu chí chấm điểm cho AI.docx | Chưa xác định / không phải luật | — | needs_review |
| VanBanGoc_31-2024-qh15_1 (2).pdf | 31/2024/QH15 | 90 | needs_review (quyền: allowed) |
| VanBanGoc_31-2024-qh15_2 (2).pdf | Chưa xác định / không phải luật | 80 | needs_review (quyền: allowed) |
| VanBanGoc_31-2024-qh15_3 (2).pdf | Chưa xác định / không phải luật | 90 | needs_review (quyền: allowed) |
| VanBanGoc_45.2013.QH13.pdf | 45/2013/QH13 | 212 | needs_review (quyền: allowed) |

Số hiệu/tên đọc được chưa thay thế xác minh. Manifest ghi metadata chưa rõ bằng null và cảnh báo; dãy điều trong văn bản sửa đổi/phụ lục có thể chứa điều được trích lại nên không tự tính là bản đầy đủ. Phần 2/3 PDF 2024 được ghép theo hồ sơ review, không suy số hiệu độc lập từ tên tệp. Tệp 44-L_CTN là Bộ luật Dân sự cũ theo metadata, không tự xếp vào Luật Đất đai chỉ vì đặt chung thư mục.

## Cơ chế đã thay đổi

Kho phục vụ mới: LegalCorpusVersion + LegalCorpusProvision. Fingerprint gắn byte nguồn, parser và hồ sơ duyệt; unit có chương/mục/điều/khoản/điểm, trang và tệp. Quyền nguồn tách khỏi xác minh nội dung; khoảng áp dụng theo từng điều nằm trong version_rules, có ngoại lệ/loại mốc/chuyển tiếp và bằng chứng. Bản hợp nhất không có hiệu lực độc lập. Quan hệ sửa đổi/bổ sung/thay thế/hướng dẫn phải có trích đoạn khớp nguồn.

Trợ lý tìm kho verified/allowed trước, rồi mới tra VBPL và nguồn ngoài được duyệt quyền. Chỉ đưa tối đa 5 đơn vị, tổng 8.000 ký tự vào một lượt. Chủ tọa, đối lập và bộ chấm chỉ dùng điều khoản đã xác minh áp dụng; phần luật thiếu căn cứ giữ not_assessed, không tính 0. Chế độ chấm web tham khảo trước đây không còn mở điểm luật mới; lịch sử cũ vẫn giữ nhãn.

Nguồn web chưa được duyệt không được đưa vào tìm kiếm native của model hoặc tải làm nguồn AI; danh sách quyền có thể mở rộng bằng LEGAL_WEB_USAGE_GRANTS kèm bằng chứng. Không sao chép lại Word bị cách ly từ trang khác. Không gửi tệp/đoạn Word cách ly vào API bên ngoài. Lệnh nhập cũ bị khóa ghi để tránh bỏ qua cổng quyền.

## Phần còn thiếu cho từng case

- Bản án 51/2024/DS-ST: hồ sơ có cấp giấy năm 1996, khởi kiện 18/07/2022, xét xử 29/03/2024. Cần bản Luật Đất đai thuộc giai đoạn cấp giấy (ưu tiên đời 1993 và lịch sử liên quan), đời 2013 cho những vấn đề có liên quan ở giai đoạn sau, Bộ luật Tố tụng dân sự và bản sửa đổi tương ứng. Cần xác định vấn đề nào là quyền sử dụng đất, giao dịch, thủ tục cấp giấy hay tố tụng trước khi chọn nghị định. Chưa xác minh đủ các nhóm này.
- Case1 phúc thẩm: chỉ biết ngày sơ thẩm được nhắc 07/08/2018; chưa biết đầy đủ ngày giao dịch/chia đất, cấp giấy và xét xử phúc thẩm. Không lấy ngày sơ thẩm thay ngày phúc thẩm. Cần xác định các mốc trước khi chọn Luật Đất đai/Bộ luật Dân sự tương ứng; nguồn tố tụng 2015 và sửa đổi cần đối chiếu. Những văn bản đang pending_permission chưa thể lấp khoảng trống này.
- Cho kho nhiều thời kỳ: còn thiếu đối chiếu đời 1987, 1993, sửa đổi 1998/những sửa đổi khác, 2003, các luật dân sự và tố tụng cũ/mới; Luật 43/2024/QH15 cùng lịch sử/chuyển tiếp cần kiểm tra riêng đối với bản gốc 2024. Danh sách nghị định đã tải chỉ là ứng viên, chưa kết luận mọi văn bản đều cần cho hai case.

## Kiểm thử và đo thời gian

Backend 73/73 qua, không skip, gồm DB kiểm thử riêng: thay thời kỳ, loại ngoại lệ/chuyển tiếp chưa duyệt, hợp nhất, xung đột phiên bản, quyền nguồn, số hiệu tên tệp sai, scan/trang ít chữ, tệp thiếu điều, trùng tệp, nguồn offline/403, idempotency và thu hồi. Frontend lint/build qua. Bốn ca Playwright Case1/fullFlow desktop/mobile báo ok, gồm trợ lý/chèn trích dẫn/tải lại và chấm không đủ nguồn; phần nguồn/model của browser là fixture, không phải xác minh web thật. Runner Windows vẫn treo teardown sau bốn ca nên dừng thủ công, không coi là CLI kết thúc sạch.

Đối chiếu trực tiếp 20 số hiệu với VBPL không trả nguồn đủ nội dung. Tìm web xác định được trang PDF Luật 2024 tại [VBPL](https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=177815), nhưng mở trực tiếp trả 403 trong lần kiểm tra; không dùng kết quả tìm kiếm làm nguyên văn đã xác minh. Các URL trong review là ứng viên đối chiếu, không phải link trích dẫn đã vượt kiểm tra.

Ba câu hỏi dưới đây đã chạy qua HTTP loopback dùng service/DB thật và tra VBPL thật, không gọi LLM, không ghi phiên. Cả ba trả HTTP 200 cùng thông báo chưa lấy được nội dung để đối chiếu, citations/sources rỗng. **Chưa thể cung cấp ba câu trả lời có điều khoản và link đã xác minh**; không thay bằng ví dụ giả lập.

| Câu hỏi thật | Tra nguồn trực tiếp trước (ms) | Tra kho mới (ms) | HTTP trả lời sau (ms) | Trích dẫn |
|---|---:|---:|---:|---:|
| Điều 202 Luật 45/2013/QH13 về hòa giải tranh chấp đất đai | 1024 | 5 | 403 | 0 |
| Điều 252 Luật 31/2024/QH15 về hiệu lực của Luật Đất đai | 247 | 3 | 464 | 0 |
| Điều 999 Luật 13/2003/QH11 về tranh chấp đất đai | 275 | 12 | 180 | 0 |

Đây là một lượt đo trên kho mới rỗng và nguồn ngoài không trả nội dung; không kết luận cải thiện tốc độ trả lời có luật, độ chính xác hoặc chất lượng LLM từ các số này.

## Vận hành và tệp mã

Hướng dẫn/schema/lệnh nhập, duyệt nguồn và thu hồi: [docs/LEGAL_CORPUS.md](../docs/LEGAL_CORPUS.md). Hồ sơ đã phê duyệt có điều kiện: [LEGAL_PDF_REVIEWS.json](LEGAL_PDF_REVIEWS.json). [Manifest đầy đủ](LEGAL_FILE_MANIFEST.json), [đối chiếu nguồn thật](LEGAL_OFFICIAL_SOURCE_AUDIT.json), [ba câu hỏi và thời gian](LEGAL_CORPUS_LIVE_QUERIES.json).

Mã mới: models/LegalCorpusVersion.js, models/LegalCorpusProvision.js; services/legalFileInventory.js, legalCorpusImport.js, legalCorpusRetrieval.js, legalUsagePolicy.js; scripts/inventoryLegalCorpus.js, auditCorpusSources.js, smokeLegalCorpus.js; data/legalFileDeclarations.json; tests/legalCorpus.test.js (đều dưới backend/src, riêng tests dưới backend/tests).

Mã nối luồng/sửa kiểm tra: legalTextParser.js, legalResearchService.js, legalAssistantService.js, legalImportService.js, vbplResearch.js, officialLegalSources.js, webLegalResearch.js, aiClient.js, simulationService.js, learnerPresentation.js; shared/legalSourcePolicy.mjs; frontend LegalBasis.jsx và case1.spec.js; backend webLaw.test.js, package.json/.env.example; tài liệu vận hành/nguồn.

Lệnh apply ban đầu bị auto-review từ chối vì hồ sơ chưa được phê duyệt cụ thể. Sau đó người dùng đã phê duyệt rõ; apply chạy thành công về mặt công cụ nhưng không nhập dữ liệu do hai nguồn không đạt kiểm tra. Không còn chờ phê duyệt nhập có điều kiện trong phạm vi hồ sơ này; phần còn thiếu là nguồn đối chiếu/URL tải thực tế và xác minh hiệu lực. Không công bố kho luật đầy đủ.
