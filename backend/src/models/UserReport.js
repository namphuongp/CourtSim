import mongoose from 'mongoose';

const userReportSchema = new mongoose.Schema({
  reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reported_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const UserReport = mongoose.model('UserReport', userReportSchema);
export default UserReport;