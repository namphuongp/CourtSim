import test from 'node:test';
import assert from 'node:assert/strict';
import { skillPresentation } from '../src/services/skillPresentation.js';
import { skillProfile, skillSeries, profileComments } from '../../frontend/src/components/skills/skillData.mjs';

test('hồ sơ kỹ năng: chỉ lấy điểm thật, giữ 0, không gộp rubric cũ/mới hoặc null', () => {
  const sessions = [
    { _id: 'a', status: 'completed', completed_at: '2026-01-01', result: { rubric_scores: { evidence_analysis: 80, legal_reasoning: null, adaptation: 0 } } },
    { _id: 'b', status: 'completed', completed_at: '2026-01-02', result: { rubric_scores: { evidence_analysis: 100, adaptation: 20, evidence_use: 50, legal_application: 101 } } },
    { status: 'ongoing', result: { rubric_scores: { adaptation: 100 } } },
  ];
  const profile = skillProfile(sessions);
  assert.equal(profile.evaluated.length, 2);
  assert.equal(profile.strongest.id, 'evidence_analysis');
  assert.equal(profile.strongest.score, 90);
  assert.equal(profile.weakest.id, 'adaptation');
  assert.equal(profile.weakest.score, 10);
  assert.equal(profile.average, 50);
  assert.equal(profile.overview.find(s => s.id === 'legal_reasoning').score, null);
  assert.deepEqual(skillSeries(profile.evaluated, 'evidence_analysis').map(p => p.score), [80, 100]);
  assert.equal(skillSeries(profile.evaluated, 'evidence_use').length, 1);
  assert.equal(skillProfile([]).average, null);
});

test('nhận xét: không biến tiêu chí chưa chấm thành điểm yếu, giới hạn 2/2/1', () => {
  const result = { feedback: 'Nhận xét tổng quát.', criteria: [{ id: 'legal_application', items: [
    { status: 'not_assessed', score: null, max: 5, improvement: 'Chưa xác minh nguồn luật.' },
    ...[1, 2, 3].map(score => ({ status: 'assessed', score, max: 5, strength: `Điểm mạnh ${score}`, improvement: `Cải thiện ${score}`, reason: `Nhận xét ${score}` })),
  ] }] };
  const summary = skillPresentation(result);
  assert.equal(summary.strengths.length, 2);
  assert.equal(summary.improvements.length, 2);
  assert.equal(summary.goal, 'Cải thiện 1');
  assert.doesNotMatch(JSON.stringify(summary), /Chưa xác minh/);
  const comments = profileComments([{ _id: 'a', result: { skill_insights: summary } }, { _id: 'b', result: { skill_insights: summary } }]);
  assert.equal(comments.strengths.length, 2);
  assert.equal(comments.improvements.length, 2);
  assert.equal(comments.goal.session._id, 'a');
  assert.equal(skillPresentation({}).goal, '');
});
