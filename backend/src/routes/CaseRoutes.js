import { Router } from 'express';
import Case from '../models/Case.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateTimeline } from '../services/legalTimeline.js';
import { learnerCase } from '../services/learnerPresentation.js';
import { validateCaseDetails } from '../services/caseEvidence.js';
import { validateCaseFacts } from '../services/caseKnowledge.js';
import { validatePracticeContext } from '../services/casePractice.js';

const router = Router();

router.get('/', asyncHandler(async (request, response) => {
  const query = request.query;
  if (Object.keys(query).some(key => !['page', 'limit', 'category'].includes(key))
    || ['page', 'limit'].some(key => query[key] !== undefined && (typeof query[key] !== 'string' || !/^[1-9]\d{0,4}$/.test(query[key])))
    || (query.category !== undefined && (typeof query.category !== 'string' || query.category.length > 80))) {
    throw new AppError('Bộ lọc danh sách vụ án không hợp lệ.');
  }
  const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 20, 1), 50);
  const filter = request.query.category ? { category: String(request.query.category).trim() } : {};
  const [items, total] = await Promise.all([
    Case.find(filter).select('title summary category created_at').sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Case.countDocuments(filter),
  ]);
  response.json({ data: items.map(learnerCase), pagination: { page, limit, total } });
}));

router.get('/:caseId', asyncHandler(async (request, response) => {
  const item = await Case.findById(request.params.caseId).lean();
  if (!item) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');
  response.json({ data: learnerCase(item) });
}));

router.post('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  const { title, summary, full_document: document, category } = request.body ?? {};
  if (![title, summary, document, category].every((value) => typeof value === 'string' && value.trim())) {
    throw new AppError('Vui lòng nhập tên vụ án, tóm tắt, nội dung hồ sơ và loại vụ án.');
  }
  if (title.length > 200 || summary.length > 4000 || document.length > 50000 || category.length > 80) {
    throw new AppError('Hồ sơ quá dài: tiêu đề tối đa 200, tóm tắt 4.000, nội dung 50.000 và loại vụ án 80 ký tự.');
  }
  const timeline = validateTimeline(request.body.timeline);
  if (timeline.some((event) => !document.includes(event.source_quote))) throw new AppError('Trích đoạn của mốc thời gian phải có trong nội dung hồ sơ.');
  const details = validateCaseDetails(request.body);
  const case_facts = validateCaseFacts(request.body);
  const practice_context = validatePracticeContext(request.body.practice_context);
  const item = await Case.create({ title: title.trim(), summary: summary.trim(), full_document: document.trim(), category: category.trim(), timeline, case_facts, ...details, practice_context });
  response.status(201).json({ data: learnerCase(item) });
}));

export default router;
