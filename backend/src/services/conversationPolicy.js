import { classifyDialogueInput } from './dialogueInput.js';
import { roleMismatch } from './hearingState.js';

export function initialConversation(opening) {
  const lastSpeaker = opening?.sender_type === 'user' ? 'learner' : opening?.sender_type === 'ai_prosecutor' ? 'opponent' : 'judge';
  return { version: 1, phase: 'opening', status: 'learner', revision: 0, last_speaker: lastSpeaker,
    current_record_id: opening?._id ? String(opening._id) : null, next_speaker: 'learner', plan: [], cursor: 0, concluded: false };
}

/**
 * Kiểm tra mệnh lệnh xin kết thúc phiên / chuyển sang nghị án trực tiếp từ người dùng.
 * Chống kết thúc nhầm: Tuyệt đối không bắt từ khóa nếu xuất hiện trong ngữ cảnh phân tích hợp đồng hoặc câu dài.
 */
export function isExplicitEndByChat(content) {
  if (typeof content !== 'string' || !content.trim()) return false;
  const trimmed = content.trim();

  // 1. Loại trừ câu phủ định hoặc ý chưa muốn kết luận
  if (/(?:không|chưa)\s+(?:thể\s+)?(?:kết luận|tổng kết|kết thúc|dừng|nghị án)\b/iu.test(trimmed)) return false;

  // 2. Loại trừ bối cảnh sự việc/hợp đồng/thủ tục dở dang (ví dụ: ngày kết thúc hợp đồng, thời hạn kết thúc...)
  if (/(?:thời hạn|thời điểm|ngày|hợp đồng|dự án|giai đoạn|kế hoạch)\s+(?:kết thúc|dừng|chấm dứt)/iu.test(trimmed)) return false;
  if (/(?:trước khi|để|nhằm|chuẩn bị)\s+(?:kết thúc|kết luận|nghị án)/iu.test(trimmed)) return false;

  // 3. Nếu là bài tranh luận phân tích dài hoặc có viện dẫn chứng cứ/điều luật thì không coi là lệnh kết thúc
  if (trimmed.length > 280 || trimmed.includes('[PL:') || trimmed.includes('[Chứng cứ:')) return false;

  // 4. Mệnh lệnh thủ tục độc lập xin dừng tranh luận / đề nghị nghị án
  return /(?:(?:tôi|chúng tôi|phía chúng tôi|luật sư)\s+)?(?:muốn|xin(?:\s+phép)?|đề nghị|yêu cầu|kính đề nghị)?\s*(?:hội đồng xét xử\s+|hđxx\s+|tòa án\s+|tòa\s+|chủ tọa\s+)?(?:cho\s+)?(?:kết thúc|dừng|khép lại)\s+(?:phiên(?:\s+tòa|\s+xử|\s+tranh tụng|\s+họp)?|phần\s+(?:tranh luận|tranh tụng|trình bày|xét hỏi)|tại đây)|(?:đề nghị|xin|kính đề nghị|mời|yêu cầu)\s+(?:hội đồng xét xử|hđxx|tòa án|tòa|chủ tọa)\s+(?:chuyển sang\s+|bước vào\s+|tiến hành\s+|vào\s+)?(?:phần\s+)?(?:nghị án|chấm điểm|đánh giá|phán quyết)|(?:tôi|chúng tôi|phía chúng tôi)\s+(?:đã\s+trình bày\s+xong|không còn\s+(?:ý kiến|câu hỏi|luận điểm)(?:\s+nào|\s+gì)?(?:\s+thêm|\s+khác)?|xin\s+dừng\s+tranh\s+luận|xin\s+kết\s+thúc)|^(?:xin\s+)?(?:kết thúc(?:\s+phiên(?:\s+tòa)?)?|nghị án(?:\s+và\s+chấm\s+điểm)?|chấm điểm(?:\s+kết\s+quả)?|kết thúc và chấm điểm)[.!?\s]*$/iu.test(trimmed);
}

/**
 * Kiểm tra ý định kết thúc có cấu trúc hoặc qua tóm tắt quan điểm cuối cùng.
 */
export function isClosingIntent(content, turnCount = 0, options = {}) {
  // Cờ cấu trúc tường minh từ client (ví dụ: bấm nút mẫu đề nghị nghị án)
  if (options?.close_requested === true) return true;
  if (typeof content !== 'string' || !content.trim()) return false;
  const trimmed = content.trim();

  // Kiểm tra lệnh thủ tục độc lập
  if (isExplicitEndByChat(trimmed)) return true;

  // Phủ định hoặc bối cảnh hợp đồng
  if (/(?:không|chưa)\s+(?:thể\s+)?(?:kết luận|tổng kết|kết thúc|dừng|nghị án)\b/iu.test(trimmed)) return false;
  if (/(?:thời hạn|thời điểm|ngày|hợp đồng|dự án|giai đoạn|kế hoạch)\s+(?:kết thúc|dừng|chấm dứt)/iu.test(trimmed)) return false;
  if (trimmed.length > 280 || trimmed.includes('[PL:') || trimmed.includes('[Chứng cứ:')) return false;

  // Câu chốt quan điểm độc lập sau khi đã có tranh luận (phải kết hợp rõ việc giữ nguyên yêu cầu/kết luận hoặc không còn ý kiến)
  const summaryStatement = /(?:^|[.!?\n]\s*)(?:tóm lại|tổng kết lại|kết luận lại|lời nói sau cùng)(?:[,:]|\s).*?(?:giữ nguyên\s+(?:yêu cầu|quan điểm|kháng cáo)|không còn\s+(?:ý kiến|tranh luận|luận điểm)|xin\s+(?:kết luận|tổng kết|nghị án|kết thúc))/iu.test(trimmed)
    || /(?:^|[.!?\n]\s*)(?:(?:tôi|chúng tôi|phía chúng tôi)\s+)(?:xin\s+)?(?:giữ nguyên\s+(?:yêu cầu|quan điểm|kháng cáo)|không còn ý kiến|kết thúc)(?:\s|[.,:!?]|$)/iu.test(trimmed);
  return Boolean(summaryStatement && turnCount > 0);
}

/**
 * Điều kiện AI (vai Thẩm phán) tự động đưa ra kết luận và kích hoạt kết thúc phiên tòa:
 * 1. Phiên đạt ngưỡng số lượt tối đa quy định.
 * 2. Hoặc đã qua đủ các giai đoạn (ít nhất 5 lượt tranh luận thực chất) và các tranh điểm đã được giải quyết/stalled không còn vấn đề mới.
 */
export function shouldAutoCloseHearing(session, effectiveTurns) {
  const maxTurns = session?.max_turns ?? 20;
  if (effectiveTurns >= maxTurns - 1) return true;

  const hearing = session?.conversation?.hearing_state;
  if (effectiveTurns >= 5 && hearing?.stalled && !hearing?.next_issue) {
    return true;
  }
  return false;
}

// Điều phối luồng phiên tòa theo 4 giai đoạn tố tụng: Khai mạc/Trình bày -> Xét hỏi làm rõ -> Tranh luận đối đáp -> Tổng kết & Nghị án.
export function chooseSpeakingPlan(session, content, options = {}) {
  if (roleMismatch(session, content)) return { phase: 'clarification', plan: ['judge'] };
  const effectiveTurns = Math.max(session.turn_count ?? 0, session.turns?.length ?? 0);

  // 1. Kiểm tra yêu cầu kết thúc từ người dùng hoặc tự động khi phiên hội đủ điều kiện
  const closing = isClosingIntent(content, effectiveTurns, options) || shouldAutoCloseHearing(session, effectiveTurns);
  if (closing) return { phase: 'summary', plan: ['judge'] };

  const kind = classifyDialogueInput(content);
  if (['greeting', 'noise', 'unclear'].includes(kind)) return { phase: session.conversation?.phase ?? 'opening', plan: ['judge'] };
  if (kind === 'brief_position') return { phase: 'clarification', plan: ['judge'] };

  // Chỉ nhận lời đề nghị trực tiếp; không nối "yêu cầu A... nếu chưa làm rõ" thành câu hỏi thủ tục.
  const procedural = kind === 'procedure';
  if (procedural) return { phase: 'clarification', plan: ['judge'] };

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
  const isConcluded = Boolean(value.concluded || (value.phase === 'summary' && value.last_purpose === 'close'));
  const readyToClose = Boolean(value.ready_to_close || isConcluded || value.phase === 'summary' || value.last_purpose === 'close');
  return {
    version: 1,
    phase: value.phase,
    status,
    revision: value.revision,
    last_speaker: value.last_speaker,
    next_speaker: value.next_speaker,
    last_purpose: value.last_purpose ?? null,
    concluded: isConcluded,
    ready_to_close: readyToClose,
    auto_complete: Boolean(value.auto_complete || isConcluded),
    current_record_id: value.current_record_id,
    started_at: value.started_at ?? null
  };
}
