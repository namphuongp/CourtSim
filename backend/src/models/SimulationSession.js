import mongoose from 'mongoose';

const simulationSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  user_court_role: { type: String, required: true, immutable: true },
  case_event_date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  difficulty: { type: String, enum: ['beginner', 'balanced', 'advanced'], default: 'balanced' },
  turn_count: { type: Number, default: 0, min: 0 },
  creation_request_id: { type: String },
  access_ready: { type: Boolean },
  access_plan: { type: String, enum: ['freemium', 'pay-per-use', 'lite', 'pro'] },
  case_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  opening: { type: mongoose.Schema.Types.Mixed, default: null },
  // Ghi cả lượt và biên bản trong một document để MongoDB standalone cũng nguyên tử.
  turns: { type: [mongoose.Schema.Types.Mixed], default: [] },
  evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
  operation: { type: mongoose.Schema.Types.Mixed, default: null },
  conversation: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  feedback_prompted_at: { type: Date, default: null },
  feedback_submitted_at: { type: Date, default: null },
  survey_receipt: { type: new mongoose.Schema({
    response_id: { type: String, required: true, maxlength: 256 },
    verified_at: { type: Date, required: true },
  }, { _id: false }), default: undefined },
  feedback: { type: new mongoose.Schema({
    content: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['new', 'viewed', 'resolved'], default: 'new' },
    notes: { type: String, maxlength: 2000, default: '' },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
  }, { _id: false }), default: undefined },
  completed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

simulationSessionSchema.index({ 'feedback.status': 1, 'feedback.created_at': -1 }, { partialFilterExpression: { 'feedback.created_at': { $exists: true } } });
simulationSessionSchema.index({ user_id: 1, created_at: -1 });
simulationSessionSchema.index({ 'survey_receipt.response_id': 1 }, { unique: true, partialFilterExpression: { 'survey_receipt.response_id': { $type: 'string' } } });
simulationSessionSchema.index({ user_id: 1, creation_request_id: 1 }, { unique: true, partialFilterExpression: { creation_request_id: { $type: 'string' } } });

simulationSessionSchema.index({ created_at: -1 });
simulationSessionSchema.index({ status: 1, created_at: -1 });
simulationSessionSchema.index({ completed_at: -1 });
const SimulationSession = mongoose.model('SimulationSession', simulationSessionSchema);
export default SimulationSession;
