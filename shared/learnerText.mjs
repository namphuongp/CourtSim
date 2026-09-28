import { TECHNICAL_TEXT } from './userCopy.mjs';
const INTERNAL = /bài tập ưu tiên lập luận|(?:kho|cơ sở) dữ liệu|kho luật|đồng bộ nguồn|(?:đã|chưa) nhập (?:nguồn|văn bản|luật|dữ liệu)|lịch sử sửa đổi|cấu hình|developer|system[_ ]prompt|stack trace|mongodb|fingerprint|version_rules|source_status|citationId|legalCoverageWarnings|rubric MVP|chuyên gia (?:phê duyệt|xác nhận)|người quản trị|metadata|backend|frontend|\bmodel[_ -]|LEGAL_ONLINE|chỉ dẫn (?:hệ thống|cho AI)|hướng dẫn (?:cho )?(?:AI|developer)/iu;

export function learnerText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const result = value.split(/(?<=[.!?])\s+|\n+/u).filter((part) => !INTERNAL.test(part) && !TECHNICAL_TEXT.test(part.replace(/\[(?:CC|PL):[^\]]+\]|\b(?:EV|LAW)-[\w-]+|mentioned_only/gu, ''))).join('\n').trim();
  return result.replace(/Thẩm phán(?: AI)?/gu, 'Chủ tọa').replace(/Bên đối lập AI/gu, 'Bên đối lập').replace(/\brubric\b/giu, 'bộ tiêu chí') || fallback;
}


// Lớp hiển thị phòng vệ cho API/biên bản cũ; nguyên văn luật và nội dung người học được giữ.
export function learnerPayload(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(learnerPayload);
  const hidden = new Set(['fact_analysis','dialogue_focus','generation_mode','source_note','reference_date_note','legal_scope_note','citation_warnings','legal_coverage_warnings','source_fingerprint','source_files','temporal_note','rubric_source','rubric_source_sha256']);
  const humanText = new Set(['title','summary','full_document','content','display_content','answer','description','reason','strength','improvement','feedback','improvement_suggestions','verdict','application_reason','score_scope','name','provided_by','label']);
  const textArrays = new Set(['established_facts','learner_claims','inferences','missing_facts','claims']);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !hidden.has(key)).map(([key, child]) => [key,
    textArrays.has(key) && Array.isArray(child) ? child.map((item) => learnerText(item)).filter(Boolean)
      : typeof child === 'string' && humanText.has(key) && !((key === 'content' || key === 'display_content') && (value.sender_type === 'user' || value.availability)) && !(key === 'summary' && child === value.source_quote) ? learnerText(child) : learnerPayload(child)]));
}
