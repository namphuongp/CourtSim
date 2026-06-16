import mongoose from 'mongoose';

const simulationSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  user_court_role: { type: String, required: true },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  created_at: { type: Date, default: Date.now }
});

const SimulationSession = mongoose.model('SimulationSession', simulationSessionSchema);
export default SimulationSession;