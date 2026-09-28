import { evidenceInventory } from './caseEvidence.js';

import { learnerText } from '../../../shared/learnerText.mjs';
export { learnerText } from '../../../shared/learnerText.mjs';

const safeUrl = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
};

export function learnerCase(value) {
  if (!value) return null;
  const c = value.toObject ? value.toObject() : value;
  return {
    _id: c._id, title: learnerText(c.title, 'Hồ sơ vụ án'), category: learnerText(c.category),
    summary: learnerText(c.summary), full_document: learnerText(c.full_document),
    reference_date: c.reference_date, source_url: safeUrl(c.source_url), created_at: c.created_at,
    parties: (c.parties ?? []).map((p) => ({ side: p.side, name: learnerText(p.name), claims: (p.claims ?? []).map((v) => learnerText(v)).filter(Boolean) })),
    timeline: (c.timeline ?? []).map((e) => ({ kind: e.kind, date: e.date, date_to: e.date_to, description: learnerText(e.description) })),
    evidence_inventory: evidenceInventory(c).map((e) => ({ id: e.id, code: e.code, name: learnerText(e.name, 'Tài liệu trong hồ sơ'), availability: e.availability,
      summary: learnerText(e.summary), content: learnerText(e.content), provided_by: learnerText(e.provided_by), date: e.date || null })),
  };
}

export function learnerCitation(citation) {
  const verified = citation.verification_status === 'verified';
  return { id: citation.id, reference_id: citation.reference_id, law_number: citation.law_number, title: learnerText(citation.title),
    article: citation.article, paragraph: citation.paragraph, point: citation.point, locator: citation.locator,
    text: citation.text, source_url: safeUrl(citation.source_url), version: learnerText(citation.version),
    application_date: citation.application_date, application_date_to: citation.application_date_to,
    verification_status: verified ? 'verified' : 'unverified',
    application_reason: verified ? learnerText(citation.application_reason) : 'Cần kiểm tra hiệu lực của điều luật này.',
  };
}

export function learnerResearch(research) {
  if (!research) return undefined;
  return { legal_assessment_available: research.legal_assessment_available === true,
    citations: (research.citations ?? []).map(learnerCitation), candidates: (research.candidates ?? []).map(learnerCitation),
    issues: (research.issues ?? []).map(({ id, label, date, date_to, verification_status }) => ({ id, label, date, date_to, verification_status })),
  };
}

function presentationTree(value) {
  if (typeof value === 'string') return learnerText(value);
  if (Array.isArray(value)) return value.map(presentationTree);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, presentationTree(child)]));
}

export function learnerRecord(record) {
  const r = record.toObject ? record.toObject() : record;
  return { _id: r._id, sender_type: r.sender_type, sender_name: r.sender_name, created_at: r.created_at, request_id: r.request_id,
    content: r.sender_type === 'user' ? r.content : learnerText(r.content, 'Cần kiểm tra thêm căn cứ trước khi kết luận.'),
    evidence_ids: r.evidence_ids ?? [], legal_reference_ids: r.legal_reference_ids ?? [],
    fact_analysis: presentationTree(r.fact_analysis), citations: (r.citations ?? []).map(learnerCitation) };
}

export function learnerEvaluation(result) {
  const r = result.toObject ? result.toObject() : result;
  return { session_id: r.session_id, created_at: r.created_at, score: r.score, score_scope: learnerText(r.score_scope),
    earned_score: r.earned_score, assessed_max: r.assessed_max, assessment_status: r.assessment_status,
    rubric_scores: r.rubric_scores, rubric_version: r.rubric_version,
    criteria: presentationTree(r.criteria), rubric_feedback: presentationTree(r.rubric_feedback),
    verdict: learnerText(r.verdict, 'Đã hoàn thành phiên luyện tập.'), feedback: learnerText(r.feedback),
    improvement_suggestions: learnerText(r.improvement_suggestions), fact_analysis: presentationTree(r.fact_analysis),
    citations: (r.citations ?? []).map(learnerCitation), legal_research: learnerResearch(r.legal_research) };
}
