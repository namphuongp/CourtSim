import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import LegalDocument from '../models/LegalDocument.js';
import LegalSourceCheck from '../models/LegalSourceCheck.js';
import { validateVersionReview } from '../services/legalVersionReview.js';

try {
  const path = process.argv[2];
  if (!path) throw new Error('Cách dùng: node src/scripts/reviewLegalVersion.js <manifest.json>');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  await connectDatabase();
  const document = await LegalDocument.findOne({ law_number: manifest.law_number, source_fingerprint: manifest.source_fingerprint });
  if (!document) throw new Error('Chưa nhập phiên bản tệp này.');
  const check = await LegalSourceCheck.findOne({ law_number: manifest.law_number }).lean();
  const rules = validateVersionReview(manifest, document, check?.snapshots ?? []);
  document.version_rules = rules;
  await document.save();
  console.log('Đã lưu phạm vi phiên bản được người quản trị đối chiếu. Không thay đổi nội dung luật.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await disconnectDatabase(); }
