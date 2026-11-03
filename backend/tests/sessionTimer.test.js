import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatDurationLong } from '../../shared/durationFormat.mjs';
import { publicSession } from '../src/services/sessionStore.js';
import { learnerEvaluation } from '../src/services/learnerPresentation.js';

test('SessionTimer formatDuration: định dạng chính xác giây sang MM:SS và HH:MM:SS', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(-10), '00:00');
  assert.equal(formatDuration(null), '00:00');
  assert.equal(formatDuration(undefined), '00:00');
  assert.equal(formatDuration('invalid'), '00:00');

  // Dưới 1 phút
  assert.equal(formatDuration(5), '00:05');
  assert.equal(formatDuration(45), '00:45');

  // Vài phút
  assert.equal(formatDuration(60), '01:00');
  assert.equal(formatDuration(125), '02:05');
  assert.equal(formatDuration(599), '09:59');

  // Trên 10 phút
  assert.equal(formatDuration(754), '12:34');

  // Trên 1 giờ (HH:MM:SS)
  assert.equal(formatDuration(3600), '01:00:00');
  assert.equal(formatDuration(3665), '01:01:05');
  assert.equal(formatDuration(7322), '02:02:02');
});

test('SessionTimer formatDurationLong: định dạng chuỗi mô tả tiếng Việt chuẩn', () => {
  assert.equal(formatDurationLong(0), '0 giây');
  assert.equal(formatDurationLong(-5), '0 giây');
  assert.equal(formatDurationLong(45), '45 giây');
  assert.equal(formatDurationLong(60), '1 phút');
  assert.equal(formatDurationLong(125), '2 phút 5 giây');
  assert.equal(formatDurationLong(3600), '1 giờ');
  assert.equal(formatDurationLong(3665), '1 giờ 1 phút 5 giây');
});

test('publicSession: giữ và trả về duration_seconds chính xác cho client', () => {
  const dummyUser = { _id: 'u1', subscription: { plan: 'pro' } };

  // Session đang diễn ra hoặc chưa lưu duration_seconds
  const ongoing = {
    _id: 's1',
    user_id: 'u1',
    status: 'ongoing',
    created_at: new Date('2026-11-03T10:00:00Z'),
    duration_seconds: 0
  };
  const pubOngoing = publicSession(ongoing, dummyUser);
  assert.equal(pubOngoing.duration_seconds, 0);

  // Session đã hoàn thành có duration_seconds đã lưu
  const completedWithSaved = {
    _id: 's2',
    user_id: 'u1',
    status: 'completed',
    created_at: new Date('2026-11-03T10:00:00Z'),
    completed_at: new Date('2026-11-03T10:15:30Z'),
    duration_seconds: 930
  };
  const pubCompleted = publicSession(completedWithSaved, dummyUser);
  assert.equal(pubCompleted.duration_seconds, 930);

  // Session cũ chưa có duration_seconds nhưng có completed_at và created_at
  const legacySession = {
    _id: 's3',
    user_id: 'u1',
    status: 'completed',
    created_at: new Date('2026-11-03T10:00:00Z'),
    completed_at: new Date('2026-11-03T10:10:00Z')
  };
  const pubLegacy = publicSession(legacySession, dummyUser);
  assert.equal(pubLegacy.duration_seconds, 600);
});

test('learnerEvaluation: chứa trường duration_seconds trong dữ liệu kết quả đánh giá', () => {
  const evalResult = {
    session_id: 's1',
    created_at: new Date(),
    verdict: 'Bản án sơ thẩm',
    feedback: 'Lập luận tốt',
    improvement_suggestions: 'Cần trích dẫn điều luật',
    duration_seconds: 754,
    criteria: []
  };

  const formatted = learnerEvaluation(evalResult);
  assert.equal(formatted.duration_seconds, 754);

  // Fallback từ completed_at và created_at nếu duration_seconds chưa có
  const legacyResult = {
    session_id: 's2',
    created_at: new Date('2026-11-03T10:00:00Z'),
    completed_at: new Date('2026-11-03T10:08:20Z'),
    verdict: 'Chấp nhận yêu cầu',
    feedback: 'Tốt',
    improvement_suggestions: 'Rèn luyện thêm',
    criteria: []
  };
  const formattedLegacy = learnerEvaluation(legacyResult);
  assert.equal(formattedLegacy.duration_seconds, 500);
});
