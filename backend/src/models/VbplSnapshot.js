import mongoose from 'mongoose';

// Chỉ adapter đối chiếu nguồn được ghi collection này; không nhập trạng thái từ seed/model.
const schema = new mongoose.Schema({
  source_url: { type: String, required: true, unique: true },
  law_number: { type: String, required: true, index: true },
  title: { type: String, required: true },
  document_type: { type: String, required: true },
  source_text: { type: String, default: '' },
  source_sha256: { type: String, required: true },
  checked_at: { type: Date, required: true },
  version: { type: String, required: true },
  source_verification: { type: String, enum: ['verified'], required: true },
  parser_version: { type: Number, required: true },
}, { timestamps: false });
export default mongoose.model('VbplSnapshot', schema);
