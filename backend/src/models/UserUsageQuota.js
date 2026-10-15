import mongoose from 'mongoose';

const userUsageQuotaSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  voice_seconds_used: { type: Number, default: 0 },
  ai_messages_used: { type: Number, default: 0 },
  cases_played: { type: Number, default: 0 },
  case_credits: { type: Number, default: 0 },
  applied_payment_ids: { type: [String], default: [] },
  free_cases_used: { type: Number, min: 0, max: 2 },
  // Chỉ giữ các lượt đang cấp quyền. Trừ lượt và ghi yêu cầu trong cùng document.
  case_allocations: { type: [new mongoose.Schema({ request_id: String, source: String, plan: String }, { _id: false })], default: [] },
  reset_date: { type: Date, required: true }
});

const UserUsageQuota = mongoose.model('UserUsageQuota', userUsageQuotaSchema);
export default UserUsageQuota;
