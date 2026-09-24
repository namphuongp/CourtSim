import mongoose from 'mongoose';

const simulationSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  user_court_role: { type: String, required: true },
  difficulty: { type: String, enum: ['beginner', 'balanced', 'advanced'], default: 'balanced' },
  turn_count: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  completed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

simulationSessionSchema.index({ user_id: 1, created_at: -1 });

const SimulationSession = mongoose.model('SimulationSession', simulationSessionSchema);
export default SimulationSession;
