import { SCORING_RUBRIC } from '../../backend/src/data/scoringRubric.js';
import { calculateEvaluation } from '../../backend/src/services/scoringService.js';
import { test, expect } from '@playwright/test';

const courtCase = { _id:'case-1',title:'Tranh chấp hợp đồng vay tài sản',summary:'Bị đơn khai đã thanh toán một phần.',category:'dân sự',full_document:'Hồ sơ giả định: có hợp đồng vay và sao kê; chưa có biên nhận trả tiền mặt.' };
const rubric_scores={legal_knowledge:70,reasoning:80,evidence_use:90,courtroom_skill:60};

async function mockApi(page, {failFirst=false, sample=courtCase, failCompleteFirst=false, completionDelay=0, modern=false}={}) {
  const courtCase = sample;
  let session=null;
  let result=null;
  let failed=false;
  let records=[];
  const requests=[];
  requests.completions=0;
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
      session={...body,_id:'session-1',case_id:courtCase,status:'ongoing',turn_count:0,max_turns:20,created_at:new Date().toISOString()};
      records=[{_id:'opening',sender_type:'ai_judge',sender_name:'Thẩm phán AI',content:'Mời trình bày lập luận.'}];
      return send({data:{session,opening:records[0]}},201);
    }
    if(path.endsWith('/v1/sessions')) return send({data:session?[{...session,result}]:[]});
    if(path.endsWith('/records')) return send({data:records});
    if(path.endsWith('/messages')) {
      requests.push(body);
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
  await page.getByLabel('4. Ngày sự kiện làm phát sinh tranh chấp').fill('2025-01-01');
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
  await expect(page.getByRole('alert')).toContainText('AI đang bận');
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(text);
  await expect(page.getByRole('button',{name:'Gửi lập luận'})).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Lập luận của bạn')).toHaveValue(text);
  if(info.project.name==='mobile') {
    await page.getByRole('button',{name:'Hồ sơ vụ án',exact:true}).click();
    await page.getByText('Đọc toàn bộ nội dung hồ sơ',{exact:true}).click();
    await expect(page.locator('details').getByText(courtCase.full_document)).toBeVisible();
    await page.getByRole('button',{name:'Đóng hồ sơ vụ án',exact:true}).click();
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
  await login(page);
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
  const date=page.getByLabel('4. Mốc tra cứu của bài tập');
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
  await expect(page.getByRole('button',{name:'Đang chấm...',exact:true})).toBeDisabled();
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
  await page.getByRole('button',{name:'Trợ lý tra cứu luật',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được phần tra cứu');
  await page.getByRole('button',{name:'Đóng trợ lý tra cứu luật',exact:true}).click();
  await expect(page.getByLabel('Lập luận của bạn')).toBeEnabled();
});

const evidenceCase = {...courtCase, parties:[{side:'plaintiff',name:'A',claims:['Yêu cầu trả khoản vay']}],timeline:[{kind:'transaction',date:'2020-01-01',description:'Ký hợp đồng'}],evidence_inventory:[{id:'EV-test-evidence1',code:'CC01',name:'Hợp đồng vay',summary:'Khoản vay theo hợp đồng.',availability:'provided',content:'Nội dung hợp đồng kiểm thử',provided_by:'Nguyên đơn',date:'2020-01-01'},{id:'EV-test-evidence2',code:'CC02',name:'Biên nhận',summary:'Bản án đề cập biên nhận.',availability:'mentioned_only'}]};

test('hồ sơ đóng mặc định, chèn chứng cứ bằng nút/bàn phím và giữ ID sau reload', async ({page},info) => {
  const calls=await mockApi(page,{sample:evidenceCase});
  await login(page); await setup(page);
  const open=page.getByRole('button',{name:'Hồ sơ vụ án',exact:true});
  await expect(page.getByRole('region',{name:'Hồ sơ vụ án'})).toHaveCount(0);
  await open.click();
  await expect(page.getByText('Yêu cầu trả khoản vay')).toBeVisible();
  if(info.project.name==='mobile') {
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByText('Đọc toàn bộ nội dung hồ sơ',{exact:true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button',{name:'Đóng hồ sơ vụ án',exact:true})).toBeFocused();
  }
  await page.screenshot({path:'test-results/dossier-'+info.project.name+'.png',fullPage:true});
  await expect(page.getByText('Chỉ được nhắc đến — chưa có nội dung tài liệu')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(open).toBeFocused();
  await open.click();
  await page.getByRole('button',{name:'Đưa vào lập luận: Hợp đồng vay',exact:true}).click();
  const input=page.getByLabel('Lập luận của bạn');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(/\[CC:EV-test-evidence1\]/);
  await expect(page.getByRole('region',{name:'Hồ sơ vụ án'})).toHaveCount(0);
  await page.reload(); await expect(input).toHaveValue(/\[CC:EV-test-evidence1\]/);
  if(info.project.name==='desktop') {
    await open.click();
    const transfer=await page.evaluateHandle(()=>new DataTransfer());
    await page.locator('article[draggable="true"]').last().dispatchEvent('dragstart',{dataTransfer:transfer});
    await input.dispatchEvent('drop',{dataTransfer:transfer});
    await expect(input).toHaveValue(/\[CC:EV-test-evidence2\]/);
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
  await page.getByRole('button',{name:'Trợ lý tra cứu luật',exact:true}).click();
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
  await page.getByRole('button',{name:'Trợ lý tra cứu luật',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Căn cứ nào cần xem xét?'})).toBeVisible();
});
