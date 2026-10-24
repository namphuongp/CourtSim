// Dịch vụ truy xuất ngữ nghĩa hồ sơ vụ án (Case Dossier Semantic Retrieval)
// Nhúng và cache các câu trong tình tiết vụ án & chứng cứ.
// So khớp cosine similarity với lập luận mới nhất của người học.

import { embed, embedBatch } from './embeddingService.js';

// Cache embeddings theo case id để không phải nhúng lại toàn bộ hồ sơ ở mỗi lượt đối đáp.
const caseVectorCache = new Map();

/**
 * Tính cosine similarity giữa 2 vector.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Xóa cache của một vụ án khi vụ án được cập nhật hoặc phiên kết thúc.
 * @param {string} caseId
 */
export function clearCaseVectorCache(caseId) {
  if (caseId) caseVectorCache.delete(String(caseId));
  else caseVectorCache.clear();
}

/**
 * Lấy hoặc tính vector embeddings cho các câu trong hồ sơ vụ án.
 * @param {string} caseId
 * @param {string[]} uniqueSentences
 * @returns {Promise<Map<string, number[]>>} — Map từ text -> vector
 */
async function getOrComputeCaseVectors(caseId, uniqueSentences) {
  const key = String(caseId ?? 'ephemeral');
  let sentenceMap = caseVectorCache.get(key);

  if (!sentenceMap) {
    sentenceMap = new Map();
    caseVectorCache.set(key, sentenceMap);
  }

  // Tìm các câu chưa có embedding trong cache
  const missing = uniqueSentences.filter(s => !sentenceMap.has(s) && s.trim().length > 0);
  if (missing.length > 0) {
    const embeddings = await embedBatch(missing, 'passage');
    for (let i = 0; i < missing.length; i++) {
      if (embeddings[i]) {
        sentenceMap.set(missing[i], embeddings[i]);
      }
    }
  }

  return sentenceMap;
}

/**
 * Tính điểm tương đồng ngữ nghĩa (cosine similarity) giữa câu hỏi/lập luận và các câu trong hồ sơ.
 * @param {object} params
 * @param {object} params.courtCase — vụ án hiện tại
 * @param {string[]} params.sentences — danh sách câu cần chấm điểm
 * @param {string} params.queryText — câu hỏi hoặc lời phát biểu mới nhất của người học
 * @returns {Promise<Map<string, number>|null>} — Map text -> score (0.0 -> 1.0) hoặc null nếu không khả dụng
 */
export async function retrieveDossierSemanticScores({ courtCase, sentences, queryText, isTest = false }) {
  if (!queryText || !sentences?.length) return null;
  // Bỏ qua gọi embedding ra ngoài khi chạy unit test trừ khi có cờ EMBEDDING_TEST_REAL
  if (isTest || (process.env.NODE_ENV === 'test' && !process.env.EMBEDDING_TEST_REAL)) return null;

  try {
    const queryVector = await embed(queryText, 'query');
    if (!queryVector?.length) return null;

    const caseId = courtCase?._id ?? courtCase?.id ?? courtCase?.title;
    const vectorMap = await getOrComputeCaseVectors(caseId, sentences);

    const scores = new Map();
    for (const text of sentences) {
      const vec = vectorMap.get(text);
      if (vec) {
        const sim = cosineSimilarity(queryVector, vec);
        scores.set(text, Math.max(0, sim));
      }
    }
    return scores;
  } catch (error) {
    console.warn('[retrieveDossierSemanticScores] Fallback to keyword:', error?.message ?? error);
    return null;
  }
}
