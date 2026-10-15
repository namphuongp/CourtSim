import mongoose from 'mongoose';
import { adminAuditOutboxSchema } from '../schemas/adminAuditOutboxSchema.js';

const paymentTransactionSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, unique: true },
  order_code: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ['case', 'lite', 'pro'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'paid', 'expired', 'cancelled', 'submitted', 'success', 'failed', 'refunded'], required: true, default: 'pending' },
  provider: { type: String, required: true, default: 'sepay_bank_transfer' },
  payment_method: { type: String, default: 'bank_transfer' },
  sepay_transaction_id: { type: String },
  reference_code: { type: String, default: null },
  paid_at: { type: Date, default: null },
  expires_at: { type: Date, required: true },
  raw_transaction: { type: mongoose.Schema.Types.Mixed, default: null },
  next_poll_at: { type: Date, default: null },
  poll_lease_until: { type: Date, default: null },
  poll_lease_token: { type: String, default: null },
  provider_payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  admin_audit_outbox: { type: [adminAuditOutboxSchema], default: undefined, select: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

paymentTransactionSchema.index({ sepay_transaction_id: 1 }, { unique: true, sparse: true });
paymentTransactionSchema.index({ user_id: 1, created_at: -1 });
paymentTransactionSchema.index({ status: 1, created_at: -1 });
paymentTransactionSchema.index({ provider: 1, status: 1, next_poll_at: 1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
