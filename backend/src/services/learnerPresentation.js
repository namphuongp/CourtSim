import { dialogueText, evidenceSummary } from '../../../shared/dialogueText.mjs';
import { caseKnowledge } from './caseKnowledge.js';
import { evidenceInventory } from './caseEvidence.js';
import { scoreSummary } from '../../../shared/scorePresentation.mjs';

import { learnerText } from '../../../shared/learnerText.mjs';
import { isVbplUrl, hasVerifiedSource } from '../../../shared/legalSourcePolicy.mjs';
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
    practice_context: c.practice_context,
    recorded_events: caseKnowledge(c).recorded_events.map((f) => ({ text: f.quote, source_quote: f.quote, source: f.source_type === 'judgment' ? 'Theo nội dung bản án' : 'Theo hồ sơ bài tập' })),
    parties: (c.parties ?? []).map((p) => ({ side: p.side, name: learnerText(p.name), claims: (p.claims ?? []).map((v) => learnerText(v)).filter(Boolean) })),
    timeline: (c.timeline ?? []).map((e) => ({ kind: e.kind, date: e.date, date_to: e.date_to, description: learnerText(e.description) })),
    evidence_inventory: evidenceInventory(c).map((e) => ({ id: e.id, code: e.code, name: learnerText(e.name, 'Tài liệu trong hồ sơ'), availability: e.availability,
      summary: e.summary === e.source_quote ? e.summary : learnerText(evidenceSummary(e.summary)), source_quote: e.source_quote, content: e.content, provided_by: learnerText(e.provided_by), date: e.date || null,
      source_kind: e.source_kind, source_locator: e.source_locator, proof_scope: e.proof_scope, verification_status: e.verification_status })),
  };
}

export function learnerCitation(citation) {
  const sourceVerified = hasVerifiedSource(citation);
  const verified = citation.verification_status === 'verified' && sourceVerified;
  return { id: citation.id, reference_id: citation.reference_id, law_number: citation.law_number, title: learnerText(citation.title),
    article: citation.article, paragraph: citation.paragraph, point: citation.point, locator: citation.locator,
    text: citation.text, source_url: sourceVerified && isVbplUrl(citation.source_url) ? citation.source_url : null, version: learnerText(citation.version),
    document_type: citation.document_type, excerpt: citation.excerpt, checked_at: sourceVerified ? citation.checked_at : null,
    source_verification: sourceVerified ? 'verified' : 'unverified', retrieval_mode: citation.retrieval_mode,
    application_status: citation.application_status ?? 'unverified', provision_note: citation.provision_note,
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

function presentationTree(value, inventory = []) {
  if (typeof value === 'string') return learnerText(dialogueText(value, inventory));
  if (Array.isArray(value)) return value.map((child) => presentationTree(child, inventory));
  if (!value || typeof value !== 'object') return value;
  // Khóa dữ liệu phục vụ liên kết/React phải giữ nguyên; chỉ lọc phần văn bản hiển thị.
  const structural = new Set(['id', 'record_id', 'status', 'quote']);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, structural.has(key) ? child : presentationTree(child, inventory)]));
}

export function learnerRecord(record, courtCase = {}) {
  const r = record.toObject ? record.toObject() : record;
  const inventory = evidenceInventory(courtCase);
  const displayed = dialogueText(r.content, inventory);
  return { _id: r._id, sender_type: r.sender_type, sender_name: ({ user: 'Bạn', ai_judge: 'Chủ tọa', ai_prosecutor: 'Bên đối lập' })[r.sender_type] ?? 'Người tham gia', created_at: r.created_at, request_id: r.request_id,
    content: r.sender_type === 'user' ? r.content : learnerText(displayed, 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.'),
    display_content: r.sender_type === 'user' ? displayed : learnerText(displayed, 'Chưa hiển thị được phản hồi này. Hãy tải lại phiên.'),
    evidence_ids: r.evidence_ids ?? [], legal_reference_ids: r.legal_reference_ids ?? [],
    citations: (r.citations ?? []).map(learnerCitation) };
}

export function learnerEvaluation(result, courtCase = {}) {
  const r = result.toObject ? result.toObject() : result;
  const inventory = evidenceInventory(courtCase);
  const summary = scoreSummary(r);
  return { session_id: r.session_id, created_at: r.created_at, score: summary.score, score_scope: summary.partial ? `${summary.label}. Chưa có điểm toàn bài.` : learnerText(r.score_scope),
    earned_score: r.earned_score, assessed_max: r.assessed_max, assessment_status: r.assessment_status,
    rubric_scores: r.rubric_scores, rubric_version: r.rubric_version,
    criteria: presentationTree(r.criteria, inventory), rubric_feedback: presentationTree(r.rubric_feedback, inventory),
    verdict: learnerText(dialogueText(r.verdict, inventory), 'Đã hoàn thành phiên luyện tập.'), feedback: learnerText(dialogueText(r.feedback, inventory)),
    improvement_suggestions: learnerText(dialogueText(r.improvement_suggestions, inventory)),
    citations: (r.citations ?? []).map(learnerCitation), legal_research: learnerResearch(r.legal_research) };
}
