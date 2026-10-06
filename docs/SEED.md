# Khởi tạo database khi clone dự án

Yêu cầu: Node.js 22.13+ hoặc 24 LTS, MongoDB đang chạy.

```powershell
cd backend
npm ci
Copy-Item .env.example .env # Chỉ làm khi chưa có .env
```

Sửa `.env`: đặt `MONGO_URI`, `JWT_SECRET` ngẫu nhiên ít nhất 32 ký tự, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` riêng (8 ký tự trở lên, tối đa 72 byte). Không dùng giá trị `replace-...`.

```powershell
npm run seed
npm run dev
# Terminal khác, từ thư mục gốc:
cd frontend
npm ci
npm run dev
```

Truy cập http://localhost:5173, đăng nhập bằng admin đã cấu hình. Admin seed đã xác minh email. Người dùng mới vẫn tuân theo cấu hình OTP. Chức năng AI cần API key/model hợp lệ hoặc máy chủ AI local; seed không cung cấp secret hoặc thay thế dịch vụ AI/email.

## Dữ liệu trong Git

Gói `backend/src/data/seed/` gồm 2 vụ án đầy đủ, 3 vai AI, 4 tài liệu/9.203 điều khoản kho cũ, 24 phiên bản/28.477 điều khoản kho mới, 4 trạng thái kiểm tra nguồn và các bản lưu PDF/DOC/DOCX đang được kho mới tham chiếu. `manifest.json` lưu số lượng, thời điểm xuất và SHA-256 từng file. Giữ nguyên ObjectId, liên kết, ngày kiểm tra và trạng thái nguồn; seed không biến nguồn cũ thành nguồn vừa được xác minh.

Không chứa tài khoản thật, mật khẩu/hash, phiên đăng nhập, lịch sử tranh tụng, hội thoại trợ lý, thanh toán hoặc usage. Các collection vận hành và index được khởi tạo rỗng; chỉ tạo admin từ `.env` khi email chưa tồn tại.

Seed kiểm tra checksum và schema trước khi nhập, ghi theo lô 500 bản ghi. Chạy lại chỉ bổ sung `_id` còn thiếu, không ghi đè nội dung đã sửa hay đổi mật khẩu admin. Không xóa/reset database. Nếu database có dữ liệu nhập độc lập trùng khóa nghiệp vụ nhưng khác `_id`, MongoDB sẽ báo lỗi unique index: dùng database mới để khởi tạo, không xóa dữ liệu cũ để né lỗi. Lỗi giữa chừng có thể để lại phần đã nhập; có thể chạy lại sau khi xử lý nguyên nhân.

File nguồn được chép vào `backend/storage/legal-sources/` để API đọc file hoạt động. Không cần chạy lại trình nhập luật hoặc có thư mục LawDoc ngoài Git.

## Cập nhật gói seed

```powershell
cd backend
npm run seed:export
```

Lệnh chỉ đọc database cấu hình trong `.env`, xuất các collection nền được cho phép trong `seedCatalog.js` và file nguồn liên quan. Khi dữ liệu nền thay đổi, kiểm tra nội dung vụ án/prompt không chứa thông tin riêng tư hoặc secret trước khi commit toàn bộ gói cùng manifest. Không xuất collection người dùng. Nên xuất khi không có tác vụ nhập/sửa kho luật để dữ liệu liên kết nhất quán.
