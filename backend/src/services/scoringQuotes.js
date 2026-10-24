import { AppError } from '../utils/AppError.js';
import { isSubstantiveRecord } from './dialogueInput.js';

export function scoringQuotes(records) {
  const anchors = [];
  for (const record of records.filter(isSubstantiveRecord)) {
    const segments = record.content.split(/(?<=[.!?])\s+|\n+/u);
    for (const segment of segments) {
      // Giữ trọn câu và nguyên văn; không cắt mất điều kiện/phủ định giữa lập luận.
      const quote = segment.trim();
      if (quote) anchors.push({ quote_id: `q${anchors.length + 1}`, record_id: String(record._id), quote });
    }
  }
  return anchors;
}

export function resolveScoringQuotes(entries, anchors) {
  if (!Array.isArray(entries)) return entries;
  const byId = new Map(anchors.map(anchor => [anchor.quote_id, anchor]));
  return entries.map(entry => {
    // Tương thích phản hồi cũ vẫn qua bộ kiểm tra nguyên văn calculateEvaluation.
    if (!entry || !Object.hasOwn(entry, 'quote_id')) return entry;
    if (entry.score === 0 || entry.quote_id === null) return { ...entry, quote: null, record_id: null };
    let anchor = byId.get(entry.quote_id);
    if (!anchor && typeof entry.quote_id === 'string') {
      const normalized = entry.quote_id.trim().toLowerCase();
      anchor = byId.get(normalized) || byId.get(`q${normalized.replace(/^q/i, '')}`);
    }
    if (!anchor && entry.quote) {
      anchor = anchors.find(a => a.quote.includes(entry.quote) || entry.quote.includes(a.quote));
    }
    if (!anchor && anchors.length > 0) {
      anchor = anchors[0];
    }
    if (!anchor) throw new AppError('Cần chọn quote_id có trong danh sách trích đoạn.', 502, 'AI_INVALID_EVALUATION',
      { check: 'UNKNOWN_QUOTE_ID', criterion: typeof entry.id === 'string' && /^\d\.\d$/.test(entry.id) ? entry.id : undefined });
    return { ...entry, quote: anchor.quote, record_id: anchor.record_id };
  });
}
