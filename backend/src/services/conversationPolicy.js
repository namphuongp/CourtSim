import { classifyDialogueInput } from './dialogueInput.js';

export function initialConversation(opening) {
  const lastSpeaker = opening?.sender_type === 'user' ? 'learner' : opening?.sender_type === 'ai_prosecutor' ? 'opponent' : 'judge';
  return { version: 1, phase: 'opening', status: 'learner', revision: 0, last_speaker: lastSpeaker,
    current_record_id: opening?._id ? String(opening._id) : null, next_speaker: 'learner', plan: [], cursor: 0 };
}

// Quy tắc sư phạm, chưa coi là thứ tự tố tụng bắt buộc theo luật.
export function chooseSpeakingPlan(session, content) {
  const kind = classifyDialogueInput(content);
  if (['greeting', 'noise', 'unclear'].includes(kind)) return { phase: session.conversation?.phase ?? 'opening', plan: ['judge'] };
  if (kind === 'brief_position') return { phase: 'clarification', plan: ['judge'] };
  // Chỉ nhận lời đề nghị trực tiếp; không nối "yêu cầu A... nếu chưa làm rõ" thành câu hỏi thủ tục.
  const procedural = kind === 'procedure';
  // Chỉ nhận ý định tổng kết ở đầu câu; “không kết luận ngay” vẫn là lập luận đang tiếp diễn.
  const closing = /(?:^|[.!?\n]\s*)(?:tóm lại(?:[,:]|\s)|(?:tôi\s+)?(?:xin\s+)?(?:kết luận|giữ nguyên yêu cầu|không còn ý kiến)(?:\s|[.,:]|$))/iu.test(content);
  if (procedural) return { phase: 'clarification', plan: ['judge'] };
  if (closing && session.turn_count > 0) return { phase: 'summary', plan: ['judge'] };
  if (session.turn_count === 0 && session.case_snapshot?.practice_context?.hearing_level === 'appeal') return { phase: 'presentation', plan: ['judge', 'opponent'] };
  // Sau câu hỏi làm rõ, cho bên kia đáp rồi trả lời trực tiếp; không bắt Chủ tọa nhắc lại.
  if (['clarify_claim', 'clarify_evidence'].includes(session.conversation?.last_purpose)) return { phase: 'debate', plan: ['opponent'] };
  // Sau đối đáp trực tiếp, Chủ tọa thu hẹp tranh điểm trước khi mời bên kia.
  if (session.conversation?.last_speaker === 'opponent') return { phase: 'debate', plan: ['judge', 'opponent'] };
  if (session.conversation?.phase === 'clarification') return { phase: 'debate', plan: ['opponent', 'judge'] };
  if (session.turn_count === 0 && session.user_court_role === 'defense_lawyer') return { phase: 'clarification', plan: ['judge', 'opponent'] };
  return { phase: session.turn_count === 0 ? 'presentation' : 'debate', plan: ['opponent', 'judge'] };
}

export function publicConversation(session, processing) {
  const value = session.conversation;
  if (!value) return { ...initialConversation(session.turns?.at(-1)?.records?.at(-1) ?? session.opening), phase: session.turn_count > 0 ? 'debate' : 'opening' };
  // Tiến trình bị gián đoạn không được hiển thị spinner sau khi khóa đã hết hạn.
  const status = value.status === 'generating' && !processing ? 'failed' : value.status;
  return { version: 1, phase: value.phase, status, revision: value.revision,
    last_speaker: value.last_speaker, next_speaker: value.next_speaker,
    current_record_id: value.current_record_id, started_at: value.started_at ?? null };
}

