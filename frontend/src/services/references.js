export const EVIDENCE_MIME = 'application/x-courtsim-evidence';

export function evidenceText(item) {
  return `[Chứng cứ: ${item.name}] ${item.summary || ''}`.trim();
}

export function evidenceIds(content, inventory = []) {
  return [...new Set([...content.matchAll(/\[CC:([^\]\s]+)\]/gu)].map((m) => m[1]).concat(inventory.filter((e) => content.includes(`[Chứng cứ: ${e.name}]`)).map((e) => e.id)))];
}

export function legalReferenceText(item) {
  const excerpt = (item.text ?? '').replace(/\s+/gu, ' ').slice(0, 350);
  return `[PL:${item.reference_id}] ${item.law_number}, ${item.locator}; mốc tra cứu ${item.application_date || 'chưa rõ'}. Trích đoạn: ${excerpt}${(item.text?.length ?? 0) > 350 ? '…' : ''} Nguồn: ${item.source_url}`;
}

