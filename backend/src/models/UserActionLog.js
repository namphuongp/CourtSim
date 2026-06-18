import mongoose from 'mongoose';

const userActionLogSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true },
  action_type: { type: String, required: true },
  action_details: { type: String },
  duration: { type: Number, default: null },
  created_at: { type: Date, default: Date.now }
});

const UserActionLog = mongoose.model('UserActionLog', userActionLogSchema);
export default UserActionLog;