import { canCiteEvidence } from '../../../shared/casePresentation.mjs';
import { createHash } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { isValidDateOnly } from './legalTimeline.js';

export function evidenceInventory(courtCase) {
  return (courtCase.evidence_inventory ?? []).map((item, index) => ({
    ...item,
    // Phiên cũ chưa có ID: sinh ổn định từ chính hồ sơ, không tạo thêm tài liệu.
    id: item.id || `EV-${createHash('sha256').update(`${courtCase._id}:${index}:${item.name}`).digest('hex').slice(0, 24)}`,
    code: `CC${String(index + 1).padStart(2, '0')}`,
    availability: item.availability === 'provided' && item.content?.trim() ? 'provided' : 'mentioned_only',
    summary: item.summary || item.source_quote || '',
  }));
}

export function readReferenceIds(content, kind, supplied) {
  const expression = kind === 'CC' ? /\[CC:([^\]\s]+)\]/gu : /\[PL:([^\]\s]+)\]/gu;
  const ids = [...new Set([...content.matchAll(expression)].map((match) => match[1]))].sort();
  if (ids.length > 30 || ids.some((id) => !/^[a-zA-Z0-9_-]{8,80}$/.test(id))) throw new AppError('Mã tài liệu viện dẫn không hợp lệ. Hãy chọn lại từ hồ sơ hoặc trợ lý.');
  if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length > 30 || supplied.some((id) => typeof id !== 'string')
    || JSON.stringify([...new Set(supplied)].sort()) !== JSON.stringify(ids))) throw new AppError('Danh sách tài liệu không khớp bài viết. Hãy chọn lại tài liệu muốn viện dẫn.');
  return ids;
}

export function validateEvidenceReferences(courtCase, content, supplied) {
  const inventory = evidenceInventory(courtCase);
  const ids = [...new Set([...readReferenceIds(content, 'CC'), ...inventory.filter((e) => content.includes(`[Chứng cứ: ${e.name}]`)).map((e) => e.id)])].sort();
  if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length > 30 || supplied.some((id) => typeof id !== 'string')
    || JSON.stringify([...new Set(supplied)].sort()) !== JSON.stringify(ids))) throw new AppError('Danh sách tài liệu không khớp bài viết. Hãy chọn lại tài liệu muốn viện dẫn.');
  if (ids.length > 30) throw new AppError('Mỗi bài viết chỉ được viện dẫn tối đa 30 tài liệu.');
  if (ids.some((id) => !inventory.some((item) => item.id === id && canCiteEvidence(item, courtCase)))) throw new AppError('Tài liệu viện dẫn không thuộc hồ sơ của phiên này.', 400, 'EVIDENCE_NOT_IN_CASE');
  return ids;
}

export function validateCaseDetails(body) {
  const parties = body.parties ?? [];
  const evidence = body.evidence_inventory ?? [];
  if (!Array.isArray(parties) || parties.length > 20 || !Array.isArray(evidence) || evidence.length > 50) throw new AppError('Danh sách các bên hoặc chứng cứ quá dài.');
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  for (const party of parties) {
    if (!party || !['plaintiff', 'defendant', 'other'].includes(party.side) || !text(party.name, 200) || !party.name.trim()
      || !Array.isArray(party.claims) || party.claims.length > 15 || party.claims.some((claim) => !text(claim, 2000))) throw new AppError('Thông tin các bên hoặc yêu cầu không hợp lệ.');
  }
  for (const item of evidence) {
    if (!item || !text(item.name, 200) || !item.name.trim() || !['provided', 'mentioned_only'].includes(item.availability)
      || ['summary', 'source_quote', 'provided_by', 'source_locator', 'proof_scope'].some((key) => item[key] !== undefined && !text(item[key], 2000))
      || (item.source_kind !== undefined && !['document', 'transcript_statement', 'transcript_readout'].includes(item.source_kind))
      || (item.verification_status !== undefined && !['unverified', 'conflicting'].includes(item.verification_status))
      || (item.content !== undefined && !text(item.content, 10000))
      || (item.availability === 'provided' && !item.content?.trim())
      || (item.date && !isValidDateOnly(item.date))) throw new AppError('Chứng cứ cần tên, trạng thái và nội dung thực sự được cung cấp; ngày không rõ có thể để trống.');
  }
  return {
    parties: parties.map(({ side, name, claims }) => ({ side, name, claims })),
    evidence_inventory: evidence.map(({ name, availability, summary, source_quote, provided_by, date, content, source_kind, source_locator, proof_scope, verification_status }) => ({ name, availability, summary, source_quote, provided_by, date, content, source_kind, source_locator, proof_scope, verification_status })),
  };
}
