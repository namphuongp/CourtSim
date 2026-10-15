const STOP_WORDS = new Set(['cua', 'cho', 'cac', 'cung', 'duoc', 'trong', 'theo', 'mot', 'nhung', 'neu', 'nay', 'voi', 'va', 'la', 'co', 've', 'tai', 'den', 'tu', 'hay', 'khi']);

export function normalizeLegalSearchText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/giu, 'd').toLowerCase();
}

export function getLegalSearchTerms(value, maximum = 120) {
  return [...new Set(normalizeLegalSearchText(value).match(/[\p{L}\p{N}]{3,}/gu)
    ?.filter((term) => !STOP_WORDS.has(term)) ?? [])].slice(0, maximum);
}
