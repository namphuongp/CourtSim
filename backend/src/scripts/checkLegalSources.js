import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import LegalSourceCheck from '../models/LegalSourceCheck.js';
import { inspectOfficialSources } from '../services/officialLegalSources.js';

try {
  const lawNumber = process.argv[2] ?? '45/2013/QH13';
  await connectDatabase();
  const result = { ...await inspectOfficialSources(lawNumber), checked_at: new Date() };
  await LegalSourceCheck.updateOne({ law_number: lawNumber }, { $set: result }, { upsert: true });
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ law_number: lawNumber, ...result }, null, 2));
  console.log(JSON.stringify({ status: result.status, message: result.message, snapshots: result.snapshots.map(({ url, sha256 }) => ({ url, sha256 })) }, null, 2));
} catch { console.error('Không đối chiếu được nguồn. Kiểm tra kết nối và thử lại; chưa thay đổi trạng thái xác minh luật.'); process.exitCode = 1; }
finally { await disconnectDatabase(); }
