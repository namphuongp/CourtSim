import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'LegalCorpusVersion' },
  locator_key: { type: String, required: true },
  article: String, paragraph: String, point: String, chapter: String, section: String,
  locator: String, text: { type: String, required: true },
  page_from: Number, page_to: Number, page_source_file: String,
  search_tokens: [String],
}, { timestamps: false });
schema.index({ document_id: 1, locator_key: 1 }, { unique: true });
schema.index({ document_id: 1, article: 1, paragraph: 1, point: 1 });
schema.index({ document_id: 1, search_tokens: 1 });
export default mongoose.model('LegalCorpusProvision', schema);
