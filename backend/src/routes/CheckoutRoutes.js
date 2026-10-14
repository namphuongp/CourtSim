import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { consumeAuthLimit } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPaymentOrder,
  findUserPayment,
  handleSepayWebhook,
  publicPayment,
  verifySepayWebhook,
} from '../services/paymentService.js';
import { findCheckoutPlan, findPaymentProduct, normalizePaymentType, publicCheckoutPlan } from '../services/pricingPlans.js';
import PaymentTransaction from '../models/PaymentTransaction.js';

const router = Router();

async function receiveSepayWebhook(request, response) {
  verifySepayWebhook(request);
  await handleSepayWebhook(request.body ?? {});
  response.json({ success: true });
}

router.post('/sepay/webhook', asyncHandler(receiveSepayWebhook));
router.post('/webhook/bank-transfer', asyncHandler(receiveSepayWebhook));

router.use(authenticate);

function requestType(body) {
  if (typeof body?.type === 'string') return normalizePaymentType(body.type);
  if (typeof body?.plan_id === 'string') return normalizePaymentType(body.plan_id);
  return '';
}

const createOrderHandler = asyncHandler(async (request, response) => {
  const type = requestType(request.body);
  const product = findPaymentProduct(type);
  if (!product) throw new AppError('Goi thanh toan khong hop le.', 400, 'INVALID_PAYMENT_TYPE');
  await consumeAuthLimit(`payment-create:${request.auth.userId}`, 20);
  const payment = await createPaymentOrder({ userId: request.auth.userId, type: product.type });
  response.status(201).json({ success: true, payment, data: payment });
});

router.post('/create', createOrderHandler);
router.post('/orders', createOrderHandler);

router.get('/:paymentId/status', asyncHandler(async (request, response) => {
  const payment = await findUserPayment({ paymentId: request.params.paymentId, userId: request.auth.userId });
  response.json({ success: true, payment, data: payment });
}));

router.get('/orders/:transactionId', asyncHandler(async (request, response) => {
  const payment = await findUserPayment({ paymentId: request.params.transactionId, userId: request.auth.userId });
  response.json({ success: true, payment, data: payment });
}));

router.get('/plans/:planId', asyncHandler(async (request, response) => {
  const plan = findCheckoutPlan(request.params.planId);
  if (!plan) throw new AppError('Goi thanh toan khong hop le.', 404, 'PLAN_NOT_FOUND');
  response.json({ data: publicCheckoutPlan(plan) });
}));

// Legacy endpoint kept read-only: frontend must not mark a payment paid.
router.post('/orders/:transactionId/confirm-paid', asyncHandler(async (request, response) => {
  const transaction = await PaymentTransaction.findOneAndUpdate(
    { transaction_id: request.params.transactionId, user_id: request.auth.userId, status: 'pending' },
    { $set: { 'provider_payload.user_confirmed_at': new Date(), 'provider_payload.user_note': typeof request.body?.note === 'string' ? request.body.note.trim().slice(0, 500) : '' } },
    { new: true },
  );
  if (!transaction) {
    const payment = await findUserPayment({ paymentId: request.params.transactionId, userId: request.auth.userId });
    return response.json({ success: true, payment, data: payment });
  }
  const payment = publicPayment(transaction);
  response.json({ success: true, payment, data: payment });
}));

export default router;
