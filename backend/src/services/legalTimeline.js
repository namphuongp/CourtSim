import { AppError } from '../utils/AppError.js';
import { isPublicWebUrl } from '../../../shared/legalSourcePolicy.mjs';

export const EVENT_LABELS = Object.freeze({ conduct: 'Hành vi', transaction: 'Giao dịch/quyền được xác lập', dispute: 'Phát sinh tranh chấp', filing: 'Khởi kiện', hearing: 'Xét xử' });

export function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) > 0;
}

export function validateTimeline(value = [], { learner = false } = {}) {
  if (!Array.isArray(value) || value.length > 20) throw new AppError('Dòng thời gian phải có tối đa 20 mốc.');
  return value.map((event) => {
    if (!event || !Object.hasOwn(EVENT_LABELS, event.kind) || !isValidDateOnly(event.date)
      || (event.date_to && (!isValidDateOnly(event.date_to) || event.date_to < event.date))
      || typeof event.description !== 'string' || !event.description.trim() || event.description.length > 500
      || (!learner && (typeof event.source_quote !== 'string' || !event.source_quote.trim() || event.source_quote.length > 1000))) {
      throw new AppError('Mốc thời gian cần loại, ngày hợp lệ, mô tả và trích đoạn nguồn, không tự điền ngày khi chỉ biết năm.');
    }
    return { kind: event.kind, date: event.date, date_to: event.date_to || event.date,
      description: event.description.trim(), source_quote: learner ? '' : event.source_quote,
      status: learner ? 'assumed' : 'reported' };
  });
}

export function buildLegalPlan(courtCase, fallbackDate, learnerTimeline = []) {
  const timeline = [...(courtCase.timeline ?? []), ...learnerTimeline];
  const land = /đất|dat dai/iu.test(`${courtCase.category} ${courtCase.title}`);
  const plans = [];
  for (const [kind, label] of Object.entries(EVENT_LABELS)) {
    const events = timeline.filter((event) => event.kind === kind);
    if (!events.length) {
      plans.push({ id: kind, kind, label, date: null, date_to: null, status: 'unknown', law_numbers: [], reason: `Chưa có mốc ${label.toLowerCase()} trong hồ sơ.` });
      continue;
    }
    events.forEach((event, index) => {
      const procedural = kind === 'filing' || kind === 'hearing';
      const law = land ? (event.date < '2004-07-01' ? 'Luật trước 2004 (chưa xác định phiên bản)' : event.date < '2014-07-01' ? '13/2003/QH11' : event.date < '2024-08-01' ? '45/2013/QH13' : '31/2024/QH15') : '91/2015/QH13';
      plans.push({ ...event, id: `${kind}-${index}`, label,
        // Đây là danh sách cần kiểm tra, không phải kết luận luật áp dụng.
        law_numbers: procedural ? [...(land ? [law] : []), '92/2015/QH13'] : [law],
        reason: `${label} (${event.date}${event.date_to && event.date_to !== event.date ? ' – ' + event.date_to : ''}): ${event.description}. Đây là mốc xác định thời điểm áp dụng pháp luật — phải dùng phiên bản luật có hiệu lực TẠI thời điểm này, không dùng luật hiện hành nếu có phiên bản khác trước đó. Cần đối chiếu riêng điều kiện áp dụng, điều khoản chuyển tiếp và loại quan hệ pháp luật (nội dung giao dịch vs. thủ tục tố tụng có thể áp dụng phiên bản khác nhau).` });
    });
  }
  if (!timeline.length && isValidDateOnly(fallbackDate)) {
    plans.push({ id: 'exercise', kind: 'exercise', label: 'Mốc giả định bài tập', date: fallbackDate, date_to: fallbackDate,
      status: 'assumed', law_numbers: land ? [fallbackDate < '2004-07-01' ? 'Luật trước 2004 (chưa xác định phiên bản)' : fallbackDate < '2014-07-01' ? '13/2003/QH11' : fallbackDate < '2024-08-01' ? '45/2013/QH13' : '31/2024/QH15'] : ['91/2015/QH13'],
      reason: 'Mốc giả định từ bài tập (chưa có mốc sự kiện trong hồ sơ). Phiên bản luật được suy ra chỉ để định hướng tra cứu, chưa phải kết luận về thời điểm áp dụng. Khi hồ sơ có mốc thực tế, phải dùng mốc đó để xác định phiên bản luật chính xác.' });
  }
  return plans;
}

export function assessVersion(document, provision, plan) {
  if (!isValidDateOnly(plan.date) || !isValidDateOnly(plan.date_to)) return { verified: false, reason: 'Chưa xác định mốc thời gian.' };
  if (plan.status === 'assumed') return { verified: false, reason: 'Mốc do người học giả định, chưa được hồ sơ xác nhận.' };
  const rules = document.version_rules ?? [];
  // Mỗi khoảng chỉ xác nhận đúng văn bản gốc/fingerprint này; không tự hợp nhất văn bản sửa đổi.
  const applicable = rules.filter((rule) => rule.from <= plan.date && rule.to >= plan.date_to
    && (!rule.articles?.length || rule.articles.includes(provision.article))
    && !rule.excluded_articles?.includes(provision.article));
  const rule = applicable.length === 1 ? applicable[0] : null;
  if (!rule || !rule.history_checked || !rule.source_checked || !rule.review_sources?.length || rule.review_sources.some(url => !isPublicWebUrl(url))) return { verified: false, reason: 'Chưa xác minh được phiên bản và lịch sử sửa đổi cho toàn bộ khoảng thời gian.' };
  if (rule.transition_status !== 'reviewed') return { verified: false, reason: 'Có quy định chuyển tiếp chưa được đối chiếu.' };
  if (!rule.event_kinds?.includes(plan.kind)) return { verified: false, reason: 'Chưa xác minh phạm vi áp dụng cho loại mốc thời gian này.' };
  return { verified: true, version: rule.version, reason: `${plan.reason} ${rule.application_note}`, review_sources: rule.review_sources };
}
