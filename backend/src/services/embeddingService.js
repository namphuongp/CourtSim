// Dịch vụ nhúng (embedding) — hỗ trợ Ollama local, OpenAI API hoặc fastembed.
// Không lưu nội dung người dùng; chỉ gửi từ khóa pháp luật hoặc nội dung điều khoản công khai.

import { env } from '../config/env.js';

const getProvider = () => process.env.EMBEDDING_PROVIDER?.trim() || env.EMBEDDING_PROVIDER || 'openai';
const getModel = () => process.env.EMBEDDING_MODEL?.trim() || env.EMBEDDING_MODEL || 'text-embedding-3-small';
const getBaseUrl = () => (process.env.EMBEDDING_BASE_URL?.trim() || env.EMBEDDING_BASE_URL || '').replace(/\/$/, '');
const getApiKey = () => process.env.EMBEDDING_API_KEY?.trim() || env.EMBEDDING_API_KEY || env.AI_API_KEY || '';
const getDimensions = () => Number(process.env.EMBEDDING_DIMENSIONS ?? '0') || 0;
const MAX_BATCH_SIZE = 64;

// Prefix hướng dẫn cho e5 models — cải thiện chất lượng embedding đáng kể.
const E5_QUERY_PREFIX = 'query: ';
const E5_PASSAGE_PREFIX = 'passage: ';
const isE5Model = () => /\be5\b/i.test(getModel());

/**
 * Thêm prefix phù hợp cho e5 models.
 * @param {'query'|'passage'} type - 'query' cho câu hỏi, 'passage' cho tài liệu
 * @param {string} text
 */
function prepareText(type, text) {
  if (!isE5Model()) return text;
  return type === 'query' ? E5_QUERY_PREFIX + text : E5_PASSAGE_PREFIX + text;
}

/**
 * Gọi Ollama embedding API.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedOllama(texts) {
  const base = getBaseUrl() || 'http://127.0.0.1:11434';
  const response = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: getModel(), input: texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Ollama embedding failed: ${response.status}`);
  const data = await response.json();
  return data.embeddings;
}

/**
 * Gọi OpenAI-compatible embedding API.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedOpenAI(texts) {
  const base = getBaseUrl() || 'https://api.openai.com/v1';
  const apiKey = getApiKey();
  const dimensions = getDimensions();
  const response = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: getModel(),
      input: texts,
      ...(dimensions ? { dimensions } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenAI embedding failed: ${response.status}`);
  const data = await response.json();
  return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
}

/**
 * Gọi embedding provider theo cấu hình.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function callProvider(texts) {
  const provider = getProvider();
  switch (provider) {
    case 'ollama': return embedOllama(texts);
    case 'openai': return embedOpenAI(texts);
    default: throw new Error(`Embedding provider "${provider}" không được hỗ trợ. Dùng "openai" hoặc "ollama".`);
  }
}

/**
 * Nhúng nhiều đoạn văn bản, tự động chia batch.
 * @param {string[]} texts — danh sách text cần nhúng
 * @param {'query'|'passage'} [type='passage'] — loại text (query hoặc passage)
 * @returns {Promise<number[][]>} — mảng vector tương ứng
 */
export async function embedBatch(texts, type = 'passage') {
  if (!texts.length) return [];
  const prepared = texts.map(text => prepareText(type, text));
  const results = [];
  for (let i = 0; i < prepared.length; i += MAX_BATCH_SIZE) {
    const batch = prepared.slice(i, i + MAX_BATCH_SIZE);
    const embeddings = await callProvider(batch);
    results.push(...embeddings);
  }
  return results;
}

/**
 * Nhúng một đoạn văn bản.
 * @param {string} text
 * @param {'query'|'passage'} [type='passage']
 * @returns {Promise<number[]>}
 */
export async function embed(text, type = 'passage') {
  const [embedding] = await embedBatch([text], type);
  return embedding;
}

/**
 * Kiểm tra dịch vụ embedding có khả dụng không.
 * @returns {Promise<boolean>}
 */
export async function isEmbeddingAvailable() {
  try {
    const result = await embed('kiểm tra kết nối', 'query');
    return Array.isArray(result) && result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Trả về metadata cấu hình embedding hiện tại.
 */
export function embeddingConfig() {
  const provider = getProvider();
  return {
    provider,
    model: getModel(),
    baseUrl: getBaseUrl() || (provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'),
    dimensions: getDimensions() || 'auto',
    isE5: isE5Model(),
  };
}
