import mongoose from 'mongoose';

const aiPersonalSchema = new mongoose.Schema({
  role_name: { type: String, required: true, unique: true },
  system_prompt: { type: String, required: true },
  model_id: { type: String, required: true },
  temperature: { type: Number, required: true, min: 0.0, max: 1.0, default: 0.7 }
});

const AiPersonal = mongoose.model('AiPersonal', aiPersonalSchema);
export default AiPersonal;