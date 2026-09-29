import mongoose from 'mongoose';

// Kho mới tách khỏi bản nhập cũ chưa có bằng chứng quyền sử dụng.
const schema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true },
  law_number: { type: String, required: true, index: true },
  title: { type: String, required: true },
  issuing_body: String,
  promulgated_at: String,
  document_kind: { type: String, enum: ['original', 'amendment', 'consolidated', 'annex'], required: true },
  status: { type: String, enum: ['verified', 'reference', 'needs_review', 'pending_permission', 'unavailable'], required: true },
  permission_status: { type: String, enum: ['allowed', 'pending_permission'], required: true },
  permission_evidence: String,
  source_url: String,
  source_sha256: String,
  checked_at: Date,
  source_verification: String,
  version: String,
  source_files: [{ path: String, sha256: String, page_count: Number, official_url: String, archive_file: String, _id: false }],
  source_priority: { type: Number, default: 0 },
  import_notes: [String],
  version_rules: { type: [mongoose.Schema.Types.Mixed], default: [] },
  relations: { type: [mongoose.Schema.Types.Mixed], default: [] },
  imported_at: { type: Date, default: Date.now },
  retired_at: Date,
}, { timestamps: false });
export default mongoose.model('LegalCorpusVersion', schema);
