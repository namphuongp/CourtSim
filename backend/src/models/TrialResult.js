import mongoose from 'mongoose';
import { legalCitationSchema } from '../schemas/legalCitationSchema.js';

const factAnalysisSchema = new mongoose.Schema({
  established_facts: { type: [String], default: [] },
  inferences: { type: [String], default: [] },
  missing_facts: { type: [String], default: [] },
}, { _id: false });

const trialResultSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true, unique: true },
  verdict: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  rubric_scores: {
    legal_knowledge: { type: Number, min: 0, max: 100 },
    reasoning: { type: Number, min: 0, max: 100 },
    evidence_use: { type: Number, min: 0, max: 100 },
    courtroom_skill: { type: Number, min: 0, max: 100 },
  },
  feedback: { type: String, required: true },
  improvement_suggestions: { type: String, required: true },
  citations: { type: [legalCitationSchema], default: [] },
  citation_warnings: { type: [String], default: [] },
  fact_analysis: { type: factAnalysisSchema, default: () => ({}) },
  created_at: { type: Date, default: Date.now }
});

const TrialResult = mongoose.model('TrialResult', trialResultSchema);
export default TrialResult;
