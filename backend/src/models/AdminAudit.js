import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  admin_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['USER_DISABLED', 'USER_ENABLED', 'FEEDBACK_STATUS_CHANGED', 'FEEDBACK_DELETED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED'], required: true },
  target_type: { type: String, enum: ['user', 'feedback', 'payment'], required: true },
  target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  created_at: { type: Date, default: Date.now },
});
schema.index({ created_at: -1 });
export default mongoose.model('AdminAudit', schema);
