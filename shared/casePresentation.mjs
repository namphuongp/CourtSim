export function caseRoleLabel(role, courtCase) {
  if (!['defense_lawyer', 'plaintiff_lawyer'].includes(role)) return null;
  const label = courtCase?.practice_context?.role_labels?.[role];
  return typeof label === 'string' ? label : null;
}

export function canCiteEvidence(item, courtCase) {
  // Hồ sơ cũ vẫn cho dẫn thông tin được thuật lại; bản chép mới chỉ kéo thẻ có nội dung xem được.
  return courtCase?.practice_context?.source_kind !== 'transcript'
    || (item.availability === 'provided' && typeof item.content === 'string' && Boolean(item.content.trim()));
}
