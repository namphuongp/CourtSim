import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
  password_hash: { type: String, required: true, select: false },
  system_role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscription_type: { type: String, enum: ['free', 'plus', 'pro'], default: 'free' },
  status: { type: String, enum: ['active', 'banned'], default: 'active' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
export default User;
