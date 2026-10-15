import PaymentTransaction from '../models/PaymentTransaction.js';
import { pollGatewayPayment } from './paymentService.js';
import { flushPendingAdminAudits } from './adminAuditOutbox.js';

export async function pollDuePayments(dependencies = {}) {
  await flushPendingAdminAudits();
  const now = new Date();
  const payments = await PaymentTransaction.find({
    // Verified claims must finish even after 24h, including manual/legacy payments.
    $or: [{ status: 'processing' }, { provider: 'sepay_gateway', status: { $in: ['pending', 'expired'] },
      created_at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }],
    $and: [
      { $or: [{ next_poll_at: null }, { next_poll_at: { $lte: now } }] },
      { $or: [{ poll_lease_until: null }, { poll_lease_until: { $lte: now } }] },
    ],
  }).sort({ next_poll_at: 1, created_at: 1 }).limit(10);
  for (const payment of payments) {
    if (dependencies.signal?.aborted) break;
    try { await pollGatewayPayment(payment, dependencies); }
    catch { /* The per-order audit and retry schedule are persisted by pollGatewayPayment. */ }
  }
}

export function startPaymentPolling(dependencies = {}) {
  const controller = new AbortController();
  let timer;
  let running = Promise.resolve();
  function schedule() {
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      running = pollDuePayments({ ...dependencies, signal: controller.signal })
        .catch(() => console.error('Không thể kiểm tra các đơn thanh toán. Sẽ thử lại.'))
        .finally(schedule);
    }, 5000);
    timer.unref();
  }
  schedule();
  return async () => {
    controller.abort();
    clearTimeout(timer);
    await running;
  };
}
