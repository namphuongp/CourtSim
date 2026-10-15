import mongoose from 'mongoose';

const amendmentSchema = new mongoose.Schema({
  law_number: { type: String, required: true },
  title: { type: String, required: true },
  promulgated_at: { type: String, default: null },
  effective_from: { type: String, required: true },
  source_url: { type: String, default: '' },
  note: { type: String, required: true },
}, { _id: false });

const sourceFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sha256: { type: String, required: true },
  page_count: { type: Number, default: null },
}, { _id: false });

const effectiveRuleSchema = new mongoose.Schema({
  articles: { type: [String], required: true },
  effective_from: { type: String, required: true },
  source_locator: { type: String, required: true },
  note: { type: String, required: true },
}, { _id: false });

const legalDocumentSchema = new mongoose.Schema({
  law_number: { type: String, required: true },
  title: { type: String, required: true },
  issuing_body: { type: String, required: true },
  promulgated_at: { type: String, required: true },
  original_effective_from: { type: String, required: true },
  effective_from: { type: String, required: true },
  effective_to: { type: String, default: null },
  verified_through: { type: String, required: true },
  scope_locator: { type: String, required: true },
  scope_text: { type: String, default: '' },
  source_text: { type: String, required: true },
  source_status: { type: String, enum: ['verified_current', 'amended_text_unavailable', 'unverified'], required: true },
  version_label: { type: String, default: 'Bản gốc' },
  history_url: String,
  version_rules: { type: [new mongoose.Schema({
    version: { type: String, required: true }, from: { type: String, required: true }, to: { type: String, required: true },
    articles: [String], excluded_articles: [String], event_kinds: [String],
    source_checked: Boolean, history_checked: Boolean,
    transition_status: { type: String, enum: ['reviewed', 'unresolved'], required: true },
    application_note: String, review_sources: [String], reviewed_at: String,
    evidence: [{ kind: String, url: String, sha256: String, quote: String, _id: false }],
  }, { _id: false })], default: [] },
  temporal_note: { type: String, required: true },
  source_url: { type: String, default: '' },
  consolidated_source_url: { type: String, default: null },
  amendments: { type: [amendmentSchema], default: [] },
  effective_rules: { type: [effectiveRuleSchema], default: [] },
  source_files: { type: [sourceFileSchema], required: true },
  source_fingerprint: { type: String, required: true },
  imported_at: { type: Date, default: Date.now },
}, { timestamps: false });

legalDocumentSchema.index({ law_number: 1, source_fingerprint: 1 }, { unique: true });

const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema);
export default LegalDocument;
