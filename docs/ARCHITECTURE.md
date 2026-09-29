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
- Trạng thái hội thoại và vị trí đọc lưu server; preview streaming chưa phải bản ghi hoàn chỉnh. Reload không tự bỏ qua lời chưa đọc hoặc tạo lại lời đã lưu.
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
- `debatePolicy`: policy nguồn dùng chung, nhiệm vụ Chủ tọa/đối lập riêng. Bỏ cặp “nếu/thì” bắt buộc, bắt buộc đúng một dấu hỏi và persona cũ chèn thêm chỉ dẫn. `AiPersonal.system_prompt` giữ để tương thích dữ liệu nhưng không còn ghép vào request; cấu hình model/nhiệt độ theo vai vẫn dùng.
- Đầu ra: `role/purpose/issue/next_speaker/focus/citation_ids/content`; server giữ quyền chọn người nói. Mảng 1–3 mã luận điểm chỉ được chuẩn hóa khi từng mã có thật. Lỗi schema/nguồn/chất lượng sửa tối đa một lần rồi dùng lời nối ngắn `guided_continuation`. Lỗi mạng giữ lượt `failed` để thử lại, không giả thành thành công.
- Record lưu `generation_mode` (`model/control/guided_continuation`), thời gian/token/số lần thử/mã từ chối; lỗi gọi lưu trong trạng thái phiên. `AiUsage.success` chỉ phản ánh lần gọi nhà cung cấp, không phải chất lượng hội thoại. DTO người học không xuất metadata này.
- Streaming chỉ mở câu hoàn chỉnh đã nhận và qua validator. Vai theo nội dung, lặp ý bằng cách diễn đạt khác và sức thuyết phục vẫn cần con người kiểm tra; schema không chứng minh đúng ngữ nghĩa.
- Trợ lý không gọi model tạo luật: chủ đề rộng hỏi rõ trước, câu cụ thể chỉ dùng `vbplResearch`; không có nguồn thì trả gợi ý thu hẹp do server tạo, cả khi mở lại phản hồi cũ.

## Xác thực và phạm vi quyền

Cookie phiên ngẫu nhiên HttpOnly, SameSite=Lax; production dùng Secure và tiền tố `__Host-`. DB chỉ lưu hash token. Hạn tuyệt đối 7 ngày, hết hạn nhàn rỗi 30 phút. Quyền/trạng thái đọc lại từ DB, không tin role trong trình duyệt.

OTP có hạn 5 phút, tối đa 5 lần thử; gửi lại cách 60 giây. Google kiểm tra chữ ký, issuer/audience, nonce, state và PKCE; liên kết tài khoản không được ghi đè danh tính có sẵn. Mật khẩu mới tối thiểu 8 ký tự, có chữ hoa/số, tối đa 72 byte. Đổi/đặt lại mật khẩu thu hồi phiên cũ qua `auth_version`.

API ghi yêu cầu Origin trong allowlist và `X-CourtSim-Request: 1`. API phiên kiểm tra chủ sở hữu; `/api/v1/admin/*` yêu cầu admin. `/api/auth/account` chỉ quản lý tài khoản đang đăng nhập: hồ sơ, mật khẩu, Google và thiết bị.

Admin hiện có người dùng, phiên/biên bản, góp ý, thống kê và usage AI. Tạo vụ án có API admin, chưa có giao diện biên tập. Thanh toán, giọng nói, xuất PDF và tải hồ sơ riêng chưa triển khai; không suy ra chức năng từ các model dự kiến.
