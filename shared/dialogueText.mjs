// Chỉ đổi cách trình bày. Mã, nội dung gốc và phân loại vẫn được giữ để đối chiếu/chấm điểm.
export function dialogueText(value, inventory = []) {
  if (typeof value !== 'string') return '';
  const names = new Map(inventory.map((e) => [e.id, e.name]));
  return value
    .replace(/\(?\b(?:trạng thái|availability)\s*[:=]?\s*["'`]?\b(?:mentioned_only|provided)\b["'`]?\)?\s*[,;]?/giu, '')
    .replace(/\(\s*(?:mentioned_only|provided)\s*\)/gu, '')
    .replace(/\[CC:([^\]\s]+)\]/gu, (_, id) => names.get(id) ?? 'tài liệu được viện dẫn')
    .replace(/\[PL:[^\]\s]+\]/gu, '')
    .replace(/\bEV-[\p{L}\p{N}_-]+/gu, (id) => names.get(id) ?? 'tài liệu được viện dẫn')
    .replace(/\bLAW-[\p{L}\p{N}_-]+/gu, '')
    .replace(/\bmentioned_only\b/gu, 'được bản án đề cập')
    .replace(/\bprovided\b/gu, 'có nội dung trong hồ sơ')
    .replace(/\b(?:established_facts|learner_claims|inferences|missing_facts|fact_analysis|dialogue_focus)\b\s*:?/gu, '')
    .replace(/[ \t]{2,}/gu, ' ').trim();
}

export function evidenceSummary(value) {
  if (typeof value !== 'string') return '';
  // Hồ sơ cũ từng dùng ghi chú nguồn thay cho trích yếu; chỉ đưa ghi chú ấy vào chi tiết.
  return /^Tài liệu được bản án (?:thuật lại|đề cập);?\s*(?:không|chưa) có bản gốc/iu.test(value) ? '' : value;
}
