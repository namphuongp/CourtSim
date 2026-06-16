import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// --- KẾT NỐI MONGODB ---
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🍃 MongoDB đã kết nối thành công qua Cloud!'))
    .catch((err) => console.error('❌ Lỗi kết nối MongoDB:', err));
} else {
  console.log('⚠️ Cảnh báo: Chưa tìm thấy chuỗi kết nối MONGO_URI trong file .env');
}

// --- API ---
app.get('/', (req, res) => {
  res.send('Server CourtSim đang chạy!');
});
app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy tại port: ${PORT}`);
});