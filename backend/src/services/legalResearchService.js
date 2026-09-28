import { LegalDocument, LegalProvision } from '../models/index.js';
import { buildLegalPlan, assessVersion } from './legalTimeline.js';
import { rankProvisions } from './legalRetrievalService.js';
import { checkOfficialSources } from './officialLegalSources.js';
import { getLegalSearchTerms } from './legalTextSearch.js';

const MAX_CONTEXT = 8000;

// Hàm thuần để kiểm thử quyết định phiên bản, không cần MongoDB hoặc dịch vụ ngoài.
export function resolveLegalResearch({ courtCase, eventDate, learnerTimeline = [], records = [], documents, provisions }) {
  const plans = buildLegalPlan(courtCase, eventDate, learnerTimeline);
  const byId = new Map(documents.map((document) => [String(document._id), document]));
  const citations = []; const candidates = []; const warnings = [];
  let size = 0; let candidateSize = 0;
  const issues = plans.map((plan) => {
    const eligibleDocs = documents.filter((d) => plan.law_numbers.includes(d.law_number));
    const ranked = rankProvisions(provisions.filter((p) => eligibleDocs.some((d) => String(d._id) === String(p.document_id))), courtCase, records);
    const entries = [];
    const covered = new Set();
    // Giới hạn ứng viên, giữ nguyên toàn điều để không cắt mất điều kiện áp dụng.
    for (const { provision, score } of ranked.filter((item) => item.score > 0).slice(0, 5)) {
      const document = byId.get(String(provision.document_id));
      let assessment = assessVersion(document, provision, plan);
      if (assessment.verified && provisions.some((other) => {
        const otherDoc = byId.get(String(other.document_id));
        return String(other.document_id) !== String(provision.document_id) && other.article === provision.article
          && otherDoc?.law_number === document.law_number && assessVersion(otherDoc, other, plan).verified
          && other.text !== provision.text;
      })) assessment = { verified: false, reason: 'Có phiên bản cùng điều và thời kỳ với nội dung khác nhau; cần đối chiếu xung đột.' };
      const entry = {
        id: `${provision._id}:${plan.id}`, provision_id: String(provision._id),
        law_number: document.law_number, title: document.title, article: provision.article,
        paragraph: provision.paragraph, point: provision.point, locator: provision.locator,
        text: provision.text, context_text: provision.text,
        source_url: document.source_url, history_url: document.history_url,
        source_files: document.source_files?.map((f) => f.name) ?? [],
        page_source_file: provision.page_source_file, page_from: provision.page_from, page_to: provision.page_to,
        effective_from: provision.effective_from, effective_to: provision.effective_to,
        verified_through: document.verified_through, temporal_note: document.temporal_note,
        version: assessment.version ?? document.version_label ?? 'Chưa xác minh phiên bản',
        source_fingerprint: document.source_fingerprint,
        verification_status: assessment.verified ? 'verified' : 'unverified',
        application_date: plan.date, application_date_to: plan.date_to, event_kind: plan.kind,
        application_reason: assessment.reason, review_sources: assessment.review_sources ?? [],
      };
      entries.push(entry.id);
      if (assessment.verified && size + provision.text.length <= MAX_CONTEXT && citations.length < 8) {
        citations.push(entry); size += provision.text.length; covered.add(document.law_number);
      } else if (candidates.length < 15) {
        const includeText = candidateSize + provision.text.length <= 24000;
        if (includeText) candidateSize += provision.text.length;
        candidates.push({ ...entry, text: includeText ? entry.text : '', context_text: undefined, verification_status: assessment.verified ? 'verified' : 'unverified',
          application_reason: assessment.verified ? 'Đã xác minh nguồn nhưng không đưa vào lượt này vì giới hạn ngữ cảnh.' : assessment.reason });
      }
    }
    const missing = plan.law_numbers.filter((number) => !covered.has(number));
    const verified = Boolean(plan.date) && !missing.length && entries.length > 0;
    if (!verified) warnings.push(`Chưa xác minh được căn cứ pháp luật — ${plan.label}: ${!plan.date ? plan.reason : missing.join(', ') || 'không tìm thấy điều khoản phù hợp'}.`);
    return { ...plan, verification_status: verified ? 'verified' : 'unverified', missing_laws: missing, candidate_ids: entries };
  });
  return { citations, candidates, issues, warnings, legal_assessment_available: issues.length > 0 && issues.every((issue) => issue.verification_status === 'verified') };
}

export async function researchLegalBasis({ courtCase, eventDate, learnerTimeline = [], records = [], online = true }) {
  try {
    const plans = buildLegalPlan(courtCase, eventDate, learnerTimeline);
    const numbers = [...new Set(plans.flatMap((p) => p.law_numbers))];
    const documents = await LegalDocument.find({ law_number: { $in: numbers } }).select('-source_text').lean();
    const terms = getLegalSearchTerms([courtCase.title, courtCase.summary, ...records.filter((r) => r.sender_type === 'user').slice(-2).map((r) => r.content)].join(' '));
    const provisions = await LegalProvision.find({ document_id: { $in: documents.map((d) => d._id) }, paragraph: null, point: null, search_tokens: { $in: terms } }).lean();
    const result = resolveLegalResearch({ courtCase, eventDate, learnerTimeline, records, documents, provisions });
    const missing = [...new Set(result.issues.flatMap((issue) => issue.missing_laws))];
    if (online && missing.length) {
      // Chỉ gửi số hiệu công khai; không gửi hồ sơ hoặc lời người học ra nguồn tra cứu.
      const checks = await Promise.allSettled(missing.slice(0, 4).map(checkOfficialSources));
      for (const check of checks) result.warnings.push(check.status === 'fulfilled' ? check.value.message : 'Chưa xác minh được căn cứ pháp luật: dịch vụ đối chiếu nguồn đang gián đoạn.');
    }
    result.warnings = [...new Set(result.warnings)];
    return result;
  } catch {
    console.error('Legal research failed:', { code: 'LEGAL_RESEARCH_UNAVAILABLE' });
    // Tra cứu hỏng không được biến thành kết luận chắc chắn hoặc làm mất lượt tranh luận.
    return { citations: [], candidates: [], issues: buildLegalPlan(courtCase, eventDate, learnerTimeline),
      legal_assessment_available: false, warnings: ['Chưa xác minh được căn cứ pháp luật: chưa đọc được dữ liệu nguồn. Phiên vẫn tiếp tục luyện lập luận.'] };
  }
}
