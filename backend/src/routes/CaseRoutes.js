import mongoose from 'mongoose';
import { Router } from 'express';
import Case from '../models/Case.js';
import SimulationSession from '../models/SimulationSession.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateTimeline } from '../services/legalTimeline.js';
import { learnerCase } from '../services/learnerPresentation.js';
import { validateCaseDetails } from '../services/caseEvidence.js';
import { validateCaseFacts } from '../services/caseKnowledge.js';
import { validatePracticeContext } from '../services/casePractice.js';
import { extractAndStructureUserCase } from '../services/userCaseUploadService.js';

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

router.post('/upload-parse', authenticate, asyncHandler(async (request, response) => {
  await consumeAuthLimit(`case-upload:${request.auth.userId}`, 20, 15 * 60000, 'Bạn đã tải lên quá nhiều bản án trong thời gian ngắn. Vui lòng thử lại sau ít phút.');
  const {
    raw_text: rawText,
    file_name: fileName,
    file_base64: fileBase64,
    title: titleHint,
    category: categoryHint,
    reference_date: referenceDateHint,
    save = true,
  } = request.body ?? {};

  const structured = await extractAndStructureUserCase({
    rawText,
    fileName,
    fileBase64,
    titleHint,
    categoryHint,
    referenceDateHint,
    userId: request.auth.userId,
  });

  if (save === false) {
    return response.status(200).json({
      data: learnerCase(structured),
      parsed: structured,
      extracted_text: structured.full_document,
    });
  }

  const created = await Case.create(structured);
  response.status(201).json({
    data: learnerCase(created.toObject()),
    extracted_text: structured.full_document,
  });
}));

router.get('/:caseId', asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
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

router.put('/:caseId', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const existing = await Case.findById(request.params.caseId);
  if (!existing) throw new AppError('Không tìm thấy vụ án cần cập nhật.', 404, 'CASE_NOT_FOUND');

  const { title, summary, full_document: document, category } = request.body ?? {};
  if (![title, summary, document, category].every((value) => typeof value === 'string' && value.trim())) {
    throw new AppError('Vui lòng nhập tên vụ án, tóm tắt, nội dung hồ sơ và loại vụ án.');
  }
  if (title.length > 200 || summary.length > 4000 || document.length > 50000 || category.length > 80) {
    throw new AppError('Hồ sơ quá dài: tiêu đề tối đa 200, tóm tắt 4.000, nội dung 50.000 và loại vụ án 80 ký tự.');
  }
  const timeline = validateTimeline(request.body.timeline);
  if (timeline.some((event) => !document.includes(event.source_quote))) {
    throw new AppError('Trích đoạn của mốc thời gian phải có trong nội dung hồ sơ.');
  }
  const details = validateCaseDetails(request.body);
  const case_facts = validateCaseFacts(request.body);
  const practice_context = validatePracticeContext(request.body.practice_context);

  existing.title = title.trim();
  existing.summary = summary.trim();
  existing.full_document = document.trim();
  existing.category = category.trim();
  existing.timeline = timeline;
  existing.case_facts = case_facts;
  if (details.evidence_inventory) existing.evidence_inventory = details.evidence_inventory;
  if (details.parties) existing.parties = details.parties;
  if (details.evidence_absences) existing.evidence_absences = details.evidence_absences;
  if (details.reference_date !== undefined) existing.reference_date = details.reference_date;
  if (details.source_url !== undefined) existing.source_url = details.source_url;
  if (details.source_note !== undefined) existing.source_note = details.source_note;
  if (details.reference_date_note !== undefined) existing.reference_date_note = details.reference_date_note;
  if (details.legal_scope_note !== undefined) existing.legal_scope_note = details.legal_scope_note;
  existing.practice_context = practice_context;

  await existing.save();
  response.json({ data: learnerCase(existing) });
}));

router.delete('/:caseId', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const existing = await Case.findById(request.params.caseId);
  if (!existing) throw new AppError('Không tìm thấy vụ án cần xóa.', 404, 'CASE_NOT_FOUND');

  const activeSessions = await SimulationSession.countDocuments({
    case_id: existing._id,
    status: 'ongoing',
  });
  if (activeSessions > 0) {
    throw new AppError(
      `Không thể xóa vụ án này vì đang có ${activeSessions} phiên luyện tập đang diễn ra. Vui lòng hoàn thành hoặc hủy các phiên trước khi xóa.`,
      409,
      'CASE_HAS_ACTIVE_SESSIONS'
    );
  }

  await Case.deleteOne({ _id: existing._id });
  response.json({ data: { message: 'Đã xóa vụ án thành công.', deleted_id: existing._id } });
}));

export default router;
