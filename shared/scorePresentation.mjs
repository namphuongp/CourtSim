// Phiên cũ có score đã quy đổi: chỉ xem là điểm toàn bài khi chấm đủ trọng số.
export function scoreSummary(result = {}) {
  const assessed = Number.isFinite(result.assessed_max) ? result.assessed_max : 100;
  const partial = assessed < 100;
  const provisional = result.legal_assessment_mode === 'web_reference';
  const earned = assessed === 0 ? null : Number.isFinite(result.earned_score) ? result.earned_score : partial ? null : result.score;
  return {
    partial, provisional, assessed, earned, remaining: 100 - assessed,
    score: partial ? null : (Number.isFinite(earned) ? earned : null),
    label: Number.isFinite(earned) ? `${earned}/${assessed}${partial ? ' điểm ở phần đã đánh giá' : ' điểm'}${provisional ? ' · tham khảo từ nguồn web' : ''}` : 'Chưa đủ dữ liệu để chấm',
  };
}

export function learningHighlights(criteria = []) {
  const assessed = criteria.flatMap(group => group.items.filter(item => item.status === 'assessed' && Number.isFinite(item.score))
    .map(item => ({ ...item, group_id: group.id, ratio: item.score / item.max })));
  const diverse = items => {
    const groups = new Set(), texts = new Set();
    return items.filter(item => {
      if (groups.has(item.group_id) || texts.has(item.quote)) return false;
      groups.add(item.group_id); texts.add(item.quote); return true;
    }).slice(0, 3);
  };
  return {
    strengths: diverse(assessed.filter(item => item.score > 0 && item.quote && item.strength && !/^chưa /iu.test(item.strength))
      .sort((a, b) => b.ratio - a.ratio || b.max - a.max)),
    improvements: diverse(assessed.filter(item => item.improvement && item.ratio < 1)
      .sort((a, b) => a.ratio - b.ratio || b.max - a.max)),
  };
}
