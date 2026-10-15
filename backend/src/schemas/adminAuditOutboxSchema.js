import mongoose from 'mongoose';

// Stored atomically with the mutation. The same event ID is used when delivering retries.
export const adminAuditOutboxSchema = new mongoose.Schema({
  admin_user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  target_type: { type: String, required: true },
  target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  created_at: { type: Date, required: true },
});
