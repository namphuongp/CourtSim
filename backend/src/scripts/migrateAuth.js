import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import { PendingRegistration, AuthSession, AuthRateBucket, OAuthAttempt } from '../models/AuthState.js';

const apply = process.argv.includes('--apply');
mongoose.set('autoIndex', false);
try {
  await connectDatabase();
  // Không tự gộp email trùng hoặc đánh dấu email cũ đã xác minh.
  const duplicates = await User.collection.aggregate([
    { $group: { _id: { $toLower: { $trim: { input: '$email' } } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $count: 'groups' },
  ]).toArray();
  if (duplicates.length) throw new Error('Có email trùng sau chuẩn hóa. Cần xử lý riêng trước khi chạy migration.');
  const legacy = await User.countDocuments({ email_verified: { $exists: false } });
  console.log({ mode: apply ? 'apply' : 'dry-run', legacyAccounts: legacy });
  if (apply) {
    // Tính lại phương thức từ thông tin đăng nhập thực, không suy ra quyền từ mảng cũ.
    await User.collection.updateMany({}, [{ $set: {
      auth_version: { $ifNull: ['$auth_version', 0] },
      auth_providers: { $concatArrays: [
        { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$password_hash', ''] } }, 0] }, ['password'], []] },
        { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$google_id', ''] } }, 0] }, ['google'], []] },
      ] },
    } }]);
    await User.collection.updateMany({}, [{ $set: { email: { $toLower: { $trim: { input: '$email' } } }, email_verified: { $ifNull: ['$email_verified', false] }, auth_providers: { $ifNull: ['$auth_providers', { $cond: [{ $ne: [{ $ifNull: ['$password_hash', null] }, null] }, ['password'], []] }] } } }]);
    await User.collection.updateMany({ google_id: null }, { $unset: { google_id: '' } });
    for (const model of [User, PendingRegistration, AuthSession, AuthRateBucket, OAuthAttempt]) await model.createIndexes();
    console.log('Đã bổ sung dữ liệu và index. Tài khoản cũ cần xác thực email khi đăng nhập.');
  }
} catch { console.error('Chưa hoàn thành migration auth. Kiểm tra dữ liệu email và kết nối MongoDB trước khi thử lại.'); process.exitCode = 1; }
finally { await disconnectDatabase(); }
