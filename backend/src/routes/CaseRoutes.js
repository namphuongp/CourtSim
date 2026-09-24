import { Router } from 'express';
import Case from '../models/Case.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (request, response) => {
  const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 20, 1), 50);
  const filter = request.query.category ? { category: String(request.query.category).trim() } : {};
  const [items, total] = await Promise.all([
    Case.find(filter).select('title summary category created_at').sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Case.countDocuments(filter),
  ]);
  response.json({ data: items, pagination: { page, limit, total } });
}));

router.get('/:caseId', asyncHandler(async (request, response) => {
  const item = await Case.findById(request.params.caseId).lean();
  if (!item) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');
  response.json({ data: item });
}));

router.post('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  const { title, summary, full_document: document, category } = request.body ?? {};
  if (![title, summary, document, category].every((value) => typeof value === 'string' && value.trim())) {
    throw new AppError('title, summary, full_document và category là bắt buộc.');
  }
  const item = await Case.create({ title: title.trim(), summary: summary.trim(), full_document: document.trim(), category: category.trim() });
  response.status(201).json({ data: item });
}));

export default router;
