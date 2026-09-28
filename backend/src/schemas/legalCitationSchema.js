import mongoose from 'mongoose';

export const legalCitationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  law_number: { type: String, required: true },
  title: { type: String, required: true },
  article: { type: String, required: true },
  paragraph: { type: String, default: null },
  point: { type: String, default: null },
  locator: { type: String, required: true },
  text: { type: String, required: true },
  source_files: { type: [String], default: [] },
  page_source_file: { type: String, default: null },
  source_url: { type: String, required: true },
  page_from: { type: Number, default: null },
  page_to: { type: Number, default: null },
  temporal_note: { type: String, required: true },
  effective_from: { type: String, required: true },
  verified_through: { type: String, required: true },
}, { _id: false });
