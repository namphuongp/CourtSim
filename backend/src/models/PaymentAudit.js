import mongoose from 'mongoose';

const paymentAuditSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null },
  order_code: { type: String, default: null },
  sepay_transaction_id: { type: String, default: null },
  amount: { type: Number, default: null },
  reason: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
});

paymentAuditSchema.index({ created_at: -1 });
paymentAuditSchema.index({ order_code: 1, created_at: -1 });

export default mongoose.model('PaymentAudit', paymentAuditSchema);
