import mongoose from 'mongoose';
import { Router } from 'express';
import Case from '../models/Case.js';
import SimulationSession from '../models/SimulationSession.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middlewares/auth.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateTimeline } from '../services/legalTimeline.js';
import { learnerCase } from '../services/learnerPresentation.js';
import { validateCaseDetails } from '../services/caseEvidence.js';
import { validateCaseFacts } from '../services/caseKnowledge.js';
import { validatePracticeContext } from '../services/casePractice.js';
import { extractAndStructureUserCase } from '../services/userCaseUploadService.js';
import { assertCanUploadCase, consumeCaseUploadAccess } from '../services/paymentAccess.js';
import { detectCaseOrigin } from '../../../shared/casePresentation.mjs';

const router = Router();

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function buildCaseListFilter(query = {}, auth = null) {
  const conditions = [];
  const category = typeof query.category === 'string' ? query.category.trim() : '';
  if (category && category !== 'all') {
    conditions.push({ category: new RegExp(`^${escapeRegex(category)}$`, 'iu') });
  }

  const origin = typeof query.origin === 'string' ? query.origin.trim() : '';
  const userUploadMatch = {
    $and: [
      { origin: { $ne: 'system' } },
      {
        $or: [
          { origin: 'user_upload' },
          { created_by: { $ne: null } },
          { source_note: /người dùng tải lên/iu },
          { 'evidence_inventory.id': /^EV-custom-/ },
        ],
      },
    ],
  };
  if (origin === 'user_upload') {
    conditions.push(userUploadMatch);
  } else if (origin === 'system') {
    conditions.push({
      $or: [
        { origin: 'system' },
        {
          $and: [
            { origin: { $ne: 'user_upload' } },
            { $or: [{ created_by: null }, { created_by: { $exists: false } }] },
            { source_note: { $not: /người dùng tải lên/iu } },
            { 'evidence_inventory.id': { $not: /^EV-custom-/ } },
          ],
        },
      ],
    });
  }

  const moderationFilter = typeof query.moderation_status === 'string' ? query.moderation_status.trim() : '';
  const isAdmin = auth?.role === 'admin';
  const validUserId = auth?.userId && mongoose.isObjectIdOrHexString(auth.userId)
    ? new mongoose.Types.ObjectId(auth.userId)
    : null;

  if (isAdmin) {
    if (moderationFilter === 'pending' || moderationFilter === 'rejected') {
      conditions.push({ moderation_status: moderationFilter });
    } else if (moderationFilter === 'approved') {
      conditions.push({ moderation_status: { $nin: ['pending', 'rejected'] } });
    }
  } else {
    // Người dùng thường chỉ thấy các vụ án đã được duyệt HOẶC hồ sơ do chính họ tải lên
    if (validUserId) {
      conditions.push({
        $or: [
          { moderation_status: { $nin: ['pending', 'rejected'] } },
          { created_by: validUserId },
        ],
      });
    } else {
      conditions.push({ moderation_status: { $nin: ['pending', 'rejected'] } });
    }
    if (moderationFilter === 'pending' || moderationFilter === 'rejected') {
      conditions.push({ moderation_status: moderationFilter });
    } else if (moderationFilter === 'approved') {
      conditions.push({ moderation_status: { $nin: ['pending', 'rejected'] } });
    }
  }

  const rawSearch = typeof query.q === 'string' ? query.q : typeof query.search === 'string' ? query.search : '';
  const search = rawSearch.trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'iu');
    conditions.push({
      $or: [
        { title: regex },
        { summary: regex },
        { category: regex },
        { 'parties.name': regex },
      ],
    });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

router.get('/', optionalAuthenticate, asyncHandler(async (request, response) => {
  const query = request.query;
  const allowedKeys = ['page', 'limit', 'category', 'origin', 'moderation_status', 'q', 'search'];
  if (
    Object.keys(query).some(key => !allowedKeys.includes(key))
    || ['page', 'limit'].some(key => query[key] !== undefined && (typeof query[key] !== 'string' || !/^[1-9]\d{0,4}$/.test(query[key])))
    || (query.category !== undefined && (typeof query.category !== 'string' || query.category.length > 80))
    || (query.origin !== undefined && (typeof query.origin !== 'string' || !['', 'all', 'system', 'user_upload'].includes(query.origin)))
    || (query.moderation_status !== undefined && (typeof query.moderation_status !== 'string' || !['', 'all', 'approved', 'pending', 'rejected'].includes(query.moderation_status)))
    || (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120))
    || (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 120))
  ) {
    throw new AppError('Bộ lọc danh sách vụ án không hợp lệ.');
  }
  const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 20, 1), 50);
  const filter = buildCaseListFilter(query, request.auth);
  const selectFields = 'title summary full_document category created_at reference_date source_url source_note origin created_by moderation_status moderation_note moderated_at practice_context parties timeline evidence_inventory legal_scope_note';
  const [items, total] = await Promise.all([
    Case.find(filter).select(selectFields).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Case.countDocuments(filter),
  ]);
  response.json({ data: items.map(learnerCase), pagination: { page, limit, total } });
}));

router.post('/upload-parse', authenticate, asyncHandler(async (request, response) => {
  await consumeAuthLimit(`case-upload:${request.auth.userId}`, 20, 15 * 60000, 'Bạn đã tải lên quá nhiều bản án trong thời gian ngắn. Vui lòng thử lại sau ít phút.');
  await assertCanUploadCase(request.auth.userId, request.auth.tier, request.auth.role);

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

  const uploadAccess = await consumeCaseUploadAccess(request.auth.userId, request.auth.tier, request.auth.role);
  const isAdmin = request.auth?.role === 'admin';
  const saveAsSystem = isAdmin && request.body?.as_system === true;
  const created = await Case.create({
    ...structured,
    origin: saveAsSystem ? 'system' : 'user_upload',
    created_by: saveAsSystem ? null : request.auth.userId,
    moderation_status: isAdmin ? 'approved' : 'pending',
    moderated_by: isAdmin ? request.auth.userId : null,
    moderated_at: isAdmin ? new Date() : null,
    source_note: saveAsSystem ? 'Hồ sơ vụ án chuẩn hệ thống.' : structured.source_note,
  });
  response.status(201).json({
    data: learnerCase(created.toObject()),
    extracted_text: structured.full_document,
    upload_access: uploadAccess,
  });
}));

router.get('/:caseId', optionalAuthenticate, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const item = await Case.findById(request.params.caseId).lean();
  if (!item) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');
  const isUnapproved = item.moderation_status === 'pending' || item.moderation_status === 'rejected';
  const isOwner = item.created_by && request.auth?.userId && String(item.created_by) === String(request.auth.userId);
  if (isUnapproved && request.auth?.role !== 'admin' && !isOwner) {
    throw new AppError('Hồ sơ tải lên này đang chờ Quản trị viên kiểm duyệt.', 403, 'CASE_NOT_APPROVED');
  }
  response.json({ data: learnerCase(item) });
}));

router.post('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  const { title, summary, full_document: document, category } = request.body ?? {};
  if (![title, summary, document, category].every((value) => typeof value === 'string' && value.trim())) {
    throw new AppError('Vui lòng nhập tên vụ án, tóm tắt, nội dung hồ sơ và loại vụ án.');
  }
  if (title.length > 200 || summary.length > 4000 || document.length > 250000 || category.length > 80) {
    throw new AppError('Hồ sơ quá dài: tiêu đề tối đa 200, tóm tắt 4.000, nội dung 250.000 và loại vụ án 80 ký tự.');
  }
  const timeline = validateTimeline(request.body.timeline);
  if (timeline.some((event) => !document.includes(event.source_quote))) throw new AppError('Trích đoạn của mốc thời gian phải có trong nội dung hồ sơ.');
  const details = validateCaseDetails(request.body);
  const case_facts = validateCaseFacts(request.body);
  const practice_context = validatePracticeContext(request.body.practice_context);
  const item = await Case.create({
    title: title.trim(),
    summary: summary.trim(),
    full_document: document.trim(),
    category: category.trim(),
    origin: 'system',
    created_by: null,
    timeline,
    case_facts,
    ...details,
    practice_context,
  });
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
  if (title.length > 200 || summary.length > 4000 || document.length > 250000 || category.length > 80) {
    throw new AppError('Hồ sơ quá dài: tiêu đề tối đa 200, tóm tắt 4.000, nội dung 250.000 và loại vụ án 80 ký tự.');
  }
  const timeline = request.body.timeline !== undefined
    ? validateTimeline(request.body.timeline)
    : (existing.timeline ?? []).filter(event => !event?.source_quote || document.includes(event.source_quote));
  if (request.body.timeline !== undefined && timeline.some((event) => !document.includes(event.source_quote))) {
    throw new AppError('Trích đoạn của mốc thời gian phải có trong nội dung hồ sơ.');
  }
  const details = validateCaseDetails({
    ...request.body,
    parties: request.body.parties !== undefined ? request.body.parties : existing.parties,
    evidence_absences: request.body.evidence_absences !== undefined ? request.body.evidence_absences : [],
  });
  const case_facts = request.body.case_facts !== undefined
    ? validateCaseFacts(request.body)
    : (existing.case_facts ?? []).filter(f => f?.quote && (`${summary}\n${document}`).includes(f.quote));
  const practice_context = request.body.practice_context !== undefined
    ? validatePracticeContext(request.body.practice_context)
    : existing.practice_context;

  existing.title = title.trim();
  existing.summary = summary.trim();
  existing.full_document = document.trim();
  existing.category = category.trim();
  existing.timeline = timeline;
  existing.case_facts = case_facts;
  if (details.evidence_inventory) existing.evidence_inventory = details.evidence_inventory;
  if (details.parties) existing.parties = details.parties;
  if (request.body.evidence_absences !== undefined && details.evidence_absences) existing.evidence_absences = details.evidence_absences;
  if (details.reference_date !== undefined) existing.reference_date = details.reference_date;
  if (details.source_url !== undefined) existing.source_url = details.source_url;
  if (details.source_note !== undefined) existing.source_note = details.source_note;
  if (details.reference_date_note !== undefined) existing.reference_date_note = details.reference_date_note;
  if (details.legal_scope_note !== undefined) existing.legal_scope_note = details.legal_scope_note;
  if (request.body.origin === 'system' || request.body.origin === 'user_upload') {
    existing.origin = request.body.origin;
    if (request.body.origin === 'system') {
      existing.created_by = null;
      existing.moderation_status = 'approved';
      existing.moderated_by = request.auth.userId;
      existing.moderated_at = new Date();
      if (/người dùng tải lên/iu.test(existing.source_note ?? '')) {
        existing.source_note = 'Hồ sơ vụ án chuẩn hệ thống.';
      }
      if (Array.isArray(existing.evidence_inventory)) {
        existing.evidence_inventory = existing.evidence_inventory.map(ev => ({
          ...(ev.toObject ? ev.toObject() : ev),
          id: String(ev.id || '').startsWith('EV-custom-') ? String(ev.id).replace(/^EV-custom-/, 'EV-sys-') : ev.id,
        }));
      }
    }
  }
  existing.practice_context = practice_context;

  await existing.save();
  response.json({ data: learnerCase(existing) });
}));

router.patch('/:caseId/origin', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const { origin } = request.body ?? {};
  if (!['system', 'user_upload'].includes(origin)) {
    throw new AppError('Phân loại nguồn vụ án không hợp lệ.', 400);
  }
  const existing = await Case.findById(request.params.caseId);
  if (!existing) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');

  existing.origin = origin;
  if (origin === 'system') {
    existing.created_by = null;
    existing.moderation_status = 'approved';
    existing.moderated_by = request.auth.userId;
    existing.moderated_at = new Date();
    if (/người dùng tải lên/iu.test(existing.source_note ?? '')) {
      existing.source_note = 'Hồ sơ vụ án chuẩn hệ thống.';
    }
  }
  await existing.save();
  response.json({ data: learnerCase(existing) });
}));

router.patch('/:caseId/moderation', authenticate, requireAdmin, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const { moderation_status: status, moderation_note: note, origin } = request.body ?? {};
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    throw new AppError('Trạng thái kiểm duyệt không hợp lệ.', 400);
  }
  const existing = await Case.findById(request.params.caseId);
  if (!existing) throw new AppError('Không tìm thấy vụ án.', 404, 'CASE_NOT_FOUND');

  existing.moderation_status = status;
  existing.moderation_note = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  existing.moderated_by = request.auth.userId;
  existing.moderated_at = new Date();
  if (origin === 'system' || origin === 'user_upload') {
    existing.origin = origin;
    if (origin === 'system') {
      existing.created_by = null;
      if (/người dùng tải lên/iu.test(existing.source_note ?? '')) {
        existing.source_note = 'Hồ sơ vụ án chuẩn hệ thống.';
      }
    }
  }
  await existing.save();
  response.json({ data: learnerCase(existing) });
}));

router.delete('/:caseId', authenticate, asyncHandler(async (request, response) => {
  if (!mongoose.isObjectIdOrHexString(request.params.caseId)) {
    throw new AppError('Mã vụ án không hợp lệ.', 400);
  }
  const existing = await Case.findById(request.params.caseId);
  if (!existing) throw new AppError('Không tìm thấy vụ án cần xóa.', 404, 'CASE_NOT_FOUND');

  const isAdmin = request.auth?.role === 'admin';
  const isOwnerOfUploadedCase = detectCaseOrigin(existing) === 'user_upload'
    && Boolean(existing.created_by)
    && String(existing.created_by) === String(request.auth?.userId);

  if (!isAdmin && !isOwnerOfUploadedCase) {
    throw new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN');
  }

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
