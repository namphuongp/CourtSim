import mongoose from 'mongoose';

const subscriptionHistorySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscription_type: { type: String, enum: ['plus', 'pro'], required: true },
  amount: { type: Number, required: true },
  payment_status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  created_at: { type: Date, default: Date.now }
});

const SubscriptionHistory = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
export default SubscriptionHistory;