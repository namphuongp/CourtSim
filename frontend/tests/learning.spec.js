import { SCORING_RUBRIC } from '../../backend/src/data/scoringRubric.js';
import { calculateEvaluation } from '../../backend/src/services/scoringService.js';
import { test, expect } from '@playwright/test';

const courtCase = { _id:'case-1',title:'Tranh chấp hợp đồng vay tài sản',summary:'Bị đơn khai đã thanh toán một phần.',category:'dân sự',full_document:'Hồ sơ giả định: có hợp đồng vay và sao kê; chưa có biên nhận trả tiền mặt.' };
const rubric_scores={legal_knowledge:70,reasoning:80,evidence_use:90,courtroom_skill:60};

async function mockApi(page, {failFirst=false, sample=courtCase, failCompleteFirst=false, completionDelay=0, modern=false, beforeReply, completedSession=false, opening='Mời trình bày lập luận.'}={}) {
  const courtCase = sample;
  let session=null;
  let result=null;
  let failed=false;
  let records=[];
  const requests=[];
  requests.completions=0;
  requests.creations=[];
  await page.route('**/api/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    const method=request.method();
    const body=request.postDataJSON();
    const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path.endsWith('/auth/register')) return send({message:'Đăng ký thành công'},201);
    if(path.endsWith('/auth/login')) return send({token:'test-browser-token',user:{id:'user-1',full_name:'Người học',role:'user'}});
    if(path.endsWith('/v1/cases')) return send({data:[courtCase],pagination:{total:1}});
    if(path.endsWith('/v1/cases/case-1')) return send({data:courtCase});
    if(path.endsWith('/v1/sessions') && method==='POST') {
      requests.creations.push(body);
      session={...body,_id:'session-1',case_id:courtCase,status:completedSession?'completed':'ongoing',turn_count:0,max_turns:20,created_at:new Date().toISOString()};
      records=[{_id:'opening',sender_type:'ai_judge',sender_name:'Thẩm phán AI',content:opening}];
      return send({data:{session,opening:records[0]}},201);
    }
    if(path.endsWith('/v1/sessions')) return send({data:session?[{...session,result}]:[]});
    if(path.endsWith('/records')) return send({data:records});
    if(path.endsWith('/messages')) {
      requests.push(body);
      if(beforeReply) await beforeReply();
      if(failFirst && !failed) { failed=true; return send({error:{message:'AI đang bận. Hãy thử lại.'}},503); }
      const messages=[{_id:'user-argument',request_id:body.request_id,sender_type:'user',sender_name:'Người học',content:body.content},{_id:'opponent',sender_type:'ai_prosecutor',sender_name:'Bên đối lập AI',content:'Bạn đối chiếu chứng cứ trả tiền như thế nào?'},{_id:'judge',sender_type:'ai_judge',sender_name:'Thẩm phán AI',content:'Mời làm rõ chứng cứ thanh toán.'}];
      records.push(...messages); session.turn_count++;
      return send({data:messages},201);
    }
    if(path.endsWith('/complete')) {
      requests.completions++;
      if(failCompleteFirst && requests.completions===1) return send({error:{message:'Chưa thể chấm điểm. Hãy thử lại.'}},503);
      session.processing=true;
      if(completionDelay) await new Promise(resolve=>setTimeout(resolve,completionDelay));
      session.processing=false;
      session.status='completed';
      result={score:75,rubric_scores,verdict:'Đạt yêu cầu bài tập',feedback:'Đã bám hồ sơ.',improvement_suggestions:'Làm rõ chứng cứ thanh toán.',citations:[],rubric_feedback:Object.fromEntries(Object.keys(rubric_scores).map(key=>[key,{reason:'Giải thích điểm theo chứng cứ.',strength:'Phân biệt lời khai.',improvement:'Đối chiếu sao kê.',quote:records[1].content,record_id:'user-argument'}]))};
      if(modern) {
        const criteria=SCORING_RUBRIC.groups.flatMap(g=>g.items.map(i=>({id:i.id,score:i.max*0.8,reason:'Có dẫn chứng cụ thể.',strength:'Bám hồ sơ.',improvement:'Giải thích giới hạn chứng cứ.',record_id:'user-argument',quote:records[1].content})));
        result={...result,...calculateEvaluation(criteria,records,false)};
        delete result.rubric_feedback;
      }
      return send({data:result}).catch(()=>{});
    }
    if(path.endsWith('/feedback/prompt')) return send({data:{show:false}});
    if(path.endsWith('/result')) return result ? send({data:result}) : send({error:{message:'Phiên chưa có kết quả.'}},404);
    if(path.endsWith('/session-1')) return send({data:session});
    return send({error:{message:'Không tìm thấy dữ liệu.'}},404);
  });
  return requests;
}

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel(/Mật khẩu/).fill('Test-only-password');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function setup(page) {
  await page.getByRole('link',{name:'Tạo phiên mới',exact:true}).click();
  await page.getByRole('button',{name:/Tranh chấp hợp đồng vay tài sản/}).click();
  await page.getByText('Đọc toàn bộ nội dung hồ sơ',{exact:true}).click();
  await expect(page.getByText(courtCase.full_document)).toBeVisible();
  await page.getByRole('button',{name:'Luật sư bảo vệ bị đơn',exact:true}).click();
  await page.getByLabel('3. Ngày sự kiện làm phát sinh tranh chấp').fill('2025-01-01');
  await page.getByRole('button',{name:'Bắt đầu phiên tòa',exact:true}).click();
  await expect(page).toHaveURL(/simulation\/session-1$/);
}

test('đăng ký → chọn hồ sơ → giữ bản nháp khi lỗi/reload → chấm điểm → lịch sử',async({page},info)=>{
  const calls=await mockApi(page,{failFirst:true});
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Người học');
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Mật khẩu').fill('Test-only-password');
  await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
  await expect(page.getByText('Đã tạo tài khoản. Đăng nhập để bắt đầu.')).toBeVisible();
  await login(page);
  await expect(page.getByText('Chưa có phiên trong danh sách này.',{exact:false})).toBeVisible();
  await setup(page);
  const text='Tôi đề nghị đối chiếu sao kê và biên nhận trước khi khẳng định đã trả tiền.';
  await page.getByLabel('Lập luận của bạn').fill(text);
  await page.getByRole('button',{name:'Gửi lập luận'}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể gửi lập luận. Nội dung bạn viết vẫn được giữ lại.');
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(text);
  await expect(page.getByRole('button',{name:'Gửi lập luận'})).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(text);
  if(info.project.name==='mobile') {
    await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
    await page.getByText('Đọc toàn bộ nội dung hồ sơ',{exact:true}).click();
    await expect(page.locator('details').getByText(courtCase.full_document)).toBeVisible();
    await page.getByRole('button',{name:'Đóng hồ sơ phiên tòa',exact:true}).click();
  }
  await page.getByRole('button',{name:'Gửi lập luận'}).click();
  await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
  expect(calls[0].request_id).toBe(calls[1].request_id);
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue('');
  page.on('dialog', () => { throw new Error('Không được mở hộp thoại trình duyệt'); });
  await page.getByRole('button',{name:'Kết thúc và chấm điểm'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Xác nhận kết thúc',exact:true}).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByText('75',{exact:true})).toBeVisible();
  await expect(page.getByText('Giải thích điểm theo chứng cứ.')).toHaveCount(4);
  await page.screenshot({path:`test-results/result-${info.project.name}.png`,fullPage:true});
  await page.getByRole('link',{name:'Xem lại toàn bộ biên bản'}).click();
  await expect(page.getByText('Phiên đã kết thúc. Đây là biên bản chỉ đọc.')).toBeVisible();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'← Danh sách phiên'}).click();
  await page.getByRole('link',{name:'Lịch sử',exact:true}).click();
  await expect(page.getByText('Điểm: 75/100')).toBeVisible();
  await page.getByRole('link',{name:'Đánh giá kỹ năng',exact:true}).click();
  await expect(page.getByRole('progressbar')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('chưa đăng nhập chuyển đến đăng nhập rồi trở về đúng phiên',async({page})=>{
  await mockApi(page);
  await page.goto('/simulation/session-1');
  await expect(page).toHaveURL(/login\?returnTo=/);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Mật khẩu').fill('Test-only-password');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(/simulation\/session-1$/);
});

test('API trả 401 xóa xác thực và điều hướng đăng nhập',async({page})=>{
  await mockApi(page);
  const loaded=page.waitForResponse(response=>response.url().endsWith('/api/v1/sessions') && response.status()===200);
  await login(page);
  await loaded;
  await page.route('**/api/v1/sessions',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'Phiên đã hết hạn.'}})}));
  await page.getByRole('link',{name:'Lịch sử',exact:true}).click();
  await expect(page).toHaveURL(/login\?returnTo=/);
  expect(await page.evaluate(()=>localStorage.getItem('userToken'))).toBeNull();
});


test('hồ sơ lịch sử giữ mốc tra cứu và cảnh báo nguồn', async ({page}) => {
  const sample={...courtCase,reference_date:'2024-03-29',source_note:'Hồ sơ lược biên đã ẩn danh',reference_date_note:'Mốc theo ngày xét xử',legal_scope_note:'Thiếu nguồn luật chuyên ngành',source_url:'https://thuvienphapluat.vn/banan/'};
  await mockApi(page,{sample});
  await login(page);
  await page.getByRole('link',{name:'Tạo phiên mới',exact:true}).click();
  await page.getByRole('button',{name:/Tranh chấp hợp đồng vay tài sản/}).click();
  const date=page.getByLabel('3. Mốc tra cứu của bài tập');
  await expect(date).toHaveValue('2024-03-29');
  await expect(date).toHaveAttribute('readonly','');
  await expect(page.getByText(sample.legal_scope_note)).toHaveCount(0);
  await page.getByRole('button',{name:'Luật sư bảo vệ bị đơn',exact:true}).click();
  const submitted=page.waitForRequest(r=>r.url().endsWith('/v1/sessions')&&r.method()==='POST');
  await page.getByRole('button',{name:'Bắt đầu phiên tòa',exact:true}).click();
  expect((await submitted).postDataJSON().case_event_date).toBe('2024-03-29');
  await expect(page).toHaveURL(/simulation\/session-1$/);
});


async function readyToEnd(page, options) {
  const requests=await mockApi(page,options);
  await login(page); await setup(page);
  await page.getByLabel('Lập luận của bạn').fill('Tôi đề nghị đối chiếu chứng cứ và giới hạn lời khai trong hồ sơ.');
  await page.getByRole('button',{name:'Gửi lập luận'}).click();
  await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
  return requests;
}

test('hộp React: Escape, focus, bản nháp và thử chấm lại an toàn', async ({page},info) => {
  const requests=await readyToEnd(page,{failCompleteFirst:true,modern:true});
  await page.getByLabel('Lập luận của bạn').fill('Bản nháp chưa gửi');
  const end=page.getByRole('button',{name:'Kết thúc và chấm điểm'});
  await end.click();
  await expect(page.getByRole('dialog')).toContainText('Bản nháp không được tính');
  await expect(page.getByRole('button',{name:'Tiếp tục tranh luận',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(end).toBeFocused();
  expect(requests.completions).toBe(0);
  await end.click(); await page.getByRole('button',{name:'Xác nhận kết thúc',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể chấm điểm');
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue('Bản nháp chưa gửi');
  await end.click(); await page.getByRole('button',{name:'Xác nhận kết thúc',exact:true}).click();
  await expect(page).toHaveURL(/result$/);
  await expect(page.getByText('80',{exact:true})).toBeVisible();
  await expect(page.getByText('Đã đánh giá 48% trọng số · Điểm thực đạt 38.4/48')).toBeVisible();
  await page.reload();
  await expect(page.getByText('80',{exact:true})).toBeVisible();
  expect(requests.completions).toBe(2);
  await page.screenshot({path:`test-results/rubric-new-${info.project.name}.png`,fullPage:true});
});

test('đang chấm chống gửi lặp và khôi phục kết quả sau reload', async ({page}) => {
  const requests=await readyToEnd(page,{completionDelay:5000,modern:true});
  await page.getByRole('button',{name:'Kết thúc và chấm điểm'}).click();
  await page.getByRole('button',{name:'Xác nhận kết thúc',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('button',{name:'Đang chấm điểm...',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Kết thúc và chấm điểm'})).toBeDisabled();
  await expect(page).toHaveURL(/result$/,{timeout:15000});
  await expect(page.getByText('80',{exact:true})).toBeVisible();
  expect(requests.completions).toBe(1);
});

test('tra cứu mất kết nối không chặn tranh luận', async ({page}) => {
  await readyToEnd(page,{});
  await page.getByRole('button',{name:'Trợ lý luật',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được lịch sử tra cứu');
  await page.getByRole('button',{name:'Đóng trợ lý luật',exact:true}).click();
  await expect(page.getByLabel('Lập luận của bạn')).toBeEnabled();
});

const evidenceCase = {...courtCase, parties:[{side:'plaintiff',name:'A',claims:['Yêu cầu trả khoản vay']}],timeline:[{kind:'transaction',date:'2020-01-01',description:'Ký hợp đồng'}],evidence_inventory:[{id:'EV-test-evidence1',code:'CC01',name:'Hợp đồng vay',summary:'Khoản vay theo hợp đồng.',availability:'provided',content:'Nội dung hợp đồng kiểm thử',provided_by:'Nguyên đơn',date:'2020-01-01'},{id:'EV-test-evidence2',code:'CC02',name:'Biên nhận',summary:'Bản án đề cập biên nhận.',availability:'mentioned_only'}]};

test('hồ sơ đóng mặc định, chèn chứng cứ bằng nút/bàn phím và giữ ID sau reload', async ({page},info) => {
  const calls=await mockApi(page,{sample:evidenceCase});
  await login(page); await setup(page);
  const open=page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true});
  await expect(page.getByRole('region',{name:'Hồ sơ phiên tòa'})).toHaveCount(0);
  await open.click();
  await expect(page.getByText('Yêu cầu trả khoản vay')).toBeVisible();
  if(info.project.name==='mobile') {
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByText('Đọc toàn bộ nội dung hồ sơ',{exact:true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button',{name:'Đóng hồ sơ phiên tòa',exact:true})).toBeFocused();
  }
  await page.screenshot({path:'test-results/dossier-'+info.project.name+'.png',fullPage:true});
  await expect(page.getByText('Tài liệu được bản án đề cập. CourtSim chưa có bản gốc.')).not.toBeVisible();
  await page.getByText('Chi tiết chứng cứ: Biên nhận',{exact:true}).click();
  await expect(page.getByText('Tài liệu được bản án đề cập. CourtSim chưa có bản gốc.')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(open).toBeFocused();
  await open.click();
  await page.getByRole('button',{name:'Đưa vào lập luận: Hợp đồng vay',exact:true}).click();
  const input=page.getByLabel('Lập luận của bạn');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(/\[Chứng cứ: Hợp đồng vay\]/);
  await expect(page.getByRole('region',{name:'Hồ sơ phiên tòa'})).toHaveCount(0);
  await page.reload(); await expect(input).toHaveValue(/\[Chứng cứ: Hợp đồng vay\]/);
  if(info.project.name==='desktop') {
    await open.click();
    const transfer=await page.evaluateHandle(()=>new DataTransfer());
    await page.locator('article[draggable="true"]').last().dispatchEvent('dragstart',{dataTransfer:transfer});
    await input.dispatchEvent('drop',{dataTransfer:transfer});
    await expect(input).toHaveValue(/\[Chứng cứ: Biên nhận\]/);
  }
  await page.getByRole('button',{name:'Gửi lập luận'}).click();
  await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
  expect(calls[0].evidence_ids).toContain('EV-test-evidence1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const verified of [true,false]) test('trợ lý riêng: nguồn '+(verified?'đã xác minh':'chưa xác minh')+', chèn chủ động và giữ lịch sử',async({page})=>{
  const calls=await mockApi(page);
  let history=[];
  await page.route('**/assistant',async route=>{
    if(route.request().method()==='POST') history=[{_id:'answer1',...route.request().postDataJSON(),status:'completed',answer:verified?'Cần đối chiếu điều kiện áp dụng. Cấu hình nội bộ không hiển thị.':'Chưa xác minh được căn cứ pháp luật. Cần kiểm tra thêm.',citations:verified?[{id:'c1',reference_id:'LAW-test-reference1',law_number:'45/2013/QH13',locator:'Điều 202',version:'Bản kiểm thử',application_date:'2020-01-01',verification_status:'verified',text:'Trích đoạn nguồn kiểm thử.',source_url:'https://vbpl.vn/'}]:[{id:'c2',law_number:'45/2013/QH13',locator:'Điều 202',verification_status:'unverified',source_url:'https://vbpl.vn/'}]}];
    await route.fulfill({json:{data:route.request().method()==='POST'?history[0]:history}});
  });
  await login(page); await setup(page);
  await page.getByRole('button',{name:'Trợ lý luật',exact:true}).click();
  await page.getByLabel('Câu hỏi tra cứu luật').fill('Căn cứ nào cần xem xét?');
  await page.getByRole('button',{name:'Hỏi trợ lý',exact:true}).click();
  await expect(page.getByRole('link',{name:'Xem nguồn văn bản'})).toHaveAttribute('href','https://vbpl.vn/');
  await expect(page.getByText('Cấu hình nội bộ không hiển thị.',{exact:false})).toHaveCount(0);
  expect(calls.length).toBe(0); expect(calls.completions).toBe(0);
  if(verified) {
    await page.getByRole('button',{name:'Đưa trích dẫn vào lập luận'}).click();
    await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(/\[PL:LAW-test-reference1\]/);
    await page.getByRole('button',{name:'Gửi lập luận'}).click();
    await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
    expect(calls[0].legal_reference_ids).toEqual(['LAW-test-reference1']);
  } else {
    await expect(page.getByText('Cần kiểm tra hiệu lực của điều luật này.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Đưa trích dẫn vào lập luận'})).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole('button',{name:'Trợ lý luật',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Căn cứ nào cần xem xét?'})).toBeVisible();
});

test('biên bản cũ: tên chứng cứ tự nhiên, không lộ mã/trạng thái hoặc khung phân tích sau reload',async({page})=>{
  await mockApi(page,{sample:evidenceCase});
  await login(page); await setup(page);
  await page.route('**/records',route=>route.fulfill({json:{data:[{_id:'old-ai',sender_type:'ai_judge',sender_name:'Thẩm phán AI',content:'Cần đối chiếu [CC:EV-test-evidence1] (mentioned_only) với kết luận về thanh toán.',fact_analysis:{established_facts:['Dữ kiện nội bộ'],learner_claims:[],inferences:[],missing_facts:[]}}]}}));
  await page.reload();
  const record=page.locator('#record-old-ai');
  await expect(record).toContainText('Hợp đồng vay');
  await expect(record).not.toContainText('EV-test-evidence1');
  await expect(record).not.toContainText('mentioned_only');
  await expect(page.getByText('Dữ kiện nội bộ')).toHaveCount(0);
  await expect(page.getByText('Dữ kiện trong hồ sơ:',{exact:true})).toHaveCount(0);
});

test('phòng xử án: trạng thái ảnh theo gửi/phản hồi thật, chống gửi trùng và xem lời đối lập',async({page})=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const calls=await mockApi(page,{beforeReply:()=>gate});
  await login(page); await setup(page);
  const judge=page.locator('[data-actor="judge"]');
  const learner=page.locator('[data-actor="learner"]');
  await expect(judge).toHaveAttribute('data-state','speaking');
  await expect(judge.locator('img[aria-hidden="false"]')).toHaveAttribute('src','/courtsim-characters/judge-speaking.png');
  await expect(page.getByRole('status')).toContainText('Đến lượt bạn');
  await page.getByLabel('Lập luận của bạn').fill('Tôi đề nghị đối chiếu hợp đồng với chứng cứ thanh toán.');
  await page.getByRole('button',{name:'Gửi lập luận'}).click();
  try {
    await expect(learner).toHaveAttribute('data-state','speaking');
    await expect(judge).toHaveAttribute('data-state','listening');
    await expect(page.getByRole('button',{name:'Gửi lập luận'})).toBeDisabled();
    await expect(page.getByRole('status')).toContainText('Đang chờ phản hồi');
    expect(calls.length).toBe(1);
    await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toHaveCount(0);
  } finally { release(); }
  await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
  await expect(judge).toHaveAttribute('data-state','speaking');
  await expect(learner).toHaveAttribute('data-state','listening');
  await page.getByRole('button',{name:'Lời trước',exact:true}).click();
  await expect(page.locator('[data-actor="opponent"]')).toHaveAttribute('data-state','speaking');
  await expect(page.getByText('Bạn đối chiếu chứng cứ trả tiền như thế nào?',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Lập luận của bạn')).toBeEnabled();
});

test('phòng xử án: đọc dài, lịch sử, bản nháp, laptop/mobile và giảm chuyển động',async({page},info)=>{
  const opening='Mời trình bày lập luận. '+ 'Hãy phân biệt yêu cầu của các bên và thông tin ghi nhận trong hợp đồng. '.repeat(16)+'Cuối cùng, đề nghị chỉ rõ vấn đề còn tranh chấp.';
  await mockApi(page,{sample:evidenceCase,opening});
  await login(page); await setup(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  const input=page.getByLabel('Lập luận của bạn');
  await input.fill('Bản nháp được giữ khi tôi xem hồ sơ và lời trình bày trước.');
  await page.getByRole('button',{name:'Đọc đầy đủ',exact:true}).click();
  await expect(page.getByRole('region',{name:'Lời trình bày đầy đủ'})).toContainText(opening);
  expect(await page.locator('.speech-content').evaluate(el=>el.scrollHeight>el.clientHeight && getComputedStyle(el).overflowY==='auto')).toBe(true);
  await page.locator('.speech-content').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  expect(await page.locator('.speech-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Đọc đầy đủ',exact:true})).toBeFocused();
  await expect(input).toHaveValue(/Bản nháp được giữ/);
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  await page.getByRole('tab',{name:'Biên bản',exact:true}).click();
  await page.getByRole('region',{name:'Hồ sơ phiên tòa'}).getByRole('button',{name:/01 · Chủ tọa/}).click();
  await expect(input).toHaveValue(/Bản nháp được giữ/);
  await expect(page.getByText('Thẩm phán AI',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Diễn biến phiên tòa',{exact:true})).toHaveCount(0);
  expect(await page.locator('.character-image').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  for(const image of await page.locator('.character-image,.court-background').all()) expect(await image.evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);
  await page.screenshot({path:'test-results/courtroom-'+info.project.name+'.png',fullPage:true});
  if(info.project.name==='desktop') {
    await page.setViewportSize({width:1024,height:768});
    await page.screenshot({path:'test-results/courtroom-laptop.png',fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('region',{name:'Tài liệu của vụ án'})).toHaveCount(0);
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  await page.getByText('Chi tiết chứng cứ: Hợp đồng vay',{exact:true}).click();
  await expect(page.getByRole('region',{name:'Hồ sơ phiên tòa'})).toContainText('Nội dung hợp đồng kiểm thử');
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue(/Bản nháp được giữ/);
  await page.getByRole('button',{name:'Gửi lập luận',exact:true}).click();
  await expect(page.getByText('Mời làm rõ chứng cứ thanh toán.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  await page.getByRole('tab',{name:'Biên bản',exact:true}).click();
  await page.getByRole('region',{name:'Hồ sơ phiên tòa'}).getByRole('button',{name:/01 · Chủ tọa/}).click();
  expect(await page.locator('.speech-content').evaluate(el=>el.scrollTop)).toBe(0);
});

test('hướng dẫn từng bước: điều hướng, đóng, trả focus và giữ bản nháp',async({page},info)=>{
  await mockApi(page); await login(page); await setup(page);
  await page.getByLabel('Lập luận của bạn').fill('Bản nháp khi đọc hướng dẫn.');
  const trigger=page.getByRole('button',{name:'Hướng dẫn',exact:true});
  await trigger.click();
  const guide=page.getByRole('dialog');
  await expect(guide).toContainText('Bước 1 / 6');
  await expect(page.locator('.tour-spotlight')).toBeVisible();
  await expect(guide.getByRole('button',{name:'Quay lại',exact:true})).toBeDisabled();
  await guide.getByRole('button',{name:'Tiếp theo →',exact:true}).click();
  await expect(guide).toContainText('Tra cứu luật');
  await expect.poll(async()=>{const target=await page.locator('.tool-law').boundingBox();const spot=await page.locator('.tour-spotlight').boundingBox();return Math.abs(spot.x-(target.x-5));}).toBeLessThan(2);
  await page.screenshot({path:'test-results/guide-'+info.project.name+'.png',fullPage:true});
  await guide.getByRole('button',{name:'Quay lại',exact:true}).click();
  await expect(guide).toContainText('Bước 1 / 6');
  await guide.getByRole('button',{name:'Bước 6: Kết thúc phiên',exact:true}).click();
  await guide.getByRole('button',{name:'Bắt đầu thực hành',exact:true}).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue('Bản nháp khi đọc hướng dẫn.');
  await trigger.click();
  await expect(guide).toContainText('Bước 1 / 6');
  await page.keyboard.press('Escape');
  await expect(guide).toHaveCount(0);
});

test('tour: phiên kết thúc, màn hình thấp, focus và giảm chuyển động',async({page})=>{
  await mockApi(page,{completedSession:true}); await login(page); await setup(page);
  await page.setViewportSize({width:740,height:390});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Hướng dẫn',exact:true}).click();
  const guide=page.getByRole('dialog');
  await expect(guide).toContainText('Bước 1 / 5');
  await expect(guide.getByRole('button',{name:/Bước .*Gửi lập luận/})).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  await expect(guide.getByRole('button',{name:'Tiếp theo →',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(guide.getByRole('button',{name:'Đóng hướng dẫn',exact:true})).toBeFocused();
  for(let step=0;step<5;step++) {
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    const bounds=await guide.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(390);
    expect(await guide.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
    if(step<4) await guide.getByRole('button',{name:'Tiếp theo →',exact:true}).click();
  }
  await expect(guide).toContainText('Kết thúc phiên');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link',{name:'Xem kết quả',exact:true})).toBeVisible();
});

test('hồ sơ phiên tòa: tab bàn phím, biên bản toàn văn và bản nháp sau reload',async({page})=>{
  const opening='Mở đầu phiên.\n'+ 'Đối chiếu nội dung hồ sơ với yêu cầu của từng bên. '.repeat(30)+'\nĐOẠN CUỐI CỦA PHẢN HỒI DÀI.';
  await mockApi(page,{opening}); await login(page); await setup(page);
  await page.getByLabel('Lập luận của bạn').fill('Bản nháp không mất khi đổi tab.');
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  const caseTab=page.getByRole('tab',{name:'Vụ án',exact:true});
  const transcriptTab=page.getByRole('tab',{name:'Biên bản',exact:true});
  await caseTab.focus(); await page.keyboard.press('ArrowRight');
  await expect(transcriptTab).toBeFocused();
  await expect(transcriptTab).toHaveAttribute('aria-selected','true');
  const entry=page.getByRole('article',{name:'01 · Chủ tọa',exact:true});
  await expect(entry.locator(':scope > p')).toHaveText(opening);
  expect(await entry.locator(':scope > p').evaluate(el=>el.scrollHeight<=el.clientHeight+1 && getComputedStyle(el).webkitLineClamp==='none')).toBe(true);
  await entry.getByText('ĐOẠN CUỐI CỦA PHẢN HỒI DÀI.',{exact:false}).scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue('Bản nháp không mất khi đổi tab.');
  await page.reload();
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  await transcriptTab.click();
  await expect(entry.locator(':scope > p')).toHaveText(opening);
  await expect(page.getByRole('button',{name:'Biên bản phiên tòa',exact:true})).toHaveCount(0);
});

test('tạo phiên không chọn mức độ, chuẩn hóa bản nháp cũ',async({page})=>{
  const calls=await mockApi(page); await login(page);
  await page.evaluate(()=>sessionStorage.setItem('courtsim:draft:user-1:setup',JSON.stringify({case_id:'case-1',user_court_role:'defense_lawyer',case_event_date:'2025-01-01',difficulty:'advanced',request_id:'old-advanced-request'})));
  await page.getByRole('link',{name:'Tạo phiên mới',exact:true}).click();
  await expect(page.getByText('3. Chọn mức độ',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Cơ bản|Cân bằng|Nâng cao/})).toHaveCount(0);
  await expect(page.getByLabel('3. Ngày sự kiện làm phát sinh tranh chấp')).toHaveValue('2025-01-01');
  await page.getByRole('button',{name:'Bắt đầu phiên tòa',exact:true}).click();
  await expect(page).toHaveURL(/simulation\/session-1$/);
  expect(calls.creations).toHaveLength(1);
  expect(calls.creations[0].difficulty).toBe('balanced');
  expect(calls.creations[0].request_id).not.toBe('old-advanced-request');
});

test('lỗi gửi rõ nghĩa, không lộ lỗi kỹ thuật; chứng cứ nguyên văn vẫn giữ nguyên',async({page},info)=>{
  const raw='Tài liệu gốc ghi: cơ sở dữ liệu có cấu hình model=abc.\n  Nội dung này phải được giữ nguyên.';
  const sample={...evidenceCase,evidence_inventory:[{...evidenceCase.evidence_inventory[0],content:raw}]};
  await mockApi(page,{sample}); await login(page); await setup(page);
  let dialogs=0; page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await page.getByRole('button',{name:'Hồ sơ phiên tòa',exact:true}).click();
  await page.getByText('Chi tiết chứng cứ: Hợp đồng vay',{exact:true}).click();
  await expect(page.getByRole('region',{name:'Hồ sơ phiên tòa'})).toContainText(raw);
  await page.keyboard.press('Escape');
  const draft='Đề nghị đối chiếu hợp đồng với chứng cứ thanh toán.';
  await page.getByLabel('Lập luận của bạn').fill(draft);
  await page.route('**/messages',route=>route.fulfill({status:502,json:{error:{code:'AI_INVALID_RESPONSE',message:'localhost:5000 TypeError: model=gpt-private citation_ids mentioned_only'}}}));
  await page.getByRole('button',{name:'Gửi lập luận',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText(/Chưa thể gửi lập luận. Nội dung bạn viết vẫn được giữ lại. Vui lòng thử lại./);
  await expect(page.getByRole('alert')).not.toContainText(/localhost|TypeError|gpt-private|citation_ids|mentioned_only/);
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(draft);
  await page.screenshot({path:'test-results/copy-error-'+info.project.name+'.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(draft);
  expect(dialogs).toBe(0);
});
