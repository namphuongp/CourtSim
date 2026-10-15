import mongoose from 'mongoose';

const legalProvisionSchema = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalDocument', required: true },
  law_number: { type: String, required: true },
  article: { type: String, required: true },
  paragraph: { type: String, default: null },
  point: { type: String, default: null },
  locator: { type: String, required: true },
  locator_key: { type: String, required: true },
  text: { type: String, required: true },
  effective_from: { type: String, required: true },
  effective_to: { type: String, default: null },
  source_files: { type: [String], required: true },
  page_source_file: { type: String, default: null },
  page_from: { type: Number, default: null },
  page_to: { type: Number, default: null },
  citation_eligible: { type: Boolean, required: true },
  search_tokens: { type: [String], default: [] },
}, { timestamps: false });

legalProvisionSchema.index({ document_id: 1, locator_key: 1 }, { unique: true });
legalProvisionSchema.index({ document_id: 1, citation_eligible: 1, search_tokens: 1 });
legalProvisionSchema.index({ law_number: 1, article: 1, paragraph: 1, point: 1 });

const LegalProvision = mongoose.model('LegalProvision', legalProvisionSchema);
export default LegalProvision;
