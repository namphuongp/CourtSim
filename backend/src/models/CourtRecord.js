import mongoose from 'mongoose';

const courtRecordSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true },
  sender_type: { type: String, enum: ['user', 'ai_judge', 'ai_prosecutor', 'ai_opponent'], required: true },
  sender_name: { type: String, required: true },
  content: { type: String, required: true },
  audio_url: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
});

courtRecordSchema.index({ session_id: 1, created_at: 1 });

const CourtRecord = mongoose.model('CourtRecord', courtRecordSchema);
export default CourtRecord;
