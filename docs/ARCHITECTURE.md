# Kiến trúc và luồng dữ liệu

Cài đặt và kiểm thử: [README](../README.md). Cấu hình, migration và triển khai: [Vận hành](OPERATIONS.md).

## Cấu trúc

| Thư mục | Trách nhiệm |
|---|---|
| `frontend/src/pages`, `components` | Trang theo route, phòng xử án, hồ sơ, trợ lý, kết quả và admin |
| `frontend/src/services` | API, xác thực, streaming, bản nháp và định dạng viện dẫn |
| `backend/src/routes`, `middlewares` | API, kiểm tra đầu vào, quyền sở hữu, phân quyền và hạn mức |
| `backend/src/services`, `models` | Nghiệp vụ, AI, nguồn luật, tài khoản và MongoDB |
| `backend/src/data`, `scripts` | Rubric, dữ liệu mẫu, nhập liệu và migration |
| `shared` | Chính sách nguồn, trình bày điểm và xử lý văn bản/SSE dùng chung |
| `LawDoc` | Tệp luật để nhập/đối chiếu và tài liệu rubric; không mặc nhiên là nguồn đã xác minh |
| `.test-artifacts` | Kết quả kiểm thử cục bộ, không đưa vào Git |

## Dữ liệu lưu ở đâu?

| Dữ liệu | Nơi lưu |
|---|---|
| Tài khoản, quyền, phương thức đăng nhập | `User` |
| Phiên đăng nhập, OTP, OAuth, hạn mức | `AuthSession`, `PendingRegistration`, `OAuthAttempt`, `AuthRateBucket` |
| Hồ sơ và chứng cứ | `Case`; mỗi phiên giữ `case_snapshot` |
| Lời thoại, cursor, khóa xử lý, điểm, góp ý | `SimulationSession` |
| Biên bản/kết quả trước khi chuyển schema | `CourtRecord`, `TrialResult`; API vẫn đọc, không xóa |
| Câu hỏi trợ lý | `LegalAssistantExchange`, gắn tài khoản và phiên |
| Kho luật và xuất xứ | `LegalDocument`, `LegalProvision`, `VbplSnapshot`, `LegalSourceCheck` |
| Lượt gọi AI, token/chi phí, thao tác quản trị | `AiUsage`, `AdminAudit` |

## Luồng phiên học

Chọn hồ sơ/vai/ngày → tạo phiên → đọc lời thoại → gửi lập luận → nhận từng lời AI → **Tiếp tục** → kết thúc → chấm điểm → góp ý tùy chọn → xem kết quả/lịch sử.

- Backend chọn người nói theo giai đoạn, vai người học và nội dung; đây là điều hành mô phỏng phục vụ luyện tập, không phải trình tự pháp lý bắt buộc.
- Sau lượt Chủ tọa hỏi rõ (`clarify_claim`/`clarify_evidence`), câu đáp có nội dung chuyển cho bên đối lập rồi trả thẳng người học. Sau một lượt kết thúc bằng bên đối lập, Chủ tọa thu hẹp tranh điểm và mời bên kia. Câu hỏi thủ tục, ý quá chung và tổng kết có ưu tiên riêng. Phiên cũ thiếu metadata vẫn dùng quy tắc vai/giai đoạn trước đó; không viết lại plan đang chờ.
- Trạng thái hội thoại và vị trí đọc lưu server; preview streaming chưa phải bản ghi hoàn chỉnh. Reload không tự bỏ qua lời chưa đọc hoặc tạo lại lời đã lưu.
- Nút ‹ / › trong ô hội thoại chỉ duyệt các lời đã lưu; khóa ở đầu/cuối và khi xử lý. Xem lại không đổi cursor hoặc sinh lời mới. Trở về lời hiện tại để tiếp tục; reload khôi phục lượt chờ trên server.
- `request_id` ổn định khi thử lại, revision/số lượt chống ghi từ tab cũ. Khóa Mongo có token và hạn 10 phút; tác vụ hết hạn không được ghi đè tác vụ mới. Mỗi phiên tối đa 20 lượt người học.
- Bản nháp ở `sessionStorage` theo tài khoản/phiên: qua reload cùng tab, chưa đồng bộ nhiều thiết bị.
- Chứng cứ có bản gốc, lời khai và tài liệu chỉ được bản án nhắc đến phải giữ nhãn riêng. Hỏi trợ lý không tự gửi lập luận hoặc đổi điểm.
- Hoàn tất lưu kết quả cùng trạng thái phiên; mở lại chỉ đọc. Góp ý chỉ mời một lần, có thể bỏ qua; lỗi góp ý không được chặn kết quả.

## Prompt và phản hồi AI

```text
Ý kiến → phân loại → chọn vai/giai đoạn
  ├─ chào/nhiễu rõ ràng → Chủ tọa mời trình bày (không gọi model)
  └─ nội dung/thủ tục → ngữ cảnh có nguồn → policy chung + nhiệm vụ vai
       → model → kiểm schema/vai/nguồn/độ dài/lặp → lưu → chờ Tiếp tục
Chấm điểm → lời người học + ngữ cảnh → rubric/quote_id → tính điểm server
Trợ lý → hỏi rõ chủ đề rộng hoặc tra vbpl.vn → nguồn đối chiếu → liên kết
```

- `dialogueInput`, `conversationPolicy`: phân loại thận trọng, không dùng ngưỡng 10 ký tự. Ý kiến ngắn có nghĩa được hỏi rõ; không dựng phản biện cho `abc`. Không bảo đảm nhận diện mọi chuỗi vô nghĩa.
- `dialogueContext`: tối đa 28 trích đoạn/12.000 ký tự hồ sơ, giữ nhãn nguồn/ID chứng cứ; 6 lượt gần nhất, tối đa 12 lượt cũ lấy hai câu đầu trọn vẹn và vai. Đây là rút trích câu, chưa phải tóm tắt ngữ nghĩa bằng model. Câu hỏi gắn lời đáp; `reply_received` không có nghĩa vấn đề đã giải quyết. Không tự suy ra sự thống nhất.
- Câu hỏi gắn với người được mời đáp. `hearingState` dựng trạng thái từ snapshot và biên bản, không cho model ghi đè: phe, danh mục chứng cứ/đã viện dẫn, câu hỏi chờ và tranh điểm ổn định. Sau ba lượt người học ở cùng tranh điểm mà không viện dẫn nguồn mới, Chủ tọa chuyển sang tranh điểm ít được trao đổi hơn; tranh điểm cũ vẫn unresolved. `conversation.hearing_state` lưu cùng lời thoại trong một lần ghi có khóa để khôi phục sau reload.
- `debatePolicy`: policy nguồn dùng chung, nhiệm vụ Chủ tọa/đối lập riêng. Không ép phải đặt câu hỏi hoặc dùng giả thiết; nếu dùng giả thiết về tình tiết chưa rõ phải nói cả nhánh ngược lại. `AiPersonal.system_prompt` giữ để tương thích dữ liệu nhưng không ghép vào request; cấu hình model/nhiệt độ theo vai vẫn dùng.
- `turnTask` bổ sung nhiệm vụ theo người được mời, lời đối lập vừa đáp, câu hỏi đã trả lời, ý lặp, câu dài và giới hạn tài liệu. Chủ tọa không có số câu tối thiểu. Case1 chỉ được dùng rút hành vi điều hành, không được đưa vào ngữ cảnh runtime, nguồn luật hoặc thư viện vụ án.
- Đầu ra: `role/purpose/issue/next_speaker/focus/citation_ids/content`; khi bên đối lập được hỏi tài liệu cụ thể, thêm `answer` với question_id/status/evidence_ids/direct_answer. Lời nói phải bắt đầu bằng câu trả lời trực tiếp; tên/mã nguồn và focus phải khớp. Server giữ quyền chọn người nói, thêm Chủ tọa nếu đối đáp né câu hỏi hoặc tranh điểm cạn. Lỗi schema/nguồn/chất lượng sửa tối đa một lần rồi dùng `guided_continuation`; lỗi mạng giữ lượt failed để thử lại.
- Phản biện thuần suy luận có thể không gắn hồ sơ. `hearingValidation` chặn các mẫu suy diễn từ lời chưa nói/thiếu chứng minh, vắng tài liệu vô căn cứ, số hiệu/ngày mới và viện dẫn loại tài liệu không có nguồn. Số đo từ lời người học phải có quy thuộc, số từ luật phải có ngữ cảnh quy định; không dùng chúng làm dữ kiện vụ án. Kiểm tra từ khóa và độ trùng từ ở sáu lời gần nhất là hàng rào bổ sung, chưa phải chứng minh ngữ nghĩa đúng.
- Record lưu `generation_mode` (`model/control/role_correction/guided_continuation`), mã chứng cứ, câu trả lời có cấu trúc và metrics. `user_court_role` immutable tại schema, API không có thao tác đổi vai. Tự xưng trái vai bị `roleMismatch` nhận diện thì server sinh lời Chủ tọa nhắc vai, không gọi model. DTO người học không xuất state/metadata nội bộ.
- Streaming chỉ mở câu hoàn chỉnh đã nhận và qua validator. Vai theo nội dung, lặp ý bằng cách diễn đạt khác và sức thuyết phục vẫn cần con người kiểm tra; schema không chứng minh đúng ngữ nghĩa.
- Trợ lý và legal retrieval dùng kho luật được phép, VBPL và web bổ sung theo cấu hình. Kho luật chỉ là nguồn quy định; case context chỉ lấy snapshot của phiên, không lấy tình tiết từ nguồn web hay vụ án khác.

### Chứng cứ và giới hạn điều hành

Danh mục truyền vào prompt có ID, tên, ngày, nguồn, phạm vi chứng minh và trạng thái; nội dung được chọn qua `dossier` tối đa 28 đoạn/12.000 ký tự. `available_presented`/`available_not_presented` dành cho bản có nội dung; `mentioned_only` giữ `not_determined` dù tên đã được viện dẫn. Trạng thái đã viện dẫn dựa trên ID hợp lệ, source anchors hoặc dấu/tên viện dẫn rõ trong biên bản, không dựa vào việc chỉ nhắc tên trong câu hỏi. `evidence_absences` chỉ được ghi từ hồ sơ có trích đoạn xác nhận vắng, phạm vi giới hạn ở hồ sơ đó.

Không tự đặt resolved/agreed/undisputed từ lời các bên. Lời học viên nằm ở learner/party argument; facts có nhãn và trích nguồn riêng. Catalog tranh điểm đất đai dùng chủ đề có trong hồ sơ và trách nhiệm chứng minh, chưa phải phân loại ngữ nghĩa tổng quát. Mẫu tự xưng, nhận diện né câu hỏi, số liệu và lặp chưa bao phủ mọi cách diễn đạt; xác thực ID/quote không bảo đảm suy luận từ chứng cứ là đúng.

Kiểm thử: `backend/tests/hearingState.test.js` có 8 nhóm hồi quy theo yêu cầu; `conversation.integration.test.js` kiểm tra immutable role, state qua MongoDB và chèn lượt Chủ tọa. `node src/scripts/evaluateHearing.js --live [missing-evidence|provided-evidence|stalled-issue]` chạy AI thật với dữ liệu hư cấu cố định (có phí), không đọc phiên/người dùng. Báo cáo cục bộ ở `.test-artifacts/hearing-live*.json`.

## Xác thực và phạm vi quyền

Cookie phiên ngẫu nhiên HttpOnly, SameSite=Lax; production dùng Secure và tiền tố `__Host-`. DB chỉ lưu hash token. Hạn tuyệt đối 7 ngày, hết hạn nhàn rỗi 30 phút. Quyền/trạng thái đọc lại từ DB, không tin role trong trình duyệt.

OTP có hạn 5 phút, tối đa 5 lần thử; gửi lại cách 60 giây. Google kiểm tra chữ ký, issuer/audience, nonce, state và PKCE; liên kết tài khoản không được ghi đè danh tính có sẵn. Mật khẩu mới tối thiểu 8 ký tự, có chữ hoa/số, tối đa 72 byte. Đổi/đặt lại mật khẩu thu hồi phiên cũ qua `auth_version`.

API ghi yêu cầu Origin trong allowlist và `X-CourtSim-Request: 1`. API phiên kiểm tra chủ sở hữu; `/api/v1/admin/*` yêu cầu admin. `/api/auth/account` chỉ quản lý tài khoản đang đăng nhập: hồ sơ, mật khẩu, Google và thiết bị.

Admin hiện có người dùng, phiên/biên bản, góp ý, thống kê và usage AI. Tạo vụ án có API admin, chưa có giao diện biên tập. Thanh toán, giọng nói, xuất PDF và tải hồ sơ riêng chưa triển khai; không suy ra chức năng từ các model dự kiến.
