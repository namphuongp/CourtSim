import mongoose from 'mongoose';
import { legalCitationSchema } from '../schemas/legalCitationSchema.js';

const factAnalysisSchema = new mongoose.Schema({
  learner_claims: { type: [String], default: [] },
  established_facts: { type: [String], default: [] },
  inferences: { type: [String], default: [] },
  missing_facts: { type: [String], default: [] },
}, { _id: false });

const trialResultSchema = new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SimulationSession', required: true, unique: true },
  verdict: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  rubric_version: String,
  rubric_source: String,
  rubric_source_sha256: String,
  rubric_status: String,
  criteria: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  assessment_status: String,
  legal_assessment_mode: String, assessment_note: String,
  earned_score: Number,
  assessed_max: Number,
  score_scope: String,
  legal_research: mongoose.Schema.Types.Mixed,
  rubric_scores: {
    issue_identification: Number,
    legal_application: Number,
    evidence_analysis: Number,
    legal_reasoning: Number,
    rebuttal: Number,
    adaptation: Number,
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
