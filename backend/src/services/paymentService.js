import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import PaymentTransaction from '../models/PaymentTransaction.js';
import PaymentAudit from '../models/PaymentAudit.js';
import { AppError } from '../utils/AppError.js';
import { applyPaymentEntitlement } from './paymentAccess.js';
import { findPaymentProduct, publicCheckoutPlan } from './pricingPlans.js';

const PAYMENT_EXPIRES_MS = 15 * 60 * 1000;

function nowPlus(ms) {
  return new Date(Date.now() + ms);
}

function maskAccount(value) {
  const text = String(value || '').trim();
  if (text.length <= 4) return text || '******160';
  return `${'*'.repeat(Math.max(0, text.length - 3))}${text.slice(-3)}`;
}

function bankConfig() {
  const accountNumber = process.env.PAYMENT_BANK_ACCOUNT_NUMBER?.trim() || process.env.SEPAY_BANK_ACCOUNT?.trim() || '';
  return {
    bankCode: process.env.PAYMENT_BANK_CODE?.trim() || '',
    accountNumber,
    accountName: process.env.PAYMENT_BANK_ACCOUNT_NAME?.trim() || 'TRAN TIEN DAT',
    accountMask: process.env.PAYMENT_BANK_ACCOUNT_MASK?.trim() || maskAccount(accountNumber),
  };
}

function vietQrUrl({ amount, orderCode }) {
  const bank = bankConfig();
  if (!bank.bankCode || !bank.accountNumber) return process.env.PAYMENT_BANK_QR_URL?.trim() || '/payment-assets/tran-tien-dat-qr.png';
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: orderCode,
    accountName: bank.accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${query}`;
}

function paymentInstructions(product, orderCode) {
  const bank = bankConfig();
  return {
    method: 'bank_transfer',
    title: 'Thanh toan chuyen khoan ngan hang',
    amount: product.amount,
    currency: 'VND',
    bank_code: bank.bankCode,
    account_number: bank.accountNumber,
    account_name: bank.accountName,
    account_mask: bank.accountMask,
    qr_image_url: vietQrUrl({ amount: product.amount, orderCode }),
    transfer_content: orderCode,
    note: 'Chuyen khoan dung so tien va dung noi dung orderCode de SePay tu doi soat.',
  };
}

function normalizeStatus(status) {
  if (status === 'success') return 'paid';
  if (status === 'failed' || status === 'refunded') return 'cancelled';
  if (status === 'submitted') return 'pending';
  return status;
}

export function publicPayment(transaction) {
  const product = findPaymentProduct(transaction.type ?? transaction.provider_payload?.type ?? transaction.provider_payload?.plan_id);
  const orderCode = transaction.order_code ?? transaction.provider_payload?.order_code ?? transaction.transaction_id;
  return {
    id: String(transaction._id),
    payment_id: String(transaction._id),
    transaction_id: transaction.transaction_id,
    orderCode,
    order_code: orderCode,
    status: normalizeStatus(transaction.status),
    provider: transaction.provider,
    type: transaction.type ?? product?.type,
    amount: transaction.amount,
    plan: product ? publicCheckoutPlan(product) : null,
    payment: transaction.provider_payload?.payment,
    expiresAt: transaction.expires_at,
    expires_at: transaction.expires_at,
    paidAt: transaction.paid_at,
    paid_at: transaction.paid_at,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  };
}

async function audit(action, data = {}) {
  try {
    await PaymentAudit.create({
      action,
      payment_id: data.paymentId ?? null,
      order_code: data.orderCode ?? null,
      sepay_transaction_id: data.sepayTransactionId ?? null,
      amount: data.amount ?? null,
      reason: data.reason ?? null,
      metadata: data.metadata ?? {},
    });
  } catch {
    // Audit must not break the payment flow.
  }
}

async function makeOrderCode() {
  for (let index = 0; index < 8; index += 1) {
    const code = `CS${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
    if (!await PaymentTransaction.exists({ order_code: code })) return code;
  }
  throw new AppError('Chua the tao ma thanh toan. Vui long thu lai.', 503, 'PAYMENT_CODE_UNAVAILABLE');
}

export async function createPaymentOrder({ userId, type }) {
  const product = findPaymentProduct(type);
  if (!product) throw new AppError('Goi thanh toan khong hop le.', 400, 'INVALID_PAYMENT_TYPE');
  const orderCode = await makeOrderCode();
  const payment = paymentInstructions(product, orderCode);
  const transaction = await PaymentTransaction.create({
    transaction_id: orderCode,
    order_code: orderCode,
    user_id: userId,
    amount: product.amount,
    type: product.type,
    provider: 'sepay_bank_transfer',
    payment_method: 'bank_transfer',
    status: 'pending',
    expires_at: nowPlus(PAYMENT_EXPIRES_MS),
    provider_payload: {
      order_code: orderCode,
      type: product.type,
      plan_id: product.id,
      plan_name: product.name,
      payment_purpose: product.paymentPurpose,
      entitlement: product.entitlement,
      payment,
    },
  });
  await audit('payment_created', { paymentId: transaction._id, orderCode, amount: product.amount });
  return publicPayment(transaction);
}

export async function expirePaymentIfNeeded(transaction) {
  const status = normalizeStatus(transaction.status);
  if (status !== 'pending' || !transaction.expires_at || transaction.expires_at > new Date()) return transaction;
  const expired = await PaymentTransaction.findOneAndUpdate(
    { _id: transaction._id, status: { $in: ['pending', 'submitted'] } },
    { $set: { status: 'expired' } },
    { new: true },
  );
  if (expired) {
    await audit('payment_expired', { paymentId: expired._id, orderCode: expired.order_code, amount: expired.amount });
    return expired;
  }
  return PaymentTransaction.findById(transaction._id);
}

function timingEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifySepayWebhook(request) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new AppError('Webhook thanh toan chua cau hinh secret.', 503, 'SEPAY_WEBHOOK_UNCONFIGURED');
    return;
  }

  const auth = String(request.get('authorization') || '').trim();
  if (auth.toLowerCase().startsWith('apikey ') && timingEqual(auth.slice(7).trim(), secret)) return;

  const signature = String(request.get('x-sepay-signature') || '').trim();
  const timestamp = String(request.get('x-sepay-timestamp') || '').trim();
  if (signature || timestamp) {
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) {
      audit('invalid_signature', { reason: 'expired_timestamp' });
      throw new AppError('Webhook thanh toan da het han.', 401, 'WEBHOOK_SIGNATURE_EXPIRED');
    }
    if (!Buffer.isBuffer(request.rawBody) && typeof request.rawBody !== 'string') {
      audit('invalid_signature', { reason: 'missing_raw_body' });
      throw new AppError('Webhook thanh toan thieu raw body de xac minh chu ky.', 400, 'WEBHOOK_RAW_BODY_REQUIRED');
    }
    const hmac = createHmac('sha256', secret);
    hmac.update(`${timestamp}.`);
    hmac.update(request.rawBody);
    const expected = `sha256=${hmac.digest('hex')}`;
    if (!timingEqual(signature, expected)) {
      audit('invalid_signature', { reason: 'hmac_mismatch' });
      throw new AppError('Chu ky webhook thanh toan khong hop le.', 401, 'WEBHOOK_SIGNATURE_INVALID');
    }
    return;
  }

  const courtsimSecret = String(request.get('x-courtsim-webhook-secret') || '').trim();
  if (courtsimSecret && timingEqual(courtsimSecret, secret)) return;

  audit('invalid_signature', { reason: 'missing_signature' });
  throw new AppError('Webhook thanh toan thieu chu ky.', 401, 'WEBHOOK_SIGNATURE_REQUIRED');
}

function transferAmount(body) {
  const value = body?.transferAmount ?? body?.amount ?? body?.transaction_amount;
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isSafeInteger(number) ? number : Math.round(number);
}

function sepayTransactionId(body) {
  return String(body?.id ?? body?.referenceCode ?? body?.transactionId ?? '').trim();
}

function parseOrderCode(body) {
  const direct = String(body?.code ?? '').trim();
  if (/^CS[A-Z0-9]+$/i.test(direct)) return direct.toUpperCase();
  const text = `${body?.content ?? ''} ${body?.description ?? ''}`;
  return text.match(/CS[A-Z0-9]+/i)?.[0]?.toUpperCase() ?? '';
}

async function fulfillClaimedPayment(payment, body) {
  const product = findPaymentProduct(payment.type);
  if (!product) throw new AppError('Goi thanh toan khong hop le.', 409, 'PAYMENT_PRODUCT_UNAVAILABLE');
  await applyPaymentEntitlement({ userId: payment.user_id, entitlement: product.entitlement });
  const paid = await PaymentTransaction.findOneAndUpdate(
    { _id: payment._id, status: 'processing', sepay_transaction_id: payment.sepay_transaction_id },
    { $set: { status: 'paid', paid_at: new Date(), raw_transaction: body, 'provider_payload.paid_by': 'sepay_webhook' } },
    { new: true },
  );
  if (!paid) throw new AppError('Trang thai thanh toan da thay doi.', 409, 'PAYMENT_STATUS_CHANGED');
  await audit('payment_paid', { paymentId: paid._id, orderCode: paid.order_code, amount: paid.amount, sepayTransactionId: paid.sepay_transaction_id });
  return paid;
}

export async function handleSepayWebhook(body) {
  await audit('webhook_received', { sepayTransactionId: sepayTransactionId(body), amount: transferAmount(body), metadata: { transferType: body?.transferType } });

  if (body?.transferType && body.transferType !== 'in') {
    await audit('outgoing_transaction', { sepayTransactionId: sepayTransactionId(body), amount: transferAmount(body) });
    return { processed: false };
  }

  const expectedAccount = process.env.SEPAY_BANK_ACCOUNT?.trim();
  if (expectedAccount && String(body?.accountNumber ?? '').trim() !== expectedAccount) {
    await audit('invalid_bank_account', { sepayTransactionId: sepayTransactionId(body), amount: transferAmount(body), reason: 'account_mismatch' });
    return { processed: false };
  }

  const transactionId = sepayTransactionId(body);
  if (!transactionId) {
    await audit('order_not_found', { amount: transferAmount(body), reason: 'missing_transaction_id' });
    return { processed: false };
  }

  const duplicate = await PaymentTransaction.findOne({ sepay_transaction_id: transactionId }).lean();
  if (duplicate) {
    await audit('duplicate_transaction', { paymentId: duplicate._id, orderCode: duplicate.order_code, amount: duplicate.amount, sepayTransactionId: transactionId });
    return { processed: false, duplicate: true };
  }

  const orderCode = parseOrderCode(body);
  if (!orderCode) {
    await audit('order_not_found', { sepayTransactionId: transactionId, amount: transferAmount(body), reason: 'missing_order_code' });
    return { processed: false };
  }

  const payment = await PaymentTransaction.findOne({ order_code: orderCode });
  if (!payment) {
    await audit('order_not_found', { orderCode, sepayTransactionId: transactionId, amount: transferAmount(body) });
    return { processed: false };
  }

  const amount = transferAmount(body);
  if (amount !== payment.amount) {
    await audit('wrong_amount', { paymentId: payment._id, orderCode, sepayTransactionId: transactionId, amount, reason: `expected_${payment.amount}` });
    return { processed: false };
  }

  if (payment.expires_at <= new Date()) {
    await PaymentTransaction.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'expired', raw_transaction: body } });
    await audit('payment_expired', { paymentId: payment._id, orderCode, sepayTransactionId: transactionId, amount });
    return { processed: false };
  }

  const claimed = await PaymentTransaction.findOneAndUpdate(
    {
      _id: payment._id,
      status: 'pending',
      expires_at: { $gt: new Date() },
      $or: [{ sepay_transaction_id: null }, { sepay_transaction_id: { $exists: false } }],
    },
    {
      $set: {
        status: 'processing',
        sepay_transaction_id: transactionId,
        reference_code: body?.referenceCode ?? null,
        raw_transaction: body,
        'provider_payload.webhook_received_at': new Date(),
      },
    },
    { new: true },
  );
  if (!claimed) {
    await audit('duplicate_transaction', { paymentId: payment._id, orderCode, sepayTransactionId: transactionId, amount, reason: 'claim_failed' });
    return { processed: false };
  }

  try {
    await fulfillClaimedPayment(claimed, body);
    return { processed: true };
  } catch (error) {
    await audit('payment_fulfillment_failed', { paymentId: claimed._id, orderCode, sepayTransactionId: transactionId, amount, reason: error.code ?? error.message });
    throw error;
  }
}

export async function findUserPayment({ paymentId, userId }) {
  const filter = { user_id: userId };
  if (/^[a-f0-9]{24}$/i.test(paymentId)) filter._id = paymentId;
  else filter.$or = [{ transaction_id: paymentId }, { order_code: paymentId }];
  const payment = await PaymentTransaction.findOne(filter);
  if (!payment) throw new AppError('Khong tim thay giao dich thanh toan.', 404, 'PAYMENT_NOT_FOUND');
  return publicPayment(await expirePaymentIfNeeded(payment));
}

export async function manuallySetPaymentStatus({ transactionId, status, adminUserId, note }) {
  const normalized = status === 'success' ? 'paid' : status === 'failed' ? 'cancelled' : status;
  if (!['paid', 'cancelled'].includes(normalized)) throw new AppError('Trang thai xac nhan khong hop le.', 400, 'INVALID_PAYMENT_STATUS');
  const payment = await PaymentTransaction.findOne({ $or: [{ transaction_id: transactionId }, { order_code: transactionId }] });
  if (!payment) throw new AppError('Khong tim thay giao dich thanh toan.', 404, 'PAYMENT_NOT_FOUND');
  if (normalizeStatus(payment.status) === 'paid') throw new AppError('Giao dich nay da duoc xac nhan truoc do.', 409, 'PAYMENT_ALREADY_APPROVED');
  if (!['pending', 'submitted', 'expired'].includes(payment.status)) throw new AppError('Chi co the xu ly giao dich dang cho.', 409, 'PAYMENT_STATUS_LOCKED');

  if (normalized === 'cancelled') {
    payment.status = 'cancelled';
    payment.provider_payload = { ...payment.provider_payload, admin_note: String(note ?? '').slice(0, 500), verified_by: adminUserId, verified_at: new Date() };
    await payment.save();
    await audit('payment_cancelled', { paymentId: payment._id, orderCode: payment.order_code, amount: payment.amount });
    return payment;
  }

  const claimed = await PaymentTransaction.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'submitted', 'expired'] } },
    { $set: { status: 'processing', sepay_transaction_id: `manual:${payment.order_code}`, reference_code: 'manual', 'provider_payload.verified_by': adminUserId, 'provider_payload.verified_at': new Date(), 'provider_payload.admin_note': String(note ?? '').slice(0, 500) } },
    { new: true },
  );
  if (!claimed) throw new AppError('Giao dich da duoc xu ly boi yeu cau khac.', 409, 'PAYMENT_STATUS_LOCKED');
  return fulfillClaimedPayment(claimed, { manual: true, adminUserId });
}
