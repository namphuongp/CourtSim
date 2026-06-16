import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  summary: { type: String, required: true },
  full_document: { type: String, required: true },
  category: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);
export default Case;