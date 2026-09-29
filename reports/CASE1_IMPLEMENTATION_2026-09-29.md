# Case1 — hồ sơ phúc thẩm có thể luyện tập

Ngày thực hiện: 29/09/2026. Hồ sơ đã nhập vào MongoDB CourtSim, ID `6abb6863841e796dc8881dc3`. Vào **Tạo phiên mới**, chọn **Phúc thẩm tranh chấp đất giữa ông Kiên và ông Xây — từ bản ghi phiên tòa**. Nhập lại cùng lệnh vẫn giữ một hồ sơ, không reset dữ liệu.

## Dữ kiện và giới hạn

Dùng mô tả thửa 70, tờ 04, 117 m²; phiên phúc thẩm TAND Hà Nội đối với sơ thẩm số 13 ngày 07/08/2018; lập trường chia miệng của Kiên, lời Xây được đọc lại về 200 đồng/3.000 viên gạch; nguồn biết của Nguyên, Huấn, Nga, Tám, Dụ/Luân; ý kiến cơ quan cấp giấy; yêu cầu bồi thường và nội dung sơ thẩm được công bố. Tất cả là nội dung trong bản chép, không xác nhận quyền hoặc tính hợp pháp của giao dịch/cấp giấy.

Ngày/số bản án phúc thẩm để chưa xác định. Giữ rõ bất nhất 58,5/58,2 m², 28.195.000/28.190.000 đồng, năm cấp/nhận/đổi giấy và chỗ phiên âm 200/200.000 đồng. Không dùng năm mất mẹ, năm xây nhà hoặc ngày lời khai không nhất quán làm tình tiết chuẩn; không suy đoán kết quả phúc thẩm hoặc bù phần tranh luận bị thiếu. Bảng đối chiếu từng đoạn, hash nguồn và quyết định biên tập: [CASE1_EDITORIAL.md](CASE1_EDITORIAL.md).

10 thẻ lời nói/phần đọc lại có nội dung xem được, người cung cấp, vị trí và phạm vi chứng minh; có nhãn chưa xác minh hoặc bất nhất. Bốn mục giấy chứng nhận/hồ sơ cấp giấy, hòa giải, bản án sơ thẩm gốc, định giá chỉ được nhắc, không kéo thả/chèn như tài liệu có sẵn. API cũng chặn mã trích của chúng. Kéo thả thẻ hợp lệ chèn nội dung biên tập kèm nguồn và giới hạn, không chỉ tên thẻ.

## Vai và phiên

- Bảo vệ phía ông Kiên (người kháng cáo).
- Đại diện bảo vệ lập trường phía ông Xây (mô phỏng). Xây vẫn vắng mặt; không nhập vai Xây trực tiếp trả lời.

Bắt đầu trình bày nội dung kháng cáo sau phần công bố tóm tắt sơ thẩm. Giữ một người nói mỗi lượt, nút Tiếp tục, nút < > duyệt lời đã lưu, snapshot, khóa phiên, request ID và giới hạn 20 lượt. Kết thúc bằng đánh giá kỹ năng, không tuyên án. Vai đúng được hiển thị ở thiết lập, phòng tòa, hồ sơ và lịch sử.

Chưa xác minh điều luật/hiệu lực cho các sự kiện của Case1 trên vbpl.vn. Không thêm điều luật hoặc URL suy đoán. Phần chấm độ chính xác pháp luật chưa đủ điều kiện, không bị tính 0; Trợ lý luật vẫn dùng quy tắc nguồn hiện có. Ngày 07/08/2018 chỉ là mốc sơ thẩm được thuật lại, không được tự nhận là ngày phúc thẩm.

## AI thật

Sau khi người dùng chấp thuận, đã gửi hồ sơ biên tập và phát biểu tổng hợp tới API OpenAI chính thức; không đọc phiên/tài khoản thật. Đã chạy hai vòng để rà soát và sửa chỉ dẫn vai. Vòng cuối: 2 vai × 3 lượt người học, 10 lời AI và 2 kết quả chấm; 13 lần gọi gồm một lần sửa đầu ra do chốt kiểm tra nguồn; không dùng phản hồi dự phòng. Judge/evaluator: gpt-5.6-terra; bên đối lập: gpt-5.6-luna.

Vòng đầu có câu phản biện dễ nghiêng sang phía người học khi họ thừa nhận điểm yếu. Đã gắn tên bên vào vai và yêu cầu xử lý sự thừa nhận theo lập trường đối lập. Vòng sau giữ giới hạn nguồn và vai rõ hơn; đôi lúc vẫn thiên về đánh giá chứng cứ tổng quát. Các guard là kiểm tra cấu trúc/nguồn và một số mẫu nguy cơ, không bảo đảm mọi diễn đạt AI đều đúng ngữ nghĩa.

Log cuối: `.test-artifacts/ai-eval/case1.json`; vòng đầu: `.test-artifacts/ai-eval/case1-first-pass.json`.

### Một số lượt thực tế (AI, không phải lời trong Case1)

**Người học bảo vệ Kiên**

**Chủ tọa:** Bên đối lập trình bày ý kiến về việc chênh lệch 58,5 m² và 58,2 m² ảnh hưởng thế nào đến phạm vi yêu cầu kháng cáo của phía ông Kiên.

**Bên đối lập:** Phía ông Xây thừa nhận bản ghi đang có hai con số 58,5 m² và 58,2 m², nên chưa thể coi một số là diện tích đã được xác nhận. Tuy nhiên, từ đó chưa suy ra rằng toàn bộ yêu cầu về đất của ông Kiên không thể xem xét; phần đọc lại sơ thẩm vẫn nêu một phạm vi và cách phân chia cụ thể, dù chính nội dung này cũng chỉ là nguồn thuật lại. Bạn cần chỉ rõ: với giới hạn số liệu đó, phía ông Kiên còn dựa vào thông tin nào để xác định phần đất cụ thể mà mình yêu cầu?

**Người học bảo vệ Kiên**

**Chủ tọa:** Bên đối lập trình bày ý kiến về việc lời kể gián tiếp của anh Nguyên và lời các chị Dụ, Luân về gánh gạch có thể liên kết ra sao với kết luận về nội dung thỏa thuận tiền, gạch và chuyển quyền sử dụng đất.

**Bên đối lập:** Phía ông Xây thừa nhận lời anh Nguyên là gián tiếp và việc chị Dụ, chị Luân tự nhận gánh gạch chưa tự chứng minh đã giao đủ hay có đổi đất. Nhưng các lời này vẫn có thể là những mắt xích hỗ trợ cho việc đã có giao nhận vật chất; điểm còn thiếu là liên hệ giữa giao nhận đó với nội dung thỏa thuận và quyền sử dụng đất. Vì vậy, việc chưa xác định được mục đích không đồng nghĩa có thể loại bỏ lập trường của ông Xây. Bạn cần làm rõ: phía ông Kiên dựa vào đâu để khẳng định giao gạch, nếu có, không liên quan đến thỏa thuận về phần đất?

**Người học bảo vệ phía Xây**

**Chủ tọa:** Bên đối lập trình bày ý kiến về hệ quả của việc chưa có giấy giao nhận đối với lập luận về thỏa thuận 200 đồng và 3.000 viên gạch.

**Bên đối lập:** Việc không có giấy giao nhận đúng là làm yếu khả năng xác nhận số tiền và số gạch đã giao. Tuy nhiên, phía ông Xây vẫn chưa chỉ ra được mối liên hệ giữa lời ông Xây được thuật lại với các lời kể về việc gánh gạch: chị Nga chỉ nói nhìn thấy gạch và nghe chuyện chuyển tiền, còn chị Dụ và chị Luân tự nhận gánh gạch nhưng chưa xác nhận nội dung đổi đất. Vì vậy, các lời kể này có thể hỗ trợ việc có gạch được chuyển, nhưng chưa đủ để suy ra đó là việc thanh toán để sử dụng toàn bộ thửa đất.

### Chấm điểm thực tế

- plaintiff_lawyer: 50/70 ở phần được đánh giá; điểm toàn bài null. Lập luận có trọng tâm về độ tin cậy và giới hạn chứng minh của lời khai, nhưng cần nối rõ hơn với yêu cầu kháng cáo cụ thể.
- defense_lawyer: 63/70 ở phần được đánh giá; điểm toàn bài null. Lập luận thận trọng, bám giới hạn chứng cứ; cần gắn rõ hơn từng thiếu sót chứng minh với hệ quả cho yêu cầu bảo vệ phía ông Xây.

## Tệp triển khai

- Dữ liệu/nhập: `backend/src/data/case1Appeal.js`, `backend/src/scripts/importCase1.js`, `backend/package.json`.
- Mô hình/API/nguồn: `Case.js`, `CaseRoutes.js`, `SessionRoutes.js`, `caseEvidence.js`, `learnerPresentation.js`.
- Phiên/AI: `casePractice.js`, `conversationPolicy.js`, `debatePolicy.js`, `dialogueContext.js`, `simulationService.js`, `legalResearchService.js`, `evaluateDialogue.js`.
- Giao diện dùng chung: `shared/casePresentation.mjs`, `CaseDossier.jsx`, `LearningOverview.jsx`, `SimulationSetup.jsx`, `SimulationRoom.jsx`, các service `simulation.js`, `courtroom.js`, `references.js`.
- Kiểm thử: `backend/tests/case1.test.js`, `backend/tests/helpers/browserHarness.mjs`, `frontend/tests/case1.spec.js`; tài liệu vận hành và bảng biên tập.

Các thay đổi có sẵn, nút duyệt < > và tệp Case1.docx được giữ nguyên; chưa tạo commit.

## Kiểm thử

- Backend với MongoDB kiểm thử riêng: 58/58 đạt, không bỏ qua. Log: `.test-artifacts/case1-backend-tests.log`.
- Kiểm thử nguồn Case1: 4/4 đạt, gồm dữ liệu/nhãn nguồn, hai vai, mẫu phát biểu sai và không chấm luật chưa xác minh.
- Frontend lint, build và `git diff --check`: đạt.
- Playwright Case1 trên desktop và mobile: đã đi qua chọn case/vai, xem thẻ, kéo thả bằng DataTransfer, giữ bản nháp sau reload, ba lượt đối đáp, kết thúc, chấm điểm, mở lịch sử và biên bản chỉ đọc. API/MongoDB thật trong cơ sở dữ liệu kiểm thử riêng; phản hồi AI giả lập. Fixture lặp câu cũng kích hoạt kiểm tra chất lượng và nhánh tiếp tục dự phòng.
- Đợt cuối `case1.spec.js fullFlow.spec.js`: cả 4 test desktop/mobile báo `ok`, gồm Case1 và luồng cũ (tài khoản, trợ lý, phiên, góp ý, điểm, đăng xuất). Các lỗi 503/502 được chủ động tạo trong fullFlow để kiểm tra khôi phục; không phải lỗi dịch vụ thật.
- Giới hạn môi trường: sau khi cả 4 test báo `ok`, tiến trình Playwright vẫn treo ở bước đóng môi trường Windows và đã được dừng bằng Ctrl+C. Vì vậy xác nhận từng test đạt, không tuyên bố lệnh Playwright kết thúc với exit code 0.
- Đã xem ảnh desktop/mobile, kiểm tra nhãn nguồn, vai, khả năng đọc và không tràn ngang: `.test-artifacts/case1-dossier-desktop.png`, `.test-artifacts/case1-dossier-mobile.png`.
- Kiểm thử AI thật cuối: 8 kịch bản (6 lượt và 2 lần chấm), 13 lần gọi, 10 lời AI, không lỗi cuối hoặc fallback. Một đầu ra phải tạo lại do mã nguồn trích chưa hợp lệ. Đây là kiểm thử dịch vụ AI nhiều lượt; việc lưu/reload/tiếp tục được kiểm tra riêng qua trình duyệt/API.

Lỗi trong quá trình kiểm thử đã xử lý: chờ nút Tiếp tục được bật thay vì chỉ xuất hiện; đi qua hộp góp ý trước khi đọc kết quả; giữ cổng AI fixture trong worker vì cấu hình backend được cache giữa các tệp. Không dùng lỗi bộ kiểm thử làm lý do sửa luồng sản phẩm.
