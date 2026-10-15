import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import LegalCorpusVersion from '../models/LegalCorpusVersion.js';
import { containedPath, hash } from '../services/legalFileInventory.js';
import { legalArchiveRoot } from '../services/localLegalImport.js';

const router = Router();
router.get('/:fingerprint/files/:index', authenticate, asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{64}$/u.test(req.params.fingerprint) || !/^\d{1,2}$/u.test(req.params.index)) throw new AppError('Nguồn không hợp lệ.', 400);
  const document = await LegalCorpusVersion.findOne({ fingerprint: req.params.fingerprint, permission_status: 'allowed' }).lean();
  const file = document?.source_files[Number(req.params.index)];
  if (!file?.archive_file || !/^[a-f0-9]{64}\.(?:pdf|docx?|html?|txt)$/u.test(file.archive_file)) throw new AppError('Chưa có tệp nguồn.', 404);
  const path = await containedPath(legalArchiveRoot, file.archive_file);
  const bytes = await readFile(path);
  if (hash(bytes) !== file.sha256) throw new AppError('Tệp nguồn cần được kiểm tra lại.', 409);
  res.setHeader('Cache-Control', 'private, max-age=300');
  // Chỉ PDF được mở trực tiếp; HTML/Word luôn tải xuống, không chạy trên origin ứng dụng.
  if (extname(path) === '.pdf') res.type('application/pdf');
  else res.attachment(file.path.split(/[\\/]/u).at(-1)).type('application/octet-stream');
  res.send(bytes);
}));
export default router;
