# Sửa hành vi AI trong phiên tranh tụng

## Nguyên nhân

- commonContext buộc nói chưa xác minh luật khi legalAssessmentAvailable=false; makeTurnPrompt tiếp tục yêu cầu nêu giới hạn trong content khi citation_ids rỗng. Cả hai vai nhận cùng chỉ thị nên lặp cảnh báo.
- fact_analysis chỉ kiểm tra trích đoạn có trong hồ sơ, chưa đủ tách lời một bên khỏi sự kiện được ghi nhận. Nội dung thuật lại và tài liệu được cung cấp thiếu ngữ cảnh về mức độ chắc chắn.
- UI hiển thị bốn nhóm kiểm soát nội bộ dưới mỗi lời thoại; bộ lọc trước đó chưa đổi marker chứng cứ/trạng thái sang cách trình bày tự nhiên.
- Kiểm tra MongoDB local: Luật Đất đai 45/2013/QH13 đã có dữ liệu nhưng có 0 version_rules được duyệt. Đây là giới hạn của dữ liệu CourtSim, không phải kết luận bản án không có căn cứ pháp luật.

## Thay đổi

- Case.case_facts lưu phân loại có trích đoạn khớp văn bản hồ sơ: recorded_event, party_statement, unproven; kèm nguồn và bên trình bày. Cùng với supplied_documents và mentioned_documents hình thành năm nhóm nội dung. Nội dung tài liệu có sẵn không đồng nghĩa bản gốc đã được giám định. Ngữ cảnh cũ chưa phân loại không tự được nâng thành sự kiện chắc chắn.
- caseKnowledge xử lý snapshot cũ thận trọng; không sửa biên bản hoặc tình tiết cũ. Mẫu đất đai được bổ sung nhãn cho diện tích tranh chấp, yêu cầu A và lời B; không bổ sung chứng cứ hay kết quả xét xử.
- Bỏ yêu cầu đọc cảnh báo luật ở mọi lượt. AI được phân tích nội dung bản án, so sánh lời trình bày, nêu khả năng/hệ quả có điều kiện. Không thay đổi cổng kiểm tra điều luật: chỉ nguồn được xác minh đúng thời kỳ mới được viện dẫn.
- Phía đối lập phải bám luận điểm cụ thể và thông tin hồ sơ; Thẩm phán đọc cả lời vừa phản biện, phân biệt thống nhất/tranh chấp và hỏi đúng một câu tiếp theo. Không suy ra sự đồng ý từ im lặng.
- dialogue_focus lưu trích đoạn làm điểm bám và câu hỏi nội bộ. Kiểm tra trích đoạn đúng nguồn, câu hỏi trùng và cảnh báo lặp; yêu cầu sửa tối đa một lần mỗi vai. Nếu JSON/nguồn hợp lệ nhưng vẫn không đạt quy tắc đối thoại, dùng bước tiếp tục có điều kiện từ chính lời người học và hồ sơ, ghi generation_mode trong dữ liệu/log. Không dùng đường này để che lỗi mạng, trích dẫn giả hoặc phản hồi sai định dạng.
- Không xuất fact_analysis/dialogue_focus trong DTO biên bản/kết quả. Điểm và nhận xét rubric vẫn giữ. Tên chứng cứ thay mã trong lời thoại, kể cả lịch sử cũ; nội dung gốc và ID còn trong dữ liệu để đối chiếu.
- Chèn mới dùng nhãn tên tài liệu dễ đọc, gửi ID riêng và kiểm tra lại với đúng hồ sơ. API vẫn nhận marker cũ để tương thích. Chú thích nguồn nằm trong phần **Chi tiết chứng cứ**, không lặp dưới mỗi phản hồi.

## Ví dụ minh họa từ kiểm thử (không phải phản hồi cloud đã xác nhận)

Người học bảo vệ B: giấy chứng nhận năm 1996 chưa cho thấy toàn bộ 229,7 m² nằm trong ranh giới được cấp; cần xem xét việc gia đình B sử dụng lâu dài.

Trước: cả hai vai nhắc “Chưa có bản gốc chứng cứ; chưa xác minh được căn cứ pháp luật”, rồi yêu cầu bổ sung tài liệu.

Sau – bên đối lập: “Theo nội dung bản án, A viện dẫn giấy chứng nhận cấp năm 1996. Việc sử dụng lâu dài mà B trình bày chưa tự chứng minh quyền đối với phần đất tranh chấp. Nếu giấy chứng nhận bao gồm phần đất ấy, lập luận của A mạnh hơn; nếu không, A cần giải thích liên hệ giữa giấy chứng nhận và diện tích yêu cầu.”

Sau – Thẩm phán: “Chưa ghi nhận sự thống nhất về phạm vi giấy chứng nhận đối với 229,7 m². Bạn phân biệt phạm vi giấy chứng nhận với quá trình sử dụng đất khi bảo vệ B như thế nào?”

Lượt tiếp theo kiểm thử chuyển sang mâu thuẫn lời khai nhân chứng và một câu hỏi mới; không lặp cảnh báo thiếu bản gốc.

## Kiểm tra và giới hạn

Các kiểm thử mới kiểm tra: năm nhóm nguồn; không nâng lời B thành sự thật; hai lượt tranh luận 229,7 m² khi luật chưa duyệt; đối lập phản biện cụ thể; câu hỏi mới của Thẩm phán; sửa cảnh báo lặp; giới hạn số lần gọi; ID nguồn và dữ liệu nội bộ không lộ sau reload; nhãn chứng cứ mới vẫn kiểm tra ID đúng vụ án. Kiểm thử HTTP dùng MongoDB riêng và AI giả lập, không xóa dữ liệu ứng dụng.

Lần gọi cloud thật đã thử ngoài sandbox nhưng nhà cung cấp trả 429 sau các lần thử lại của client. Cần thử phiên thật khi hết giới hạn dịch vụ; chưa khẳng định đã kiểm định đầy đủ chất lượng ngôn ngữ của model. Bộ kiểm tra trích đoạn/câu trùng là ràng buộc có kiểm thử, không bảo đảm phát hiện mọi lặp ý hoặc sai suy luận. Phân loại hồ sơ mới cần người biên soạn đối chiếu nguồn; phần cũ không có nhãn chỉ dùng thận trọng. Dữ liệu luật vẫn cần duyệt phiên bản đúng mốc; thay đổi này không tự hợp thức hóa nguồn.

## Tệp chính

- backend/src/services/caseKnowledge.js, debatePolicy.js, simulationService.js, caseEvidence.js, learnerPresentation.js
- backend/src/models/Case.js, routes/CaseRoutes.js, routes/SessionRoutes.js, data/sampleLandCase.js
- shared/dialogueText.mjs, learnerText.mjs
- frontend/src/components/CaseDossier.jsx, pages/Home/User/SimulationRoom.jsx, SimulationResult.jsx, services/references.js
- backend/tests/debateBehavior.test.js, session.integration.test.js; frontend/tests/learning.spec.js

Cập nhật hồ sơ mẫu: `npm --prefix backend run sample:import`. Luồng đang học dùng prompt mới ngay; snapshot hồ sơ cũ vẫn được giữ. Không cần chạy seed toàn bộ.

Kết quả cuối: backend 33/33 bài đạt (gồm MongoDB thật); trình duyệt 22/22 bài đạt (20 bài hồi quy và 2 bài mới về biên bản cũ trên desktop/mobile); lint không lỗi/cảnh báo; build thành công; diff không lỗi khoảng trắng. Cloud AI thật còn bị giới hạn 429 như ghi trên.
