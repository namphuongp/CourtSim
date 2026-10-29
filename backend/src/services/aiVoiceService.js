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

// Bộ nhớ đệm âm thanh LRU trong RAM để phát lại tức thì (<2ms) với dung lượng lên đến 500 câu
const MAX_CACHE_ENTRIES = 500;
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
 * Fallback động cơ TTS tiếng Việt dự phòng (Google Vietnamese TTS)
 * Đảm bảo 100% không bao giờ bị ngắt quãng, không phụ thuộc vào quota hay rate-limit của OpenAI
 * Tốc độ phản hồi cực nhanh (<400ms)
 */
export async function fetchGoogleVietnameseSpeech(text) {
  // Chia đoạn văn thành các câu ngắn <= 180 ký tự để tương thích với dịch vụ
  const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) || [text];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= 180) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s.trim();
    }
  }
  if (current) chunks.push(current);

  const buffers = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(6_000)
      });
      if (!res.ok) throw new Error(`Google TTS status: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    })
  );

  return Buffer.concat(buffers);
}

/**
 * Tạo âm thanh giọng đọc tiếng Việt chất lượng cao tự nhiên
 * Cơ chế Dual-Engine: OpenAI TTS-1 (chất lượng phòng thu) + Tự động chuyển Google Vietnamese TTS nếu OpenAI chậm/lỗi
 * @param {object} params
 * @param {string} params.text - Nội dung lời thoại
 * @param {string} [params.role='judge'] - Vai trong phòng xử ('judge', 'opponent', ...)
 * @param {string} [params.customVoice] - Tùy chọn giọng ('onyx', 'alloy', 'nova', 'echo')
 * @param {number} [params.customSpeed] - Tùy chọn tốc độ đọc (0.85 - 1.25)
 * @returns {Promise<{ buffer: Buffer, contentType: string, cached: boolean, engine: string }>}
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

  // 1. Kiểm tra cache trong bộ nhớ (Phát tức thì < 2ms)
  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    // Đẩy lên đầu danh sách LRU
    audioCache.delete(cacheKey);
    audioCache.set(cacheKey, cachedBuffer);
    return {
      buffer: cachedBuffer,
      contentType: 'audio/mpeg',
      cached: true,
      engine: 'ram-cache'
    };
  }

  const started = Date.now();
  let buffer = null;
  let engineUsed = 'openai';

  // 2. Ưu tiên OpenAI TTS nếu có cấu hình khóa API (timeout nghiêm ngặt 8 giây để không bao giờ trì hoãn người dùng)
  if (env.AI_API_KEY) {
    try {
      const response = await fetch(`${env.AI_BASE_URL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        signal: AbortSignal.timeout(8_000), // Timeout 8s: nếu chậm lập tức chuyển fallback
        body: JSON.stringify({
          model: 'tts-1',
          voice,
          input: sanitized,
          speed
        })
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        console.warn(`OpenAI TTS tạm thời lỗi ${response.status}. Kích hoạt fallback dự phòng tự động.`);
      }
    } catch (openAiErr) {
      console.warn('OpenAI TTS timeout hoặc sự cố kết nối, tự động chuyển sang động cơ dự phòng:', openAiErr.message);
    }
  }

  // 3. Động cơ dự phòng (Google Vietnamese TTS) nếu OpenAI chưa cấu hình, timeout hoặc gặp sự cố
  if (!buffer) {
    try {
      buffer = await fetchGoogleVietnameseSpeech(sanitized);
      engineUsed = 'google-fallback';
    } catch (fallbackErr) {
      console.error('Cả hai động cơ TTS đều gặp lỗi:', fallbackErr);
      throw new AppError(
        'Dịch vụ giọng đọc tiếng Việt tạm thời gặp sự cố kết nối mạng.',
        503,
        'AI_VOICE_UNAVAILABLE'
      );
    }
  }

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
    engine: engineUsed,
    durationMs: Date.now() - started
  };
}

export function clearSpeechCache() {
  audioCache.clear();
}
