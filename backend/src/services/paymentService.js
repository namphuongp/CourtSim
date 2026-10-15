import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import PaymentTransaction from '../models/PaymentTransaction.js';
import PaymentAudit from '../models/PaymentAudit.js';
import { AppError } from '../utils/AppError.js';
import { applyPaymentEntitlement } from './paymentAccess.js';
import { findPaymentProduct, publicCheckoutPlan } from './pricingPlans.js';
import { buildGatewayCheckout, fetchGatewayOrder, gatewayConfig, parseGatewayOrder, paymentProvider, pollingIntervalMs, vndAmount } from './sepayGateway.js';
import { adminAuditEvent, flushAdminAuditOutbox } from './adminAuditOutbox.js';

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
    plan: product ? { ...(transaction.provider_payload?.checkout_plan ?? publicCheckoutPlan(product)),
      id: transaction.provider_payload?.plan_id ?? product.id,
      name: transaction.provider_payload?.plan_name ?? product.name,
      amount: transaction.amount,
      entitlement: transaction.provider_payload?.entitlement ?? product.entitlement,
      price: `${new Intl.NumberFormat('vi-VN').format(transaction.amount)} VNĐ` } : null,
    payment: transaction.provider_payload?.payment,
    expiresAt: transaction.expires_at,
    expires_at: transaction.expires_at,
    paidAt: transaction.paid_at,
    paid_at: transaction.paid_at,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
    ...(transaction.provider === 'sepay_gateway' ? { verification: {
      available: transaction.provider_payload?.poll_status !== 'error',
      checked_at: transaction.provider_payload?.polled_at ?? null,
    } } : {}),
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
    const code = `CS${randomBytes(12).toString('hex').toUpperCase()}`;
    if (!await PaymentTransaction.exists({ order_code: code })) return code;
  }
  throw new AppError('Chua the tao ma thanh toan. Vui long thu lai.', 503, 'PAYMENT_CODE_UNAVAILABLE');
}

export async function createPaymentOrder({ userId, type }) {
  const product = findPaymentProduct(type);
  if (!product) throw new AppError('Goi thanh toan khong hop le.', 400, 'INVALID_PAYMENT_TYPE');
  const provider = paymentProvider();
  const config = provider === 'sepay_gateway' ? gatewayConfig() : null;
  const orderCode = await makeOrderCode();
  const checkout = config ? buildGatewayCheckout({ orderCode, amount: product.amount, planId: product.id, planName: product.name, userId }) : null;
  const payment = config ? { method: 'sepay_gateway', currency: 'VND' } : paymentInstructions(product, orderCode);
  const transaction = await PaymentTransaction.create({
    transaction_id: orderCode,
    order_code: orderCode,
    user_id: userId,
    amount: product.amount,
    type: product.type,
    provider,
    payment_method: config?.paymentMethod ?? 'bank_transfer',
    status: 'pending',
    expires_at: nowPlus(PAYMENT_EXPIRES_MS),
    provider_payload: {
      order_code: orderCode,
      type: product.type,
      plan_id: product.id,
      plan_name: product.name,
      payment_purpose: product.paymentPurpose,
      entitlement: product.entitlement,
      checkout_plan: publicCheckoutPlan(product),
      ...(config ? { environment: config.environment, merchant_id: config.merchantId } : {}),
      payment,
    },
  });
  await audit('payment_created', { paymentId: transaction._id, orderCode, amount: product.amount });
  return { ...publicPayment(transaction), ...(checkout ? { checkout } : {}) };
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
    throw new AppError('Webhook thanh toán chưa được cấu hình.', 503, 'SEPAY_WEBHOOK_UNCONFIGURED');
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
  const amount = vndAmount(value);
  return Number.isNaN(amount) ? null : amount;
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

async function fulfillClaimedPayment(payment, body, paidBy = 'sepay_webhook') {
  const product = findPaymentProduct(payment.type);
  if (!product) throw new AppError('Goi thanh toan khong hop le.', 409, 'PAYMENT_PRODUCT_UNAVAILABLE');
  await applyPaymentEntitlement({ userId: payment.user_id, entitlement: payment.provider_payload?.entitlement ?? product.entitlement, paymentId: payment._id });
  const paid = await PaymentTransaction.findOneAndUpdate(
    { _id: payment._id, status: 'processing', sepay_transaction_id: payment.sepay_transaction_id },
    { $set: { status: 'paid', paid_at: new Date(), raw_transaction: body, 'provider_payload.paid_by': paidBy } },
    { returnDocument: 'after' },
  );
  if (!paid) {
    const current = await PaymentTransaction.findById(payment._id);
    if (current?.status === 'paid' && current.sepay_transaction_id === payment.sepay_transaction_id) return current;
    throw new AppError('Trang thai thanh toan da thay doi.', 409, 'PAYMENT_STATUS_CHANGED');
  }
  await audit('payment_paid', { paymentId: paid._id, orderCode: paid.order_code, amount: paid.amount, sepayTransactionId: paid.sepay_transaction_id });
  return paid;
}

async function resumeClaimedPayment(payment) {
  const receipt = payment.raw_transaction;
  const payload = payment.provider_payload ?? {};
  let source;
  if (payment.sepay_transaction_id === `manual:${payment.order_code}` && payment.reference_code === 'manual'
    && payload.verified_by && Number.isFinite(Date.parse(payload.verified_at))) {
    source = 'manual';
  } else if (payment.provider === 'sepay_gateway' && receipt?.source === 'sepay_polling') {
    // The claim was verified before fulfillment. Revalidate the saved evidence, keeping its
    // identity even if the provider later adds/removes transaction history or changes config.
    const parsed = parseGatewayOrder({ ...receipt.order,
      transactions: receipt.transaction ? [{ ...receipt.transaction, transaction_type: 'PAYMENT' }] : [] }, payment);
    if (parsed.status === 'paid' && parsed.transactionId === payment.sepay_transaction_id) source = 'sepay_polling';
  } else if (payment.provider === 'sepay_bank_transfer' && payload.webhook_received_at
    && sepayTransactionId(receipt) === payment.sepay_transaction_id
    && parseOrderCode(receipt) === payment.order_code && transferAmount(receipt) === payment.amount
    && (!receipt.transferType || receipt.transferType === 'in')) {
    source = 'sepay_webhook';
  }
  if (!source) throw new AppError('Chưa đủ chứng từ để tiếp tục cấp quyền. Cần kiểm tra lại giao dịch.', 409, 'PAYMENT_CLAIM_UNVERIFIED');
  const result = await fulfillClaimedPayment(payment, receipt ?? { manual: true, adminUserId: payload.verified_by }, source);
  await flushAdminAuditOutbox(PaymentTransaction, payment._id);
  return result;
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
    if (duplicate.status === 'processing' && duplicate.provider === 'sepay_bank_transfer'
      && parseOrderCode(body) === duplicate.order_code && transferAmount(body) === duplicate.amount) {
      await resumeClaimedPayment(duplicate);
      return { processed: true };
    }
    await audit('duplicate_transaction', { paymentId: duplicate._id, orderCode: duplicate.order_code, amount: duplicate.amount, sepayTransactionId: transactionId });
    return { processed: false, duplicate: true };
  }

  const orderCode = parseOrderCode(body);
  if (!orderCode) {
    await audit('order_not_found', { sepayTransactionId: transactionId, amount: transferAmount(body), reason: 'missing_order_code' });
    return { processed: false };
  }

  const payment = await PaymentTransaction.findOne({ order_code: orderCode, provider: 'sepay_bank_transfer' });
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

export async function findUserPayment({ paymentId, userId }, dependencies) {
  const filter = { user_id: userId };
  if (/^[a-f0-9]{24}$/i.test(paymentId)) filter._id = paymentId;
  else filter.$or = [{ transaction_id: paymentId }, { order_code: paymentId }];
  const payment = await PaymentTransaction.findOne(filter);
  if (!payment) throw new AppError('Khong tim thay giao dich thanh toan.', 404, 'PAYMENT_NOT_FOUND');
  let current = await expirePaymentIfNeeded(payment);
  if (current.provider === 'sepay_gateway' || current.status === 'processing') {
    try { current = await pollGatewayPayment(current, dependencies); }
    catch { current = await PaymentTransaction.findById(payment._id); }
  }
  return publicPayment(current);
}

export async function resumeGatewayCheckout({ paymentId, userId }, dependencies) {
  const payment = await PaymentTransaction.findOne({ user_id: userId, $or: [{ transaction_id: paymentId }, { order_code: paymentId }] });
  if (!payment) throw new AppError('Không tìm thấy giao dịch thanh toán.', 404, 'PAYMENT_NOT_FOUND');
  let current = await expirePaymentIfNeeded(payment);
  if (current.provider === 'sepay_gateway') current = await pollGatewayPayment(current, dependencies);
  if (current.provider !== 'sepay_gateway' || current.status !== 'pending') {
    throw new AppError('Đơn này không thể tiếp tục thanh toán. Hãy kiểm tra trạng thái hoặc tạo đơn mới.', 409, 'PAYMENT_STATUS_LOCKED');
  }
  const config = gatewayConfig();
  if (config.environment !== current.provider_payload.environment || config.merchantId !== current.provider_payload.merchant_id
    || config.paymentMethod !== current.payment_method) {
    throw new AppError('Dịch vụ thanh toán đã thay đổi. Hãy tạo đơn mới.', 409, 'PAYMENT_CONFIG_CHANGED');
  }
  const checkout = buildGatewayCheckout({ orderCode: current.order_code, amount: current.amount,
    planId: current.provider_payload.plan_id, planName: current.provider_payload.plan_name, userId });
  return { ...publicPayment(current), checkout };
}

async function settleGatewayOrder(payment, order) {
  const parsed = parseGatewayOrder(order, payment);
  const orderCode = payment.order_code;
  const amount = payment.amount;
  if (parsed.status === 'pending') return payment;
  if (parsed.status === 'cancelled') {
    // A processing order already has a verified payment receipt; never discard that claim.
    if (payment.status === 'processing') throw new AppError('Giao dịch cần được đối soát lại.', 409, 'PAYMENT_STATUS_LOCKED');
    return await PaymentTransaction.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['pending', 'expired'] } },
      { $set: { status: 'cancelled' } }, { returnDocument: 'after' },
    ) ?? PaymentTransaction.findById(payment._id);
  }
  const { transactionId, transaction } = parsed;
  // Store only reconciliation fields, not customer/card details from the API response.
  const receipt = { source: 'sepay_polling', verification: parsed.verification,
    order: { order_invoice_number: orderCode, id: order.id, order_id: order.order_id,
      order_status: order.order_status, order_amount: amount, order_currency: 'VND' },
    transaction: transaction ? { id: transaction.id, transaction_id: transaction.transaction_id,
      transaction_status: 'APPROVED', transaction_amount: amount, transaction_currency: 'VND', payment_method: transaction.payment_method } : null };
  let claimed;
  try {
    claimed = await PaymentTransaction.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['pending', 'expired', 'processing'] },
        $or: [{ sepay_transaction_id: { $exists: false } }, { sepay_transaction_id: null }, { sepay_transaction_id: transactionId }] },
      { $set: { status: 'processing', sepay_transaction_id: transactionId,
        raw_transaction: receipt } },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (error.code === 11000) throw new AppError('Giao dịch đã thuộc đơn thanh toán khác.', 409, 'SEPAY_TRANSACTION_REUSED');
    throw error;
  }
  if (!claimed) {
    const current = await PaymentTransaction.findById(payment._id);
    if (current?.status === 'paid' && current.sepay_transaction_id === transactionId) return current;
    throw new AppError('Đơn thanh toán đang được xử lý bằng giao dịch khác.', 409, 'PAYMENT_STATUS_LOCKED');
  }
  try {
    return await fulfillClaimedPayment(claimed, receipt, 'sepay_polling');
  } catch (error) {
    await audit('payment_fulfillment_failed', { paymentId: claimed._id, orderCode, sepayTransactionId: transactionId, amount, reason: error.code ?? error.message });
    throw error; // The next poll retries this verified claim without granting credits twice.
  }
}

export async function pollGatewayPayment(payment, dependencies = {}) {
  if (!['pending', 'expired', 'processing'].includes(payment.status)
    || (payment.provider !== 'sepay_gateway' && payment.status !== 'processing')) return payment;
  const interval = pollingIntervalMs();
  const now = new Date();
  const token = randomBytes(16).toString('hex');
  const claimed = await PaymentTransaction.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'expired', 'processing'] }, $and: [
      { $or: [{ next_poll_at: null }, { next_poll_at: { $lte: now } }] },
      { $or: [{ poll_lease_until: null }, { poll_lease_until: { $lte: now } }] },
    ] },
    { $set: { poll_lease_until: new Date(Date.now() + 30000), poll_lease_token: token } },
    { returnDocument: 'after' },
  );
  if (!claimed) return PaymentTransaction.findById(payment._id);
  let failure;
  let pollStatus = 'not_found';
  try {
    if (claimed.status === 'processing') {
      await resumeClaimedPayment(claimed);
      pollStatus = 'ok';
    } else {
      const order = await fetchGatewayOrder(claimed, dependencies);
      if (order) {
        // Validate the invoice and amounts before saving the provider's order ID.
        parseGatewayOrder(order, claimed);
        await PaymentTransaction.updateOne({ _id: claimed._id, poll_lease_token: token },
          { $set: { 'provider_payload.sepay_order_id': order.order_id } });
        await settleGatewayOrder(claimed, order);
        pollStatus = 'ok';
      }
    }
  } catch (error) {
    failure = error;
    pollStatus = 'error';
    await audit('payment_poll_failed', { paymentId: claimed._id, orderCode: claimed.order_code, reason: error.code ?? 'POLL_FAILED' });
  } finally {
    const failures = failure ? Math.min(6, (claimed.provider_payload?.poll_failures ?? 0) + 1) : 0;
    const delay = failure ? Math.min(300000, interval * (2 ** failures)) : interval;
    await PaymentTransaction.updateOne({ _id: claimed._id, poll_lease_token: token }, { $set: {
      poll_lease_until: null, poll_lease_token: null, next_poll_at: new Date(Date.now() + delay),
      'provider_payload.polled_at': new Date(), 'provider_payload.poll_status': pollStatus,
      'provider_payload.poll_failures': failures,
    } });
  }
  if (failure) throw failure;
  return PaymentTransaction.findById(payment._id);
}

export async function manuallySetPaymentStatus({ transactionId, status, adminUserId, note }) {
  const normalized = status === 'success' ? 'paid' : status === 'failed' ? 'cancelled' : status;
  if (!['paid', 'cancelled'].includes(normalized)) throw new AppError('Trang thai xac nhan khong hop le.', 400, 'INVALID_PAYMENT_STATUS');
  const payment = await PaymentTransaction.findOne({ $or: [{ transaction_id: transactionId }, { order_code: transactionId }] });
  if (!payment) throw new AppError('Khong tim thay giao dich thanh toan.', 404, 'PAYMENT_NOT_FOUND');
  if (normalizeStatus(payment.status) === 'paid') throw new AppError('Giao dich nay da duoc xac nhan truoc do.', 409, 'PAYMENT_ALREADY_APPROVED');
  if (payment.status === 'processing' && normalized === 'paid') return resumeClaimedPayment(payment);
  if (!['pending', 'submitted', 'expired'].includes(payment.status)) throw new AppError('Chi co the xu ly giao dich dang cho.', 409, 'PAYMENT_STATUS_LOCKED');

  const event = adminAuditEvent(adminUserId, normalized === 'paid' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED', 'payment', payment._id);

  if (normalized === 'cancelled') {
    const cancelled = await PaymentTransaction.findOneAndUpdate(
      { _id: payment._id, status: { $in: ['pending', 'submitted', 'expired'] } },
      { $set: { status: 'cancelled', 'provider_payload.admin_note': String(note ?? '').slice(0, 500), 'provider_payload.verified_by': adminUserId, 'provider_payload.verified_at': new Date() },
        $push: { admin_audit_outbox: event } },
      { new: true },
    );
    if (!cancelled) throw new AppError('Giao dịch đã được xử lý bởi yêu cầu khác.', 409, 'PAYMENT_STATUS_LOCKED');
    await audit('payment_cancelled', { paymentId: cancelled._id, orderCode: cancelled.order_code, amount: cancelled.amount });
    await flushAdminAuditOutbox(PaymentTransaction, cancelled._id);
    return cancelled;
  }

  const claimed = await PaymentTransaction.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'submitted', 'expired'] } },
    { $set: { status: 'processing', sepay_transaction_id: `manual:${payment.order_code}`, reference_code: 'manual', 'provider_payload.verified_by': adminUserId, 'provider_payload.verified_at': new Date(), 'provider_payload.admin_note': String(note ?? '').slice(0, 500) },
      $push: { admin_audit_outbox: event } },
    { new: true },
  );
  if (!claimed) throw new AppError('Giao dich da duoc xu ly boi yeu cau khac.', 409, 'PAYMENT_STATUS_LOCKED');
  const result = await fulfillClaimedPayment(claimed, { manual: true, adminUserId }, 'manual');
  await flushAdminAuditOutbox(PaymentTransaction, claimed._id);
  return result;
}
