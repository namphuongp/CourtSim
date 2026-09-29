export const EVIDENCE_MIME = 'application/x-courtsim-evidence';
import { legalReferenceLabel } from '../../../shared/legalSourcePolicy.mjs';

export function evidenceText(item) {
  return `[Chứng cứ: ${item.name}] ${item.source_kind?.startsWith('transcript_') ? `${item.content}\nNguồn: ${item.provided_by}; ${item.source_locator}. Giới hạn: ${item.proof_scope}` : item.summary || ''}`.trim();
}

export function evidenceIds(content, inventory = []) {
  return [...new Set([...content.matchAll(/\[CC:([^\]\s]+)\]/gu)].map((m) => m[1]).concat(inventory.filter((e) => content.includes(`[Chứng cứ: ${e.name}]`)).map((e) => e.id)))];
}

export function legalReferenceText(item) {
  const excerpt = (item.text ?? '').replace(/\s+/gu, ' ').slice(0, 350);
  return `${legalReferenceLabel(item)} Cần đối chiếu thời điểm áp dụng. Trích đoạn: ${excerpt}${(item.text?.length ?? 0) > 350 ? '…' : ''} Nguồn: ${item.source_url}`;
}

