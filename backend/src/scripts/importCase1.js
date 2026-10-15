import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Case from '../models/Case.js';
import { case1Appeal } from '../data/case1Appeal.js';
import { validateCaseDetails } from '../services/caseEvidence.js';
import { validateCaseFacts } from '../services/caseKnowledge.js';
import { validatePracticeContext } from '../services/casePractice.js';
import { validateTimeline } from '../services/legalTimeline.js';

try {
  const source = await readFile(new URL('../../../LawDoc/Case1.docx', import.meta.url));
  if (createHash('sha256').update(source).digest('hex') !== 'd87346430a9edf5a0dca62656327af4b11fc21b2908c20157e90b5d054a11763') {
    throw new Error('Case1.docx đã thay đổi; cần đối chiếu lại bảng biên tập trước khi nhập.');
  }
  validateCaseDetails(case1Appeal);
  validateCaseFacts(case1Appeal);
  validatePracticeContext(case1Appeal.practice_context);
  validateTimeline(case1Appeal.timeline);
  await connectDatabase();
  // Chỉ cập nhật hồ sơ có đúng tiêu đề này, không reset dữ liệu hoặc phiên đã lưu.
  const item = await Case.findOneAndUpdate({ title: case1Appeal.title }, { $set: case1Appeal },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true });
  const saved = await Case.findById(item._id).lean();
  if (saved.evidence_inventory.length !== 14 || saved.practice_context.hearing_date !== null) throw new Error('Dữ liệu đọc lại chưa khớp hồ sơ biên tập.');
  console.log(JSON.stringify({ id: saved._id, title: saved.title, cards: saved.evidence_inventory.length, hearing_date: saved.practice_context.hearing_date }));
} catch (error) {
  console.error(error.name === 'MongoServerSelectionError' ? 'Không kết nối được cơ sở dữ liệu.' : error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
