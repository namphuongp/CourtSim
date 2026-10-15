# Thanh toán SePay bằng polling

CourtSim xác minh thanh toán bằng cách **backend chủ động gọi API SePay**, không dùng IPN. Không cần `SEPAY_IPN_SECRET`, đăng ký IPN URL hay tunnel HTTPS khi phát triển local. Backend cần kết nối HTTPS ra Internet để gọi SePay. Merchant Secret Key chỉ được dùng trên backend.

Các gói: Pay-per-use (30.000 VND/1 lượt), Lite (99.000 VND/5 lượt), Pro (249.000 VND). Giá/quyền lợi do backend quyết định. Hỗ trợ `BANK_TRANSFER` và `NAPAS_BANK_TRANSFER`; chưa tích hợp thẻ, thanh toán định kỳ hay hoàn tiền tự động.

Tài liệu SePay: [Bắt đầu nhanh](https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau), [SDK Node.js](https://developer.sepay.vn/vi/cong-thanh-toan/sdk/nodejs), [Danh sách đơn](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/danh-sach-don-hang), [Chi tiết đơn](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang), [Basic Auth và môi trường](https://developer.sepay.vn/vi/cong-thanh-toan/API/tong-quan).

## Cần cung cấp thông tin gì?

1. Merchant ID và Secret Key trong mục **Cổng thanh toán** của SePay (không phải API token của dịch vụ biến động số dư).
2. Môi trường `sandbox` để thử hoặc `production` cho giao dịch thật.
3. Origin frontend để khách quay về, ví dụ `http://localhost:5173`. Origin này phải có trong `CLIENT_ORIGIN`.
4. Phương thức đã kích hoạt trên merchant: mặc định `BANK_TRANSFER`.

Điền trực tiếp vào `backend/.env`:

```dotenv
PAYMENT_PROVIDER=sepay_gateway
SEPAY_ENV=sandbox
SEPAY_MERCHANT_ID=<merchant-id-sandbox>
SEPAY_SECRET_KEY=<secret-key-sandbox>
SEPAY_PAYMENT_METHOD=BANK_TRANSFER
SEPAY_POLL_INTERVAL_MS=10000
CLIENT_ORIGIN=http://localhost:5173
PAYMENT_RETURN_ORIGIN=http://localhost:5173
```

Chạy `npm ci` trong backend để cài SDK, khởi động lại backend và frontend. Nếu `.env` cũ có `SEPAY_IPN_SECRET`, có thể xóa dòng đó; ứng dụng không đọc biến này. Endpoint IPN của tích hợp cổng thanh toán đã được bỏ. Khi chạy production, dùng Merchant ID/Secret Key Production, `SEPAY_ENV=production`, `NODE_ENV=production` và origin frontend HTTPS. Backend production từ chối checkout Sandbox.

`npm run dev` theo dõi cả `src` và `.env`, tự khởi động lại backend khi lưu cấu hình. Nếu terminal đang chạy bằng lệnh dev cũ, cần dừng và chạy lại `npm run dev` một lần để áp dụng chế độ này. Khi dùng `npm start` hoặc process manager trên server, khởi động lại dịch vụ sau mỗi lần sửa `.env`. Log khởi động cho biết môi trường SePay đã nạp hoặc mã cấu hình cần kiểm tra, không in Merchant ID/Secret Key.

## Luồng hoạt động

1. Khách chọn gói, bấm **Thanh toán qua SePay**. `POST /api/payments/create` lưu đơn pending và trả form đã ký bằng SDK. Giá/URL gửi từ trình duyệt không được sử dụng.
2. Trình duyệt POST form sang `https://pay-sandbox.sepay.vn/v1/checkout/init` hoặc `https://pay.sepay.vn/v1/checkout/init`, giữ nguyên thứ tự các trường đã ký.
3. Ba URL success/error/cancel đưa khách về `/checkout/<plan>?order=<ma-don>&payment=success|error|cancel`. Query callback chỉ dùng hiển thị, không tự cấp quyền hoặc hủy đơn.
4. Backend gọi `GET /v1/order/detail/<order_invoice_number>` bằng mã hóa đơn CourtSim, theo SDK Node.js chính thức và hành vi đã kiểm tra trên API Production. Mỗi lần poll chỉ gọi một API chi tiết, rồi đối chiếu invoice trả về. API dùng Basic Auth `merchant_id:secret_key`, tới `https://pgapi-sandbox.sepay.vn` hoặc `https://pgapi.sepay.vn` tùy môi trường. Không dùng URL API do trình duyệt cung cấp.
5. Chỉ cấp quyền khi API xác nhận đúng invoice, số tiền, VND và trạng thái `CAPTURED`. Nếu có lịch sử giao dịch, bắt buộc có `PAYMENT`/`APPROVED` đúng số tiền, tiền tệ, phương thức. API chuyển khoản thực tế có thể trả `CAPTURED` cùng `transactions: []`; trường hợp này dùng mã đơn SePay làm biên nhận đối soát và ghi rõ nguồn xác minh `captured_order`, không tự tạo chi tiết giao dịch. `CANCELLED` từ API mới hủy đơn; trạng thái đang chờ/không tìm thấy/lỗi mạng không được coi là đã trả tiền.
6. ID giao dịch được gắn môi trường/merchant và có unique index. Cộng lượt và ghi dấu đơn đã cấp quyền nằm trong cùng Mongo document. Poll lặp/đồng thời không cộng lại. Đơn đã claim `processing` được phục hồi từ chứng từ đã xác minh lưu trong DB: kiểm lại invoice/tiền/tệ/ID của chứng từ đó và hoàn tất cùng claim, không cần lấy lại lịch sử giao dịch từ SePay. Vì vậy việc SePay bổ sung hoặc bỏ mảng transactions ở lần trả lời sau không làm đổi identity của claim. Đơn còn pending/expired vẫn bắt buộc gọi API bằng cấu hình merchant tương ứng. Khi paid, frontend tải `/api/auth/me` để cập nhật gói.
7. Đơn lưu snapshot gói/quyền lợi/giá lúc tạo. Khi đã có mã đơn, màn checkout hiển thị theo đơn đã lưu dù URL đang chứa tên gói khác hoặc bảng giá hiện tại đã thay đổi.

## Tần suất và xử lý lỗi

- Backend mặc định tra mỗi đơn tối đa một lần/10 giây. `SEPAY_POLL_INTERVAL_MS` cho phép 5.000–300.000 ms. Khóa lease trong Mongo ngăn nhiều tab hoặc nhiều backend cùng gọi API cho một đơn; lease tự hết hạn sau 30 giây nếu process chết.
- Trang thanh toán đọc trạng thái mỗi 5 giây khi pending/processing, mỗi 30 giây khi expired và dừng khi paid/cancelled. `GET /api/payments/:paymentId/status` cũng kích hoạt tra cứu nếu đến hạn, chỉ sau khi xác minh chủ đơn. Reload/đăng nhập lại vẫn tìm được đơn bằng query `order`.
- Worker trong `backend/src/server.js` chạy độc lập với trình duyệt, lấy tối đa 10 đơn đến hạn mỗi đợt; tự kiểm tra tiếp sau khi khách đóng trang. Worker không tạo vòng chạy chồng nhau và dừng trước khi đóng Mongo. Khi gọi `createApp()` riêng trong test hoặc host khác, cần chủ động gọi `startPaymentPolling()` nếu muốn polling nền.
- Mỗi lần xác minh có timeout tổng 8 giây. Lỗi API/429 hoặc lỗi xử lý được lưu audit, giữ trạng thái hiện tại, giãn thời gian thử lại theo cấp số nhân tối đa 5 phút. Trang hiển thị chưa thể xác minh thay vì báo thanh toán thất bại. Không ghi khóa hay nội dung lỗi nhà cung cấp vào log/response.
- Hạn 15 phút chỉ là hạn tiếp tục checkout tại CourtSim. Đơn pending/expired vẫn được đối soát tự động trong vòng 24 giờ từ khi tạo; giao dịch đã thu tiền vẫn được cấp quyền. Các đơn này cũ hơn có thể kiểm tra bằng cách mở lại URL đơn hoặc bấm **Kiểm tra trạng thái**. Claim processing đã có chứng từ hợp lệ, gồm manual và webhook cũ, tiếp tục được worker phục hồi kể cả sau 24 giờ. Nếu đã chuyển tiền, kiểm tra trạng thái trước khi tạo/thanh toán đơn mới.
- `POST /api/payments/:orderCode/checkout` tiếp tục đúng đơn pending của chính tài khoản. Không tiếp tục đơn nếu môi trường, merchant hoặc phương thức đã đổi; đơn cũ cần dùng thông tin merchant tương ứng để đối soát. Chưa tích hợp tự động thu hồi quyền/hoàn tiền cho đơn đã paid.

Các prefix alias `/api/payment`, `/api/v1/checkout` có cùng kiểm tra phân quyền. API tạo/tiếp tục đơn vẫn cần đăng nhập, Origin hợp lệ và `X-CourtSim-Request: 1`. API trạng thái trả `verification.available=false` nếu lần xác minh gần nhất lỗi; không trả dữ liệu khách hàng/thẻ từ SePay.

Trong admin, đơn processing có nút **Hoàn tất cấp quyền** để thử phục hồi theo lịch polling. Xác nhận paid thủ công có thể gửi lại cho processing khi chứng từ lưu đủ điều kiện; không hủy claim đang xử lý hoặc ghi đè nguồn xác minh cũ. Webhook cũ gửi lại cùng chứng từ cũng hoàn tất claim còn dang dở. Payload thiếu/sai chứng từ không được cấp quyền tự động. Parser số tiền webhook chỉ nhận VND nguyên dương an toàn (chuỗi thập phân với `.0`/`.00` được chấp nhận), không làm tròn hay bỏ ký tự phân cách.

Sự kiện admin được lưu vào `admin_audit_outbox` cùng lần ghi chấp nhận xác nhận/hủy thủ công; yêu cầu đối soát được lưu trước khi thực hiện. Sự kiện được chuyển sang AdminAudit theo ID cố định. Nếu việc chuyển lỗi, thao tác đã commit vẫn trả kết quả thành công và worker/màn lịch sử admin sẽ ghi bù; gửi lại không nhân đôi sự kiện đó. Nhật ký xác nhận thủ công ghi nhận quyết định admin, còn trạng thái paid và PaymentAudit thể hiện việc cấp quyền đã hoàn tất. Cơ chế tương tự bảo vệ nhật ký khóa/mở người dùng.

Nếu dùng `deploy/nginx.conf.example`, CSP cho phép form đến đúng hai origin checkout SePay và ảnh VietQR qua HTTPS. Khi tự đặt CSP/CDN/reverse proxy, cần giữ allowlist này; frontend vẫn kiểm checkout URL cố định. Không cần nới `form-action` thành wildcard.

## Kiểm thử

- Backend: đặt `COURTSIM_TEST_MONGO_URI` trỏ Mongo thử nghiệm rồi chạy `npm test`.
- Frontend: `npm run test:e2e -- tests/payment.spec.js`, kiểm tra desktop và mobile. Form checkout, callback, polling API, cập nhật quyền lợi và reload đều được kiểm tra; transport SePay là fixture, CourtSim API/Mongo là thật.
- Mỗi ca tích hợp tạo DB riêng `courtsim_test_<uuid>`. Các test kiểm tra giá server, quyền sở hữu đơn, khóa polling, pending/404, sai tiền/tệ/phương thức, API lỗi/backoff, gửi trùng, ID dùng lại, phục hồi lỗi cấp quyền, hủy thật từ API và đối soát nền khi đóng trang.
- Trước khi dùng thật, thực hiện giao dịch Sandbox bằng merchant của bạn rồi đối chiếu trạng thái/API/quyền lợi. Test fixture không xác nhận tài khoản SePay thật đã hoạt động. Đảm bảo các index `sepay_transaction_id`, `order_code`, `transaction_id`, `UserUsageQuota.user_id` và index polling đã được tạo nếu tắt autoIndex.

Luồng QR trực tiếp cũ vẫn bật được bằng `PAYMENT_PROVIDER=sepay_bank_transfer`, dùng `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_ACCOUNT`, `PAYMENT_BANK_*` và `/api/payments/sepay/webhook`. Đây là tùy chọn cũ dùng webhook biến động số dư; cấu hình `sepay_gateway` ở trên chỉ dùng polling và không cần webhook/IPN.
