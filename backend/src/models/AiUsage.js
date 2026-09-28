import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession' },
  role: { type: String, enum: ['judge', 'opponent', 'evaluator', 'legal_assistant', 'voice', 'other'], required: true },
  provider: String, model: String,
  input_tokens: { type: Number, default: null }, cached_input_tokens: { type: Number, default: null },
  output_tokens: { type: Number, default: null }, audio_seconds: { type: Number, default: null },
  latency_ms: Number, success: Boolean, error_type: String,
  estimated_cost: { type: Number, default: null }, currency: { type: String, default: 'USD' }, pricing_version: String,
  created_at: { type: Date, default: Date.now },
}, { bufferCommands: false });
schema.index({ created_at: -1 });
schema.index({ session_id: 1, created_at: -1 });
export default mongoose.model('AiUsage', schema);
