import mongoose from 'mongoose';

const simulationSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  user_court_role: { type: String, required: true },
  case_event_date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
  difficulty: { type: String, enum: ['beginner', 'balanced', 'advanced'], default: 'balanced' },
  turn_count: { type: Number, default: 0, min: 0 },
  creation_request_id: { type: String },
  case_snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  opening: { type: mongoose.Schema.Types.Mixed, default: null },
  // Ghi cả lượt và biên bản trong một document để MongoDB standalone cũng nguyên tử.
  turns: { type: [mongoose.Schema.Types.Mixed], default: [] },
  evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
  operation: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  completed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

simulationSessionSchema.index({ user_id: 1, created_at: -1 });
simulationSessionSchema.index({ user_id: 1, creation_request_id: 1 }, { unique: true, partialFilterExpression: { creation_request_id: { $type: 'string' } } });

const SimulationSession = mongoose.model('SimulationSession', simulationSessionSchema);
export default SimulationSession;
