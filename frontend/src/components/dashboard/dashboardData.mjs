export const skillLabels = { issue_identification: 'xác định vấn đề pháp lý', legal_application: 'áp dụng pháp luật', evidence_analysis: 'phân tích chứng cứ', legal_reasoning: 'lập luận pháp lý', rebuttal: 'phản biện', adaptation: 'ứng biến', legal_knowledge: 'kiến thức pháp lý', reasoning: 'lập luận', evidence_use: 'sử dụng chứng cứ', courtroom_skill: 'kỹ năng tranh tụng' };

export function normalizedScore(result) {
  if (!result) return null;
  // Điểm cũ có thể đã quy đổi; ưu tiên tử/mẫu gốc và không coi thiếu điểm là 0.
  const max = result.assessed_max ?? 100;
  const score = result.earned_score ?? (max === 100 ? result.score : null);
  return Number.isFinite(score) && Number.isFinite(max) && max > 0 && score >= 0 && score <= max ? score / max * 100 : null;
}

export function sessionTime(session, completed = false) {
  for (const value of completed ? [session.completed_at, session.created_at] : [session.updated_at, session.completed_at, session.created_at]) {
    const time = value ? new Date(value).getTime() : NaN;
    if (Number.isFinite(time)) return time;
  }
  return null;
}

export const formatScore = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
export const formatDate = time => time === null ? 'Chưa có ngày' : new Date(time).toLocaleDateString('vi-VN');

export function dashboardSummary(sessions) {
  const completed = sessions.filter(s => s.status === 'completed');
  const ongoing = sessions.filter(s => s.status === 'ongoing').sort((a, b) => (sessionTime(b) ?? 0) - (sessionTime(a) ?? 0));
  const scored = completed.filter(s => normalizedScore(s.result) !== null);
  const points = scored.filter(s => sessionTime(s, true) !== null).sort((a, b) => sessionTime(a, true) - sessionTime(b, true)).slice(-12);
  return { completed, ongoing, scored, points,
    average: scored.length ? scored.reduce((sum, s) => sum + normalizedScore(s.result), 0) / scored.length : null,
    totalTurns: sessions.reduce((sum, s) => sum + (Number.isInteger(s.turn_count) && s.turn_count > 0 ? s.turn_count : 0), 0) };
}

export function practiceSuggestion(completed) {
  for (const session of [...completed].sort((a, b) => (sessionTime(b, true) ?? 0) - (sessionTime(a, true) ?? 0))) {
    const saved = session.result?.improvement_suggestions;
    if (typeof saved === 'string' && saved.trim()) return { text: saved.trim(), session };
    const weakest = Object.entries(session.result?.rubric_scores ?? {}).filter(([key, value]) => skillLabels[key] && Number.isFinite(value) && value >= 0 && value < 100).sort((a, b) => a[1] - b[1])[0];
    if (weakest) return { text: `Ưu tiên luyện ${skillLabels[weakest[0]]} — kỹ năng có điểm thấp nhất trong phiên này (${formatScore(weakest[1])}/100).`, session };
  }
  return null;
}

export function recentSessions(sessions, { search, status, sort }) {
  const query = search.trim().toLocaleLowerCase('vi');
  return sessions.filter(s => (status === 'all' || s.status === status) && (s.case_id?.title ?? '').toLocaleLowerCase('vi').includes(query)).sort((a, b) => {
    if (sort === 'high' || sort === 'low') {
      const left = normalizedScore(a.result), right = normalizedScore(b.result);
      if (left === null || right === null) return left === right ? (sessionTime(b) ?? 0) - (sessionTime(a) ?? 0) : left === null ? 1 : -1;
      if (left !== right) return sort === 'high' ? right - left : left - right;
    }
    return ((sessionTime(b) ?? 0) - (sessionTime(a) ?? 0)) * (sort === 'oldest' ? -1 : 1);
  }).slice(0, 6);
}
