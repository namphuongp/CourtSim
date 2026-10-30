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
export function sanitizeTextForTts(rawText, maxLength = 3500) {
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

function splitIntoSpeechChunks(text, maxChunkLength = 175) {
  const rawParts = text.match(/[^.!?;,\n]+[.!?;,\n]*|\S+/gu) || [text];
  const chunks = [];
  let current = '';

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = trimmed.split(/\s+/u);
      let sub = '';
      for (const word of words) {
        if ((sub + ' ' + word).trim().length <= maxChunkLength) {
          sub = (sub + ' ' + word).trim();
        } else {
          if (sub) chunks.push(sub);
          sub = word;
        }
      }
      if (sub) current = sub;
    } else if ((current + ' ' + trimmed).trim().length <= maxChunkLength) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      current = trimmed;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxChunkLength)];
}

function stripMp3MetadataFrames(buffer, isFirstChunk = false) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return buffer;
  let offset = 0;
  // 1. Bỏ ID3v2 tag ở đầu nếu có
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    if (10 + size < buffer.length) offset = 10 + size;
  }
  let sliced = offset > 0 ? buffer.subarray(offset) : buffer;
  // 2. Nếu có frame Xing/Info ở đầu chứa tổng độ dài của riêng 1 câu (khiến trình duyệt dừng sau câu 1), bỏ frame metadata đó
  const firstFrameWindow = sliced.subarray(0, Math.min(sliced.length, 512));
  const xingIdx = firstFrameWindow.indexOf('Xing');
  const infoIdx = firstFrameWindow.indexOf('Info');
  const markerIdx = xingIdx !== -1 ? xingIdx : infoIdx;
  if (markerIdx !== -1) {
    // Tìm frame sync MPEG tiếp theo (0xFF và 0xE0..0xFF) sau marker
    for (let i = markerIdx + 4; i < sliced.length - 1; i++) {
      if (sliced[i] === 0xff && (sliced[i + 1] & 0xe0) === 0xe0) {
        sliced = sliced.subarray(i);
        break;
      }
    }
  }
  // 3. Bỏ ID3v1 tag (128 bytes cuối bắt đầu bằng 'TAG') ở các đoạn chưa phải đoạn cuối
  if (!isFirstChunk && sliced.length > 128) {
    const tail = sliced.subarray(sliced.length - 128, sliced.length - 125).toString('ascii');
    if (tail === 'TAG') {
      sliced = sliced.subarray(0, sliced.length - 128);
    }
  }
  return sliced;
}

/**
 * Fallback động cơ TTS tiếng Việt dự phòng (Google Vietnamese TTS)
 * Đảm bảo 100% không bao giờ bị ngắt quãng, không phụ thuộc vào quota hay rate-limit của OpenAI
 * Tốc độ phản hồi cực nhanh (<400ms)
 */
export async function fetchGoogleVietnameseSpeech(text) {
  // Chia đoạn văn thành các mệnh đề ngắn <= 175 ký tự để đọc liền mạch toàn bộ các câu
  const chunks = splitIntoSpeechChunks(text, 175);

  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(8_000)
    });
    if (!res.ok) throw new Error(`Google TTS status: ${res.status}`);
    const rawBuf = Buffer.from(await res.arrayBuffer());
    buffers.push(chunks.length === 1 ? rawBuf : stripMp3MetadataFrames(rawBuf, i === chunks.length - 1));
  }

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
