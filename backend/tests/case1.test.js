import test from 'node:test';
import assert from 'node:assert/strict';
import { case1Appeal as c } from '../src/data/case1Appeal.js';
import { validateCaseDetails, validateEvidenceReferences } from '../src/services/caseEvidence.js';
import { validateCaseFacts } from '../src/services/caseKnowledge.js';
import { validatePracticeContext, openingStatement } from '../src/services/casePractice.js';
import { validateTimeline } from '../src/services/legalTimeline.js';
import { chooseSpeakingPlan } from '../src/services/conversationPolicy.js';
import { dialogueProblem } from '../src/services/debatePolicy.js';
import { canCiteEvidence, caseRoleLabel } from '../../shared/casePresentation.mjs';

test('Case1 giữ nguồn, ngày chưa biết và giới hạn thẻ có thể trích', () => {
  validateCaseDetails(c); validateCaseFacts(c); validateTimeline(c.timeline);
  assert.equal(validatePracticeContext(c.practice_context).hearing_date, null);
  assert.equal(c.practice_context.judgment_number, null);
  assert.equal(c.evidence_inventory.filter(e => canCiteEvidence(e, c)).length, c.evidence_inventory.length);
  for (const e of c.evidence_inventory) {
    if (e.availability === 'provided') {
      assert.ok(e.provided_by && e.source_locator && e.proof_scope && e.content);
      assert.deepEqual(validateEvidenceReferences(c, `[CC:${e.id}]`), [e.id]);
    } else assert.deepEqual(validateEvidenceReferences(c, `[CC:${e.id}]`), [e.id]);
  }
  assert.throws(() => validatePracticeContext({ ...c.practice_context, hearing_date: '2018-09-01' }));
});

test('hai vai phúc thẩm bắt đầu từ nội dung kháng cáo, không nhập vai người vắng mặt', () => {
  for (const role of ['plaintiff_lawyer', 'defense_lawyer']) {
    assert.ok(caseRoleLabel(role, c));
    assert.match(openingStatement(c, role), /kháng cáo/);
    assert.deepEqual(chooseSpeakingPlan({ user_court_role: role, turn_count: 0, case_snapshot: c }, 'Tôi bảo vệ yêu cầu về đất và cần làm rõ nguồn chứng cứ.').plan, ['judge', 'opponent']);
  }
});

test('chặn lời mời người vắng mặt, phán quyết tự tạo và số liệu chắc chắn giả', () => {
  for (const [content, expected] of [
    ['Mời ông Xây trực tiếp trả lời.', /vắng mặt/],
    ['Hội đồng xét xử tuyên ông Kiên thắng kiện.', /phán quyết/],
    ['Diện tích đất của ông Kiên là 58,5 m².', /bất nhất/],
  ]) assert.match(dialogueProblem({ content }, 'judge', [], c), expected);
});

test('nguồn chưa xác minh không chấm luật và không nâng lời khai thành sự kiện', async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'case1-test-secret-at-least-32-characters';
  const { researchLegalBasis } = await import('../src/services/legalResearchService.js');
  const { validateFactAnchors } = await import('../src/services/simulationService.js');
  const legal = await researchLegalBasis({ courtCase: c, eventDate: c.reference_date, online: false });
  assert.equal(legal.legal_assessment_available, false);
  assert.deepEqual(legal.citations, []);
  assert.throws(() => validateFactAnchors({ established_facts: ['Anh Nguyên nói việc thỏa thuận là do bố kể lại'], learner_claims: [] }, c, []));
  assert.doesNotThrow(() => validateFactAnchors({ established_facts: [c.case_facts[0].quote], learner_claims: [] }, c, []));
});


test('giả định chứng cứ không sửa nguồn, không cho viện dẫn tài liệu ngoài hồ sơ', async () => {
  const { EVIDENCE_ASSUMPTION_POLICY, caseIntroduction, practiceText } = await import('../../shared/casePresentation.mjs');
  const { SOURCE_POLICY } = await import('../src/services/debatePolicy.js');
  const { hearingProblem } = await import('../src/services/hearingValidation.js');
  const before = structuredClone(c);
  assert.ok(SOURCE_POLICY.includes(EVIDENCE_ASSUMPTION_POLICY));
  assert.ok(!caseRoleLabel('defense_lawyer', c).includes('mô phỏng'));
  assert.equal(caseIntroduction(c).developments.length, 4);
  assert.equal(caseIntroduction({ title: 'Vụ án khác', summary: 'Nội dung khác' }).summary, 'Nội dung khác');
  assert.ok(!practiceText(c.evidence_inventory[0].content).includes('không phải tài liệu gốc'));
  assert.throws(() => validateEvidenceReferences(c, '[CC:EV-outside-case]'));
  assert.match(hearingProblem({ content: 'Đề nghị bạn xuất trình bản gốc giấy chứng nhận.' }, 'judge', { hearing: {} }, []), /giả định/);
  assert.deepEqual(c, before);
});
