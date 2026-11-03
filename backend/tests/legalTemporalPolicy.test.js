import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLegalPlan, assessVersion, isValidDateOnly } from '../src/services/legalTimeline.js';

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

