import mongoose from 'mongoose';
import { SimulationSession } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { generateDebateTurn } from './simulationService.js';
import { getRecords, MAX_TURNS, replayTurn, withSessionLock } from './sessionStore.js';

import { initialConversation, chooseSpeakingPlan } from './conversationPolicy.js';
import { classifyDialogueInput } from './dialogueInput.js';

function makeRecord(session, value) {
  return { ...value, _id: new mongoose.Types.ObjectId(), session_id: session._id, created_at: new Date(), displayed_at: null };
}

export async function runConversation(session, command, { generate = generateDebateTurn, onProgress } = {}) {
  return withSessionLock(session, async (locked, fence) => {
    const timing = { storage_ms: 0, history_ms: 0, generation_ms: 0 };
    if (locked.status !== 'ongoing') throw new AppError('Phiên đã kết thúc. Bạn có thể xem lại biên bản.', 409, 'SESSION_COMPLETED');
    if (!locked.case_event_date) throw new AppError('Vui lòng bổ sung ngày sự kiện trước khi tiếp tục phiên.', 409, 'SESSION_EVENT_DATE_REQUIRED');
    let state = locked.conversation ?? initialConversation(locked.opening);
    async function save(update) {
      const at = performance.now();
      const saved = await SimulationSession.updateOne(fence, update);
      timing.storage_ms += performance.now() - at;
      if (!saved.matchedCount) throw new AppError('Yêu cầu đã hết thời gian xử lý. Hãy tải lại phiên.', 409, 'SESSION_LOCK_EXPIRED');
    }
    if (command.action === 'submit') {
      const replay = replayTurn(locked, command.requestId, command.content);
      if (replay) return; // Khôi phục lượt lỗi qua resume, không thêm lời người học lần nữa.
      if (state.status !== 'learner') throw new AppError('Hãy đọc hết lượt hiện tại trước khi gửi lập luận mới.', 409, 'TURN_NOT_INVITED');
      if (locked.turn_count >= MAX_TURNS) throw new AppError('Đã đủ số lượt. Hãy kết thúc để nhận đánh giá.', 409, 'TURN_LIMIT');
      if (command.revision !== state.revision) throw new AppError('Phiên đã thay đổi. Hãy tải lại để xem lượt hiện tại.', 409, 'STALE_TURN');
      const user = makeRecord(locked, { sender_type: 'user', sender_name: 'Bạn', content: command.content, request_id: command.requestId,
        input_kind: classifyDialogueInput(command.content),
        evidence_ids: command.evidenceIds, legal_reference_ids: command.citations.map(c => c.reference_id), citations: command.citations });
      const selection = chooseSpeakingPlan(locked, command.content);
      state = { ...state, ...selection, status: 'generating', revision: state.revision + 1, cursor: 0,
        turn_index: locked.turns.length, last_speaker: 'learner', current_record_id: String(user._id), next_speaker: selection.plan[0], started_at: new Date() };
      await save({ $set: { conversation: state }, $push: { turns: { request_id: command.requestId, records: [user] } }, $inc: { turn_count: 1 } });
      locked.turns.push({ request_id: command.requestId, records: [user] });
      locked.turn_count++;
    } else {
      if (command.revision !== state.revision) return; // Double click hoặc retry sau mất phản hồi: không tiến thêm lượt.
      if (command.action === 'advance') {
        if (state.status !== 'awaiting_continue') return;
        if (state.next_speaker === 'learner') {
          await save({ $set: { conversation: { ...state, status: 'learner', revision: state.revision + 1 } } });
          return;
        }
        state = { ...state, status: 'generating', revision: state.revision + 1, started_at: new Date() };
      } else if (command.action === 'resume') {
        if (!['failed', 'generating'].includes(state.status)) return;
        state = { ...state, status: 'generating', started_at: new Date() };
      } else throw new AppError('Thao tác phiên không hợp lệ.');
      await save({ $set: { conversation: state } });
    }
    try {
      const historyAt = performance.now();
      const history = await getRecords(locked);
      timing.history_ms = performance.now() - historyAt;
      const generateAt = performance.now();
      const [message] = await generate({ session: { ...locked.toObject(), conversation: state }, courtCase: locked.case_snapshot ?? session.case_snapshot,
        records: history, speakers: [state.plan[state.cursor]], invitedNext: state.plan[state.cursor + 1] ?? 'learner' }, { onProgress });
      timing.generation_ms = performance.now() - generateAt;
      const speech = makeRecord(locked, message);
      const updated = { ...state, cursor: state.cursor + 1, status: 'awaiting_continue', revision: state.revision + 1,
        current_issue: speech.issue ?? state.current_issue ?? null,
        last_purpose: speech.purpose ?? null,
        last_speaker: state.plan[state.cursor], next_speaker: state.plan[state.cursor + 1] ?? 'learner', current_record_id: String(speech._id), started_at: null };
      await save({ $set: { conversation: updated }, $push: { [`turns.${state.turn_index}.records`]: speech } });
      return timing;
    } catch (error) {
      await save({ $set: { conversation: { ...state, status: 'failed', started_at: null,
        last_generation_error: { code: error.code ?? 'GENERATION_FAILED', metrics: error.generation_metrics ?? null } } } });
      throw error;
    }
  }, { leaseMs: 180_000 });
}
