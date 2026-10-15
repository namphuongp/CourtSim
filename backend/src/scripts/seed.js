import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';
import { seedModels, seedDirectory } from './seedCatalog.js';
const hash = content => createHash('sha256').update(content).digest('hex');
async function run() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@courtsim.local').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('SEED_ADMIN_EMAIL không hợp lệ.');
  if (password.length < 8 || Buffer.byteLength(password) > 72 || password.startsWith('replace-')) throw new Error('Đặt SEED_ADMIN_PASSWORD riêng: ít nhất 8 ký tự, tối đa 72 byte UTF-8.');
  const manifest = JSON.parse(await readFile(new URL('manifest.json', seedDirectory), 'utf8'));
  if (manifest.version !== 1) throw new Error('Phiên bản seed không hỗ trợ.');
  const datasets = [];
  // Kiểm tra toàn bộ gói trước khi ghi để tránh nhập dở vì file bị hỏng.
  for (const Model of seedModels) {
    const name = Model.collection.collectionName;
    const content = await readFile(new URL(`${name}.json`, seedDirectory), 'utf8');
    const entry = manifest.collections[name];
    if (!entry || hash(content) !== entry.sha256) throw new Error(`Seed sai checksum: ${name}`);
    const documents = mongoose.mongo.BSON.EJSON.parse(content);
    if (!Array.isArray(documents) || documents.length !== entry.count) throw new Error(`Seed sai số lượng: ${name}`);
    for (const document of documents) {
      if (!document._id) throw new Error(`Seed thiếu _id: ${name}`);
      await new Model(document).validate();
    }
    datasets.push({ Model, documents });
  }
  for (const source of manifest.sources) {
    if (!/^[a-f0-9]{64}\.(pdf|docx?)$/.test(source.file)) throw new Error('Tên bản lưu không hợp lệ.');
    if (hash(await readFile(new URL(`sources/${source.file}`, seedDirectory))) !== source.sha256) throw new Error(`Bản lưu sai checksum: ${source.file}`);
  }
  await connectDatabase();
  const existing = await User.findOne({ email });
  if (existing && existing.system_role !== 'admin') throw new Error('Email seed thuộc tài khoản thường; hãy dùng email khác.');
  // Khởi tạo cả collection/index vận hành trên database mới.
  for (const file of await readdir(new URL('../models/', import.meta.url))) {
    if (file.endsWith('.js')) await import(new URL(`../models/${file}`, import.meta.url));
  }
  for (const Model of Object.values(mongoose.models)) await Model.init();
  await mkdir(new URL('../../storage/legal-sources/', import.meta.url), { recursive: true });
  for (const source of manifest.sources) {
    await copyFile(new URL(`sources/${source.file}`, seedDirectory), new URL(`../../storage/legal-sources/${source.file}`, import.meta.url));
  }
  for (const { Model, documents } of datasets) {
    for (let offset = 0; offset < documents.length; offset += 500) {
      await Model.collection.bulkWrite(documents.slice(offset, offset + 500).map(document => ({
        updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true },
      })), { ordered: true });
    }
    console.log(`${Model.collection.collectionName}: ${documents.length} bản ghi seed (giữ bản đã có).`);
  }
  // Không đổi mật khẩu hoặc nâng quyền tài khoản đã tồn tại.
  if (!existing) await User.create({ email, username: 'CourtSim Admin', password_hash: await bcrypt.hash(password, 12),
    system_role: 'admin', subscription_type: 'pro', status: 'active', email_verified: true, auth_providers: ['password'] });
  console.log('Seed hoàn tất. Admin hiện có được giữ nguyên; không xóa dữ liệu.');
}
run().catch(error => {
  console.error(error.name === 'Error' ? error.message : `Seed thất bại (${error.name}). Kiểm tra MongoDB, schema và index.`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
