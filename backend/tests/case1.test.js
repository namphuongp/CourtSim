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

test('phân loại rõ vụ án chuẩn hệ thống và hồ sơ người dùng tải lên cùng mức độ đầy đủ dữ liệu', async () => {
  const { detectCaseOrigin, caseCompletenessStats } = await import('../../shared/casePresentation.mjs');
  const { learnerCase } = await import('../src/services/learnerPresentation.js');
  const { extractAndStructureUserCase } = await import('../src/services/userCaseUploadService.js');

  assert.equal(detectCaseOrigin(c), 'system');
  const sysStats = caseCompletenessStats(c);
  assert.equal(sysStats.origin, 'system');
  assert.equal(sysStats.has_full_dossier, true);
  assert.equal(sysStats.quality_level, 'verified_system');
  assert.equal(learnerCase(c).origin, 'system');

  const structuredUpload = await extractAndStructureUserCase({
    rawText: 'Ngày 10/01/2025, nguyên đơn là bà Nguyễn Thị Lan khởi kiện yêu cầu bị đơn là ông Trần Văn Hùng hoàn trả 500.000.000 đồng tiền đặt cọc theo Hợp đồng đặt cọc ngày 10/01/2025. Ngày 15/02/2025, hai bên lập Biên bản làm việc nhưng ông Hùng từ chối hoàn trả.',
    userId: '507f1f77bcf86cd799439011',
  }, { complete: async () => { throw new Error('offline'); } });

  assert.equal(structuredUpload.origin, 'user_upload');
  assert.equal(structuredUpload.created_by, '507f1f77bcf86cd799439011');
  const presentedUpload = learnerCase(structuredUpload);
  assert.equal(presentedUpload.origin, 'user_upload');
  assert.equal(presentedUpload.created_by, '507f1f77bcf86cd799439011');

  const partialUpload = {
    title: 'Hồ sơ người dùng tải lên thiếu dữ liệu',
    source_note: 'Hồ sơ bản án do người dùng tải lên và được chuẩn hóa cấu trúc tự động.',
    parties: [{ side: 'plaintiff', name: 'Nguyên đơn', claims: [] }],
    timeline: [],
    evidence_inventory: [],
  };
  const partialStats = caseCompletenessStats(partialUpload);
  assert.equal(partialStats.origin, 'user_upload');
  assert.equal(partialStats.has_full_dossier, false);
  assert.equal(partialStats.quality_level, 'partial_upload');
  assert.ok(partialStats.missing_fields.length >= 2);
});

test('giới hạn 2 lượt tải miễn phí và trạng thái kiểm duyệt hồ sơ người dùng tải lên', async () => {
  const { FREE_UPLOAD_LIMIT } = await import('../../shared/membershipPolicy.mjs');
  const { detectModerationStatus, caseCompletenessStats } = await import('../../shared/casePresentation.mjs');
  const { learnerCase } = await import('../src/services/learnerPresentation.js');

  assert.equal(FREE_UPLOAD_LIMIT, 2);
  assert.equal(detectModerationStatus(c), 'approved');
  assert.equal(caseCompletenessStats(c).is_approved, true);

  const pendingUpload = {
    title: 'Hồ sơ người dùng tải lên chờ duyệt',
    origin: 'user_upload',
    moderation_status: 'pending',
    summary: 'Tóm tắt vụ việc',
  };
  assert.equal(detectModerationStatus(pendingUpload), 'pending');
  const pendingStats = caseCompletenessStats(pendingUpload);
  assert.equal(pendingStats.is_pending, true);
  assert.equal(pendingStats.is_approved, false);
  assert.equal(learnerCase(pendingUpload).moderation_status, 'pending');

  const rejectedUpload = {
    title: 'Hồ sơ bị từ chối',
    origin: 'user_upload',
    moderation_status: 'rejected',
    moderation_note: 'Thiếu dữ liệu các bên đương sự.',
    summary: 'Tóm tắt vụ việc',
  };
  const rejectedStats = caseCompletenessStats(rejectedUpload);
  assert.equal(rejectedStats.is_rejected, true);
  assert.equal(rejectedStats.is_approved, false);
  assert.equal(learnerCase(rejectedUpload).moderation_note, 'Thiếu dữ liệu các bên đương sự.');
});
