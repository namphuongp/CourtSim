# Hồ sơ vụ án và trợ lý tra cứu

## Cách sử dụng

1. Chọn vụ án: đọc phần Giới thiệu vụ án, các bên/yêu cầu, mốc thời gian và tài liệu. Chọn vai để xem vai của mình trong hồ sơ.
2. Trong phiên, nút **Hồ sơ vụ án** mở panel; đóng bằng nút Đóng hoặc Escape. Khi đóng, hồ sơ không chiếm diện tích khung lập luận. Desktop kéo thả tài liệu vào ô viết; điện thoại/bàn phím dùng **Đưa vào lập luận**.
3. Nội dung chèn có `[Chứng cứ: Tên]` và trích yếu; ID đi riêng trong payload. Marker `[CC:ID]` cũ vẫn được nhận để tương thích. Người học sửa bài trước khi gửi; xóa marker cũng bỏ viện dẫn có cấu trúc. Không tự gửi bài khi chèn.
4. **Trợ lý tra cứu luật** có lịch sử riêng. Chỉ nguồn đủ điều kiện mới có nút **Đưa trích dẫn vào lập luận** (`[PL:ID]`). Nguồn thiếu xác minh được báo ngắn và không biến thành căn cứ chắc chắn. Tra cứu không tự gửi lượt, không chấm điểm.

## API và lưu trữ

- `Case.parties`: side/name/claims; `evidence_inventory`: id/name/summary/content/provided_by/date/availability/source_quote. Không biết bên cung cấp/ngày thì để trống. `provided` bắt buộc có nội dung thực sự trong hồ sơ. `mentioned_only` không phải bản gốc.
- ID tài liệu cũ được sinh ổn định theo ID hồ sơ/vị trí/tên; không tạo tài liệu mới. Phiên mới vẫn giữ snapshot hồ sơ. Thay đổi hồ sơ mẫu không tự viết lại snapshot của phiên đã tạo.
- API tạo vụ án của admin nhận các trường trên và kiểm tra kiểu, độ dài, ngày, trạng thái. ID do máy chủ chuẩn hóa, không nhận ID tùy ý từ payload tạo vụ án.
- `POST /api/v1/sessions/:id/messages` nhận thêm `evidence_ids`, `legal_reference_ids`. Máy chủ đối chiếu danh sách với marker trong nội dung, kiểm tra tài liệu thuộc snapshot và trích dẫn luật thuộc câu trả lời đã xác minh của cùng người/cùng phiên. Mã sai bị từ chối trước khi gọi AI. ID và căn cứ chuẩn được lưu cùng lượt nguyên tử; vẫn hỗ trợ bài viết cũ không có marker.
- `GET/POST /api/v1/sessions/:id/assistant`: đọc lịch sử hoặc hỏi với `{question, request_id}`. Collection `LegalAssistantExchange` độc lập với lượt và kết quả; chỉ chủ phiên truy cập. Unique index chống trùng cùng request; token/lease bảo vệ thử lại, câu hỏi thay đổi phải dùng ID mới. Tối đa 40 câu hỏi/phiên trong luồng thông thường. Reload khôi phục lịch sử và bản nháp, yêu cầu quá hạn hiện cho phép thử lại.
- Trợ lý dùng cấu hình model Thẩm phán hiện có, nhưng có prompt riêng, không dùng persona đối lập và không thao tác kết quả. Tra cứu dùng cùng bộ chọn phiên bản/mốc/sửa đổi/chuyển tiếp; dữ liệu thiếu đi qua nguồn chính thức được cho phép, có timeout/cache và kiểm tra trước khi duyệt. Tải được trang không đồng nghĩa đã xác minh luật.

## Ghi chú nội bộ và chấm điểm

Nguồn tiêu chí: `LawDoc/Tiêu chí chấm điểm cho AI.docx`. Giữ 6 nhóm, 23 mục, trọng số 15–20–20–20–15–10 và quy đổi /100 từ phần đủ điều kiện. Tài liệu đánh giá khả năng tìm, hiểu, áp dụng luật và liên kết chứng cứ; không quy định phạt/cộng điểm vì dùng trợ lý. Quyết định triển khai: chỉ đánh giá chất lượng nội dung người học chủ động gửi, không đánh giá số câu hỏi hoặc số lần chèn trích dẫn.

Loại khỏi DTO giao diện: source_note, reference_date_note, legal_scope_note, cảnh báo vận hành dài, file nguồn/fingerprint và thông tin cấu hình rubric. Trạng thái đề xuất/chờ chuyên gia của rubric vẫn giữ trong dữ liệu/tài liệu vận hành. Prompt yêu cầu AI không xuất ghi chú này; learnerPresentation và bộ lọc dùng chung bảo vệ cả dữ liệu cũ sau reload. Văn bản luật nguyên gốc và bài người học không bị viết lại. Bộ lọc văn bản nhận dạng các mẫu nội bộ đã biết, không thay thế kiểm định nội dung AI.

Cảnh báo liên quan người học vẫn đặt cạnh viện dẫn: **Cần kiểm tra hiệu lực của điều luật này**, kèm liên kết nguồn nếu có. Điểm và tỷ lệ trọng số thực sự được đánh giá vẫn hiển thị.

## Cập nhật dữ liệu và chạy kiểm tra

Từ `backend`, `npm run sample:import` chỉ cập nhật vụ án mẫu đất đai; không chạy lại seed toàn bộ hoặc thay mật khẩu admin. Mẫu có hai bên ẩn danh và bốn tài liệu chỉ được bản án đề cập, chưa có bản gốc. Những hồ sơ thiếu các trường mới hiện trạng thái chưa có thông tin, không suy diễn thêm chứng cứ.

Nhập/duyệt luật dùng `legal:import`, `legal:check`, `legal:review` theo `SCORING_AND_LEGAL_RESEARCH.md`. Trợ lý chỉ đưa căn cứ đã duyệt đúng phạm vi vào câu trả lời; các PDF đã nhập nhưng chưa duyệt phiên bản không đủ điều kiện này.

```powershell
# Từ thư mục dự án; test Mongo tạo/xóa DB kiểm thử riêng, không xóa DB ứng dụng.
$env:COURTSIM_TEST_MONGO_URI='mongodb://127.0.0.1:27017'
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

Kiểm thử bao gồm nguồn luật đã/chưa xác minh, mạng nguồn chính thức hỏng, ID chứng cứ sai vụ án, ghi chú cũ, API với MongoDB, kéo thả desktop, chèn bằng nút trên mobile, focus/Escape, draft/reload, câu hỏi không tăng lượt/điểm và hồi quy kết thúc phiên. AI trong kiểm thử được giả lập; chất lượng trả lời của dịch vụ AI thật cần kiểm tra riêng khi có nguồn đã duyệt và dịch vụ sẵn sàng.

## Kết quả kiểm tra lần triển khai này

- Backend: 28/28 bài đạt, không bỏ qua; gồm HTTP với MongoDB thật trên database kiểm thử riêng. Bốn bài kiểm thử hồ sơ/trợ lý được chạy lại sau khi bổ sung kiểm tra URL do AI đưa ra và đều đạt.
- Playwright: 20/20 bài đạt trên Edge desktop và viewport điện thoại; đã xem ảnh panel ở cả hai kích thước.
- Frontend lint: không lỗi/cảnh báo; build production thành công. `git diff --check` không có lỗi khoảng trắng.
- API local kiểm tra trực tiếp: mẫu đất đai trả hai bên, bốn tài liệu mentioned_only, không trả legal_scope_note.
- Chưa kiểm định chất lượng trả lời bằng cloud AI thật với căn cứ đã duyệt; kiểm thử AI dùng phản hồi giả lập có kiểm soát. Cần duyệt nguồn/phiên bản rồi thử một phiên học thật.

## Tệp chính đã thay đổi

- Dữ liệu/API: Case.js, CourtRecord.js, LegalAssistantExchange.js, sampleLandCase.js, CaseRoutes.js, SessionRoutes.js, sessionStore.js.
- Logic: caseEvidence.js, legalAssistantService.js, learnerPresentation.js, simulationService.js, shared/learnerText.mjs.
- Giao diện: CaseDossier.jsx, StudyPanel.jsx, LegalAssistant.jsx, LegalBasis.jsx, SimulationSetup.jsx, SimulationRoom.jsx, SimulationResult.jsx, api.js, references.js; bỏ CaseSource.jsx không còn sử dụng.
- Kiểm thử: dossierAssistant.test.js, session.integration.test.js, learning.spec.js. Tài liệu: README.md, SCORING_AND_LEGAL_RESEARCH.md và tài liệu này.
