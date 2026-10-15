import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Injected transport for tests only; production always calls SePay's fixed HTTPS origins.
export function createSepayFixture(merchantId, secretKey) {
  const orders = new Map();
  const calls = [];
  const control = { status: 200 };
  return { orders, calls, control,
    pending(payment) {
      const order = { id: randomUUID(), order_id: `SEPAY-${payment.orderCode}`, order_invoice_number: payment.orderCode,
        order_status: 'AUTHENTICATION_NOT_NEEDED', order_amount: `${payment.amount}.00`, order_currency: 'VND', transactions: [] };
      orders.set(payment.orderCode, order);
      return order;
    },
    paid(order, transactionId = randomUUID()) {
      order.order_status = 'CAPTURED';
      order.transactions = [{ id: transactionId, transaction_status: 'APPROVED', transaction_type: 'PAYMENT',
        transaction_currency: 'VND', transaction_amount: String(Number(order.order_amount)), payment_method: 'BANK_TRANSFER' }];
      return order;
    },
    async fetchImpl(url, options) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://pgapi-sandbox.sepay.vn');
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from(`${merchantId}:${secretKey}`).toString('base64')}`);
      calls.push(parsed.href);
      if (control.status !== 200) return new Response('', { status: control.status });
      if (parsed.pathname === '/v1/order') {
        return Response.json({ data: [...orders.values()].filter(order => order.order_invoice_number.includes(parsed.searchParams.get('q'))), meta: { has_more: false } });
      }
      const order = [...orders.values()].find(item => parsed.pathname === `/v1/order/detail/${item.order_invoice_number}`);
      return order ? Response.json({ data: order }) : new Response('', { status: 404 });
    },
  };
}
