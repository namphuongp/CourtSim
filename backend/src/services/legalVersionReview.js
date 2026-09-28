import { isValidDateOnly, EVENT_LABELS } from './legalTimeline.js';
import { isOfficialUrl } from './officialLegalSources.js';

export function validateVersionReview(manifest, document, snapshots) {
  if (!manifest || manifest.source_fingerprint !== document.source_fingerprint || manifest.law_number !== document.law_number
    || !Array.isArray(manifest.rules) || !manifest.rules.length || manifest.rules.length > 50) throw new Error('Manifest không khớp phiên bản tệp đã nhập.');
  for (const rule of manifest.rules) {
    if (!isValidDateOnly(rule.from) || !isValidDateOnly(rule.to) || rule.from > rule.to
      || !isValidDateOnly(rule.reviewed_at) || rule.reviewed_at > new Date().toISOString().slice(0, 10) || rule.to > rule.reviewed_at
      || !rule.source_checked || !rule.history_checked || rule.transition_status !== 'reviewed'
      || typeof rule.version !== 'string' || !rule.version.trim()
      || typeof rule.application_note !== 'string' || rule.application_note.length < 20
      || !Array.isArray(rule.event_kinds) || !rule.event_kinds.length || rule.event_kinds.some((kind) => !Object.hasOwn(EVENT_LABELS, kind))
      || !Array.isArray(rule.review_sources) || !rule.review_sources.length || rule.review_sources.some((url) => !isOfficialUrl(url))
      || !Array.isArray(rule.evidence) || rule.evidence.length < 2) throw new Error('Thiếu đối chiếu nguyên văn, lịch sử, thời điểm hoặc chuyển tiếp trong manifest.');
    for (const evidence of rule.evidence) {
      const snapshot = snapshots.find((item) => item.url === evidence.url && item.sha256 === evidence.sha256);
      if (!snapshot || !rule.review_sources.includes(evidence.url) || typeof evidence.quote !== 'string' || evidence.quote.length < 20 || !snapshot.content.includes(evidence.quote)) throw new Error('Trích đoạn xác minh không khớp bản chụp nguồn chính thức.');
    }
    if (!['text', 'history'].every((kind) => rule.evidence.some((item) => item.kind === kind))) throw new Error('Cần bằng chứng riêng cho nội dung và lịch sử.');
    for (const key of ['articles', 'excluded_articles']) if (rule[key] && (!Array.isArray(rule[key]) || rule[key].some((v) => typeof v !== 'string' || !/^\d+[a-z]?$/.test(v)))) throw new Error('Danh sách điều không hợp lệ.');
  }
  return manifest.rules;
}
