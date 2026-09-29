import 'dotenv/config';
import mongoose from 'mongoose';
import { fetchOfficialPage, isOfficialUrl } from '../services/officialLegalSources.js';
import { parseVbplPage } from '../services/vbplResearch.js';
import VbplSnapshot from '../models/VbplSnapshot.js';

// URL phải được sao chép từ trang thật, không nhận địa chỉ từ model hoặc API người học.
const [url, number] = process.argv.slice(2);
try {
  if (!isOfficialUrl(url) || !/^\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30}$/iu.test(number ?? '')) throw new Error('Cần URL HTTPS thuộc vbpl.vn và số hiệu chính xác.');
  const page = await fetchOfficialPage(url);
  const snapshot = parseVbplPage(page, number);
  if (!snapshot) throw new Error('Trang nguồn không khớp hoặc chưa đọc được nội dung. Không lưu trạng thái đã xác minh.');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/courtsim');
  await VbplSnapshot.updateOne({ source_url: snapshot.source_url }, { $set: snapshot }, { upsert: true, runValidators: true });
  console.log(JSON.stringify({ law_number: snapshot.law_number, source_url: snapshot.source_url, checked_at: snapshot.checked_at, note: 'Đã đối chiếu trang nguồn; chưa kết luận phiên bản áp dụng.' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
