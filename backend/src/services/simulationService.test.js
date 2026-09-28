import assert from 'node:assert/strict';
import test from 'node:test';
process.env.JWT_SECRET = 'test-only-secret-not-used-by-real-deployments';
const { roleContext, readRubricFeedback, validateFactAnchors } = await import('./simulationService.js');
const { readRequestId, replayTurn, publicSession } = await import('./sessionStore.js');

const keys = ['legal_knowledge', 'reasoning', 'evidence_use', 'courtroom_skill'];
const records = [{ _id: 'user-1', sender_type: 'user', content: 'Hồ sơ có hợp đồng vay nhưng chưa có biên nhận trả tiền.' }];
const feedback = Object.fromEntries(keys.map((key) => [key, { reason: 'Lập luận có căn cứ', strength: 'Bám hồ sơ', improvement: 'Phân biệt lời khai và chứng cứ', record_id: 'user-1', quote: 'chưa có biên nhận trả tiền' }]));

test('vai đối lập được xác định theo người học và loại vụ án', () => {
  assert.match(roleContext({user_court_role:'defense_lawyer',difficulty:'beginner'}, {category:'dân sự'}), /Bên đối lập là luật sư bảo vệ nguyên đơn/);
  assert.match(roleContext({user_court_role:'plaintiff_lawyer',difficulty:'advanced'}, {category:'lao động'}), /Bên đối lập là luật sư bảo vệ bị đơn/);
  assert.match(roleContext({user_court_role:'plaintiff_lawyer',difficulty:'balanced'}, {category:'hình sự'}), /bào chữa cho bị cáo/);
});
test('rubric cần đủ tiêu chí và trích đúng phát biểu người học', () => {
  assert.deepEqual(readRubricFeedback(feedback, records), feedback);
  assert.throws(() => readRubricFeedback({}, records));
  assert.throws(() => readRubricFeedback({...feedback, reasoning:{...feedback.reasoning,quote:'chứng cứ không có thật'}},records));
  assert.throws(() => readRubricFeedback(feedback, records.map((r)=>({...r,sender_type:'ai_judge'}))));
});
test('mã yêu cầu được kiểm tra và gửi lại không tạo lượt mới', () => {
  assert.equal(readRequestId('1234567890abcdef'), '1234567890abcdef');
  assert.throws(() => readRequestId({ $ne: null }));
  const session = { turns:[{request_id:'1234567890abcdef', records:[{content:'Nội dung đã lưu'}]}] };
  assert.deepEqual(replayTurn(session,'1234567890abcdef','Nội dung đã lưu'),session.turns[0].records);
  assert.throws(() => replayTurn(session,'1234567890abcdef','Nội dung khác'));
});
test('không lộ khóa xử lý hoặc dữ liệu nội bộ trong API phiên', () => {
  const safe = publicSession({ _id:'test',operation:{token:'private',expires_at:new Date(Date.now()+10000)},turns:[],evaluation:{},creation_request_id:'private',case_snapshot:{title:'Hồ sơ'} });
  assert.equal(safe.operation,undefined);
  assert.equal(safe.turns,undefined);
  assert.equal(safe.processing,true);
  assert.equal(safe.case_id.title,'Hồ sơ');
});

test('dữ kiện và lời khai phải trích đúng nguồn, không nhận tình tiết bịa',()=>{
 const courtCase={summary:'Có hợp đồng vay.',full_document:'Bị đơn khai đã trả một phần.'};
 const analysis={established_facts:['Có hợp đồng vay.'],learner_claims:['chưa có biên nhận'],inferences:[],missing_facts:[]};
 assert.doesNotThrow(()=>validateFactAnchors(analysis,courtCase,records));
 assert.throws(()=>validateFactAnchors({...analysis,established_facts:['Đã trả đủ 500 triệu.']},courtCase,records));
 assert.throws(()=>validateFactAnchors({...analysis,learner_claims:['Tôi thừa nhận đã trả đủ.']},courtCase,records));
});
