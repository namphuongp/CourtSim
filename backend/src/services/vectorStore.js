// Wrapper Qdrant vector store — quản lý collections, upsert và search.
// Fallback: khi Qdrant không khả dụng, trả mảng rỗng để hệ thống dùng keyword search.

const QDRANT_URL = (process.env.QDRANT_URL?.trim() || 'http://localhost:6333').replace(/\/$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY?.trim() || '';
const QDRANT_TIMEOUT_MS = Number(process.env.QDRANT_TIMEOUT_MS ?? '10000');

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (QDRANT_API_KEY) h['api-key'] = QDRANT_API_KEY;
  return h;
}

async function qdrantFetch(path, options = {}) {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(QDRANT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Qdrant ${options.method ?? 'GET'} ${path}: ${response.status} ${text.slice(0, 200)}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? response.json() : null;
}

// --- Collection Management ---

/**
 * Kiểm tra collection có tồn tại không.
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function collectionExists(name) {
  try {
    await qdrantFetch(`/collections/${name}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tạo collection mới. Nếu đã tồn tại, bỏ qua.
 * @param {string} name
 * @param {number} vectorSize — kích thước vector (ví dụ 1024 cho e5-large, 1536 cho OpenAI)
 * @param {string} [distance='Cosine']
 */
export async function ensureCollection(name, vectorSize, distance = 'Cosine') {
  if (await collectionExists(name)) return;
  await qdrantFetch(`/collections/${name}`, {
    method: 'PUT',
    body: JSON.stringify({
      vectors: { size: vectorSize, distance },
      // Bật payload index cho các field filter phổ biến.
      optimizers_config: { indexing_threshold: 1000 },
    }),
  });
}

/**
 * Tạo payload index cho field.
 * @param {string} collection
 * @param {string} fieldName
 * @param {'keyword'|'integer'|'float'|'bool'|'text'} fieldType
 */
export async function createPayloadIndex(collection, fieldName, fieldType = 'keyword') {
  try {
    await qdrantFetch(`/collections/${collection}/index`, {
      method: 'PUT',
      body: JSON.stringify({ field_name: fieldName, field_schema: fieldType }),
    });
  } catch {
    // Index có thể đã tồn tại, bỏ qua lỗi.
  }
}

/**
 * Xóa collection.
 * @param {string} name
 */
export async function deleteCollection(name) {
  try {
    await qdrantFetch(`/collections/${name}`, { method: 'DELETE' });
  } catch {
    // Collection không tồn tại, bỏ qua.
  }
}

/**
 * Lấy thông tin collection.
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function collectionInfo(name) {
  try {
    const response = await qdrantFetch(`/collections/${name}`);
    return response?.result ?? null;
  } catch {
    return null;
  }
}

// --- Point Operations ---

/**
 * Upsert các points vào collection.
 * @param {string} collection
 * @param {Array<{id: string|number, vector: number[], payload: object}>} points
 */
export async function upsertPoints(collection, points) {
  if (!points.length) return;
  // Qdrant REST API giới hạn batch, chia ra nếu cần.
  const BATCH = 100;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    await qdrantFetch(`/collections/${collection}/points`, {
      method: 'PUT',
      body: JSON.stringify({ points: batch }),
      signal: AbortSignal.timeout(60_000), // Upsert có thể chậm hơn.
    });
  }
}

/**
 * Xóa points theo IDs.
 * @param {string} collection
 * @param {Array<string|number>} ids
 */
export async function deletePoints(collection, ids) {
  if (!ids.length) return;
  await qdrantFetch(`/collections/${collection}/points/delete`, {
    method: 'POST',
    body: JSON.stringify({ points: ids }),
  });
}

/**
 * Tìm kiếm vector gần nhất.
 * @param {string} collection
 * @param {object} options
 * @param {number[]} options.vector — vector truy vấn
 * @param {number} [options.limit=10] — số kết quả tối đa
 * @param {number} [options.scoreThreshold] — ngưỡng cosine similarity tối thiểu
 * @param {object} [options.filter] — Qdrant filter conditions
 * @param {boolean} [options.withPayload=true]
 * @returns {Promise<Array<{id: string|number, score: number, payload: object}>>}
 */
export async function search(collection, { vector, limit = 10, scoreThreshold, filter, withPayload = true } = {}) {
  const body = {
    vector,
    limit,
    with_payload: withPayload,
    ...(scoreThreshold != null ? { score_threshold: scoreThreshold } : {}),
    ...(filter ? { filter } : {}),
  };
  const response = await qdrantFetch(`/collections/${collection}/points/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response?.result ?? [];
}

/**
 * Đếm số points trong collection.
 * @param {string} collection
 * @param {object} [filter]
 * @returns {Promise<number>}
 */
export async function countPoints(collection, filter) {
  const response = await qdrantFetch(`/collections/${collection}/points/count`, {
    method: 'POST',
    body: JSON.stringify({ ...(filter ? { filter } : {}), exact: true }),
  });
  return response?.result?.count ?? 0;
}

// --- Utility ---

/**
 * Kiểm tra Qdrant có khả dụng không.
 * @returns {Promise<boolean>}
 */
export async function isQdrantAvailable() {
  try {
    await qdrantFetch('/collections', { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Trả về cấu hình Qdrant hiện tại (không bao gồm API key).
 */
export function qdrantConfig() {
  return {
    url: QDRANT_URL,
    hasApiKey: Boolean(QDRANT_API_KEY),
    timeoutMs: QDRANT_TIMEOUT_MS,
  };
}
