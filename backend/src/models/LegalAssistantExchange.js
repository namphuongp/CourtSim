import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  request_id: { type: String, required: true }, question: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  token: String, expires_at: Date,
  answer: String, citations: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  verification_status: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
schema.index({ session_id: 1, request_id: 1 }, { unique: true });
schema.index({ session_id: 1, user_id: 1, created_at: 1 });
export default mongoose.model('LegalAssistantExchange', schema);
