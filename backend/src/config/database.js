import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5_000 });
  } catch (error) {
    if (env.MONGO_URI.startsWith('mongodb+srv://') && (error.code === 'ECONNREFUSED' || error.syscall === 'querySrv')) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5_000 });
    } else {
      throw error;
    }
  }
  console.log(`MongoDB đã kết nối: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
