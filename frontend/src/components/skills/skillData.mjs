import { sessionTime } from '../dashboard/dashboardData.mjs';

export const skills = [
  { id: 'issue_identification', label: 'Vấn đề pháp lý và mục tiêu' },
  { id: 'legal_application', label: 'Áp dụng pháp luật' },
  { id: 'evidence_analysis', label: 'Phân tích chứng cứ' },
  { id: 'legal_reasoning', label: 'Lập luận pháp lý' },
  { id: 'rebuttal', label: 'Phản biện' },
  { id: 'adaptation', label: 'Ứng biến' },
  { id: 'legal_knowledge', label: 'Kiến thức pháp lý' },
  { id: 'reasoning', label: 'Lập luận' },
  { id: 'evidence_use', label: 'Sử dụng chứng cứ' },
  { id: 'courtroom_skill', label: 'Kỹ năng tranh tụng' },
];
export const skillFamilies = [
  { id: 'reasoning', label: 'Lập luận', keys: ['legal_reasoning', 'reasoning'] },
  { id: 'evidence', label: 'Chứng cứ', keys: ['evidence_analysis', 'evidence_use'] },
  { id: 'law', label: 'Pháp luật', keys: ['legal_application', 'legal_knowledge'] },
  { id: 'court', label: 'Tranh tụng', keys: ['rebuttal', 'adaptation', 'courtroom_skill'] },
];
export function skillScore(session, id) {
  const value = session.result?.rubric_scores?.[id];
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function skillProfile(sessions) {
  const evaluated = sessions.filter(s => s.status === 'completed' && s.result)
    .sort((a, b) => (sessionTime(b, true) ?? 0) - (sessionTime(a, true) ?? 0));
  const overview = skills.map(skill => {
    const values = evaluated.map(s => skillScore(s, skill.id)).filter(value => value !== null);
    return { ...skill, score: average(values), count: values.length };
  });
  const ranked = overview.filter(s => s.score !== null).sort((a, b) => b.score - a.score);
  return { evaluated, overview, average: average(ranked.map(s => s.score)), strongest: ranked[0] ?? null,
    weakest: ranked.length > 1 && ranked[0].score !== ranked.at(-1).score ? ranked.at(-1) : null };
}

export function skillSeries(evaluated, id) {
  return evaluated.filter(s => skillScore(s, id) !== null && sessionTime(s, true) !== null)
    .sort((a, b) => sessionTime(a, true) - sessionTime(b, true)).slice(-12)
    .map(s => ({ session: s, score: skillScore(s, id), time: sessionTime(s, true) }));
}

export function profileComments(evaluated) {
  const collect = key => {
    const seen = new Set();
    return evaluated.flatMap(session => (session.result.skill_insights?.[key] ?? []).map(text => ({ text, session })))
      .filter(item => typeof item.text === 'string' && item.text.trim() && !seen.has(item.text) && seen.add(item.text)).slice(0, 2);
  };
  const goal = evaluated.find(s => s.result.skill_insights?.goal?.trim());
  const feedback = evaluated.find(s => s.result.skill_insights?.feedback?.trim());
  return { strengths: collect('strengths'), improvements: collect('improvements'),
    goal: goal ? { text: goal.result.skill_insights.goal, session: goal } : null,
    feedback: feedback ? { text: feedback.result.skill_insights.feedback, session: feedback } : null };
}
