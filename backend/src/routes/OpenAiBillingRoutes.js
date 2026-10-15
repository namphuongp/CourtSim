import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../services/emailAuthService.js';
import { AppError } from '../utils/AppError.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { openAiBillingReport, beginOpenAiSync, runOpenAiSync } from '../services/openAiBillingService.js';

const router = Router();
router.get('/', asyncHandler(async (req, res) => {
  if (Object.keys(req.query).some(key => key !== 'month')) throw new AppError('Bộ lọc không hợp lệ.');
  res.json({ data: await openAiBillingReport(req.query.month) });
}));
router.post('/sync', asyncHandler(async (req, res) => {
  validateBody(req.body, ['month']);
  await consumeAuthLimit(`openai-sync:${req.auth.userId}`, 10);
  const task = await beginOpenAiSync({ month: req.body.month, trigger: 'manual', initiatedBy: req.auth.userId });
  // Trả ngay để proxy không timeout; tiến độ/lease được giữ trong MongoDB cho lần tải lại.
  res.status(202).json({ data: { status: 'running', month: task.range.month } });
  setImmediate(() => { runOpenAiSync(task).catch(() => console.warn('OPENAI_BILLING_STORAGE_FAILED')); });
}));
export default router;
