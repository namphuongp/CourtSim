import { hasReadableLawSource, hasVerifiedSource } from '../../../shared/legalSourcePolicy.mjs';
import { AppError } from '../utils/AppError.js';
import { validateCitationIds } from './legalRetrievalService.js';

export const contentCriteria = ['2.1', '2.2'];
export const applicationCriteria = ['2.3', '2.4', '4.2'];

export function scoringCitationIds(id, basis) {
  const sources = applicationCriteria.includes(id) ? basis.applicationSources : contentCriteria.includes(id) ? basis.contentSources : [];
  return sources.map(source => source.id);
}

export function legalScoringBasis(context, records = []) {
  const verified = (context.citations ?? []).filter(c => hasVerifiedSource(c) && c.verification_status === 'verified' && c.article && c.text?.trim());
  const applicable = verified.filter(c => c.application_status === 'verified');
  // Chấm tham khảo kỹ năng vận dụng theo nguyên văn đã tải, không tự nâng nhãn xác minh hiệu lực.
  const reference = context.legal_assessment_mode === 'web_reference' ? (context.citations ?? []).filter(c =>
    c.assessment_mode === 'web_reference' && hasReadableLawSource(c) && c.article && c.text?.trim()) : [];
  // Thiếu đúng điều người học viện dẫn không được biến thành lỗi hiểu luật của người học.
  const covered = sources => records.filter(r => r.sender_type === 'user').every(r => validateCitationIds({
    content: r.content ?? '', citationIds: sources.map(c => c.id), availableCitations: sources,
  }).valid);
  const contentSources = [...new Map([...verified, ...reference].map(c => [c.id, c])).values()];
  const verifiedApplication = Boolean(context.legal_assessment_available && applicable.length && covered(applicable));
  const applicationSources = verifiedApplication ? applicable : reference;
  return { content: contentSources.length > 0 && covered(contentSources),
    application: applicationSources.length > 0 && covered(applicationSources),
    mode: reference.length ? 'web_reference' : 'verified_or_unassessed',
    verified, applicable, contentSources, applicationSources };
}

// Điểm luật phải gắn nguồn ở từng tiêu chí, không mượn một nguồn chung để chấm mọi mục.
export function validateScoringBasis(entries, basis) {
  for (const entry of entries) {
    const application = applicationCriteria.includes(entry.id);
    if (!application && !contentCriteria.includes(entry.id)) continue;
    if (entry.score == null) continue;
    const allowedIds = scoringCitationIds(entry.id, basis);
    if (!Array.isArray(entry.citation_ids) || !entry.citation_ids.length
      || entry.citation_ids.some(id => !allowedIds.includes(id))) {
      throw new AppError(`Tiêu chí ${entry.id} cần dẫn nguồn đã xác minh phù hợp với phần nhận xét.`, 502, 'AI_INVALID_EVALUATION', { check: 'INVALID_CRITERION_CITATIONS', criterion: entry.id });
    }
  }
}

export const SCORING_CALIBRATION = [
  'Chấm mức độ thể hiện thực tế theo từng tiêu chí, không mặc định điểm tối đa khi người học chỉ nêu đúng từ khóa hoặc thừa nhận thiếu dữ liệu.',
  'Mốc tham chiếu: 0 khi không thể hiện hoặc sai hoàn toàn, khoảng 25% khi chỉ nêu ý, 50% khi có giải thích nhưng thiếu liên kết quan trọng, 75% khi lập luận có căn cứ nhưng còn thiếu sót, 100% khi đáp ứng đầy đủ tiêu chí trong phạm vi hồ sơ. Có thể dùng điểm giữa các mốc, không ép phân phối điểm.',
  'Điểm tối đa cần reason giải thích vì sao đã đáp ứng đầy đủ. Nếu improvement chỉ ra thiếu sót ngay trong tiêu chí đang chấm thì không cho điểm tối đa. Bài tập nâng cao cho lần sau không tự động làm mất điểm.',
  'Chấm tính nhất quán trên toàn phiên. Một câu đúng cuối phiên không xóa mâu thuẫn chưa được người học điều chỉnh. Không thưởng cho độ dài, số lần lặp hoặc thắng kiện.',
  'Mỗi tiêu chí luật được chấm phải có citation_ids riêng từ nguồn phù hợp. Ở chế độ web_reference, chấm kỹ năng lựa chọn, hiểu và vận dụng nguyên văn được cung cấp vào giả định của bài tập, bao gồm 2.3, 2.4 và 4.2. Phân biệt ngày văn bản và mốc sự kiện, nêu điều kiện khi có khác biệt phiên bản; không khẳng định hiệu lực hoặc kết quả vụ kiện khi chưa đối chiếu. Ở chế độ verified_or_unassessed, các mục 2.3, 2.4 và 4.2 chỉ dùng nguồn đã xác minh điều kiện áp dụng.',
].join('\n');
