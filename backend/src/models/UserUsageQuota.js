import mongoose from 'mongoose';

const userUsageQuotaSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  voice_seconds_used: { type: Number, default: 0 },
  ai_messages_used: { type: Number, default: 0 },
  cases_played: { type: Number, default: 0 },
  reset_date: { type: Date, required: true }
});

const UserUsageQuota = mongoose.model('UserUsageQuota', userUsageQuotaSchema);
export default UserUsageQuota;