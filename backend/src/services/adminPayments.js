import mongoose from 'mongoose';
import PaymentTransaction from '../models/PaymentTransaction.js';
import PaymentAudit from '../models/PaymentAudit.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { objectId, queryOptions, literalRegex, dateRange } from './adminQuery.js';

const paid = { $in: ['$status', ['paid', 'success']] };
const pending = { $in: ['$status', ['pending', 'submitted', 'processing']] };
const summaryFields = {
  totalOrders: { $sum: 1 },
  paidCount: { $sum: { $cond: [paid, 1, 0] } },
  paidAmount: { $sum: { $cond: [paid, '$amount', 0] } },
  pendingCount: { $sum: { $cond: [pending, 1, 0] } },
  pendingAmount: { $sum: { $cond: [pending, '$amount', 0] } },
};
const emptySummary = { totalOrders: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0 };

export function publicAdminPayment(transaction) {
  const payload = transaction.provider_payload ?? {};
  return {
    id: transaction._id, transaction_id: transaction.transaction_id,
    order_code: transaction.order_code ?? payload.order_code ?? transaction.transaction_id,
    amount: transaction.amount,
    status: ({ success: 'paid', failed: 'cancelled', submitted: 'pending' })[transaction.status] ?? transaction.status,
    provider: transaction.provider, type: transaction.type, payment_method: transaction.payment_method,
    paid_at: transaction.paid_at, expires_at: transaction.expires_at,
    created_at: transaction.created_at, updated_at: transaction.updated_at,
    user: transaction.user ?? (transaction.user_id?.username ? { _id: transaction.user_id._id, username: transaction.user_id.username, email: transaction.user_id.email } : null),
    plan: { id: payload.plan_id, name: payload.plan_name, payment_purpose: payload.payment_purpose },
    payment: payload.payment,
    note: payload.admin_note ?? '',
    verification: { checked_at: payload.polled_at ?? null, available: payload.poll_status !== 'error',
      source: payload.paid_by ?? null, proof: transaction.raw_transaction?.verification ?? null,
      provider_order_id: payload.sepay_order_id ?? transaction.raw_transaction?.order?.order_id ?? null,
      provider_status: transaction.raw_transaction?.order?.order_status ?? null },
  };
}

export async function adminPaymentList(query, scopedUserId) {
  const { view = 'transactions', user_id: userId, ...options } = query;
  if (!['transactions', 'users'].includes(view)) throw new AppError('Chế độ xem không hợp lệ.');
  const opts = queryOptions(options, view === 'users'
    ? ['paidAmount', 'pendingAmount', 'totalOrders', 'lastPaymentAt'] : ['created_at', 'updated_at', 'amount', 'status']);
  const filter = {};
  if (userId !== undefined && (typeof userId !== 'string' || !userId)) throw new AppError('Người dùng không hợp lệ.');
  if (scopedUserId || userId) filter.user_id = objectId(scopedUserId ?? userId);
  if (options.status) {
    const statuses = { paid: ['paid', 'success'], success: ['paid', 'success'], pending: ['pending', 'submitted'], submitted: ['pending', 'submitted'],
      cancelled: ['cancelled', 'failed'], failed: ['cancelled', 'failed'], processing: ['processing'], expired: ['expired'], refunded: ['refunded'] };
    if (!Object.hasOwn(statuses, options.status)) throw new AppError('Trạng thái thanh toán không hợp lệ.');
    filter.status = { $in: statuses[options.status] };
  }
  if (options.range) filter.created_at = dateRange(options).match;
  const pipeline = [{ $match: filter }, { $lookup: { from: User.collection.name, localField: 'user_id', foreignField: '_id',
    pipeline: [{ $project: { username: 1, email: 1 } }], as: 'user' } }, { $set: { user: { $arrayElemAt: ['$user', 0] } } }];
  if (opts.search) {
    const search = { $regex: literalRegex(opts.search), $options: 'i' };
    pipeline.push({ $match: { $or: [{ transaction_id: search }, { order_code: search }, { 'user.username': search }, { 'user.email': search }] } });
  }
  const grouped = view === 'users' ? [{ $group: { _id: '$user_id', user: { $first: '$user' }, ...summaryFields,
    lastPaymentAt: { $max: { $cond: [paid, { $ifNull: ['$paid_at', '$updated_at'] }, null] } } } }] : [];
  pipeline.push({ $facet: {
    summary: [{ $group: { _id: null, ...summaryFields } }],
    total: [...grouped, { $count: 'count' }],
    items: [...grouped, { $sort: opts.sort }, { $skip: opts.skip }, { $limit: opts.limit }],
  } });
  const [result] = await PaymentTransaction.aggregate(pipeline);
  const { _id, ...summary } = result.summary[0] ?? emptySummary;
  return { data: view === 'users' ? result.items : result.items.map(publicAdminPayment), summary,
    pagination: { total: result.total[0]?.count ?? 0, page: opts.page, limit: opts.limit } };
}

export async function findAdminPayment(identifier) {
  if (typeof identifier !== 'string' || identifier.length > 100) throw new AppError('Mã thanh toán không hợp lệ.');
  const alternatives = [{ transaction_id: identifier }, { order_code: identifier }];
  if (mongoose.isObjectIdOrHexString(identifier)) alternatives.push({ _id: objectId(identifier) });
  const payment = await PaymentTransaction.findOne({ $or: alternatives });
  if (!payment) throw new AppError('Không tìm thấy giao dịch thanh toán.', 404, 'PAYMENT_NOT_FOUND');
  return payment;
}

export async function adminPaymentDetail(identifier) {
  const payment = await findAdminPayment(identifier);
  await payment.populate('user_id', 'username email');
  const audits = await PaymentAudit.find({ payment_id: payment._id }).select('action amount created_at').sort({ created_at: -1 }).limit(20).lean();
  return { data: { ...publicAdminPayment(payment), audits } };
}
