import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLegalPlan, assessVersion, isValidDateOnly } from '../src/services/legalTimeline.js';
import { getValidityDetails, getAuthorityMetadata, legalAuthorities } from '../src/data/legalAuthorities.js';
import { learnerCitation } from '../src/services/learnerPresentation.js';
import { legalCitationSchema } from '../src/schemas/legalCitationSchema.js';

// ===== Tests cho logic thời điểm áp dụng pháp luật =====

test('buildLegalPlan: reason phải ghi rõ ngày sự kiện và yêu cầu đối chiếu phiên bản luật', () => {
  const courtCase = {
    category: 'Tranh chấp hợp đồng dân sự',
    title: 'Tranh chấp hợp đồng mua bán',
    timeline: [
      { kind: 'transaction', date: '2010-03-15', date_to: '2010-03-15', description: 'Ký hợp đồng mua bán', source_quote: 'Ngày 15/3/2010 hai bên ký hợp đồng', status: 'reported' },
      { kind: 'dispute', date: '2022-06-01', date_to: '2022-06-01', description: 'Phát sinh tranh chấp', source_quote: 'Tháng 6/2022 tranh chấp xảy ra', status: 'reported' },
    ],
  };
  const plans = buildLegalPlan(courtCase, null);

  const transactionPlan = plans.find(p => p.kind === 'transaction');
  assert.ok(transactionPlan, 'phải có mốc giao dịch');
  assert.ok(transactionPlan.reason.includes('2010-03-15'), 'reason phải chứa ngày sự kiện giao dịch 2010-03-15');
  assert.ok(transactionPlan.reason.includes('thời điểm') || transactionPlan.reason.includes('phiên bản') || transactionPlan.reason.includes('TẠI'),
    'reason phải nhắc yêu cầu xét đúng phiên bản luật tại thời điểm sự kiện');

  const disputePlan = plans.find(p => p.kind === 'dispute');
  assert.ok(disputePlan, 'phải có mốc tranh chấp');
  assert.ok(disputePlan.reason.includes('2022-06-01'), 'reason phải chứa ngày tranh chấp 2022-06-01');
});

test('buildLegalPlan: fallback (chưa có mốc) phải cảnh báo đây chỉ là tham khảo, không phải kết luận', () => {
  const courtCase = { category: 'Dân sự', title: 'Vụ án bài tập', timeline: [] };
  const plans = buildLegalPlan(courtCase, '2015-05-10');
  const fallback = plans.find(p => p.kind === 'exercise');
  assert.ok(fallback, 'phải có mốc giả định bài tập khi không có timeline');
  assert.equal(fallback.status, 'assumed');
  assert.ok(fallback.reason.toLowerCase().includes('giả định') || fallback.reason.toLowerCase().includes('tham khảo'),
    'reason phải nêu rõ đây là mốc giả định/tham khảo');
  assert.ok(!fallback.reason.toLowerCase().includes('kết luận luật áp dụng') || fallback.reason.includes('chưa phải kết luận'),
    'reason không được tuyên bố đây là kết luận chính thức về luật áp dụng');
});

test('buildLegalPlan: phân biệt phiên bản Luật Đất đai theo thời kỳ sự kiện', () => {
  const makeCase = (date) => ({
    category: 'Tranh chấp đất đai',
    title: 'Tranh chấp đất đai',
    timeline: [{ kind: 'transaction', date, date_to: date, description: 'Chuyển nhượng đất', source_quote: 'Giao dịch đất', status: 'reported' }],
  });

  // Trước 2004: Luật cũ
  const plans2003 = buildLegalPlan(makeCase('2003-01-01'), null);
  const tx2003 = plans2003.find(p => p.kind === 'transaction');
  assert.ok(tx2003.law_numbers.some(n => n.includes('2004') || n.toLowerCase().includes('trước 2004') || n.includes('2003')),
    'Sự kiện 2003 phải tra phiên bản Luật Đất đai trước 2004');

  // 2014-2024: Luật 45/2013/QH13
  const plans2020 = buildLegalPlan(makeCase('2020-06-01'), null);
  const tx2020 = plans2020.find(p => p.kind === 'transaction');
  assert.ok(tx2020.law_numbers.includes('45/2013/QH13'),
    'Sự kiện 2020 phải tra Luật Đất đai 45/2013/QH13');

  // Sau 01/08/2024: Luật 31/2024/QH15
  const plans2025 = buildLegalPlan(makeCase('2025-01-01'), null);
  const tx2025 = plans2025.find(p => p.kind === 'transaction');
  assert.ok(tx2025.law_numbers.includes('31/2024/QH15'),
    'Sự kiện 2025 phải tra Luật Đất đai 31/2024/QH15');
});

test('assessVersion: chưa reviewed transition_status phải trả về unverified với lý do rõ ràng', () => {
  const document = {
    version_rules: [{
      from: '2010-01-01', to: '2023-12-31', version: 'Luật X 2010',
      history_checked: true, source_checked: true,
      review_sources: ['https://vbpl.vn/van-ban/chi-tiet/12345'],
      transition_status: 'not_reviewed', // Chưa đối chiếu chuyển tiếp
      event_kinds: ['transaction'],
    }],
  };
  const provision = { article: '5', paragraph: null, point: null };
  const plan = { date: '2015-06-01', date_to: '2015-06-01', kind: 'transaction', status: 'reported', reason: 'Giao dịch 2015' };

  const result = assessVersion(document, provision, plan);
  assert.equal(result.verified, false, 'phải unverified khi transition_status chưa reviewed');
  assert.ok(result.reason.includes('chuyển tiếp'), 'lý do phải đề cập điều khoản chuyển tiếp');
});

test('assessVersion: không có rule phù hợp phiên bản trong khoảng ngày phải unverified', () => {
  const document = {
    version_rules: [{
      from: '2024-01-01', to: '2030-12-31', version: 'Luật mới 2024',
      history_checked: true, source_checked: true,
      review_sources: ['https://vbpl.vn/van-ban/chi-tiet/99999'],
      transition_status: 'reviewed',
      event_kinds: ['transaction'],
    }],
  };
  const provision = { article: '10', paragraph: null, point: null };
  // Sự kiện năm 2015 — không có rule phù hợp
  const plan = { date: '2015-03-01', date_to: '2015-03-01', kind: 'transaction', status: 'reported', reason: 'Giao dịch 2015' };

  const result = assessVersion(document, provision, plan);
  assert.equal(result.verified, false, 'phải unverified khi không có rule phù hợp với khoảng thời gian sự kiện');
});

// ===== Tests cho Cảnh báo tình trạng hiệu lực & Lịch sử thay đổi =====

test('getValidityDetails: Luật Đất đai 45/2013/QH13 phải có status expired, cảnh báo thay thế và lịch sử thay đổi', () => {
  const details = getValidityDetails('45/2013/QH13');
  assert.ok(details, 'phải trả về validity details');
  assert.equal(details.validity_status, 'expired', 'Luật 2013 phải hết hiệu lực hiện nay');
  assert.ok(details.validity_warning.includes('HẾT HIỆU LỰC'), 'Cảnh báo phải nêu rõ hết hiệu lực');
  assert.ok(details.validity_warning.includes('31/2024/QH15'), 'Cảnh báo phải nêu được văn bản thay thế 31/2024/QH15');
  assert.ok(details.change_history.length >= 2, 'Lịch sử phải có ít nhất văn bản gốc và văn bản thay thế');

  const orig = details.change_history.find(h => h.type === 'original');
  assert.ok(orig, 'Phải có mục văn bản gốc');
  assert.equal(orig.law_number, '45/2013/QH13');
  assert.equal(orig.effective_from, '2014-07-01');

  const rep = details.change_history.find(h => h.type === 'replacement');
  assert.ok(rep, 'Phải có mục văn bản thay thế');
  assert.equal(rep.law_number, '31/2024/QH15');
  assert.equal(rep.effective_from, '2024-08-01');
});

test('getValidityDetails: Luật Đất đai 31/2024/QH15 có status amended (sửa đổi bởi Luật 43/2024/QH15)', () => {
  const details = getValidityDetails('31/2024/QH15');
  assert.ok(details);
  assert.equal(details.validity_status, 'amended', 'Luật 31/2024 đã được sửa đổi ngày hiệu lực bởi Luật 43/2024');
  assert.ok(details.validity_warning.includes('43/2024/QH15'), 'Cảnh báo phải nhắc đến Luật 43/2024/QH15');
  assert.ok(details.change_history.some(h => h.type === 'amendment' && h.law_number === '43/2024/QH15'),
    'Lịch sử thay đổi phải liệt kê Luật 43/2024/QH15');
  assert.ok(details.change_history.some(h => h.type === 'superseded' && h.law_number === '45/2013/QH13'),
    'Lịch sử thay đổi phải liệt kê văn bản tiền nhiệm 45/2013/QH13');
});

test('getValidityDetails: Luật Đất đai 13/2003/QH11 có status expired và thay thế bởi 45/2013/QH13', () => {
  const details = getValidityDetails('13/2003/QH11');
  assert.ok(details);
  assert.equal(details.validity_status, 'expired');
  assert.ok(details.validity_warning.includes('45/2013/QH13'));
});

test('getValidityDetails: An toàn với khoảng trắng, chữ thường và ngày không hợp lệ', () => {
  const lowercase = getValidityDetails('  45/2013/qh13  ');
  assert.ok(lowercase);
  assert.equal(lowercase.validity_status, 'expired');

  const invalidDate = getValidityDetails('45/2013/QH13', 'not-a-date');
  assert.ok(invalidDate);
  assert.equal(invalidDate.validity_status, 'expired');

  const unknown = getValidityDetails('UNKNOWN/9999');
  assert.equal(unknown, null);
});

test('learnerCitation: tự động gắn validity_status, validity_warning và change_history cho trích dẫn', () => {
  const citation = {
    id: 'CIT-TEST-1',
    law_number: '45/2013/QH13',
    title: 'Luật Đất đai',
    article: '166',
    text: 'Điều 166. Quyền chung của người sử dụng đất...',
    source_url: 'https://vbpl.vn/example',
    source_verification: 'verified',
    verification_status: 'verified',
    application_status: 'verified',
  };

  const formatted = learnerCitation(citation);
  assert.equal(formatted.validity_status, 'expired');
  assert.ok(formatted.validity_warning.includes('HẾT HIỆU LỰC'));
  assert.ok(formatted.change_history.length >= 2);
  assert.equal(formatted.effective_from, '2014-07-01');
  assert.equal(formatted.effective_to, '2024-07-31');

  // Guard null/undefined
  assert.equal(learnerCitation(null), null);
  assert.equal(learnerCitation(undefined), undefined);
});

test('legalCitationSchema: chứa đầy đủ các trường validity_status, validity_warning, change_history', () => {
  const paths = legalCitationSchema.paths;
  assert.ok(paths.validity_status, 'phải có validity_status trên schema');
  assert.ok(paths.validity_warning, 'phải có validity_warning trên schema');
  assert.ok(paths.change_history, 'phải có change_history trên schema');
  assert.ok(paths.effective_to, 'phải có effective_to trên schema');
  assert.ok(paths.issuing_body, 'phải có issuing_body trên schema');
});
