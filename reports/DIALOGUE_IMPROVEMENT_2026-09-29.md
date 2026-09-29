# Cải thiện hội thoại CourtSim — 29/09/2026

Đã triển khai trực tiếp; baseline là mã tại `1962955`. Không sửa dữ liệu phiên, rubric, model cấu hình hoặc đưa Case1 vào thư viện vụ án. Kết quả AI dưới đây lấy từ API thật; test ứng dụng dùng fixture được ghi riêng.

## Luồng và tệp sửa

```text
SimulationRoom → POST /dialogue → runConversation + khóa phiên
  → classifyDialogueInput → chooseSpeakingPlan (server)
  → dialogueContext + roleTask + turnTask → generateDebateTurn
  → getPersona (env override / AiPersonal) → aiClient → API model
  → schema/vai/nguồn/nội dung → sửa tối đa 1 lần
  → lưu từng record + cursor/revision → chờ Tiếp tục
  → SSE / SimulationRoom / CourtroomStage hiển thị nhân vật
```

| Tệp | Thay đổi |
|---|---|
| `backend/src/services/conversationPolicy.js` | Chọn lượt theo mục đích/người nói cuối đã lưu; giữ nhánh tương thích phiên cũ |
| `backend/src/services/debatePolicy.js` | Nhiệm vụ từng lượt, Chủ tọa không có độ dài tối thiểu, chặn mẫu mở đầu lặp/lộ chỉ dẫn/đối lập điều hành; lời nối đúng người tiếp theo |
| `backend/src/services/dialogueContext.js` | Gắn câu hỏi của cả hai vai với người đáp; nhận câu lặp; bớt bản sao lời mới nhất; cho phản biện thuần suy luận dùng nguồn lời người học; chặn số đo/số tiền mới |
| `backend/src/services/simulationService.js` | Ghép nhiệm vụ lượt, áp dụng kiểm tra số, đồng bộ giai đoạn khi tự chọn plan, hướng dẫn sửa nguồn |
| `backend/src/scripts/evaluateDialogue.js` | Thêm hai phiên năm lượt giữ trạng thái; mã thoát lỗi; chụp đầu vào để log không bị sửa khi nối transcript; hash đầu vào thực chạy |
| `backend/tests/conversation.integration.test.js` | Ma trận hai vai, câu ngắn/dài/mơ hồ/lặp/thiếu nguồn, bảo vệ nội dung và nhánh MongoDB mới |
| `frontend/src/components/courtroom/CourtroomStage.jsx`, `courtroom.css` | Nút ‹ / › trong ô hội thoại, số thứ tự, trạng thái đầu/cuối và đang xử lý, vùng bấm 44px |
| `frontend/src/pages/Home/User/SimulationRoom.jsx` | Duyệt lời đã lưu bằng trạng thái xem lại; trở về lời hiện tại không thay cursor server |
| `frontend/tests/fullFlow.spec.js` | Kiểm tra lùi/tiến, khóa biên, nhân vật/nội dung, trả lại Tiếp tục và không phát sinh gọi model |
| `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md` | Quy tắc, cách tái lập và giới hạn |

`SessionRoutes`, `conversationService`, `sessionStore`, `SimulationSession` được đọc/kiểm tra và giữ cơ chế hiện tại: request_id, khóa có token, ghi nguyên tử, revision, cursor và snapshot hồ sơ. Theo yêu cầu bổ sung, giao diện có ‹ / › để duyệt lời đã lưu; mỗi lời vẫn riêng, chỉ bấm Tiếp tục mới tạo lời kế tiếp. Không thêm hiệu ứng gõ chữ.

## Nguyên nhân và cách dùng Case1

Prompt cũ yêu cầu Chủ tọa “2–4 câu ngắn, thường 30–80 từ”, dễ làm dài cả lời chuyển. `roleTask` chưa có nhiệm vụ đủ cụ thể cho câu trả lời thủ tục, lời đối lập vừa chất vấn hoặc giới hạn người học vừa thừa nhận. Bộ chọn lượt phần lớn trả `opponent, judge`. Ngữ cảnh lặp toàn văn lời mới nhất trong `learner`, `current_issue` và lịch sử. Câu hỏi của bên đối lập chưa được gắn lời đáp như câu hỏi Chủ tọa.

Đã đọc XML nội dung `LawDoc/Case1.docx`. Các hành vi rút ra: mời đúng người, hỏi một điểm, xác định tài liệu đang được nói tới, ngắt lời dài bằng câu hỏi cụ thể, mời phía kia rồi quay lại người trình bày. Không sao chép lỗi phiên âm, danh tính, số đo, tình tiết, trình tự phúc thẩm hoặc kết luận từ bản ghi. Không dùng Case1 làm nguồn luật; bản ghi kết thúc giữa tranh luận nên không suy ra phần sau.

## Quy tắc chuyển lượt

| Trạng thái | Trước | Sau |
|---|---|---|
| Ý quá chung / thủ tục / chào hoặc nhiễu | Chủ tọa | Giữ nguyên; nhiệm vụ hỏi rõ/trả lời thủ tục riêng |
| Lập luận mở đầu, bảo vệ bị đơn | Chủ tọa → đối lập | Giữ nguyên |
| Lập luận mở đầu, bảo vệ nguyên đơn | Đối lập → Chủ tọa | Giữ nguyên |
| Trả lời câu hỏi làm rõ đã lưu | Thường đối lập → Chủ tọa | Đối lập → người học |
| Người học đáp sau lượt đối lập nói cuối | Thường đối lập → Chủ tọa | Chủ tọa thu hẹp → đối lập → người học |
| Tổng kết sau ít nhất một lượt | Chủ tọa | Giữ nguyên, không tuyên án |
| Phiên cũ thiếu last_purpose/last_speaker | Dựa vai/giai đoạn | Giữ nhánh cũ; không đổi plan đang chờ |

Đây là quy tắc điều hành bài tập, chưa được xác nhận là thứ tự tố tụng bắt buộc. Không giao cho model tự chọn thứ tự. Việc xác minh quy tắc pháp lý theo loại vụ án/cấp xét xử vẫn còn mở.

## Đo AI thật

Chủ tọa `gpt-5.6-terra`, đối lập `gpt-5.6-luna`, cùng cấu hình trước/sau. Dữ liệu gửi là hồ sơ mẫu công khai ẩn danh A/B và câu tổng hợp; không đọc hội thoại người dùng. Tra cứu luật được cố định không có nguồn, không phải phép đo chất lượng kho luật/vbpl.

| Bộ đo | Đầu vào có gọi AI | Lời AI | Số cuộc gọi gồm sửa | Lời dự phòng | Trung vị/cuộc gọi | P95/cuộc gọi |
|---|---:|---:|---:|---:|---:|---:|
| Trước | 18 | 32 | 35 | 1 | 2,265 giây | 3,369 giây |
| Sau, cùng đầu vào | 18 | 32 | 33 | 0 | 2,261 giây | 3,257 giây |
| Ca khó: hai phiên năm lượt | 10 | 15 | 17 | 0 | 2,016 giây | 3,293 giây |

Độ dài trung vị lời Chủ tọa: 44 → 32 từ phân cách bằng khoảng trắng. Độ trễ trung vị gần như không đổi, chưa có bằng chứng cải thiện tốc độ đáng kể. Ca sửa có thể lâu hơn: lượt có số điều chưa xác minh trong bộ khó mất khoảng 6,17–6,35 giây cho cả hai nhân vật và lần sửa. UI tạo từng lời sau Tiếp tục nên không tương đương tổng thời gian hai lời trong script. Chưa đo thời gian token đầu tiên và độ trễ người dùng thực trên mạng production.

Baseline có 4 lần từ chối: 3 lỗi focus/nguồn và 1 mã nội bộ; một lời phải dùng dự phòng. Bộ sau có 1 lỗi focus được sửa. Bộ khó cuối có 2 lần lặp số điều chưa xác minh, đều bị từ chối và sửa thành công. Các lượt sau sửa đều mang `generation_mode=model`; điều này không đồng nghĩa ngữ nghĩa hoàn hảo.

Trong lần thử trung gian phát hiện `retrievedLaw` lọt vào lời nói; đã bổ sung validator và test. Cũng phát hiện phản biện về nguồn luật bị ép chọn chứng cứ không liên quan; đã cho phép focus hồ sơ rỗng cho phản biện chỉ xét lời người học, vẫn kiểm tra mọi ID được chọn và citation pháp luật. Lượt làm rõ chứng cứ vẫn phải gắn nguồn khi có hồ sơ.

Transcript, raw output từng cuộc gọi, thời gian, mã từ chối và plan được giữ cục bộ:

- [Trước](../.test-artifacts/ai-eval/before.json), [sau](../.test-artifacts/ai-eval/after.json), [hai phiên năm lượt](../.test-artifacts/ai-eval/edge.json).
- [Các cặp nguyên văn](../.test-artifacts/ai-eval/pairs.md), [script đọc và kiểm tra lại](../.test-artifacts/summarize-dialogue.mjs).
- Log trung gian `after-first-pass.json`, `edge-first-pass.json`, `edge-second-pass.json` giúp đối chiếu lỗi đã sửa.

Lưu ý bằng chứng: script cũ giữ tham chiếu mảng đầu vào nên một số log nhiều lượt có thêm chính output vào cuối `input`. Đã sửa dùng `structuredClone`. Khi kiểm tra lại log cũ, chỉ bỏ hậu tố trùng chính xác output; giữ nguyên tệp gốc. Năm cặp dưới dùng tình huống độc lập nên không bị ảnh hưởng. `after.json` được đo trước lần bổ sung cuối về bộ chặn số/tên trường; toàn bộ lời đã chấp nhận được chạy lại qua validator cuối và đều qua. Bộ `edge.json` được gọi với các bộ chặn đó. Đây là các phép đo đơn lẻ, không phải đánh giá thống kê nhiều seed.

## Kiểm thử và phần chưa xác minh

- `npm test` với MongoDB kiểm thử riêng: **54/54**, không skip; log tại `.test-artifacts/dialogue-backend-tests.log`.
- Sau bổ sung chặn tên trường, chạy lại nhóm hội thoại: **8/8**; log tại `.test-artifacts/dialogue-focused-tests.log`.
- `npm run lint`, `npm run build`, `node scripts/check-source.mjs` (103 tệp), `git diff --check`: qua.
- Playwright: mobile full flow và hai bài trình bày điểm qua. Desktop full flow lần đầu timeout tại đăng nhập lại sau phần phiên; chạy lại riêng qua **54,1 giây**. Không sửa timeout hoặc mã đăng nhập để ép test qua. Tiến trình test đầu bị kẹt lúc kết thúc và đã dừng sau khi lấy bằng chứng; không báo toàn lệnh đầu thành công.
- Kiểm thử browser dùng API/Mongo thật nhưng email/model fixture: chứng minh lượt riêng, Tiếp tục, reload, retry, lịch sử và trạng thái chờ; không chứng minh chất lượng hội thoại thật. Lỗi 503 trong log browser là lỗi cố ý của fixture.
- Sau bổ sung ‹ / ›, cả **4 ca E2E** đều báo `ok`: full flow desktop **42,9 giây**, mobile **38,4 giây**, cùng hai ca hiển thị điểm. Kiểm tra điều hướng không tăng số cuộc gọi AI. Tiến trình lại kẹt lúc đóng sau khi cả bốn ca xong, đã dừng thủ công; vì vậy không khẳng định lệnh E2E thoát mã 0. Đã xem ảnh desktop/mobile, lint và build lại đều qua. Ảnh tại `.test-artifacts/dialogue-navigation-desktop.png` và `.test-artifacts/dialogue-navigation-mobile.png`.
- Bộ khó giữ trạng thái trong script, chưa phải phiên browser với model thật. Kho luật, mọi loại vụ án, vai trong hình sự, mất mạng thật và độ tự nhiên lâu dài ngoài số lượt đã đo chưa được xác minh.

Model vẫn có thể hỏi vòng quanh việc nối giấy chứng nhận với ranh giới khi người học đã thừa nhận thiếu thông tin; bên đối lập đôi lúc lấy yêu cầu chung của một bên để phản biện dù phát biểu mới chỉ giới hạn kết luận. Ở ca `mentioned`, cách dùng “bạn thực hiện” khi mời đối lập còn dễ nhầm người được nhắc. Bộ chặn cú pháp không giải quyết hết sự quy thuộc hoặc suy luận sai. Nhận diện lặp hiện chỉ so câu sau chuẩn hóa, không bắt mọi cách diễn đạt đồng nghĩa. Kiểm số chỉ áp dụng một số đơn vị số đo/số tiền; số xuất hiện trong lời người học vẫn chỉ là lời họ nói, không thành sự thật.

Hai hướng tiếp theo nếu cần độ chặt cao hơn: (1) đánh giá ngữ nghĩa offline trên bộ transcript được chuyên gia gán nhãn, không tăng độ trễ mỗi lượt; (2) thêm lượt kiểm định model riêng cho nội dung rủi ro, tăng chi phí và độ trễ nên cần đo trước. Chưa tự thêm model kiểm định vào đường xử lý hiện tại.

## Năm cặp trước/sau cùng ngữ cảnh

Đây là lời thật từ các lần gọi API, không phải ví dụ biên tập lại. Phần sau ngắn hơn nhưng vẫn có hạn chế đã nêu.

### short / plaintiff_lawyer / judge

Người học: Tôi không đồng ý.

Trước: Bạn nêu rõ bạn không đồng ý với yêu cầu hoặc quan điểm nào của Bên đối lập, và đề nghị Chủ tọa giải quyết vấn đề gì đối với diện tích 229,7 m² đang tranh chấp?

Sau: Bạn không đồng ý với yêu cầu hoặc lập luận cụ thể nào trong tranh chấp 229,7 m² đất?

### mentioned / defense_lawyer / judge

Người học: Bản án nhắc đến giấy chứng nhận nhưng bài tập chưa cung cấp toàn văn. Tôi chỉ dùng thông tin được bản án thuật lại để so sánh phạm vi yêu cầu, không coi mình đã kiểm tra bản gốc.

Trước: Chủ tọa ghi nhận giới hạn phạm vi trình bày của bạn đối với giấy chứng nhận được bản án thuật lại. Mời Bên đối lập trình bày ý kiến về giá trị của thông tin này đối với yêu cầu trả 229,7 m² đất.

Sau: Bên đối lập, hãy nêu quan điểm về việc thiếu toàn văn Giấy chứng nhận ảnh hưởng thế nào đến giá trị so sánh phạm vi yêu cầu mà bạn thực hiện.

### answered / defense_lawyer / judge

Người học: Tôi chỉ dựa vào nội dung được bản án thuật lại, chưa khẳng định đã xem bản gốc giấy chứng nhận.

Trước: Chủ tọa ghi nhận bạn chỉ dựa vào nội dung bản án thuật lại, không khẳng định đã xem bản gốc giấy chứng nhận. Mời Bên đối lập trình bày ý kiến về giá trị của nội dung được thuật lại này đối với yêu cầu của A.

Sau: Bên đối lập, mời trình bày ý kiến về hệ quả của việc lập luận chỉ dựa trên nội dung giấy chứng nhận được bản án thuật lại, chưa đối chiếu bản gốc.

### procedure / plaintiff_lawyer / judge

Người học: Xin hỏi Chủ tọa, tôi có thể dẫn tài liệu được bản án nhắc đến không?

Trước: Chủ tọa ghi nhận bạn có thể viện dẫn các tài liệu mà bản án đã nhắc đến. Tuy nhiên, bạn cần nêu rõ tài liệu nào được dùng và bạn dự kiến liên kết nội dung đã được thuật lại của tài liệu đó với yêu cầu trả 229,7 m² đất như thế nào.

Sau: Bạn có thể dẫn các tài liệu được bản án nhắc đến, nhưng cần trình bày đúng là nội dung bản án thuật lại và nêu rõ chúng liên hệ thế nào với yêu cầu của bạn.

### argument / plaintiff_lawyer / opponent

Người học: Việc sử dụng đất lâu dài không tự chứng minh quyền đối với toàn bộ diện tích tranh chấp. Cần đối chiếu ranh giới được ghi trong hồ sơ với phần đất hai bên đang yêu cầu.

Trước: Bên đối lập thừa nhận việc sử dụng lâu dài, tự nó, chưa đủ kết luận quyền đối với toàn bộ 229,7 m². Tuy nhiên, lập luận của bạn chưa chỉ ra tài liệu nào xác định phần đất đó nằm ngoài phạm vi giấy chứng nhận năm 1996. Hồ sơ hiện chỉ ghi nhận giấy chứng nhận được đề cập và tranh chấp 229,7 m²; chưa có bản gốc hoặc sơ đồ để đối chiếu ranh giới. Vì vậy, chưa thể suy ra yêu cầu của nguyên đơn đã được chứng minh chỉ từ yêu cầu đối chiếu này. Kính mời Chủ tọa.

Sau: Bên đối lập thừa nhận việc sử dụng lâu dài chưa đủ để xác định quyền đối với toàn bộ 229,7 m². Tuy nhiên, yêu cầu của bạn về đối chiếu ranh giới mới chỉ là phương pháp kiểm tra; hồ sơ hiện chỉ ghi nhận giấy chứng nhận được đề cập và thông tin cơ quan đăng ký đất đai, chưa có bản gốc hoặc sơ đồ đo đạc để xác định phần đất đó thực sự nằm trong phạm vi giấy chứng nhận. Vì vậy, mắt xích giữa giấy chứng nhận năm 1996 và toàn bộ diện tích đang tranh chấp vẫn chưa được làm rõ.

