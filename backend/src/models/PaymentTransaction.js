import mongoose from 'mongoose';

const paymentTransactionSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  provider: { type: String, required: true },
  provider_payload: { type: mongoose.Schema.Types.Mixed, required: true }, // Lưu JSON linh hoạt từ cổng thanh toán
  status: { type: String, enum: ['success', 'failed', 'refunded'], required: true }
});

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;