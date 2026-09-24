import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5_000 });
  console.log(`MongoDB đã kết nối: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
