import { researchAssistant } from './vbplResearch.js';
import { isVbplUrl, hasVerifiedSource, legalReferenceLabel } from '../../../shared/legalSourcePolicy.mjs';
import { dialogueText } from '../../../shared/dialogueText.mjs';
import { createHash, randomUUID } from 'node:crypto';
import LegalAssistantExchange from '../models/LegalAssistantExchange.js';
import { AppError } from '../utils/AppError.js';
import { learnerCitation, learnerText } from './learnerPresentation.js';
import { readReferenceIds } from './caseEvidence.js';

export function assistantGuidance(question = '', { unavailable = false, sourceStatus } = {}) {
  const text = question.normalize('NFC').trim().toLocaleLowerCase('vi').replace(/[?.!]+$/u, '');
  const topics = [
    [/^(?:(?:tìm|tra cứu|cho tôi biết về)\s+)?(?:bộ )?luật lao động$/u, 'Bạn muốn tìm về hợp đồng lao động, tiền lương hay chấm dứt hợp đồng? Hãy cho biết thời điểm xảy ra sự việc.'],
    [/^(?:(?:tìm|tra cứu)\s+)?luật đất đai$/u, 'Bạn cần tìm về giấy chứng nhận, chuyển nhượng hay tranh chấp đất? Hãy nêu năm xảy ra sự kiện để chọn phiên bản phù hợp.'],
    [/^(?:(?:tìm|tra cứu)\s+)?(?:bộ )?luật dân sự$/u, 'Bạn muốn tìm về hợp đồng, bồi thường hay thừa kế? Hãy nêu sự việc và thời điểm liên quan.'],
  ];
  const broad = topics.find(([pattern]) => pattern.test(text));
  if (broad) return broad[1];
  if (!unavailable) return null;
  if (sourceStatus === 'unavailable') return 'Hiện chưa lấy được nội dung văn bản để đối chiếu trên vbpl.vn. Chưa thể xác minh điều luật hoặc cung cấp trích dẫn. Bạn có thể thử lại sau hoặc tra bằng số hiệu/tên văn bản khác.';
  if (sourceStatus === 'disabled') return 'Tra cứu trực tiếp đang tắt và chưa có bản lưu đủ điều kiện để viện dẫn. Bạn có thể thử số hiệu hoặc tên văn bản khác.';
  if (/\d+\/\d{4}\//u.test(text)) return 'Chưa đối chiếu được văn bản mang số hiệu này trên vbpl.vn. Bạn hãy kiểm tra lại số hiệu, hoặc thử lại sau; chưa có căn cứ đã xác minh để viện dẫn.';
  if (/(?:điều|khoản|điểm)\s+[\da-z]/iu.test(text)) return 'Chưa xác minh được điều khoản bạn hỏi. Bạn đang tra văn bản nào, số hiệu và thời điểm áp dụng là gì?';
  return 'Chưa tìm được nguồn phù hợp để đối chiếu trên vbpl.vn. Bạn cần làm rõ quyền, nghĩa vụ hay thủ tục nào? Hãy thêm tên văn bản hoặc mốc sự kiện.';
}

export function publicAssistantExchange(value, { fresh = false } = {}) {
  const status = value.status === 'pending' && value.expires_at && new Date(value.expires_at) <= new Date() ? 'failed' : value.status;
  const present = citation => learnerCitation({ ...citation, retrieval_mode: fresh ? citation.retrieval_mode : 'cache' });
  const citations = (value.citations ?? []).map(present);
  const sources = (value.sources ?? []).filter(s => isVbplUrl(s.source_url ?? s.url) && hasVerifiedSource({ ...s, source_url: s.source_url ?? s.url }))
    .map(s => ({ ...present({ ...s, source_url: s.source_url ?? s.url }), url: s.source_url ?? s.url }));
  const trusted = [...(value.citations ?? []), ...(value.sources ?? [])].some(hasVerifiedSource);
  return { _id: value._id, question: value.question, status, request_id: value.request_id, created_at: value.created_at,
    // Phản hồi cũ thiếu xuất xứ không được giữ nhãn đã xác minh hoặc link do model tạo.
    answer: trusted ? learnerText(dialogueText(value.answer)) : assistantGuidance(value.question, { unavailable: true, sourceStatus: value.source_status }),
    verification_status: trusted ? value.verification_status : 'unverified', citations, sources };
}

export async function answerLegalQuestion({ session, courtCase, question }, dependencies = {}) {
  const guidance = assistantGuidance(question);
  if (guidance) return { answer: guidance, verification_status: 'unverified', citations: [], sources: [] };
  const research = await (dependencies.research ?? researchAssistant)({ courtCase, eventDate: session.case_event_date, question });
  const results = (research.results ?? []).filter(hasVerifiedSource);
  if (!results.length) return {
    answer: assistantGuidance(question, { unavailable: true, sourceStatus: research.source_status }),
    source_status: research.source_status,
    verification_status: 'unverified', citations: [], sources: [],
  };
  const citations = results.filter(r => r.verification_status === 'verified' && r.text);
  const sources = results.filter(r => !citations.includes(r));
  const timelines = (research.plans ?? []).filter(p => p.date);
  const dates = timelines.map(p => p.label.toLowerCase() + ': ' + p.date + (p.date_to && p.date_to !== p.date ? ' đến ' + p.date_to : '') + (p.status === 'assumed' ? ' (giả định bài tập)' : '')).join('; ');
  const missing = (research.plans ?? []).filter(p => !p.date).map(p => p.label.toLowerCase());
  // Trả trích đoạn đối chiếu trực tiếp; không để model bổ sung điều luật hoặc đường dẫn từ trí nhớ.
  const summary = results.map(r => r.title + ' (' + r.law_number + ')' + (r.article ? ' — ' + r.locator : '') + '.').join('\n');
  const timing = dates ? 'Mốc trong hồ sơ: ' + dates + '.' : 'Chưa có mốc sự kiện hoặc giao dịch được xác nhận.';
  return { answer: 'Tìm thấy ' + results.length + ' văn bản có nội dung được đối chiếu từ vbpl.vn.\n' + summary + '\n'
      + (results.length > 1 ? 'Có nhiều văn bản phù hợp; hãy chọn đúng số hiệu và thời kỳ cần tra cứu.\n' : '') + timing
      + (missing.length ? ' Cần làm rõ mốc ' + missing.join(', ') + ' nếu liên quan đến câu hỏi.' : '')
      + ' Đọc trích đoạn bên dưới và đối chiếu sửa đổi, hiệu lực, chuyển tiếp trước khi áp dụng.',
    verification_status: 'verified', citations, sources };
}

export async function askLegalAssistant({ session, courtCase, question, requestId }) {
  const filter = { session_id: session._id, user_id: session.user_id, request_id: requestId };
  let exchange = await LegalAssistantExchange.findOne(filter);
  if (exchange && exchange.question !== question) throw new AppError('Câu hỏi đã thay đổi. Vui lòng gửi lại như một câu hỏi mới.', 409, 'REQUEST_CONFLICT');
  if (exchange?.status === 'completed') return publicAssistantExchange(exchange);
  const token = randomUUID();
  if (!exchange) {
    if (await LegalAssistantExchange.countDocuments({ session_id: session._id }) >= 40) throw new AppError('Phiên này đã đủ 40 câu hỏi tra cứu. Bạn có thể xem lại câu trả lời đã có.', 429);
    try {
      exchange = await LegalAssistantExchange.create({ ...filter, question, status: 'pending', token, expires_at: new Date(Date.now() + 600000) });
    } catch (error) { if (error.code !== 11000) throw error; throw new AppError('Câu hỏi đang được xử lý. Vui lòng chờ rồi thử lại.', 409, 'ASSISTANT_BUSY'); }
  } else {
    exchange = await LegalAssistantExchange.findOneAndUpdate({ ...filter, $or: [{ status: 'failed' }, { status: 'pending', expires_at: { $lte: new Date() } }] },
      { $set: { status: 'pending', token, expires_at: new Date(Date.now() + 600000) } }, { returnDocument: 'after' });
    if (!exchange) throw new AppError('Câu hỏi đang được xử lý. Vui lòng chờ rồi thử lại.', 409, 'ASSISTANT_BUSY');
  }
  try {
    const answer = await answerLegalQuestion({ session, courtCase, question });
    answer.citations = answer.citations.map((citation) => ({ ...citation, reference_id: `LAW-${createHash('sha256').update(`${exchange._id}:${citation.id}`).digest('hex').slice(0, 24)}` }));
    const saved = await LegalAssistantExchange.findOneAndUpdate({ _id: exchange._id, token }, { $set: { ...answer, status: 'completed' }, $unset: { token: 1, expires_at: 1 } }, { returnDocument: 'after' });
    if (!saved) throw new AppError('Câu hỏi đã hết thời gian xử lý. Hãy tải lại câu trả lời.', 409);
    return publicAssistantExchange(saved, { fresh: true });
  } catch (error) {
    await LegalAssistantExchange.updateOne({ _id: exchange._id, token }, { $set: { status: 'failed' }, $unset: { token: 1, expires_at: 1 } });
    throw error;
  }
}

export async function validateLegalReferences(session, content, supplied) {
  const ids = readReferenceIds(content, 'PL');
  if (!ids.length && !content.includes('[Căn cứ:')) {
    readReferenceIds(content, 'PL', supplied);
    return [];
  }
  const exchanges = await LegalAssistantExchange.find({ session_id: session._id, user_id: session.user_id, status: 'completed' }).sort({ created_at: -1 }).limit(40).lean();
  const citations = exchanges.flatMap(e => e.citations).filter(c => c.verification_status === 'verified' && hasVerifiedSource(c)
    && (ids.includes(c.reference_id) || (content.includes(legalReferenceLabel(c)) && content.includes(c.source_url))));
  if (ids.some((id) => !citations.some((c) => c.reference_id === id))) throw new AppError('Trích dẫn không thuộc phần tra cứu của phiên này. Hãy chọn lại từ trợ lý.', 400, 'LEGAL_REFERENCE_NOT_IN_SESSION');
  // Nhãn tự nhiên được đối chiếu lại với nguồn thuộc phiên, không tin metadata client gửi lên.
  const selected = new Map();
  for (const citation of citations) {
    const key = legalReferenceLabel(citation) + citation.source_url;
    const previous = selected.get(key);
    if (previous && previous.source_sha256 !== citation.source_sha256) throw new AppError('Có hai bản nội dung khác nhau của cùng trích dẫn. Hãy ghi rõ phiên bản cần dùng.', 400);
    if (!previous) selected.set(key, citation);
  }
  const resolved = [...selected.values()];
  if (resolved.length > 30 || (supplied !== undefined && (!Array.isArray(supplied)
    || JSON.stringify([...new Set(supplied)].sort()) !== JSON.stringify(resolved.map(c => c.reference_id).sort())))) throw new AppError('Danh sách trích dẫn không khớp bài viết. Hãy chọn lại từ trợ lý.', 400);
  return resolved;
}
