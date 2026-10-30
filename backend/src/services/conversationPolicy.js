import { classifyDialogueInput } from './dialogueInput.js';
import { roleMismatch } from './hearingState.js';

export function initialConversation(opening) {
  const lastSpeaker = opening?.sender_type === 'user' ? 'learner' : opening?.sender_type === 'ai_prosecutor' ? 'opponent' : 'judge';
  return { version: 1, phase: 'opening', status: 'learner', revision: 0, last_speaker: lastSpeaker,
    current_record_id: opening?._id ? String(opening._id) : null, next_speaker: 'learner', plan: [], cursor: 0 };
}

export function isClosingIntent(content, turnCount = 0) {
  if (typeof content !== 'string' || !content.trim()) return false;
  // Không coi câu phủ định kiểu "tôi không kết luận ngay" là yêu cầu kết thúc.
  if (/(?:không|chưa)\s+(?:thể\s+)?(?:kết luận|tổng kết|kết thúc)\s+ngay/iu.test(content)) return false;

  // 1. Yêu cầu kết thúc phiên tòa / dừng tranh luận / chuyển sang nghị án trực tiếp từ người dùng (hiệu lực ở mọi lượt)
  const explicitEnd = /(?:(?:tôi|chúng tôi|phía chúng tôi|luật sư)\s+)?(?:muốn|xin(?:\s+phép)?|đề nghị|yêu cầu)\s+(?:hội đồng xét xử\s+|tòa án\s+|tòa\s+|chủ tọa\s+)?(?:cho\s+)?(?:kết thúc|dừng|khép lại)\s+(?:phiên(?:\s+tòa|\s+xử|\s+tranh tụng|\s+họp)?|phần\s+(?:tranh luận|tranh tụng|trình bày|xét hỏi))|(?:đề nghị|xin)\s+(?:hội đồng xét xử|tòa án|tòa|chủ tọa)\s+(?:chuyển sang\s+|vào\s+)?nghị án|(?:tôi|chúng tôi|phía chúng tôi)\s+(?:đã\s+trình bày\s+xong|không còn\s+(?:ý kiến|câu hỏi|luận điểm)(?:\s+nào|\s+gì)?(?:\s+thêm|\s+khác)?)/iu.test(content);
  if (explicitEnd) return true;

  // 2. Câu tổng kết / chốt quan điểm cuối phiên (áp dụng khi đã có trao đổi)
  const summaryStatement = /(?:^|[.!?\n]\s*)(?:tóm lại(?:[,:]|\s)|tổng kết lại(?:[,:]|\s)|kết luận lại(?:[,:]|\s)|lời nói sau cùng(?:[,:]|\s)|(?:tôi|chúng tôi|phía chúng tôi)\s+(?:xin\s+)?(?:kết luận|tổng kết|giữ nguyên\s+(?:yêu cầu|quan điểm|kháng cáo)|không còn ý kiến|kết thúc)(?:\s|[.,:]|$))/iu.test(content);
  return summaryStatement && turnCount > 0;
}

// Điều phối luồng phiên tòa theo 4 giai đoạn tố tụng: Khai mạc/Trình bày (opening/presentation) -> Xét hỏi làm rõ (clarification) -> Tranh luận đối đáp (debate) -> Tổng kết & Nghị án (summary).
export function chooseSpeakingPlan(session, content) {
  if (roleMismatch(session, content)) return { phase: 'clarification', plan: ['judge'] };
  const kind = classifyDialogueInput(content);
  if (['greeting', 'noise', 'unclear'].includes(kind)) return { phase: session.conversation?.phase ?? 'opening', plan: ['judge'] };
  if (kind === 'brief_position') return { phase: 'clarification', plan: ['judge'] };
  // Chỉ nhận lời đề nghị trực tiếp; không nối "yêu cầu A... nếu chưa làm rõ" thành câu hỏi thủ tục.
  const procedural = kind === 'procedure';
  const effectiveTurns = Math.max(session.turn_count ?? 0, session.turns?.length ?? 0);
  const closing = isClosingIntent(content, effectiveTurns);
  if (procedural) return { phase: 'clarification', plan: ['judge'] };
  if (closing) return { phase: 'summary', plan: ['judge'] };
  // Chuyển tranh điểm trả lời về người học, không gọi lại phản biện cũ.
  if (session.conversation?.hearing_state?.stalled) return { phase: 'clarification', plan: ['judge'] };
  if (session.conversation?.hearing_state?.judge_intervention) return { phase: 'clarification', plan: ['judge', 'opponent'] };
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
    last_purpose: value.last_purpose ?? null,
    ready_to_close: Boolean(value.phase === 'summary' || value.last_purpose === 'close'),
    current_record_id: value.current_record_id, started_at: value.started_at ?? null };
}
