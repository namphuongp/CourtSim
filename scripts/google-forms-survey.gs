// Dán vào Apps Script gắn với chính Google Form, không gắn với bảng Sheets.
function setupCourtSimSurvey() {
  const form = FormApp.getActiveForm();
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('TOKEN_ITEM_ID');
  const item = existingId ? form.getItemById(Number(existingId)).asTextItem()
    : form.addTextItem().setTitle('Mã phiên CourtSim');
  item.setRequired(true).setHelpText('Được điền sẵn từ CourtSim. Giữ nguyên mã này để nhận kết quả.');
  item.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern('^[a-f0-9]{24}\\.[a-f0-9]{64}$').build());
  props.setProperty('TOKEN_ITEM_ID', String(item.getId()));
  const marker = 'a'.repeat(24) + '.' + 'b'.repeat(64);
  const url = form.createResponse().withItemResponse(item.createResponse(marker)).toPrefilledUrl();
  const entry = url.match(/[?&](entry\.\d+)=/);
  if (!entry) throw new Error('Không xác định được trường mã phiên.');
  // Chỉ in tên cấu hình công khai, tuyệt đối không in secret hoặc câu trả lời.
  console.log('SURVEY_TOKEN_ENTRY=' + entry[1]);
  const handlers = ScriptApp.getProjectTriggers().map(trigger => trigger.getHandlerFunction());
  if (!handlers.includes('courtSimOnSubmit')) ScriptApp.newTrigger('courtSimOnSubmit').forForm(form).onFormSubmit().create();
  if (!handlers.includes('retryCourtSimReceipts')) ScriptApp.newTrigger('retryCourtSimReceipts').timeBased().everyMinutes(5).create();
}

function courtSimOnSubmit(event) {
  if (!event || !event.response) throw new Error('Hàm này chạy từ trigger gửi Google Form.');
  queueCourtSimReceipt_(event.response);
}

function queueCourtSimReceipt_(response) {
  const props = PropertiesService.getScriptProperties();
  const itemId = props.getProperty('TOKEN_ITEM_ID');
  const answer = response.getItemResponses().find(item => String(item.getItem().getId()) === itemId);
  const token = String(answer ? answer.getResponse() : '').trim();
  if (!/^[a-f0-9]{24}\.[a-f0-9]{64}$/.test(token)) return;
  const key = 'pending_' + response.getId();
  // Lưu trước khi gọi mạng để tự gửi lại nếu backend tạm thời không hoạt động.
  props.setProperty(key, JSON.stringify({ token: token, response_id: response.getId() }));
  deliverCourtSimReceipt_(key, props);
}

function deliverCourtSimReceipt_(key, props) {
  const payload = props.getProperty(key);
  if (!payload) return;
  const secret = props.getProperty('SURVEY_WEBHOOK_SECRET');
  const url = props.getProperty('COURTSIM_WEBHOOK_URL');
  if (!secret || secret.length < 32 || !/^https:\/\/[^?#]+\/api\/v1\/survey\/google-forms$/.test(url || '')) {
    throw new Error('Cần cấu hình secret và URL webhook HTTPS trong Script Properties.');
  }
  const timestamp = String(Date.now());
  const signature = Utilities.computeHmacSha256Signature(timestamp + '.' + payload, secret, Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
  const response = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', payload: payload,
    headers: { 'X-CourtSim-Timestamp': timestamp, 'X-CourtSim-Signature': signature },
    muteHttpExceptions: true, followRedirects: false,
  });
  if (response.getResponseCode() === 200) props.deleteProperty(key);
  else throw new Error('Chưa đồng bộ xác nhận, HTTP ' + response.getResponseCode() + '. Hệ thống sẽ thử lại.');
}

function retryCourtSimReceipts() {
  const props = PropertiesService.getScriptProperties();
  const keys = Object.keys(props.getProperties()).filter(key => key.indexOf('pending_') === 0).slice(0, 20);
  keys.forEach(key => {
    try { deliverCourtSimReceipt_(key, props); }
    catch (error) { console.warn('Có xác nhận chưa đồng bộ. Kiểm tra cấu hình hoặc trạng thái backend.'); }
  });
}

// Khôi phục khi trigger bị tắt hoặc hết quota; không gửi nội dung khảo sát về CourtSim.
function recoverRecentCourtSimReceipts() {
  FormApp.getActiveForm().getResponses(new Date(Date.now() - 7 * 86400000)).forEach(response => {
    try { queueCourtSimReceipt_(response); }
    catch (error) { console.warn('Có xác nhận chờ gửi lại.'); }
  });
}
