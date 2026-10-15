import test from 'node:test';
import assert from 'node:assert/strict';
import { learnerText, learnerPayload } from '../../shared/learnerText.mjs';

test('lời dẫn bỏ chấm phẩy nhưng giữ trích dẫn, địa chỉ nguồn và lời người học', () => {
  assert.equal(learnerText('Chưa đủ dữ liệu; hãy luyện thêm.'), 'Chưa đủ dữ liệu, hãy luyện thêm.');
  assert.equal(learnerText('Trích: “Ý một; ý hai”.'), 'Trích: “Ý một; ý hai”.');
  assert.equal(learnerText('Nguồn https://example.com/a;b'), 'Nguồn https://example.com/a;b');
  const record = { sender_type: 'user', content: 'Tôi viện dẫn A; tôi chưa kết luận B.', quote: 'Nguyên văn; giữ nguyên.' };
  assert.deepEqual(learnerPayload(record), record);
});
