import test from 'node:test';
import assert from 'node:assert/strict';
import { publicErrorMessage, RESPONSE_STYLE } from '../../shared/userCopy.mjs';
import { learnerPayload, learnerText } from '../../shared/learnerText.mjs';
import { learnerCase, learnerEvaluation, learnerCitation } from '../src/services/learnerPresentation.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';

test('lỗi công khai không lộ host, model, ID, tên trường hoặc stack', () => {
  const fallback = 'Chưa thể gửi lập luận. Vui lòng thử lại.';
  for (const message of ['localhost:5000 says', 'ECONNREFUSED 127.0.0.1', 'TypeError: x is undefined', 'model=gpt-4-test', 'case_id is required', 'mentioned_only', '[CC:EV-test123]']) {
    assert.equal(publicErrorMessage(message, 'BAD_REQUEST', 400, fallback), fallback);
  }
  assert.equal(publicErrorMessage('Lập luận cần ít nhất 10 ký tự.', 'VALIDATION_ERROR', 400, fallback), 'Lập luận cần ít nhất 10 ký tự.');
  let body;
  const original = console.error;
  const logs = [];
  try {
    console.error = (...args) => logs.push(args);
    errorHandler(new AppError('AI judge sai citation_ids, model=gpt-private', 502, 'AI_INVALID_CITATIONS'), {method:'POST',route:{path:'/:sessionId/messages'}}, {status(){return this;},json(value){body=value;}});
  } finally { console.error = original; }
  assert.equal(body.error.message, 'Chưa thể thực hiện thao tác. Vui lòng thử lại.');
  assert.equal(logs[0][1].code, 'AI_INVALID_CITATIONS');
  assert.doesNotMatch(JSON.stringify(logs), /gpt-private/);
});

test('giữ nguyên chứng cứ gốc, trích bản án, luật và câu trích trong kết quả', () => {
  const raw = 'Cơ sở dữ liệu có cấu hình model=abc.\n  Tài liệu ghi: mentioned_only.';
  const c = { _id:'c', title:'Vụ án', summary:'Tóm tắt', full_document:'Hồ sơ.', evidence_inventory:[{name:'Tài liệu',availability:'provided',content:raw,source_quote:raw}] };
  const presented = learnerPayload(learnerCase(c));
  assert.equal(presented.evidence_inventory[0].content, raw);
  assert.equal(presented.evidence_inventory[0].source_quote, raw);
  assert.equal(presented.evidence_inventory[0].summary, raw);
  assert.equal(learnerPayload(learnerCitation({text:raw})).text, raw);
  const result = learnerPayload(learnerEvaluation({criteria:[{items:[{quote:raw,reason:'Có dẫn chứng. Cấu hình nội bộ.'}]}]}));
  assert.equal(result.criteria[0].items[0].quote, raw);
  assert.equal(result.criteria[0].items[0].reason, 'Có dẫn chứng.');
  assert.equal(learnerPayload({sender_type:'user',content:raw}).content, raw);
});

test('lời dẫn bỏ vận hành nhưng giữ cảnh báo có ích; prompt yêu cầu không sửa trích dẫn', () => {
  const text = learnerText('model=gpt-private. Cần kiểm tra hiệu lực của điều luật này. Thẩm phán AI đặt câu hỏi.');
  assert.doesNotMatch(text, /gpt-private|Thẩm phán AI/);
  assert.match(text, /Cần kiểm tra hiệu lực/);
  assert.match(text, /Chủ tọa/);
  assert.match(RESPONSE_STYLE, /Giữ nguyên văn/);
  assert.match(RESPONSE_STYLE, /Không lặp cảnh báo chung/);
});
