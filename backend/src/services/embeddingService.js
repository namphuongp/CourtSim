// Dịch vụ nhúng (embedding) — hỗ trợ Ollama local, OpenAI API hoặc fastembed.
// Không lưu nội dung người dùng; chỉ gửi từ khóa pháp luật hoặc nội dung điều khoản công khai.

const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER?.trim() || (geminiKey ? 'gemini' : 'openai');
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL?.trim() || (geminiKey ? 'gemini-embedding-001' : 'text-embedding-3-small');
const EMBEDDING_BASE_URL = (process.env.EMBEDDING_BASE_URL?.trim() || (geminiKey ? 'https://generativelanguage.googleapis.com/v1beta/openai' : '')).replace(/\/$/, '');
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY?.trim() || (geminiKey || process.env.OPENAI_API_KEY?.trim() || '');
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? '0') || 0;
const MAX_BATCH_SIZE = 64;

// Prefix hướng dẫn cho e5 models — cải thiện chất lượng embedding đáng kể.
const E5_QUERY_PREFIX = 'query: ';
const E5_PASSAGE_PREFIX = 'passage: ';
const isE5Model = () => /\be5\b/i.test(EMBEDDING_MODEL);

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
  const base = EMBEDDING_BASE_URL || 'http://127.0.0.1:11434';
  const response = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
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
  const base = EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
  const response = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(EMBEDDING_API_KEY ? { Authorization: `Bearer ${EMBEDDING_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      ...(EMBEDDING_DIMENSIONS ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
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
  switch (EMBEDDING_PROVIDER) {
    case 'ollama': return embedOllama(texts);
    case 'gemini':
    case 'openai': return embedOpenAI(texts);
    default: throw new Error(`Embedding provider "${EMBEDDING_PROVIDER}" không được hỗ trợ. Dùng "gemini", "ollama" hoặc "openai".`);
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
  return {
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    baseUrl: EMBEDDING_BASE_URL || (EMBEDDING_PROVIDER === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'),
    dimensions: EMBEDDING_DIMENSIONS || 'auto',
    isE5: isE5Model(),
  };
}
