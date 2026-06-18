import mongoose from 'mongoose';

const trialResultSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true, unique: true },
  verdict: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 10 },
  feedback: { type: String, required: true },
  improvement_suggestions: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const TrialResult = mongoose.model('TrialResult', trialResultSchema);
export default TrialResult;