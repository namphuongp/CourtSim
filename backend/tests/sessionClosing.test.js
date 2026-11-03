import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExplicitEndByChat,
  isClosingIntent,
  shouldAutoCloseHearing,
  chooseSpeakingPlan,
  publicConversation
} from '../src/services/conversationPolicy.js';

test('Chống kết thúc nhầm: Không bắt từ khóa khi người dùng chưa trình bày xong hoặc nói trong ngữ cảnh bình thường', () => {
  // Câu phủ định hoặc chưa muốn kết luận
  assert.equal(isClosingIntent('Tôi không đồng ý kết thúc phần này ngay bây giờ.', 3), false);
  assert.equal(isClosingIntent('Vì vậy tôi chưa thể kết luận ngay toàn bộ diện tích thuộc A.', 2), false);

  // Ngữ cảnh sự kiện/hợp đồng (ngày kết thúc, thời hạn kết thúc...)
  assert.equal(isClosingIntent('Theo hợp đồng số 01, thời hạn kết thúc công việc là ngày 30/12/2025.', 3), false);
  assert.equal(isClosingIntent('Trước khi kết thúc phần tranh luận này, tôi muốn làm rõ biên bản giao nhận.', 3), false);
  assert.equal(isClosingIntent('Dự án kết thúc vào tháng 5 và hai bên đã tiến hành nghiệm thu.', 2), false);

  // Câu dùng từ nối "tóm lại" nhưng không phải chốt giữ nguyên yêu cầu/kết thúc -> Không kết thúc nhầm
  assert.equal(isClosingIntent('Tóm lại, chứng cứ đã rõ.', 2), false);
  assert.equal(isClosingIntent('Tóm lại, bị đơn không chứng minh được ranh giới.', 3), false);

  // Phân tích dài có dẫn chứng luật hoặc bút lục
  const longArgument = 'Tóm lại, bị đơn đã vi phạm thỏa thuận theo hợp đồng chuyển nhượng quyền sử dụng đất. Căn cứ [PL:LAW-1234] và [Chứng cứ: Biên bản đo đạc thực địa] đã xác định ranh giới rõ ràng, đề nghị Tòa buộc bị đơn tháo dỡ công trình.';
  assert.equal(isClosingIntent(longArgument, 4), false);

  // Câu chốt quan điểm độc lập ngắn gọn sau khi đã có lượt tranh tụng -> Hợp lệ
  assert.equal(isClosingIntent('Tóm lại, tôi giữ nguyên yêu cầu.', 2), true);
  assert.equal(isClosingIntent('Tôi đã trình bày xong toàn bộ luận cứ, kính đề nghị Hội đồng xét xử vào nghị án.', 2), true);
  assert.equal(isClosingIntent('Xin kết thúc phiên tòa.', 1), true);

  // Cờ cấu trúc tường minh close_requested: true -> Luôn kích hoạt
  assert.equal(isClosingIntent('Bất kỳ câu nào', 2, { close_requested: true }), true);
});

test('Tự động khép phiên: AI Thẩm phán tự động kết luận khi hội đủ điều kiện phiên xử', () => {
  // 1. Chạm ngưỡng số lượt tối đa
  const maxSession = { max_turns: 20, turn_count: 19 };
  assert.equal(shouldAutoCloseHearing(maxSession, 19), true);

  // 2. Chưa đủ số lượt và tranh tụng vẫn còn tiếp diễn
  const activeSession = {
    max_turns: 20,
    turn_count: 3,
    conversation: { hearing_state: { stalled: false, next_issue: { id: 'issue:2' } } }
  };
  assert.equal(shouldAutoCloseHearing(activeSession, 3), false);

  // 3. Đã qua đủ số lượt thực chất (>= 5 lượt) và tranh điểm đã cạn kiệt (stalled và không còn next_issue)
  const exhaustedSession = {
    max_turns: 20,
    turn_count: 6,
    conversation: { hearing_state: { stalled: true, next_issue: null } }
  };
  assert.equal(shouldAutoCloseHearing(exhaustedSession, 6), true);
});

test('chooseSpeakingPlan: Chuyển sang phase summary và chỉ định judge khi khép phiên', () => {
  const normalSession = { turn_count: 2, user_court_role: 'plaintiff_lawyer' };

  // Câu phân tích bình thường -> Không chuyển sang summary
  const debatePlan = chooseSpeakingPlan(normalSession, 'Bị đơn không chứng minh được nguồn gốc đất khai hoang.');
  assert.equal(debatePlan.phase, 'debate');

  // Câu yêu cầu kết thúc -> Chuyển sang summary với người nói duy nhất là judge
  const closingPlan = chooseSpeakingPlan(normalSession, 'Kính đề nghị Hội đồng xét xử vào nghị án và chấm điểm.');
  assert.equal(closingPlan.phase, 'summary');
  assert.deepEqual(closingPlan.plan, ['judge']);

  // Khi có cờ cấu trúc close_requested
  const flagPlan = chooseSpeakingPlan(normalSession, 'Luật sư xin kết thúc.', { close_requested: true });
  assert.equal(flagPlan.phase, 'summary');
  assert.deepEqual(flagPlan.plan, ['judge']);

  // Khi phiên tự động đạt ngưỡng kết thúc
  const nearMaxSession = { max_turns: 20, turn_count: 19, user_court_role: 'plaintiff_lawyer' };
  const autoPlan = chooseSpeakingPlan(nearMaxSession, 'Tôi tiếp tục giải trình về mốc thời gian.');
  assert.equal(autoPlan.phase, 'summary');
  assert.deepEqual(autoPlan.plan, ['judge']);
});

test('publicConversation: Trả về các cờ trạng thái cấu trúc concluded và ready_to_close', () => {
  const sessionOngoing = {
    conversation: { phase: 'debate', status: 'learner', revision: 2, last_purpose: 'rebut' }
  };
  const pub1 = publicConversation(sessionOngoing, false);
  assert.equal(pub1.concluded, false);
  assert.equal(pub1.ready_to_close, false);

  const sessionConcluded = {
    conversation: { phase: 'summary', status: 'awaiting_continue', revision: 5, last_purpose: 'close', concluded: true }
  };
  const pub2 = publicConversation(sessionConcluded, false);
  assert.equal(pub2.concluded, true);
  assert.equal(pub2.ready_to_close, true);
  assert.equal(pub2.auto_complete, true);
});

