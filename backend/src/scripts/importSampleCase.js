import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Case from '../models/Case.js';
import { sampleLandCase } from '../data/sampleLandCase.js';

try {
  await connectDatabase();
  const item = await Case.findOneAndUpdate(
    { title: sampleLandCase.title }, { $set: sampleLandCase },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
  console.log(`Đã nhập hồ sơ mẫu: ${item.title} (${item._id})`);
} catch {
  console.error('Không nhập được hồ sơ mẫu. Kiểm tra kết nối cơ sở dữ liệu.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
