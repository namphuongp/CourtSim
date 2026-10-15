import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  source_url: { type: String, required: true, unique: true }, law_number: String, title: String,
  source_text: String, source_sha256: String, checked_at: Date, parser_version: Number,
  source_verification: { type: String, enum: ['web_read', 'verified'] }, law_country: { type: String, enum: ['VN'] },
  research_scope: { type: String, enum: ['land_dispute'] }, version: String, document_type: String,
});
schema.index({ checked_at: 1 }, { expireAfterSeconds: 86400 });
export default mongoose.model('WebLawSnapshot', schema);
