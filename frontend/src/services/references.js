export const EVIDENCE_MIME = 'application/x-courtsim-evidence';

export function evidenceText(item) {
  return `[CC:${item.id}] ${item.code ? `${item.code} — ` : ''}${item.name}: ${item.summary || 'Chưa có trích yếu.'}${item.availability !== 'provided' ? ' (Chỉ được nhắc đến; chưa có nội dung tài liệu.)' : ''}`;
}

export function legalReferenceText(item) {
  const excerpt = (item.text ?? '').replace(/\s+/gu, ' ').slice(0, 350);
  return `[PL:${item.reference_id}] ${item.law_number}, ${item.locator}; mốc tra cứu ${item.application_date || 'chưa rõ'}. Trích đoạn: ${excerpt}${(item.text?.length ?? 0) > 350 ? '…' : ''} Nguồn: ${item.source_url}`;
}

