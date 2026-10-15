import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { seedModels, seedDirectory } from './seedCatalog.js';
try {
  await connectDatabase();
  await mkdir(new URL('sources/', seedDirectory), { recursive: true });
  const manifest = { version: 1, exported_at: new Date().toISOString(), collections: {}, sources: [] };
  for (const Model of seedModels) {
    const name = Model.collection.collectionName;
    const documents = await Model.collection.find({}).sort({ _id: 1 }).toArray();
    const content = mongoose.mongo.BSON.EJSON.stringify(documents, { relaxed: false }) + '\n';
    await writeFile(new URL(`${name}.json`, seedDirectory), content);
    manifest.collections[name] = { count: documents.length, sha256: createHash('sha256').update(content).digest('hex') };
    if (name === 'legalcorpusversions') {
      for (const file of documents.flatMap(d => d.source_files || [])) {
        if (!file.archive_file || manifest.sources.some(s => s.file === file.archive_file)) continue;
        if (!/^[a-f0-9]{64}\.(pdf|docx?)$/.test(file.archive_file)) throw new Error('Tên bản lưu không hợp lệ.');
        const source = await readFile(new URL(`../../storage/legal-sources/${file.archive_file}`, import.meta.url));
        if (createHash('sha256').update(source).digest('hex') !== file.sha256) throw new Error('Bản lưu nguồn sai checksum.');
        await copyFile(new URL(`../../storage/legal-sources/${file.archive_file}`, import.meta.url), new URL(`sources/${file.archive_file}`, seedDirectory));
        manifest.sources.push({ file: file.archive_file, sha256: file.sha256 });
      }
    }
    console.log(`${name}: ${documents.length}`);
  }
  await writeFile(new URL('manifest.json', seedDirectory), JSON.stringify(manifest, null, 2) + '\n');
} catch (error) {
  console.error(`Xuất seed thất bại (${error.name}). Kiểm tra kết nối, bản lưu nguồn và quyền ghi.`);
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
