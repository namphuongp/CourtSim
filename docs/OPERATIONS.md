# Vận hành CourtSim

Lệnh cài đặt/chạy/test ở [README](../README.md); biến đầy đủ ở [backend/.env.example](../backend/.env.example). Không commit `.env`, khóa, log hội thoại hoặc bản sao DB.

## Cấu hình cần thiết

| Nhóm | Cấu hình |
|---|---|
| Runtime | Node 24 LTS hoặc 22.13+, MongoDB; `MONGO_URI`, `JWT_SECRET` ngẫu nhiên ≥32 ký tự |
| Domain | `NODE_ENV=production`, `CLIENT_ORIGIN=https://<domain>`, `VITE_API_URL=/api` khi build |
| Backend/proxy | `HOST=127.0.0.1`, `PORT=5000`; `TRUST_PROXY` chỉ IP/subnet proxy tin cậy |
| Email | `EMAIL_API_KEY`, `EMAIL_FROM`; xác minh domain gửi với Resend |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<domain>/api/auth/google/callback`; đăng ký URI chính xác trong OAuth client |
| AI | `OPENAI_API_KEY` hoặc `GEMINI_API_KEY`; nếu cùng có thì Gemini được ưu tiên. Endpoint tùy chỉnh cần `AI_BASE_URL` và khóa riêng `AI_API_KEY` |
| Vai AI | `AI_JUDGE_MODEL`, `AI_OPPONENT_MODEL`, `AI_EVALUATOR_MODEL`; đổi env rồi restart, không cần seed |
| Chi phí | Hạn mặc định 80 cuộc gọi/người/15 phút, 200/người/ngày, 2.000 toàn hệ thống/ngày; chỉnh các biến `AI_*_CALLS_*`. Tính cả retry, không phải hạn ngân sách tiền tuyệt đối |
| Luật | `LEGAL_ONLINE_LOOKUP=false` ngừng tải mới; bản lưu còn hạn vẫn dùng được. `LEGAL_WEB_REFERENCE_SCORING=false` tắt đường chấm tham khảo web. |

`AUTH_EMAIL_VERIFICATION_DISABLED` chỉ dùng development. `AI_MODEL_PRICING_JSON` cần đơn giá/version đã đối chiếu; thiếu giá thì báo chi phí chưa đầy đủ, không suy đoán. Hạn mức ứng dụng nên đi cùng giới hạn ngân sách tại nhà cung cấp.

## Chuẩn bị domain

1. Dùng cùng origin cho frontend và `/api`; HTTPS, certificate hợp lệ, MongoDB không công khai ra Internet.
2. Build với `VITE_API_URL=/api`; phục vụ `frontend/dist`, không dùng Vite dev server cho production.
3. Tham khảo [mẫu Nginx](../deploy/nginx.conf.example): thay domain/certificate/path; giữ SSE không buffering, timeout đủ cho chấm điểm, SPA fallback và security headers. Chạy `nginx -t` trước khi áp dụng trên máy chủ.
4. Chạy backend bằng tài khoản hệ thống riêng và process manager, chỉ nhận traffic sau khi DB sẵn sàng. Kiểm tra `GET /api/v1/health`.
5. Kiểm tra email thật, OAuth redirect/logout, cookie Secure, streaming, quyền truy cập chéo và một phiên hoàn chỉnh trên staging trước khi mở công khai.

Mẫu cấu hình chưa được triển khai hoặc kiểm chứng trên domain thật. Không bật `trust proxy=true` tùy tiện; xem [Express](https://expressjs.com/en/guide/behind-proxies/). SSE cần cấu hình phù hợp ở cả proxy/CDN; xem [Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Dữ liệu, migration và khôi phục

- Sao lưu DB bằng MongoDB Database Tools hoặc snapshot nhà cung cấp; mã hóa và hạn chế quyền đọc. Cất cấu hình kết nối ở nơi riêng, tránh mật khẩu trên command line/log.
- Thử khôi phục vào DB **khác** ở staging; kiểm tra số bản ghi, index, đăng nhập và phiên mẫu. Chưa có diễn tập restore production được xác nhận.
- Trong `backend`: `npm run auth:migrate` là dry-run; chỉ chạy `npm run auth:migrate -- --apply` sau backup và kiểm tra email trùng. Không tự gộp tài khoản hoặc đánh dấu email verified.
- `npm run admin:indexes` tạo index đã khai báo, không xóa dữ liệu. Nếu tắt autoIndex, cần tạo đủ index các model trước khi mở traffic, không chỉ index admin.
- `npm run seed` dành cho chuẩn bị dữ liệu, có thể cập nhật mật khẩu admin; không đưa vào startup/deploy. `npm run sample:import` chỉ cập nhật hồ sơ mẫu theo tiêu đề, không sửa tài khoản.
- Giữ `CourtRecord`/`TrialResult` cũ. Rollback code phải tương thích `SimulationSession` và `score=null`; không khôi phục đè DB đang có dữ liệu mới.

## Kiểm tra và giới hạn

CI: [.github/workflows/ci.yml](../.github/workflows/ci.yml). Giữ 7 nhóm backend và 2 bài trình duyệt desktop/mobile; dùng `npm test` trong backend và `npm run test:e2e` trong frontend. Mongo dùng DB `courtsim_test_<uuid>` riêng; thiếu URI thì các ca backend tích hợp bị skip. E2E email/model fixture không chứng minh dịch vụ thật hoạt động. Kết quả tạm ở `.test-artifacts/`, dọn bằng `npm run test:clean` trong frontend. JavaScript có lint/kiểm tra cú pháp, chưa có TypeScript typecheck.

Trong `backend`: `node src/scripts/smokeAi.js` dùng tình huống hư cấu, có phí; `npm run legal:smoke` kiểm tra vbpl trực tiếp, tạo `.test-artifacts/VBPL_LIVE_CHECK.json` khi được chạy. Các script benchmark gắn phiên/tài khoản cụ thể đã bỏ.

Đánh giá prompt: `node src/scripts/evaluateDialogue.js before` ở mã cũ, `after` ở mã mới; `review` chạy hai hội thoại ba lượt và câu hỏi đã trả lời, `long-before`/`long-after` đo bài dài. Chỉ hồ sơ mẫu công khai/câu tổng hợp được gửi đến OpenAI chính thức; đọc cấu hình persona, không đọc phiên người dùng. Có phí API. Kết quả ở `.test-artifacts/ai-eval`, gồm phản hồi thật, token, thời gian, mode và nguyên nhân sửa. Tra cứu luật được cố định ở trạng thái không có nguồn để so sánh công bằng; đây không phải kiểm tra vbpl trực tiếp. Giữ mã baseline trước sửa nếu muốn tái lập so sánh.

`node src/scripts/evaluateDialogue.js edge` chạy hai phiên năm lượt, giữ vai/giai đoạn/mục đích cuối giữa các lượt: thừa nhận thiếu chứng cứ, lặp lời, số điều chưa xác minh, phát biểu dài và tổng kết. Script trả mã thoát lỗi khi có lời gọi thất bại; `guided_continuation` vẫn phải đọc riêng trong report vì không phải chất lượng model đạt. `datasetHash` định danh bộ hồ sơ/đầu vào cơ sở; `evaluated_inputs_sha256` định danh các đầu vào thực sự đã chạy, gồm bộ edge. Không so tổng thời gian hai phiên khi số người nói khác nhau; dùng thời gian từng lần gọi và số lần sửa kèm transcript.

Chưa đủ điều kiện kết luận sẵn sàng production: bộ test rút gọn đã qua luồng OTP/đặt lại mật khẩu với API thật và email fixture, nhưng vbpl chưa trả nội dung đủ để xác minh trong lần kiểm tra trực tiếp, trình duyệt có lúc bị chặn; chưa xác nhận đủ email/OAuth trên domain thật. Giám sát lỗi, quota, thời gian AI, tỷ lệ dự phòng và gửi email; chưa có hàng đợi email bền vững hoặc kiểm toán bảo mật độc lập.
## Kho luật có kiểm soát nguồn và quyền sử dụng

Quy trình hiện tại: xem [LEGAL_CORPUS.md](LEGAL_CORPUS.md). Mô phỏng/trợ lý dùng kho tài liệu người dùng đã cho phép và web bổ sung không giới hạn tên miền, trong phạm vi pháp luật Việt Nam về tranh chấp đất đai. Chấm điểm luật vẫn kiểm tra thời điểm áp dụng riêng; kết quả lịch sử không tự tính lại. Sao lưu cả MongoDB và `backend/storage/legal-sources/`.

# Nhập hồ sơ Case1

Từ thư mục `backend`, chạy `npm run case1:import`. Script đối chiếu SHA-256 của `LawDoc/Case1.docx`, kiểm tra hồ sơ biên tập và upsert đúng tiêu đề; không chạy seed hoặc xóa dữ liệu. Phiên đã mở giữ snapshot riêng. Nội dung biên tập và metadata nguồn nằm trong `backend/src/data/case1Appeal.js`.

Hồ sơ là bài tập phúc thẩm từ bản chép lời chưa đầy đủ, hai vai bảo vệ lập trường. `practice_context` giữ ngày/số bản án phúc thẩm chưa xác định và trạng thái luật chưa xác minh. Mốc tham chiếu 07/08/2018 chỉ là ngày sơ thẩm được nhắc. 10 thẻ có nội dung lời nói/phần công bố có thể trích; 4 tài liệu gốc chỉ được nhắc không cho chèn như chứng cứ được cung cấp.

Kiểm thử nội bộ: `node --test tests/case1.test.js` trong backend; `npx playwright test case1.spec.js` trong frontend. Kiểm thử AI thật khi được phép gửi nội dung nguồn ra ngoài: `node src/scripts/evaluateDialogue.js case1` trong backend; kết quả riêng ở `.test-artifacts/ai-eval/case1.json`, không tạo phiên cho tài khoản thật.
