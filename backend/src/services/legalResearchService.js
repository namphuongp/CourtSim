import { buildLegalPlan, assessVersion } from './legalTimeline.js';
import { rankProvisions } from './legalRetrievalService.js';
import { hasReadableLawSource, hasVerifiedSource } from '../../../shared/legalSourcePolicy.mjs';
import { parseLegalArticles, createProvisionUnits } from './legalTextParser.js';
import { researchCorpusForSimulation } from './legalCorpusRetrieval.js';
import { researchWebLaw, webReferenceEnabled, WEB_REFERENCE_NOTE } from './webLegalResearch.js';

const MAX_CONTEXT = 8000;

// Hàm thuần để kiểm thử quyết định phiên bản, không cần MongoDB hoặc dịch vụ ngoài.
export function resolveLegalResearch({ courtCase, eventDate, learnerTimeline = [], records = [], documents, provisions, snapshots = [] }) {
  const plans = buildLegalPlan(courtCase, eventDate, learnerTimeline);
  const byId = new Map(documents.map((document) => [String(document._id), document]));
  const compact = text => (text ?? '').replace(/\s+/gu, ' ').trim();
  const sourceUnits = snapshots.filter(hasVerifiedSource).map(snapshot => ({ snapshot,
    units: parseLegalArticles(snapshot.source_text).flatMap(createProvisionUnits) }));
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
      // Cờ duyệt chưa đủ: nguyên văn phải khớp đơn vị trong nguồn đã xác minh.
      const snapshot = sourceUnits.find(({ snapshot: s, units }) => s.law_number === document.law_number && s.source_url === document.source_url
        && units.some(p => p.article === provision.article && p.paragraph === (provision.paragraph ?? null)
          && p.point === (provision.point ?? null) && compact(p.text) === compact(provision.text)))?.snapshot;
      if (!snapshot) assessment = { verified: false, reason: 'Chưa đối chiếu được nguyên văn điều khoản với nguồn đã xác minh.' };
      if (assessment.verified && provisions.some((other) => {
        const otherDoc = byId.get(String(other.document_id));
        return String(other.document_id) !== String(provision.document_id) && other.article === provision.article
          && otherDoc?.law_number === document.law_number && assessVersion(otherDoc, other, plan).verified
          && other.text !== provision.text;
      })) assessment = { verified: false, reason: 'Có phiên bản cùng điều và thời kỳ với nội dung khác nhau, cần đối chiếu xung đột.' };
      const entry = {
        id: `${provision._id}:${plan.id}`, provision_id: String(provision._id),
        law_number: document.law_number, title: document.title, article: provision.article,
        paragraph: provision.paragraph, point: provision.point, locator: provision.locator,
        text: provision.text, context_text: provision.text,
        source_url: document.source_url, history_url: document.history_url,
        source_verification: snapshot ? 'verified' : 'unverified', source_sha256: snapshot?.source_sha256,
        checked_at: snapshot?.checked_at, retrieval_mode: 'cache', document_type: snapshot?.document_type,
        application_status: assessment.verified ? 'verified' : 'unverified',
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

export async function researchLegalBasis(input, dependencies = {}) {
  let result;
  try {
    result = await (dependencies.corpus ?? researchCorpusForSimulation)(input);
  } catch {
    result = { citations: [], candidates: [], issues: [], legal_assessment_available: false,
      warnings: ['Kho luật đang không truy cập được.'] };
  }
  // Có tài liệu chưa đồng nghĩa đã đủ nguồn để chấm. Lỗi kho không chặn đường tìm web.
  if ((result.legal_assessment_available && result.citations.length && result.citations.every(c => hasVerifiedSource(c) && c.application_status === 'verified'))
    || !webReferenceEnabled() || input.online === false) return result;
  try {
    const web = await (dependencies.web ?? researchWebLaw)(input);
    const citations = [...result.citations];
    for (const citation of web.citations ?? []) {
      if (!citations.some(c => c.id && c.id === citation.id)) citations.push(citation);
    }
    const reference = citations.some(c => c.assessment_mode === 'web_reference' && hasReadableLawSource(c) && c.article && c.text?.trim());
    return { ...result, citations,
      ...(reference ? { legal_assessment_mode: 'web_reference', assessment_note: WEB_REFERENCE_NOTE } : {}),
      source_diagnostics: web.diagnostics ?? [], warnings: [...new Set([...(result.warnings ?? []), ...(web.warnings ?? [])])] };
  } catch {
    return { ...result, warnings: [...(result.warnings ?? []), 'Chưa truy cập được nguồn web, giữ phần đánh giá có căn cứ hiện có.'] };
  }
}
