# CourtSim
1. Khởi tạo môi trường cài đặt ban đầu
Mở Terminal tại thư mục gốc của dự án CourtSim:
Đối với Backend:
cd backend
npm install
Đối với Frontend:
cd ../frontend
npm install
2. Cấu hình biến môi trường bảo mật
Tạo một file có tên là .env nằm trực tiếp trong thư mục /backend/ và điền cấu hình chuỗi kết nối đám mây MongoDB Atlas của bạn:

PORT=5000
MONGO_URI=mongodb://<username>:<password>@cluster0-shard-00-00.mongodb.net:27017...

3. Khởi động backend và frontend
Sử dụng lệnh: npm run dev