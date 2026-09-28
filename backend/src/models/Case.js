import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  summary: { type: String, required: true },
  full_document: { type: String, required: true },
  category: { type: String, required: true },
  source_url: String,
  source_note: String,
  reference_date: String,
  reference_date_note: String,
  legal_scope_note: String,
  case_facts: { type: [new mongoose.Schema({ kind: { type: String, enum: ['recorded_event', 'party_statement', 'unproven'] }, quote: String, source_type: { type: String, enum: ['judgment', 'case_outline'] }, party: String }, { _id: false })], default: [] },
  parties: { type: [new mongoose.Schema({ side: { type: String, enum: ['plaintiff', 'defendant', 'other'] }, name: String, claims: [String] }, { _id: false })], default: [] },
  timeline: { type: [new mongoose.Schema({
    kind: { type: String, enum: ['conduct', 'transaction', 'dispute', 'filing', 'hearing'], required: true },
    date: String, date_to: String, description: String, source_quote: String,
    status: { type: String, enum: ['reported', 'assumed'], default: 'reported' },
  }, { _id: false })], default: [] },
  evidence_inventory: { type: [new mongoose.Schema({
    id: String, summary: String, content: String, provided_by: String, date: String,
    name: String, availability: { type: String, enum: ['provided', 'mentioned_only'], required: true },
    source_quote: String,
  }, { _id: false })], default: [] },
  created_at: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);
export default Case;
