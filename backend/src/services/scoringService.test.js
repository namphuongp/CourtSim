import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORING_RUBRIC } from '../data/scoringRubric.js';
import { calculateEvaluation } from './scoringService.js';

const user = { _id: 'u', sender_type: 'user', content: 'Tôi đề nghị đối chiếu chứng cứ trong hồ sơ.' };
const records = [user, { sender_type: 'ai_prosecutor' }, user, { sender_type: 'ai_prosecutor' }, user];
const entries = SCORING_RUBRIC.groups.flatMap((g) => g.items.map((i) => ({ id: i.id, score: i.max * 0.8, reason: 'Đã liên kết dữ kiện, còn thiếu giải thích.', strength: 'Bám hồ sơ.', improvement: 'Giải thích chứng cứ chứng minh điều gì.', record_id: 'u', quote: 'đối chiếu chứng cứ' })));

test('rubric tài liệu: 6 nhóm 15–20–20–20–15–10, 23 tiêu chí con tổng 100', () => {
  assert.deepEqual(SCORING_RUBRIC.groups.map((g) => g.max), [15, 20, 20, 20, 15, 10]);
  assert.equal(entries.length, 23);
  for (const group of SCORING_RUBRIC.groups) assert.equal(group.items.reduce((sum, item) => sum + item.max, 0), group.max);
  const result = calculateEvaluation(entries, records, true);
  assert.equal(result.score, 80); assert.equal(result.assessed_max, 100);
  assert.equal(result.criteria[0].score, 12);
});
test('thiếu luật và cơ hội phản biện: quy đổi phần được chấm, không phạt phần chưa quan sát', () => {
  const result = calculateEvaluation(entries, [user], false);
  assert.equal(result.assessed_max, 48); assert.equal(result.earned_score, 38.4); assert.equal(result.score, 80);
  assert.equal(result.criteria[1].score, null); assert.equal(result.criteria[4].score, null);
  assert.equal(result.assessment_status, 'partial');
});
test('không tin điểm tổng từ AI; chặn thiếu/trùng tiêu chí, quá điểm, NaN và quote giả', () => {
  assert.throws(() => calculateEvaluation(entries.slice(1), records, true));
  assert.throws(() => calculateEvaluation([...entries.slice(1), entries[1]], records, true));
  for (const score of [8, -1, NaN, Infinity, '3']) assert.throws(() => calculateEvaluation([{ ...entries[0], score }, ...entries.slice(1)], records, true));
  assert.throws(() => calculateEvaluation([{ ...entries[0], quote: 'không tồn tại' }, ...entries.slice(1)], records, true));
  assert.throws(() => calculateEvaluation(entries, records.map((r) => ({ ...r, sender_type: 'ai_judge' })), true));
});
test('điểm 0 hợp lệ khi chưa thể hiện; không yêu cầu AI bịa trích đoạn', () => {
  const result = calculateEvaluation(entries.map((e) => ({ ...e, score: 0, quote: null, record_id: null })), records, true);
  assert.equal(result.score, 0);
});
