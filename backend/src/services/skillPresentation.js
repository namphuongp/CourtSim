import { learnerText } from '../../../shared/learnerText.mjs';

const text = value => typeof value === 'string' ? learnerText(value).trim().slice(0, 900) : '';
const unique = values => [...new Set(values.map(text).filter(Boolean))].slice(0, 2);

// Chỉ dùng nhận xét của tiêu chí đã chấm; thiếu nguồn luật không phải điểm yếu của người học.
export function skillPresentation(result) {
  const groups = Array.isArray(result.criteria) ? result.criteria : [];
  const assessed = groups.flatMap(group => (Array.isArray(group.items) ? group.items : [])
    .filter(item => item.status === 'assessed' && Number.isFinite(item.score) && Number.isFinite(item.max) && item.max > 0 && item.score >= 0 && item.score <= item.max)
    .map(item => ({ ...item, group: group.id, ratio: item.score / item.max })));
  const strengths = [...assessed].filter(item => item.score > 0 && item.strength && !/^chưa /iu.test(item.strength)).sort((a, b) => b.ratio - a.ratio);
  const improvements = [...assessed].filter(item => item.ratio < 1).sort((a, b) => a.ratio - b.ratio);
  return {
    strengths: unique(strengths.map(item => item.strength)),
    improvements: unique(improvements.map(item => item.improvement)),
    feedback: text(result.feedback),
    goal: text(improvements[0]?.improvement) || text(result.improvement_suggestions),
    details: groups.filter(group => typeof group.id === 'string').map(group => ({
      id: group.id,
      strengths: unique(strengths.filter(item => item.group === group.id).map(item => item.strength)),
      improvements: unique(improvements.filter(item => item.group === group.id).map(item => item.improvement)),
      feedback: unique(assessed.filter(item => item.group === group.id).map(item => item.reason)),
    })),
  };
}
