import test from 'node:test';
import assert from 'node:assert/strict';
import { legalScoringBasis, validateScoringBasis } from '../src/services/scoringBasis.js';
import { scoringEligibility, calculateEvaluation } from '../src/services/scoringService.js';
import { SCORING_RUBRIC } from '../src/data/scoringRubric.js';

const citation = { id: 'law1', source_url: 'https://vbpl.vn/van-ban/chi-tiet/fixture', source_verification: 'verified',
  verification_status: 'verified', article: '1', text: 'Nội dung hư cấu dành riêng cho kiểm thử.', checked_at: new Date().toISOString(),
  source_sha256: 'a'.repeat(64), version: 'fixture', application_status: 'unverified' };
const user = { _id: 'u', sender_type: 'user', content: 'Tôi đề nghị đối chiếu chứng cứ trong hồ sơ với quy định.' };
const records = [user, { sender_type: 'ai_prosecutor' }, user, { sender_type: 'ai_prosecutor' }, user];

test('nguồn đã đối chiếu nội dung mở 2.1/2.2, không tự mở chấm hiệu lực hoặc coi thiếu là 0', () => {
  const basis = legalScoringBasis({ citations: [citation], legal_assessment_available: false });
  const eligibility = scoringEligibility(records, basis);
  assert.equal(eligibility['2.1'], null);
  assert.equal(eligibility['2.2'], null);
  for (const id of ['2.3', '2.4', '4.2']) assert.ok(eligibility[id]);
  const entries = SCORING_RUBRIC.groups.flatMap(g => g.items.map(i => ({ id: i.id, score: i.max * 0.8,
    reason: 'Có lập luận, còn thiếu liên kết.', strength: 'Bám hồ sơ.', improvement: 'Giải thích thêm.', record_id: 'u', quote: 'đối chiếu chứng cứ' })));
  const result = calculateEvaluation(entries, records, basis);
  assert.equal(result.assessed_max, 85);
  assert.equal(result.earned_score, 68);
  assert.equal(result.assessed_percentage, 80);
  assert.equal(result.score, null);
});

test('nguồn web chỉ đọc được, metadata thiếu điều, hoặc URL giả không mở điểm luật', () => {
  for (const c of [{ ...citation, source_verification: 'web_read' }, { ...citation, text: '' }, { ...citation, source_url: 'https://vbpl.vn.evil.test/law' }]) {
    const basis = legalScoringBasis({ citations: [c], legal_assessment_available: true });
    assert.equal(basis.content, false);
    assert.equal(basis.application, false);
  }
  const basis = legalScoringBasis({ citations: [{ ...citation, law_number: '999/2020/QH14' }] }, [{ sender_type: 'user', content: 'Tôi viện dẫn Điều 2 Luật 999/2020/QH14.' }]);
  assert.equal(basis.content, false);
});

test('nguồn tham khảo thêm không vô hiệu hóa nguồn đủ điều kiện, chặn nguồn sai theo tiêu chí', () => {
  const basis = legalScoringBasis({ citations: [{ ...citation, application_status: 'verified' }, { ...citation, id: 'read', source_verification: 'web_read' }], legal_assessment_available: true });
  assert.equal(basis.application, true);
  assert.doesNotThrow(() => validateScoringBasis([{ id: '2.3', score: 3, citation_ids: ['law1'] }], basis));
  for (const ids of [[], ['read'], ['invented']]) assert.throws(() => validateScoringBasis([{ id: '2.3', score: 3, citation_ids: ids }], basis));
  const contentOnly = legalScoringBasis({ citations: [citation] });
  assert.throws(() => validateScoringBasis([{ id: '4.2', score: 2, citation_ids: ['law1'] }], contentOnly));
});

test('luồng evaluator sửa nguồn sai, giữ điểm phần có căn cứ và không mở mục hiệu lực', async () => {
  process.env.JWT_SECRET ||= 'scoring-basis-test-secret-at-least-32-characters';
  const { evaluateSession } = await import('../src/services/simulationService.js');
  const context = { citations: [{ ...citation, context_text: citation.text }], issues: [], candidates: [], warnings: [], legal_assessment_available: false };
  const eligibility = scoringEligibility(records, legalScoringBasis(context));
  let calls = 0;
  const result = await evaluateSession({ session: { case_event_date: '2024-03-29', user_court_role: 'plaintiff_lawyer' },
    courtCase: { title: 'Bài tập kiểm thử', summary: 'Các bên bất đồng về chứng cứ.', full_document: 'Các bên bất đồng về chứng cứ.' }, records }, {
    persona: async () => ({ model_id: 'fixture' }), research: async () => context,
    complete: async input => {
      calls++;
      assert.match(input.systemPrompt, /không mặc định điểm tối đa/);
      const criteria = SCORING_RUBRIC.groups.flatMap(g => g.items).filter(i => !eligibility[i.id]).map(i => ({
        id: i.id, score: i.max * 0.8, quote_id: 'q1', reason: 'Có giải thích nhưng chưa đầy đủ.', strength: 'Bám nội dung.', improvement: 'Nêu rõ liên hệ với yêu cầu.',
        citation_ids: i.id.startsWith('2.') ? [calls === 1 ? 'invented' : 'law1'] : [],
      }));
      return JSON.stringify({ criteria, verdict: 'Lập luận cần hoàn thiện.', feedback: 'Đã phân biệt nguồn và kết luận.', improvement_suggestions: 'Giải thích liên hệ chứng cứ với yêu cầu.', citation_ids: ['law1'] });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.assessed_max, 85);
  assert.equal(result.earned_score, 68);
  assert.equal(result.score, null);
  assert.deepEqual(result.criteria[1].items[0].citation_ids, ['law1']);
});
