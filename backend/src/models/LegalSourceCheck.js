import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  law_number: { type: String, required: true, unique: true },
  checked_at: Date,
  status: { type: String, enum: ['unavailable', 'pending_review', 'disabled'], required: true },
  message: String,
  // HTML gốc chỉ để kiểm tra nội bộ; không render và không đưa vào ngữ cảnh AI.
  snapshots: [{ url: String, sha256: String, content: String, http_status: Number, _id: false }],
});
export default mongoose.model('LegalSourceCheck', schema);
