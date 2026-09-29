import { SCORING_RUBRIC } from '../data/scoringRubric.js';
import { AppError } from '../utils/AppError.js';
import { isSubstantiveRecord } from './dialogueInput.js';

const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;

export function scoringEligibility(records, legalAvailable) {
  let opponents = 0; let responses = 0;
  for (const record of records) {
    if (['ai_prosecutor', 'ai_opponent'].includes(record.sender_type) && record.generation_mode !== 'guided_continuation') opponents++;
    if (isSubstantiveRecord(record) && opponents > 0) responses++;
  }
  return Object.fromEntries(SCORING_RUBRIC.groups.flatMap((group) => group.items.map((item) => {
    let reason = null;
    if ((item.id.startsWith('2.') || item.id === '4.2') && !legalAvailable) reason = 'Chưa xác minh được căn cứ phù hợp với thời điểm vụ án nên chưa chấm độ chính xác pháp luật.';
    if ((item.id.startsWith('5.') || item.id.startsWith('6.')) && !responses) reason = 'Chưa có lượt người học trả lời lập luận mới của bên đối lập.';
    if (item.id === '5.4' && responses < 2) reason = 'Chưa có lượt bảo vệ lập luận sau phản biện tiếp theo.';
    if (!records.some(isSubstantiveRecord)) reason = 'Chưa có ý kiến về nội dung vụ án để đánh giá; lời chào và câu hỏi thủ tục không phải bài lập luận.';
    return [item.id, reason];
  })));
}

export function calculateEvaluation(entries, records, legalAvailable) {
  const eligibility = scoringEligibility(records, legalAvailable);
  const definitions = SCORING_RUBRIC.groups.flatMap((group) => group.items);
  if (!Array.isArray(entries) || entries.length !== definitions.length || new Set(entries.map((entry) => entry?.id)).size !== definitions.length
    || entries.some((entry) => !definitions.some((item) => item.id === entry?.id))) throw new AppError('Chưa nhận đủ đánh giá theo từng tiêu chí. Vui lòng chấm lại.', 502, 'AI_INVALID_EVALUATION');
  const users = new Map(records.filter((r) => r.sender_type === 'user').map((r) => [String(r._id), r.content]));
  const evaluated = new Map();
  for (const item of definitions) {
    const value = entries.find((entry) => entry.id === item.id);
    if (eligibility[item.id]) {
      evaluated.set(item.id, { ...item, score: null, status: 'not_assessed', reason: eligibility[item.id], strength: 'Chưa đủ dữ liệu đánh giá.', improvement: item.id.startsWith('2.') || item.id === '4.2' ? 'CourtSim cần xác minh nguồn luật trước khi đánh giá phần này; đây không phải lỗi của người học.' : 'Tiếp tục luyện trả lời phản biện ở phiên tiếp theo.', record_id: null, quote: null });
      continue;
    }
    if (typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 0 || value.score > item.max
      || ['reason', 'strength', 'improvement'].some((key) => typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 2000)) throw new AppError('Điểm hoặc nhận xét chưa đúng tiêu chí. Vui lòng chấm lại.', 502, 'AI_INVALID_EVALUATION');
    const hasQuote = typeof value.quote === 'string' && value.quote.trim() && typeof value.record_id === 'string' && users.get(value.record_id)?.includes(value.quote);
    if (!hasQuote && !(value.score === 0 && value.quote === null && value.record_id === null)) throw new AppError('Nhận xét chưa dẫn đúng phát biểu của bạn. Vui lòng chấm lại.', 502, 'AI_INVALID_EVALUATION');
    evaluated.set(item.id, { ...item, score: round(value.score), status: 'assessed', reason: value.reason.trim(), strength: value.strength.trim(), improvement: value.improvement.trim(), record_id: value.record_id, quote: value.quote });
  }
  const criteria = SCORING_RUBRIC.groups.map((group) => {
    const items = group.items.map((item) => evaluated.get(item.id));
    const assessed = items.filter((item) => item.status === 'assessed');
    return { id: group.id, label: group.label, max: group.max, items,
      earned: round(assessed.reduce((sum, item) => sum + item.score, 0)),
      assessed_max: assessed.reduce((sum, item) => sum + item.max, 0),
      score: assessed.length === items.length ? round(assessed.reduce((sum, item) => sum + item.score, 0)) : null };
  });
  const earned = round(criteria.reduce((sum, group) => sum + group.earned, 0));
  const assessedMax = criteria.reduce((sum, group) => sum + group.assessed_max, 0);
  return { rubric_version: SCORING_RUBRIC.version, rubric_source: SCORING_RUBRIC.source, rubric_source_sha256: SCORING_RUBRIC.source_sha256,
    rubric_status: 'proposal', criteria, score: assessedMax === 100 ? earned : null,
    assessed_percentage: assessedMax > 0 ? round(earned / assessedMax * 100) : null,
    assessment_status: assessedMax === 100 ? 'complete' : 'partial', earned_score: earned, assessed_max: assessedMax,
    score_scope: assessedMax === 100 ? 'Điểm theo thang 100.' : `${earned}/${assessedMax} điểm ở phần đã đánh giá. ${100 - assessedMax}% trọng số chưa chấm; chưa có điểm toàn bài. Phần chưa chấm không bị tính 0 điểm.`,
    rubric_scores: Object.fromEntries(criteria.map((group) => [group.id, group.score === null ? null : round(group.score / group.max * 100)])) };
}
