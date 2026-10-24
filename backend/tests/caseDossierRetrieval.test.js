import test from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, clearCaseVectorCache, retrieveDossierSemanticScores } from '../src/services/caseDossierRetrieval.js';
import { extractDossierSentences, dialogueContext } from '../src/services/dialogueContext.js';

test('cosineSimilarity tính đúng độ tương đồng vector', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [-1, -1]) - (-1)) < 1e-6);
  assert.ok(cosineSimilarity([1, 2, 3], [2, 4, 6]) > 0.9999);
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity(null, [1, 2]), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
});

test('extractDossierSentences trích xuất đầy đủ câu từ tình tiết và chứng cứ', () => {
  const mockCase = {
    summary: 'Tranh chấp 200m2 đất tại Ba Vì. Các bên chưa thống nhất ranh giới.',
    full_document: 'Nguyên đơn xuất trình giấy chứng nhận quyền sử dụng đất.',
    case_facts: [{ kind: 'recorded_event', quote: 'Tranh chấp 200m2 đất tại Ba Vì.' }],
    evidence_inventory: [
      { id: 'E1', name: 'Sổ đỏ', summary: 'Giấy chứng nhận cấp năm 2005.', availability: 'provided', content: 'Nội dung chi tiết của giấy chứng nhận.' }
    ],
  };
  const sentences = extractDossierSentences(mockCase);
  assert.ok(Array.isArray(sentences));
  assert.ok(sentences.length >= 3);
  assert.ok(sentences.some(s => s.includes('200m2')));
  assert.ok(sentences.some(s => s.includes('2005')));
});

test('retrieveDossierSemanticScores xử lý an toàn và bỏ qua trong test env', async () => {
  const result = await retrieveDossierSemanticScores({
    courtCase: { _id: 'c1' },
    sentences: ['Câu 1', 'Câu 2'],
    queryText: 'câu hỏi',
    isTest: true,
  });
  assert.equal(result, null);
  clearCaseVectorCache('c1');
});

test('dialogueContext sử dụng dossierSemanticScores trong ranking hồ sơ khi được cung cấp', () => {
  const session = { user_court_role: 'plaintiff_lawyer' };
  const factA = 'Đoạn A: Giấy mua bán viết tay năm 1999.';
  const factB = 'Đoạn B: Ranh giới đo đạc năm 2010.';
  const courtCase = {
    summary: 'Đất tranh chấp 100m2.',
    full_document: `${factA}\n${factB}`,
    case_facts: [
      { kind: 'recorded_event', quote: factA },
      { kind: 'recorded_event', quote: factB },
    ],
    evidence_inventory: [],
  };
  const records = [{ sender_type: 'user', content: 'Tôi nói về hợp đồng chuyển nhượng viết tay.' }];

  // TH 1: Không có semantic scores -> xếp theo keyword
  const ctxNormal = dialogueContext(session, courtCase, records, { citations: [] });
  assert.ok(ctxNormal.dossier.length > 0);

  // TH 2: Có semantic score cực cao cho Đoạn B
  const semanticScores = new Map([
    [factB, 0.99],
    [factA, 0.1],
  ]);
  const ctxSemantic = dialogueContext(session, courtCase, records, { citations: [], dossierSemanticScores: semanticScores });
  assert.equal(ctxSemantic.dossier[0].text, factB);
});
