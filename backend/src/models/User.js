import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
  password_hash: { type: String, default: null, select: false },
  auth_version: { type: Number, default: 0, min: 0 },
  google_email: { type: String, maxlength: 254 },
  google_id: { type: String },
  email_verified: { type: Boolean, default: false },
  survey_verified_at: { type: Date, default: null },
  auth_providers: { type: [String], enum: ['password', 'google'], default: [] },
  system_role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscription_type: { type: String, enum: ['free', 'plus', 'pro'], default: 'free' },
  status: { type: String, enum: ['active', 'banned'], default: 'active' },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
userSchema.index({ google_id: 1 }, { unique: true, partialFilterExpression: { google_id: { $type: 'string' } } });

userSchema.index({ created_at: -1 });
const User = mongoose.model('User', userSchema);
export default User;
