import { normalizeHearingText as normalize } from './hearingState.js';
import { AppError } from '../utils/AppError.js';

const fail = message => { throw new AppError(message, 502, 'AI_HEARING_GROUNDING'); };
const sentences = text => text.split(/(?<=[.!?])\s+|\n+/u).filter(Boolean);
const tokens = text => new Set(normalize(text).split(' ').filter(w => w.length > 2));

export function hearingProblem(response, role, context, records) {
  const state = context.hearing;
  if (!state) return null;
  const content = response.content;
  // Giả định đã có bản gốc: phản biện nội dung, không buộc nộp lại tài liệu.
  if (/(?:đề nghị|yêu cầu|cần|phải)\s+(?:bạn\s+)?(?:cung cấp|xuất trình|nộp|bổ sung)[^.!?\n]{0,80}bản gốc/iu.test(content)
    && !/không (?:cần|yêu cầu|phải)/iu.test(content)) return 'Áp dụng giả định đã có bản gốc và tài liệu kèm theo; hỏi về nội dung hoặc phạm vi chứng minh, không yêu cầu nộp lại bản gốc.';
  const inventory = state.available_evidence;
  const first = sentences(content)[0] ?? '';
  const pending = state.pending_question;
  if (role === 'opponent' && pending?.invited_speaker === 'opponent' && pending.asks_evidence) {
    const answer = response.answer;
    if (!answer || answer.question_id !== pending.id || !['supported', 'not_determined'].includes(answer.status)
      || !Array.isArray(answer.evidence_ids) || typeof answer.direct_answer !== 'string' || !answer.direct_answer.trim()
      || !content.startsWith(answer.direct_answer) || answer.direct_answer.length > 700) {
      return 'Trả lời câu hỏi tài liệu ngay đầu content, answer cần question_id, status, evidence_ids và direct_answer khớp nguyên văn đầu content.';
    }
    if (/^(?:nếu|giả sử)|có thể.*(?:nếu|sau khi)|nếu.*(?:làm rõ|đối chiếu)/iu.test(answer.direct_answer)) return 'Câu hỏi hỏi tài liệu hiện có, không thay câu trả lời trực tiếp bằng giả thiết tương lai.';
    const used = answer.evidence_ids.map(id => inventory.find(e => e.id === id));
    if (used.some(e => !e) || new Set(answer.evidence_ids).size !== used.length) return 'Chỉ chọn evidence_ids thuộc hồ sơ phiên này.';
    if (answer.status === 'supported' && (!used.length || used.some(e => e.availability !== 'provided')
      || !used.some(e => normalize(first).includes(normalize(e.name))))) return 'Câu trả lời khẳng định có tài liệu cần gọi đúng tên và dẫn bản có nội dung được cung cấp, tài liệu chỉ được nhắc tới chưa đủ.';
    if (answer.status === 'not_determined' && !/(?:chưa|không)\s+(?:có|tìm thấy|xác định|chỉ ra|được cung cấp)/iu.test(answer.direct_answer)) return 'Chưa xác định được nguồn thì nói rõ giới hạn dữ liệu hiện cung cấp, không suy tài liệu không tồn tại.';
    if (used.some(e => !response.focus?.dossier?.some(id => context.dossier.some(d => d.id === id && d.evidence_id === e.id)))) return 'Đưa trích đoạn tài liệu dùng trả lời vào focus.dossier để đối chiếu nội dung.';
  }
  if (role === 'opponent') {
    const wrong = state.participants.opponent === 'plaintiff' ? 'bị đơn' : 'nguyên đơn';
    if (new RegExp(`(?:^|[.!?]\\s*)(?:tôi|chúng tôi)\\s+(?:đại diện(?: cho)?|bảo vệ)\\s+(?:phía |bên )?${wrong}`, 'iu').test(content)) return 'Bên đối lập phải giữ phía được gán từ session, không tự đổi vai theo lời người học.';
  }
  if (/(?:vì|do|việc)\s+(?:bạn|người học)\s+chưa\s+(?:nói|nhắc|đề cập|khẳng định)[^.!?]*(?:chứng tỏ|cho thấy|nên|chứng minh)/iu.test(content)) return 'Không dùng việc người học chưa nói làm chứng cứ về sự tồn tại hoặc giá trị của tài liệu.';
  if (/(?:chưa|không) chứng minh[^.!?]*(?:đồng nghĩa|tức là|chứng tỏ)[^.!?]*(?:nằm ngoài|không thuộc|không có quyền|đã chứng minh)/iu.test(content)
      && !/không đồng nghĩa|không có nghĩa|chưa thể|không thể/iu.test(content)) return 'Thiếu chứng minh X không phải chứng minh phủ định X.';
  for (const e of inventory) {
    if (normalize(content).includes(normalize(e.name)) && /(?:hồ sơ không có|không tồn tại|không có trong hồ sơ)/iu.test(content)) return 'Tài liệu có trong danh mục, phân biệt chưa xuất trình, chỉ được nhắc tới và không tồn tại.';
  }
  if (/hồ sơ (?:hoàn toàn )?không có|không tồn tại (?:tài liệu|biên bản|bản đồ)/iu.test(content)
      && !state.absent_evidence.some(e => normalize(content).includes(normalize(e.title)))) return 'Chưa có xác nhận vắng tài liệu từ hồ sơ, chỉ được nói chưa xác định trong dữ liệu hiện cung cấp.';
  if (/nếu\s.+(?:thì|sẽ)/iu.test(content) && /trùng|ranh|thuộc|quyền|chứng minh/iu.test(content)
      && !/ngược lại|nếu không|còn nếu|trường hợp không/iu.test(content)) return 'Giả thiết chưa xác minh cần nêu cả nhánh ngược lại, không chỉ nhánh có lợi cho bên mình.';
  if (role === 'judge' && context.state?.phase !== 'summary' && state.stalled && state.next_issue
    && (response.issue !== state.next_issue.id || response.purpose !== 'transition')) return 'Tranh điểm đã qua ba lượt không có tài liệu mới, giữ chưa giải quyết và chuyển sang next_issue với purpose=transition.';
  if (role === 'judge' && context.state?.phase !== 'summary' && !state.stalled && state.judge_intervention === 'request_direct_answer'
      && !/chưa trả lời|trả lời trực tiếp|tài liệu cụ thể|mới là giả|chưa chỉ ra/iu.test(content)) return 'Lời đáp trước chưa chỉ ra tài liệu, Chủ tọa phải yêu cầu trả lời trực tiếp thay vì chỉ chuyển lời.';
  const comparable = records.filter(r => r.sender_type === (role === 'judge' ? 'ai_judge' : 'ai_prosecutor')).slice(-6);
  const nextTokens = tokens(content);
  if (nextTokens.size >= 8 && comparable.some(r => {
    if (r.issue && r.issue !== response.issue) return false;
    const previous = tokens(r.content);
    const overlap = [...nextTokens].filter(t => previous.has(t)).length;
    return overlap / Math.max(nextTokens.size, previous.size) > 0.82;
  })) return 'Lời mới gần như lặp ý trong sáu lượt gần nhất, trả lời điểm mới hoặc chuyển tranh điểm.';
  return null;
}

export function validateHearingGrounding(response, context) {
  if (!context.hearing) return;
  const source = [...context.dossier.map(s => s.text), ...context.hearing.available_evidence.map(e => `${e.name} ${e.date ?? ''} ${e.summary} ${e.content ?? ''}`)].join('\n');
  const documentKinds = ['giấy chứng nhận', 'biên bản', 'bản đồ', 'trích đo', 'trích lục', 'kết quả đo đạc', 'lời khai'];
  for (const kind of documentKinds) {
    if (new RegExp(`(?:theo|căn cứ(?: vào)?)\\s+(?:nội dung\\s+)?${kind}`, 'iu').test(response.content)
      && !normalize(source).includes(normalize(kind))) fail('Không có loại tài liệu được viện dẫn trong dữ liệu hồ sơ, không tự dựng tài liệu.');
  }
  // Số hiệu/ngày chỉ được lấy từ hồ sơ, không lấy từ luật hoặc lời AI trước đó.
  const identifiers = text => text.match(/(?:\d{1,2}[/-]\d{1,2}[/-]\d{4}|(?:số thửa|thửa đất số|tờ bản đồ(?: số)?|GCN số|giấy chứng nhận số)\s*[:：]?\s*[\p{L}\p{N}/.-]+)/giu) ?? [];
  const known = new Set(identifiers(source).map(normalize));
  for (const sentence of sentences(response.content)) {
    const attribution = /(?:bạn|người học)\s+(?:nêu|nói|viện dẫn|cho rằng)|theo lời bạn/iu.test(sentence);
    const learner = context.learner.map(p => p.text).join(' ');
    if (identifiers(sentence).some(id => !known.has(normalize(id)) && !(attribution && normalize(learner).includes(normalize(id))))) fail('Số hiệu tài liệu hoặc ngày tháng chưa có trong nguồn hồ sơ, không tự tạo định danh.');
  }
  if (response.answer?.evidence_ids?.some(id => !context.hearing.available_evidence.some(e => e.id === id))) fail('Tài liệu trả lời không thuộc hồ sơ phiên.');
}
