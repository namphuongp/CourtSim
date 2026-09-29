import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import SimulationSession from '../models/SimulationSession.js';
import AiUsage from '../models/AiUsage.js';
import AdminAudit from '../models/AdminAudit.js';
try {
  await connectDatabase();
  // Chỉ tạo chỉ mục khai báo; không xóa chỉ mục hoặc sửa dữ liệu hiện có.
  for (const model of [User, SimulationSession, AiUsage, AdminAudit]) await model.createIndexes();
  console.log('Đã tạo chỉ mục quản trị. Dữ liệu hiện có được giữ nguyên.');
} catch (error) {
  console.error('Không thể tạo chỉ mục quản trị:', { name: error.name, code: error.code });
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
