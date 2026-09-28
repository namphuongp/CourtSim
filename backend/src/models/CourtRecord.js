import mongoose from 'mongoose';
import { legalCitationSchema } from '../schemas/legalCitationSchema.js';

const factAnalysisSchema = new mongoose.Schema({
  learner_claims: { type: [String], default: [] },
  established_facts: { type: [String], default: [] },
  inferences: { type: [String], default: [] },
  missing_facts: { type: [String], default: [] },
}, { _id: false });

const courtRecordSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true },
  sender_type: { type: String, enum: ['user', 'ai_judge', 'ai_prosecutor', 'ai_opponent'], required: true },
  sender_name: { type: String, required: true },
  content: { type: String, required: true },
  fact_analysis: { type: factAnalysisSchema, default: () => ({}) },
  citations: { type: [legalCitationSchema], default: [] },
  citation_warnings: { type: [String], default: [] },
  legal_research: mongoose.Schema.Types.Mixed,
  audio_url: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
});

courtRecordSchema.index({ session_id: 1, created_at: 1 });

const CourtRecord = mongoose.model('CourtRecord', courtRecordSchema);
export default CourtRecord;
