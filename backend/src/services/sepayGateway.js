import { SePayPgClient } from 'sepay-pg-node';
import { AppError } from '../utils/AppError.js';

export function paymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER?.trim() || 'sepay_gateway';
  if (!['sepay_gateway', 'sepay_bank_transfer'].includes(provider)) {
    throw new AppError('Dịch vụ thanh toán chưa sẵn sàng.', 503, 'PAYMENT_PROVIDER_INVALID');
  }
  return provider;
}

export function gatewayApiConfig() {
  const environment = process.env.SEPAY_ENV?.trim() || 'sandbox';
  const merchantId = process.env.SEPAY_MERCHANT_ID?.trim();
  const secretKey = process.env.SEPAY_SECRET_KEY?.trim();
  if (!merchantId || !secretKey || !['sandbox', 'production'].includes(environment)
    || (process.env.NODE_ENV === 'production' && environment !== 'production')) {
    throw new AppError('Dịch vụ thanh toán chưa sẵn sàng.', 503, 'SEPAY_GATEWAY_UNCONFIGURED');
  }
  return { environment, merchantId, secretKey };
}

export function gatewayConfig() {
  const config = gatewayApiConfig();
  pollingIntervalMs();
  const paymentMethod = process.env.SEPAY_PAYMENT_METHOD?.trim() || 'BANK_TRANSFER';
  let origin;
  try {
    const url = new URL(process.env.PAYMENT_RETURN_ORIGIN?.trim() || '');
    const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.href !== `${url.origin}/` || !allowed.includes(url.origin)
      || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error();
    origin = url.origin;
  } catch {
    throw new AppError('Dịch vụ thanh toán chưa sẵn sàng.', 503, 'PAYMENT_RETURN_ORIGIN_INVALID');
  }
  if (!['BANK_TRANSFER', 'NAPAS_BANK_TRANSFER'].includes(paymentMethod)) {
    throw new AppError('Dịch vụ thanh toán chưa sẵn sàng.', 503, 'SEPAY_GATEWAY_UNCONFIGURED');
  }
  return { ...config, paymentMethod, origin };
}

export function buildGatewayCheckout({ orderCode, amount, planId, planName, userId }) {
  const config = gatewayConfig();
  const client = new SePayPgClient({ env: config.environment, merchant_id: config.merchantId, secret_key: config.secretKey });
  const returnUrl = result => {
    const url = new URL(`/checkout/${encodeURIComponent(planId)}`, config.origin);
    url.searchParams.set('order', orderCode);
    url.searchParams.set('payment', result);
    return url.href;
  };
  // Preserve this insertion order when submitting the form: the SDK signs in field order.
  const fields = client.checkout.initOneTimePaymentFields({
    merchant: config.merchantId,
    operation: 'PURCHASE',
    payment_method: config.paymentMethod,
    order_invoice_number: orderCode,
    order_amount: amount,
    currency: 'VND',
    order_description: `CourtSim - ${planName} - ${orderCode}`,
    customer_id: String(userId),
    success_url: returnUrl('success'),
    error_url: returnUrl('error'),
    cancel_url: returnUrl('cancel'),
  });
  return { url: client.checkout.initCheckoutUrl(), method: 'POST', fields };
}

export function vndAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  if (!/^\d+(?:\.0{1,2})?$/.test(String(value))) return NaN;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : NaN;
}

export function parseGatewayOrder(order, payment) {
  if (!order || order.order_invoice_number !== payment.order_code || order.order_currency !== 'VND'
    || vndAmount(order.order_amount) !== payment.amount) {
    throw new AppError('Thông tin giao dịch không khớp đơn thanh toán.', 502, 'SEPAY_ORDER_MISMATCH');
  }
  if (order.order_status === 'CANCELLED') return { status: 'cancelled' };
  if (order.order_status !== 'CAPTURED') return { status: 'pending' };
  // The live bank-transfer API can report CAPTURED with an empty transactions array.
  // CAPTURED is the provider's authoritative paid state; retain the order as the receipt.
  if (Array.isArray(order.transactions) && order.transactions.length === 0
    && ['BANK_TRANSFER', 'NAPAS_BANK_TRANSFER'].includes(payment.payment_method)
    && typeof order.order_id === 'string' && /^[\w-]{1,128}$/.test(order.order_id)) {
    return { status: 'paid', transactionId: `pg-order:${payment.provider_payload?.environment}:${payment.provider_payload?.merchant_id}:${order.order_id}`,
      transaction: null, verification: 'captured_order' };
  }
  const transaction = Array.isArray(order.transactions) && order.transactions.find(item =>
    item.transaction_type === 'PAYMENT' && item.transaction_status === 'APPROVED'
      && item.transaction_currency === 'VND' && vndAmount(item.transaction_amount) === payment.amount
      && item.payment_method === payment.payment_method);
  const id = transaction?.id;
  if (!transaction || !['string', 'number'].includes(typeof id) || !/^[\w-]{1,128}$/.test(String(id))) {
    throw new AppError('Chưa xác minh được giao dịch thanh toán.', 502, 'SEPAY_TRANSACTION_INVALID');
  }
  return { status: 'paid', transactionId: `pg:${payment.provider_payload?.environment}:${payment.provider_payload?.merchant_id}:${id}`, transaction, verification: 'approved_transaction' };
}

export function pollingIntervalMs() {
  const interval = Number(process.env.SEPAY_POLL_INTERVAL_MS || 10000);
  if (!Number.isInteger(interval) || interval < 5000 || interval > 300000) {
    throw new AppError('Dịch vụ thanh toán chưa sẵn sàng.', 503, 'SEPAY_POLL_INTERVAL_INVALID');
  }
  return interval;
}

export async function fetchGatewayOrder(payment, { fetchImpl = globalThis.fetch, signal } = {}) {
  const config = gatewayApiConfig();
  if (payment.provider_payload?.environment !== config.environment || payment.provider_payload?.merchant_id !== config.merchantId) {
    throw new AppError('Dịch vụ thanh toán đã thay đổi. Cần đối soát đơn cũ.', 409, 'PAYMENT_CONFIG_CHANGED');
  }
  const origin = config.environment === 'sandbox' ? 'https://pgapi-sandbox.sepay.vn' : 'https://pgapi.sepay.vn';
  const timeout = AbortSignal.timeout(8000);
  const requestSignal = signal ? AbortSignal.any([timeout, signal]) : timeout;
  async function request(path) {
    try {
      const response = await fetchImpl(`${origin}/v1/${path}`, {
        method: 'GET', redirect: 'error', signal: requestSignal,
        headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${config.merchantId}:${config.secretKey}`).toString('base64')}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      // Never expose upstream responses, request headers, or merchant credentials.
      throw new AppError('Chưa thể kiểm tra giao dịch với SePay. Hệ thống sẽ thử lại.', 502, 'SEPAY_LOOKUP_UNAVAILABLE');
    }
  }
  const invoice = payment.order_code;
  if (typeof invoice !== 'string' || !/^CS[A-F0-9]{24}$/.test(invoice)) {
    throw new AppError('Chưa xác minh được đơn thanh toán.', 502, 'SEPAY_ORDER_INVALID');
  }
  // SePay's Node SDK and live API use order_invoice_number for this path.
  const result = await request(`order/detail/${encodeURIComponent(invoice)}`);
  if (!result) return null;
  if (result.data?.order_invoice_number !== invoice) throw new AppError('Thông tin đơn thanh toán không khớp.', 502, 'SEPAY_ORDER_MISMATCH');
  return result.data;
}
