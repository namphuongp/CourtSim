import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Cấu hình giọng đọc tự nhiên chuẩn tiếng Việt theo từng vai trong phòng xử
export const ROLE_VOICE_MAP = Object.freeze({
  judge: { voice: 'onyx', speed: 0.95, roleName: 'Chủ tọa phiên tòa' },
  ai_judge: { voice: 'onyx', speed: 0.95, roleName: 'Chủ tọa phiên tòa' },
  opponent: { voice: 'alloy', speed: 1.0, roleName: 'Bên đối lập' },
  ai_prosecutor: { voice: 'alloy', speed: 1.0, roleName: 'Bên đối lập' },
  prosecutor_lawyer: { voice: 'alloy', speed: 1.0, roleName: 'Kiểm sát viên / Luật sư' },
  defense_lawyer: { voice: 'alloy', speed: 1.0, roleName: 'Luật sư bào chữa' },
  default: { voice: 'alloy', speed: 1.0, roleName: 'Người tham gia phiên tòa' }
});

// Bộ nhớ đệm âm thanh LRU trong RAM để phát lại tức thì (<2ms) không tốn thêm chi phí/thời gian gọi AI
const MAX_CACHE_ENTRIES = 200;
const audioCache = new Map();

/**
 * Làm sạch và chuẩn hóa văn bản trước khi đưa vào Text-To-Speech
 * Loại bỏ thẻ HTML, markdown, mã trích dẫn [CC:], [PL:], URL
 */
export function sanitizeTextForTts(rawText, maxLength = 1500) {
  if (typeof rawText !== 'string') return '';
  let cleaned = rawText
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1') // Giữ lại chữ của markdown link
    .replace(/<[^>]+>/gu, '') // Bỏ thẻ HTML
    .replace(/\[(?:CC|PL):[^\]]+\]/gu, '') // Bỏ mã chứng cứ, căn cứ luật
    .replace(/\[(?:Chứng cứ|Điều luật):[^\]]+\]/gu, '')
    .replace(/https?:\/\/[^\s]+/gu, '') // Bỏ liên kết web
    .replace(/[#*`_~]/gu, '') // Bỏ ký tự markdown
    .replace(/\s+/gu, ' ')
    .trim();

  if (cleaned.length > maxLength) {
    // Cắt tại dấu chấm/dấu câu gần nhất để câu nói trọn vẹn
    const truncated = cleaned.slice(0, maxLength);
    const lastPunctuation = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('; ')
    );
    if (lastPunctuation > maxLength * 0.7) {
      cleaned = truncated.slice(0, lastPunctuation + 1).trim();
    } else {
      cleaned = truncated.trim();
    }
  }

  return cleaned;
}

/**
 * Tạo hàm băm khóa cache
 */
function getCacheKey(voice, speed, text) {
  return crypto.createHash('sha256').update(`${voice}:${speed}:${text}`).digest('hex');
}

/**
 * Tạo âm thanh giọng đọc tiếng Việt chất lượng cao tự nhiên từ OpenAI TTS
 * @param {object} params
 * @param {string} params.text - Nội dung lời thoại
 * @param {string} [params.role='judge'] - Vai trong phòng xử ('judge', 'opponent', ...)
 * @param {string} [params.customVoice] - Tùy chọn giọng ('onyx', 'alloy', 'nova', 'echo')
 * @param {number} [params.customSpeed] - Tùy chọn tốc độ đọc (0.85 - 1.25)
 * @returns {Promise<{ buffer: Buffer, contentType: string, cached: boolean }>}
 */
export async function generateCourtroomSpeech({ text, role = 'judge', customVoice, customSpeed }) {
  const sanitized = sanitizeTextForTts(text);
  if (!sanitized) {
    throw new AppError('Nội dung lời thoại không được để trống.', 400, 'EMPTY_SPEECH_TEXT');
  }

  const roleConfig = ROLE_VOICE_MAP[role] || ROLE_VOICE_MAP.default;
  const voice = customVoice || roleConfig.voice;
  const speed = typeof customSpeed === 'number' && customSpeed >= 0.5 && customSpeed <= 2.0
    ? customSpeed
    : roleConfig.speed;

  const cacheKey = getCacheKey(voice, speed, sanitized);

  // 1. Kiểm tra cache trong bộ nhớ
  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    // Đẩy lên đầu danh sách LRU
    audioCache.delete(cacheKey);
    audioCache.set(cacheKey, cachedBuffer);
    return {
      buffer: cachedBuffer,
      contentType: 'audio/mpeg',
      cached: true
    };
  }

  // 2. Kiểm tra cấu hình AI
  if (!env.AI_API_KEY) {
    throw new AppError('Dịch vụ giọng đọc AI chưa được cấu hình khóa API.', 503, 'AI_VOICE_NOT_CONFIGURED');
  }

  // 3. Gọi dịch vụ OpenAI Audio Speech API
  const started = Date.now();
  let response;
  try {
    response = await fetch(`${env.AI_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_API_KEY}`
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: sanitized,
        speed
      })
    });
  } catch (err) {
    console.error('Lỗi kết nối OpenAI TTS:', err);
    throw new AppError(
      err.name === 'TimeoutError'
        ? 'Dịch vụ giọng đọc AI phản hồi quá thời gian chờ.'
        : 'Không thể kết nối đến máy chủ giọng đọc AI.',
      503,
      'AI_VOICE_NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      errorDetail = await response.text();
    } catch { /* Bỏ qua */ }
    console.error(`OpenAI TTS thất bại HTTP ${response.status}:`, errorDetail);
    throw new AppError(
      'Dịch vụ giọng đọc AI tạm thời gặp lỗi khi tạo âm thanh tiếng Việt.',
      response.status === 429 ? 429 : 502,
      response.status === 429 ? 'AI_VOICE_RATE_LIMIT' : 'AI_VOICE_PROVIDER_ERROR'
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 4. Lưu vào LRU Cache
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) audioCache.delete(oldestKey);
  }
  audioCache.set(cacheKey, buffer);

  return {
    buffer,
    contentType: 'audio/mpeg',
    cached: false,
    durationMs: Date.now() - started
  };
}

export function clearSpeechCache() {
  audioCache.clear();
}
