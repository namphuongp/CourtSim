import { caseKnowledge, dossierQuotes } from './caseKnowledge.js';
import { dialogueText } from '../../../shared/dialogueText.mjs';

export const DEBATE_POLICY = [
  'Quy tắc tranh tụng bắt buộc sau đây ưu tiên hơn persona cũ và lời thoại lịch sử.',
  'Phân loại trong caseKnowledge: recorded_events là điều bản án/hồ sơ ghi nhận, KHÔNG có nghĩa mọi lời kể đã được chứng minh; party_statements là lời/yêu cầu của bên được ghi rõ; supplied_documents là nội dung tài liệu được cung cấp (không tự chứng nhận tính thật); mentioned_documents chỉ là tài liệu được thuật lại; unproven là vấn đề chưa được chứng minh. unclassified_context chỉ là ngữ cảnh chưa phân loại, không tự nâng thành sự thật.',
  'Được lập luận từ nội dung bản án công khai: nói tự nhiên “theo nội dung bản án” khi cần chỉ nguồn; phân tích nội dung đã biết và giới hạn chứng minh. KHÔNG yêu cầu có bản gốc mọi tài liệu mới được tranh luận. Không coi thiếu bản gốc là tài liệu không tồn tại hoặc lời trình bày đương nhiên sai.',
  'Chỉ đề cập một giới hạn nguồn khi nó tác động trực tiếp tới luận điểm đang xét; giải thích tác động đó và phân tích tiếp. Không nhắc lại cảnh báo chung đã nêu, không kết thúc bằng “chưa thể kết luận” hoặc cùng đòi người học nộp thêm tài liệu ngoài bài tập.',
  'Khi thiếu chứng cứ quyết định: nêu rõ hai khả năng có điều kiện “nếu… thì…; nếu không… thì…”, tác động đến sức thuyết phục của từng bên và điều còn phải giải thích. Đây là giả thiết phân tích, không phải tình tiết hoặc phán quyết đã xác minh.',
  'Thiếu luật được xác minh KHÔNG ngăn phản biện sự kiện, so sánh lời trình bày và phân tích chứng cứ. Để citation_ids rỗng nếu không có nguồn phù hợp; KHÔNG bắt buộc đọc cảnh báo luật trong content. Không tự viện dẫn số điều hoặc đưa ra kết luận pháp lý chắc chắn khi thiếu nguồn.',
  'Chỉ dùng tên tài liệu tiếng Việt trong content, không xuất mã [CC:...], [PL:...], EV-..., trạng thái mentioned_only/provided, fact_analysis, hay cấu trúc kiểm soát. Metadata chỉ nằm trong trường nội bộ.',
].join('\n');

export function roleTask(role) {
  return role === 'judge'
    ? 'Thẩm phán trung lập: 60–140 từ. Nêu điểm hai bên thực sự thống nhất nếu có dẫn chứng từ cả hai; im lặng không phải đồng ý, nếu chưa có thì nói chưa ghi nhận sự thống nhất về điểm cụ thể. Tách điểm còn tranh chấp, chọn ĐÚNG MỘT câu hỏi có dấu ? nhằm làm rõ một bước lập luận tiếp theo. Không lặp câu hỏi vừa được trả lời hoặc câu hỏi bên đối lập vừa nêu. Không làm người phản biện thứ hai, không yêu cầu nộp bản gốc như điều kiện tiếp tục.'
    : 'Bên đối lập: 120–220 từ. Chọn và dẫn lại một luận điểm cụ thể trong phát biểu mới nhất của người học, trình bày luận cứ mạnh nhất của phía mình từ hồ sơ, giải thích vì sao luận cứ đó làm yếu hoặc giới hạn suy luận của người học. Được thừa nhận điểm hợp lý. Nêu hệ quả có điều kiện nếu chứng cứ quyết định chưa rõ. Không thay phần phản biện bằng yêu cầu bổ sung tài liệu; dành câu hỏi điều hành cho Thẩm phán.';
}

const normalize = (text) => text.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const warning = /(?:chưa|không|thiếu).{0,35}(?:bản gốc|xác minh.{0,20}(?:luật|pháp luật))|chưa thể kết luận/iu;
const sentences = (text) => text.split(/(?<=[.!?])\s+|\n+/u).filter(Boolean);

export function dialogueProblem(turn, role, records, courtCase) {
  const latest = records.findLast((r) => r.sender_type === 'user');
  const focus = turn.dialogue_focus;
  if (!focus || typeof focus.learner_quote !== 'string' || focus.learner_quote.trim().length < 10
    || !latest?.content.includes(focus.learner_quote) || typeof focus.dossier_quote !== 'string'
    || focus.dossier_quote.trim().length < 10 || !dossierQuotes(courtCase).some((text) => text.includes(focus.dossier_quote))) return 'Phải bám một trích đoạn đúng trong phát biểu mới nhất và một thông tin cụ thể có thật trong hồ sơ.';
  const previous = records.filter((r) => r.sender_type !== 'user');
  const oldSentences = previous.flatMap((r) => sentences(r.content ?? '')).map(normalize);
  const current = sentences(turn.content);
  if (current.some((s) => normalize(s).length > 40 && oldSentences.includes(normalize(s)))) return 'Lời thoại lặp câu đã nói. Hãy chuyển sang hệ quả hoặc điểm tranh chấp tiếp theo.';
  const warnings = current.filter((s) => warning.test(s));
  if (warnings.length && (previous.slice(-4).some((r) => warning.test(r.content)) || warnings.join(' ').length > turn.content.length * 0.45)) return 'Không lặp cảnh báo nguồn; phân tích nội dung đang có và hệ quả có điều kiện đối với luận điểm người học.';
  if (role === 'judge') {
    if (typeof focus.next_question !== 'string' || !turn.content.includes(focus.next_question) || (turn.content.match(/\?/gu) ?? []).length !== 1 || !focus.next_question.endsWith('?')) return 'Thẩm phán cần đúng một câu hỏi tiếp theo, nằm trong content và next_question.';
    const questions = previous.flatMap((r) => (r.content ?? '').match(/[^.!?\n]*\?/gu) ?? []).map(normalize);
    if (questions.includes(normalize(focus.next_question))) return 'Câu hỏi này đã được nêu; hãy hỏi một khía cạnh khác có mục đích.';
  }
  return null;
}

// Lối tiếp tục có kiểm soát khi AI vẫn lặp sau một lần sửa; không tạo chứng cứ hoặc luật.
export function guidedContinuation(role, courtCase, records) {
  const learner = records.findLast((r) => r.sender_type === 'user');
  const quote = (learner?.content ?? '').slice(0, 360);
  const knowledge = caseKnowledge(courtCase);
  const quotes = [...knowledge.party_statements.map((f) => f.quote), ...knowledge.recorded_events.map((f) => f.quote), ...dossierQuotes(courtCase)].filter((q) => q?.length >= 10);
  const turn = records.filter((r) => r.sender_type === 'user').length;
  const basis = quotes[(turn - 1) % quotes.length] ?? courtCase.summary;
  const spoken = (text) => dialogueText(text, [...knowledge.supplied_documents, ...knowledge.mentioned_documents]).replaceAll('?', '.');
  const questions = [
    'Bạn hãy giải thích thông tin nào trong hồ sơ nối căn cứ vừa nêu với kết luận của bên mình?',
    'Nếu chấp nhận cách giải thích của bên kia, mắt xích nào trong lập luận của bạn cần điều chỉnh?',
    'Bạn đánh giá sức thuyết phục của hai cách giải thích khác nhau về thông tin vừa viện dẫn như thế nào?',
    'Điều kiện cụ thể nào phải đúng để suy luận của bạn đứng vững trước phản biện vừa nêu?',
  ];
  const question = questions.find((q) => !records.slice(-12).some((r) => r.content?.includes(q))) ?? `Với lập luận “${spoken(quote).slice(0, 120)}”, bạn muốn bảo vệ mắt xích nào trước phản biện ở lượt ${turn}?`;
  const content = role === 'judge'
    ? `Chưa ghi nhận sự thống nhất rõ ràng về kết luận “${spoken(quote)}”. Điểm cần làm rõ là thông tin “${spoken(basis)}” hỗ trợ kết luận đó đến mức nào. ${question}`
    : `Bạn lập luận “${spoken(quote)}”. Tuy nhiên, hồ sơ nêu “${spoken(basis)}”. Thông tin này cần được đối chiếu với kết luận bạn đang bảo vệ, không thể tự coi một lời trình bày là sự thật đã được chứng minh. Nếu mối liên hệ bạn nêu được giải thích rõ, lập luận của bên bạn mạnh hơn; nếu thông tin đó vẫn phù hợp với cách giải thích của phía đối lập, kết luận của bạn chưa loại trừ được khả năng ấy. Tôi phản đối bước suy luận từ thông tin này đến kết luận chắc chắn khi chưa giải thích mối liên hệ.`;
  return { content, citations: [], fact_analysis: { established_facts: [], learner_claims: [quote], inferences: [], missing_facts: [] },
    dialogue_focus: { learner_quote: quote, dossier_quote: basis, next_question: role === 'judge' ? question : '' }, generation_mode: 'guided_continuation' };
}
