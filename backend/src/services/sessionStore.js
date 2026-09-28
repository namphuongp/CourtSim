import { randomUUID } from 'node:crypto';
import { CourtRecord, SimulationSession } from '../models/index.js';
import { AppError } from '../utils/AppError.js';

export const MAX_TURNS = 20;
const LEASE_MS = 10 * 60_000;

export function readRequestId(value) {
  if (value === undefined) return randomUUID(); // Tương thích các client cũ.
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) {
    throw new AppError('Mã yêu cầu không hợp lệ. Vui lòng tải lại trang.');
  }
  return value;
}

export function replayTurn(session, requestId, content) {
  const previous = session.turns?.find((turn) => turn.request_id === requestId);
  if (previous && previous.records[0].content !== content) {
    throw new AppError('Yêu cầu đã gửi có nội dung khác. Vui lòng tải lại phiên.', 409, 'REQUEST_CONFLICT');
  }
  return previous?.records;
}

export async function getRecords(session) {
  const legacy = await CourtRecord.find({ session_id: session._id }).sort({ created_at: 1, _id: 1 }).lean();
  return [...legacy, ...(session.opening ? [session.opening] : []), ...(session.turns ?? []).flatMap((turn) => turn.records)];
}

export async function withSessionLock(session, action) {
  const token = randomUUID();
  const locked = await SimulationSession.findOneAndUpdate({
    _id: session._id,
    user_id: session.user_id,
    $or: [{ operation: null }, { 'operation.expires_at': { $lte: new Date() } }],
  }, { $set: { operation: { token, expires_at: new Date(Date.now() + LEASE_MS) } } }, { returnDocument: 'after' });
  if (!locked) throw new AppError('Phiên đang xử lý một yêu cầu. Vui lòng chờ rồi thử lại.', 409, 'SESSION_BUSY');
  try {
    return await action(locked, { _id: locked._id, 'operation.token': token });
  } finally {
    // Token ngăn yêu cầu cũ mở khóa hoặc ghi đè yêu cầu mới sau khi hết hạn.
    await SimulationSession.updateOne({ _id: locked._id, 'operation.token': token }, { $set: { operation: null } });
  }
}

export function publicSession(session) {
  const value = session.toObject ? session.toObject() : session;
  const { operation, turns, evaluation, opening, case_snapshot, creation_request_id, ...safe } = value;
  return { ...safe, ...(case_snapshot ? { case_id: case_snapshot } : {}), max_turns: MAX_TURNS,
    processing: Boolean(operation && new Date(operation.expires_at) > new Date()) };
}
