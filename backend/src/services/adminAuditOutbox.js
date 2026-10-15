import mongoose from 'mongoose';
import AdminAudit from '../models/AdminAudit.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import User from '../models/User.js';

export function adminAuditEvent(adminUserId, action, targetType, targetId) {
  return { _id: new mongoose.Types.ObjectId(), admin_user_id: adminUserId, action,
    target_type: targetType, target_id: targetId, created_at: new Date() };
}

export async function flushAdminAuditOutbox(Model, id) {
  try {
    const document = await Model.findById(id).select('+admin_audit_outbox').lean();
    for (const event of document?.admin_audit_outbox ?? []) {
      await AdminAudit.updateOne({ _id: event._id }, { $setOnInsert: event }, { upsert: true });
      // A crash between delivery and removal only replays the same event ID.
      await Model.updateOne({ _id: id }, { $pull: { admin_audit_outbox: { _id: event._id } } });
    }
  } catch {
    console.warn('ADMIN_AUDIT_DELIVERY_PENDING');
    // Keep the durable outbox and return the already committed business result.
  }
}

export async function flushPendingAdminAudits() {
  for (const Model of [PaymentTransaction, User]) {
    const documents = await Model.find({ 'admin_audit_outbox.0': { $exists: true } }).select('_id').limit(50).lean();
    for (const document of documents) await flushAdminAuditOutbox(Model, document._id);
  }
}
