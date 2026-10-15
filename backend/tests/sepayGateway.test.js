import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildGatewayCheckout, fetchGatewayOrder, gatewayConfig, parseGatewayOrder, pollingIntervalMs } from '../src/services/sepayGateway.js';

test('SePay gateway: cấu hình, chữ ký và tra cứu API không dùng IPN', async t => {
  Object.assign(process.env, { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173',
    PAYMENT_RETURN_ORIGIN: 'http://localhost:5173', SEPAY_ENV: 'sandbox',
    SEPAY_MERCHANT_ID: 'TEST_MERCHANT', SEPAY_SECRET_KEY: 'test-merchant-key',
    SEPAY_PAYMENT_METHOD: 'BANK_TRANSFER', SEPAY_POLL_INTERVAL_MS: '10000' });
  await t.test('form dùng URL SDK, chữ ký base64 và callback gắn đúng đơn', () => {
    const checkout = buildGatewayCheckout({ orderCode: 'CS0123456789ABCDEF01234567', amount: 30000, planId: 'pay-per-use', planName: 'Pay-per-use', userId: 'test-user' });
    assert.equal(checkout.url, 'https://pay-sandbox.sepay.vn/v1/checkout/init');
    const { signature, ...fields } = checkout.fields;
    assert.deepEqual(Object.keys(fields), ['merchant', 'operation', 'payment_method', 'order_invoice_number', 'order_amount', 'currency', 'order_description', 'customer_id', 'success_url', 'error_url', 'cancel_url']);
    const expected = createHmac('sha256', 'test-merchant-key').update(Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(',')).digest('base64');
    assert.equal(signature, expected);
    assert.equal(fields.order_amount, 30000);
    for (const [key, result] of [['success_url', 'success'], ['error_url', 'error'], ['cancel_url', 'cancel']]) {
      const url = new URL(fields[key]);
      assert.equal(url.pathname, '/checkout/pay-per-use');
      assert.equal(url.searchParams.get('order'), fields.order_invoice_number);
      assert.equal(url.searchParams.get('payment'), result);
    }
    assert.ok(!JSON.stringify(checkout).includes('test-merchant-key'));
    process.env.SEPAY_ENV = 'production';
    assert.equal(buildGatewayCheckout({ orderCode: 'CS0123456789ABCDEF01234567', amount: 30000, planId: 'lite', planName: 'Lite', userId: 'test-user' }).url, 'https://pay.sepay.vn/v1/checkout/init');
    process.env.SEPAY_ENV = 'sandbox';
  });
  await t.test('thiếu khóa hoặc origin lạ bị từ chối, production không dùng sandbox', () => {
    for (const key of ['SEPAY_MERCHANT_ID', 'SEPAY_SECRET_KEY']) {
      const previous = process.env[key]; process.env[key] = '';
      assert.throws(gatewayConfig, { code: 'SEPAY_GATEWAY_UNCONFIGURED' }); process.env[key] = previous;
    }
    process.env.PAYMENT_RETURN_ORIGIN = 'https://attacker.example';
    assert.throws(gatewayConfig, { code: 'PAYMENT_RETURN_ORIGIN_INVALID' });
    process.env.PAYMENT_RETURN_ORIGIN = 'http://localhost:5173';
    process.env.NODE_ENV = 'production';
    assert.throws(gatewayConfig);
    process.env.NODE_ENV = 'test';
  });
  const payment = { order_code: 'CS0123456789ABCDEF01234567', amount: 30000, payment_method: 'BANK_TRANSFER',
    provider_payload: { environment: 'sandbox', merchant_id: 'TEST_MERCHANT' } };
  const paidOrder = { order_id: 'SEPAY-TEST', order_invoice_number: payment.order_code, order_status: 'CAPTURED', order_currency: 'VND', order_amount: '30000.00',
    transactions: [{ id: 'test-id', transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_currency: 'VND', transaction_amount: '30000', payment_method: 'BANK_TRANSFER' }] };
  await t.test('chỉ nhận đúng invoice, tiền tệ, số tiền và giao dịch đã approved', () => {
    assert.equal(parseGatewayOrder(paidOrder, payment).status, 'paid');
    for (const [field, value] of [['order_amount', '30,000'], ['order_amount', '30000.01'], ['order_amount', true], ['order_currency', 'USD'], ['order_status', 'PENDING']]) {
      if (field === 'order_status') assert.equal(parseGatewayOrder({ ...paidOrder, [field]: value }, payment).status, 'pending');
      else assert.throws(() => parseGatewayOrder({ ...paidOrder, [field]: value }, payment), { code: 'SEPAY_ORDER_MISMATCH' });
    }
    for (const [field, value] of [['transaction_amount', '29999'], ['transaction_status', 'DECLINED'], ['transaction_type', 'REFUND'], ['transaction_currency', 'USD'], ['payment_method', 'CARD']]) {
      assert.throws(() => parseGatewayOrder({ ...paidOrder, transactions: [{ ...paidOrder.transactions[0], [field]: value }] }, payment), { code: 'SEPAY_TRANSACTION_INVALID' });
    }
    assert.throws(() => parseGatewayOrder({ ...paidOrder, order_invoice_number: 'OTHER' }, payment));
    assert.equal(parseGatewayOrder({ ...paidOrder, order_status: 'CANCELLED' }, payment).status, 'cancelled');
    assert.equal(parseGatewayOrder({ ...paidOrder, transactions: [{ ...paidOrder.transactions[0], id: 1 }] }, payment).status, 'paid');
    const captured = parseGatewayOrder({ ...paidOrder, transactions: [] }, payment);
    assert.equal(captured.status, 'paid');
    assert.equal(captured.verification, 'captured_order');
    assert.equal(captured.transaction, null);
    assert.ok(captured.transactionId.endsWith(':SEPAY-TEST'));
    assert.throws(() => parseGatewayOrder({ ...paidOrder, transactions: undefined }, payment));
    assert.throws(() => parseGatewayOrder({ ...paidOrder, order_id: '', transactions: [] }, payment));
    assert.throws(() => parseGatewayOrder({ ...paidOrder, order_amount: '1.00', transactions: [] }, payment));
  });
  await t.test('tra cứu bằng Basic Auth và mã invoice đúng theo SDK/API thực tế', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('TEST_MERCHANT:test-merchant-key').toString('base64')}`);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({ data: paidOrder });
    };
    assert.deepEqual(await fetchGatewayOrder(payment, { fetchImpl }), paidOrder);
    const detailUrl = `https://pgapi-sandbox.sepay.vn/v1/order/detail/${payment.order_code}`;
    assert.deepEqual(calls, [detailUrl]);
    calls.length = 0;
    await fetchGatewayOrder({ ...payment, provider_payload: { ...payment.provider_payload, sepay_order_id: 'SEPAY-TEST' } }, { fetchImpl });
    assert.deepEqual(calls, [detailUrl], 'Không dùng provider order_id cũ thay cho invoice.');
    assert.equal(await fetchGatewayOrder(payment, { fetchImpl: async () => new Response('', { status: 404 }) }), null);
    await assert.rejects(fetchGatewayOrder(payment, { fetchImpl: async () => Response.json({ data: { ...paidOrder, order_invoice_number: 'OTHER' } }) }), { code: 'SEPAY_ORDER_MISMATCH' });
    await assert.rejects(fetchGatewayOrder(payment, { fetchImpl: async () => new Response('', { status: 429 }) }), { code: 'SEPAY_LOOKUP_UNAVAILABLE' });
    await assert.rejects(fetchGatewayOrder(payment, { fetchImpl: async () => { throw new Error('secret'); } }), { code: 'SEPAY_LOOKUP_UNAVAILABLE' });
    await assert.rejects(fetchGatewayOrder({ ...payment, provider_payload: { ...payment.provider_payload, merchant_id: 'WRONG' } }, { fetchImpl }), { code: 'PAYMENT_CONFIG_CHANGED' });
  });
  await t.test('khoảng polling có giới hạn để tránh gọi API liên tục', () => {
    assert.equal(pollingIntervalMs(), 10000);
    process.env.SEPAY_POLL_INTERVAL_MS = '1';
    assert.throws(pollingIntervalMs, { code: 'SEPAY_POLL_INTERVAL_INVALID' });
    process.env.SEPAY_POLL_INTERVAL_MS = '10000';
  });
});
