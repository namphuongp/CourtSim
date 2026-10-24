// Chỉ nhận diện chắc chắn các đầu vào không có luận điểm; không đo ý nghĩa bằng độ dài.
export function classifyDialogueInput(content) {
  const text = content.normalize('NFC').trim().toLocaleLowerCase('vi');
  const plain = text.replace(/[.!?,;:]+$/u, '').trim();
  if (/^(?:(?:xin |kính )?chào|hello|hi)(?:\s+(?:chủ tọa|tòa|mọi người|hội đồng xét xử))?$/u.test(plain)) return 'greeting';
  if (!/\p{L}/u.test(text) || /^(?:abc|asdf\w*|qwerty\w*|test|xyz|([\p{L}\p{N}])\1{3,})$/u.test(plain)) return 'noise';
  if (/(?:đề nghị|yêu cầu)\s+(?:(?:chủ tọa|tòa án|tòa)\s+)?(?:làm rõ|giải thích|hướng dẫn thủ tục)|xin hỏi|không hiểu/iu.test(text)) return 'procedure';
  if (/^(?:tôi\s+)?(?:không\s+)?(?:đồng ý|nhất trí|phản đối|chấp nhận)(?:\s+(?:ạ|vâng))?$/u.test(plain)
    || /^(?:vâng|dạ|có|không|chưa|rồi)$/u.test(plain)) return 'brief_position';
  // Chuỗi ASCII một từ lạ cần làm rõ, không kết luận người học viết vô nghĩa.
  if (/^[a-z]{5,}$/u.test(plain)) return 'unclear';
  return 'argument';
}

export const isSubstantiveRecord = record => record.sender_type === 'user'
  && !['greeting', 'noise', 'unclear', 'procedure'].includes(record.input_kind ?? classifyDialogueInput(record.content));

export function controlTurn(kind) {
  const content = kind === 'greeting'
    ? 'Hội đồng xét xử ghi nhận sự có mặt của các bên. Mời Luật sư bắt đầu trình bày quan điểm và yêu cầu của phía mình.'
    : kind === 'noise' ? 'Hội đồng xét xử chưa ghi nhận được ý kiến tranh tụng cụ thể về vụ án. Đề nghị Luật sư trình bày rõ quan điểm tranh luận của phía mình.'
      : 'Chủ tọa đề nghị Luật sư làm rõ quan điểm hoặc yêu cầu cụ thể muốn trình bày trước Hội đồng xét xử.';
  return { role: 'judge', purpose: 'invite', issue: null, next_speaker: 'learner', content,
    generation_mode: 'control', citations: [], fact_analysis: { established_facts: [], learner_claims: [], inferences: [], missing_facts: [] } };
}
