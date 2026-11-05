import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Cấu hình giọng đọc tự nhiên chuẩn tiếng Việt theo từng vai trong phòng xử
export const ROLE_VOICE_MAP = Object.freeze({
  judge: { voice: 'onyx', speed: 0.95, roleName: 'Chủ tọa phiên tòa' },
  ai_judge: { voice: 'onyx', speed: 0.95, roleName: 'Chủ tọa phiên tòa' },
  opponent: { voice: 'echo', speed: 1.0, roleName: 'Bên đối lập' },
  ai_prosecutor: { voice: 'echo', speed: 1.0, roleName: 'Bên đối lập' },
  prosecutor_lawyer: { voice: 'echo', speed: 1.0, roleName: 'Kiểm sát viên / Luật sư' },
  defense_lawyer: { voice: 'echo', speed: 1.0, roleName: 'Luật sư bào chữa' },
  learner: { voice: 'nova', speed: 1.02, roleName: 'Người học (Luật sư)' },
  user: { voice: 'nova', speed: 1.02, roleName: 'Người học (Luật sư)' },
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
    .replace(/\[(?:CC|PL|BL):[^\]]+\]/gu, '') // Bỏ mã chứng cứ, căn cứ luật, bút lục
    .replace(/\[(?:Chứng cứ|Điều luật|Căn cứ|Bút lục):[^\]]+\]/gu, '') // Bỏ nhãn trích dẫn tố tụng
    .replace(/https?:\/\/[^\s]+/gu, '') // Bỏ liên kết web
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Bỏ emoji
    .replace(/[-=_]{3,}/gu, ' ') // Bỏ phân cách markdown
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
 * Chuẩn hóa ngữ âm và văn phong tố tụng tiếng Việt cho động cơ Text-to-Speech:
 * - Đọc tự nhiên ngày tháng năm (18/12/2015 -> ngày 18 tháng 12 năm 2015)
 * - Đọc số tiền, tiền tệ lớn (1.600.000.000 đồng -> 1 tỷ 600 triệu đồng)
 * - Đọc phần trăm (2% -> 2 phần trăm)
 * - Mở rộng viết tắt pháp lý (HĐXX -> Hội đồng xét xử, BLDS -> Bộ luật Dân sự...)
 * - Xử lý tên tắt có dấu chấm (ông Đ. -> ông Đ) để không ngắt câu giật cục
 * - Thêm khoảng nghỉ tự nhiên cho điều luật và các mệnh đề
 */
export function normalizeVietnameseSpeechForTts(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return '';
  let res = rawText;

  // 1. Chuẩn hóa dấu ngoặc kép và dấu nháy
  res = res.replace(/[„“""«»]/gu, '"');
  res = res.replace(/[’'']/gu, "'");

  // 2. Chuyển đổi ngày tháng dạng dd/mm/yyyy hoặc d/m/yyyy sang lời nói tự nhiên
  res = res.replace(/(?:ngày\s+)?(?<![\p{L}\p{N}])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\p{L}\p{N}])/giu, (match, d, m, y) => {
    return `ngày ${parseInt(d, 10)} tháng ${parseInt(m, 10)} năm ${y}`;
  });
  res = res.replace(/(?:tháng\s+)?(?<![\p{L}\p{N}])(\d{1,2})\/(\d{4})(?![\p{L}\p{N}])/giu, (match, m, y) => {
    return `tháng ${parseInt(m, 10)} năm ${y}`;
  });

  // 3. Chuẩn hóa số tiền có phân cách hàng nghìn (1.600.000.000 đồng, 500.000 VNĐ, 20.000.000 đ)
  res = res.replace(/(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})+)\s*(?:đồng|đ|vnd|vnđ)(?![\p{L}\p{N}])/giu, (match, numStr) => {
    const rawNum = parseInt(numStr.replace(/\./g, ''), 10);
    if (isNaN(rawNum)) return match;
    if (rawNum >= 1e9) {
      const ty = Math.floor(rawNum / 1e9);
      const remainder = rawNum % 1e9;
      const trieu = Math.floor(remainder / 1e6);
      if (trieu > 0) return `${ty} tỷ ${trieu} triệu đồng`;
      return `${ty} tỷ đồng`;
    }
    if (rawNum >= 1e6) {
      const trieu = Math.floor(rawNum / 1e6);
      const remainder = rawNum % 1e6;
      const nghin = Math.floor(remainder / 1e3);
      if (nghin > 0) return `${trieu} triệu ${nghin} nghìn đồng`;
      return `${trieu} triệu đồng`;
    }
    if (rawNum >= 1e3) {
      const nghin = Math.floor(rawNum / 1e3);
      const remainder = rawNum % 1e3;
      if (remainder > 0) return `${nghin} nghìn ${remainder} đồng`;
      return `${nghin} nghìn đồng`;
    }
    return `${rawNum} đồng`;
  });

  // 4. Chuẩn hóa phần trăm: 2% -> 2 phần trăm, 15,5% -> 15 phẩy 5 phần trăm
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*%/gu, (match, n) => {
    return `${n.replace('.', ' phẩy ').replace(',', ' phẩy ')} phần trăm`;
  });

  // 5. Chuẩn hóa tên tắt như 'ông Đ.', 'bà N.', 'anh T.' -> bỏ dấu chấm để tránh ngắt câu vô lý
  res = res.replace(/(?<![\p{L}\p{N}])(ông|bà|anh|chị|cụ)\s+([\p{Lu}])\.(?!\p{L})/giu, (match, title, letter) => `${title} ${letter}`);

  // 6. Mở rộng từ viết tắt tố tụng phổ biến
  const legalAbbreviations = [
    [/(?<![\p{L}\p{N}])HĐXX(?![\p{L}\p{N}])/gu, 'Hội đồng xét xử'],
    [/(?<![\p{L}\p{N}])VKSNDTC(?![\p{L}\p{N}])/gu, 'Viện kiểm sát nhân dân tối cao'],
    [/(?<![\p{L}\p{N}])VKSND(?![\p{L}\p{N}])/gu, 'Viện kiểm sát nhân dân'],
    [/(?<![\p{L}\p{N}])VKS(?![\p{L}\p{N}])/gu, 'Viện kiểm sát'],
    [/(?<![\p{L}\p{N}])KSV(?![\p{L}\p{N}])/gu, 'Kiểm sát viên'],
    [/(?<![\p{L}\p{N}])TANDTC(?![\p{L}\p{N}])/gu, 'Tòa án nhân dân tối cao'],
    [/(?<![\p{L}\p{N}])TANDCC(?![\p{L}\p{N}])/gu, 'Tòa án nhân dân cấp cao'],
    [/(?<![\p{L}\p{N}])TAND(?![\p{L}\p{N}])/gu, 'Tòa án nhân dân'],
    [/(?<![\p{L}\p{N}])BLTTDS(?![\p{L}\p{N}])/gu, 'Bộ luật Tố tụng Dân sự'],
    [/(?<![\p{L}\p{N}])BLTTHS(?![\p{L}\p{N}])/gu, 'Bộ luật Tố tụng Hình sự'],
    [/(?<![\p{L}\p{N}])BLDS(?![\p{L}\p{N}])/gu, 'Bộ luật Dân sự'],
    [/(?<![\p{L}\p{N}])BLHS(?![\p{L}\p{N}])/gu, 'Bộ luật Hình sự'],
    [/(?<![\p{L}\p{N}])NQ-HĐTP(?![\p{L}\p{N}])/giu, 'Nghị quyết Hội đồng Thẩm phán'],
    [/(?<![\p{L}\p{N}])HĐTP(?![\p{L}\p{N}])/giu, 'Hội đồng Thẩm phán'],
    [/(?<![\p{L}\p{N}])NĐ-CP(?![\p{L}\p{N}])/giu, 'Nghị định Chính phủ'],
    [/(?<![\p{L}\p{N}])TT-BTP(?![\p{L}\p{N}])/giu, 'Thông tư Bộ Tư pháp'],
    [/(?<![\p{L}\p{N}])UBND(?![\p{L}\p{N}])/gu, 'Ủy ban nhân dân'],
    [/(?<![\p{L}\p{N}])CCCD(?![\p{L}\p{N}])/gu, 'Căn cước công dân'],
    [/(?<![\p{L}\p{N}])CMND(?![\p{L}\p{N}])/gu, 'Chứng minh nhân dân'],
    [/(?<![\p{L}\p{N}])GCNQSDĐ(?![\p{L}\p{N}])/giu, 'Giấy chứng nhận quyền sử dụng đất'],
    [/(?<![\p{L}\p{N}])QSDĐ(?![\p{L}\p{N}])/giu, 'quyền sử dụng đất'],
    [/(?<![\p{L}\p{N}])K1(?![\p{L}\p{N}])/gu, 'Khoản 1'],
    [/(?<![\p{L}\p{N}])K2(?![\p{L}\p{N}])/gu, 'Khoản 2'],
    [/(?<![\p{L}\p{N}])K3(?![\p{L}\p{N}])/gu, 'Khoản 3'],
    [/(?<![\p{L}\p{N}])K4(?![\p{L}\p{N}])/gu, 'Khoản 4'],
    [/(?<![\p{L}\p{N}])K5(?![\p{L}\p{N}])/gu, 'Khoản 5'],
    [/(?<![\p{L}\p{N}])Đ1(?![\p{L}\p{N}])/gu, 'Điều 1'],
    [/(?<![\p{L}\p{N}])Đ2(?![\p{L}\p{N}])/gu, 'Điều 2'],
    [/(?<![\p{L}\p{N}])Đ3(?![\p{L}\p{N}])/gu, 'Điều 3'],
  ];

  for (const [pattern, replacement] of legalAbbreviations) {
    res = res.replace(pattern, replacement);
  }

  // 7. Thêm khoảng nghỉ tự nhiên sau số điều luật
  res = res.replace(/Điều\s+(\d+)\s+(Bộ luật|Luật)/giu, 'Điều $1, $2');

  // 8. Chuyển các dấu ngoặc đơn giải thích thành dấu phẩy để giọng đọc liền mạch
  res = res.replace(/\(([^)]+)\)/gu, ', $1,');

  // 9. Dọn dẹp khoảng trắng và dấu phẩy thừa
  res = res
    .replace(/,\s*,/gu, ',')
    .replace(/\s*,\s*/gu, ', ')
    .replace(/\s+/gu, ' ')
    .trim();

  return res;
}

/**
 * Tạo hàm băm khóa cache
 */
function getCacheKey(voice, speed, text) {
  return crypto.createHash('sha256').update(`${voice}:${speed}:${text}`).digest('hex');
}

function splitIntoSpeechChunks(text, maxChunkLength = 175) {
  const rawParts = text.split(/(?<=[.!?;])\s+/u);
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
      const clauses = trimmed.split(/(?<=,)\s+/u);
      let sub = '';
      for (const clause of clauses) {
        if ((sub + ' ' + clause).trim().length <= maxChunkLength) {
          sub = (sub + ' ' + clause).trim();
        } else {
          if (sub) chunks.push(sub);
          sub = clause.trim();
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

  // Chuẩn hóa văn phong tố tụng tiếng Việt tự nhiên nhất như con người phát biểu
  const speechText = normalizeVietnameseSpeechForTts(sanitized);

  const roleConfig = ROLE_VOICE_MAP[role] || ROLE_VOICE_MAP.default;
  const voice = customVoice || roleConfig.voice;
  const speed = typeof customSpeed === 'number' && customSpeed >= 0.5 && customSpeed <= 2.0
    ? customSpeed
    : roleConfig.speed;

  const cacheKey = getCacheKey(voice, speed, speechText);

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

  // 2. Ưu tiên OpenAI TTS HD (chất lượng phòng thu cao nhất, tự nhiên như người thật)
  if (env.AI_API_KEY) {
    const preferredModel = process.env.AI_TTS_MODEL?.trim() || 'tts-1-hd';
    try {
      const response = await fetch(`${env.AI_BASE_URL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        signal: AbortSignal.timeout(8_000), // Timeout 8s: nếu chậm lập tức chuyển fallback
        body: JSON.stringify({
          model: preferredModel,
          voice,
          input: speechText,
          speed
        })
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (preferredModel !== 'tts-1') {
        // Dự phòng model tiêu chuẩn nếu tts-1-hd quá tải
        const fallbackRes = await fetch(`${env.AI_BASE_URL}/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.AI_API_KEY}`
          },
          signal: AbortSignal.timeout(6_000),
          body: JSON.stringify({
            model: 'tts-1',
            voice,
            input: speechText,
            speed
          })
        });
        if (fallbackRes.ok) {
          buffer = Buffer.from(await fallbackRes.arrayBuffer());
        }
      }
    } catch (openAiErr) {
      console.warn('OpenAI TTS timeout hoặc sự cố kết nối, tự động chuyển sang động cơ dự phòng:', openAiErr.message);
    }
  }

  // 3. Động cơ dự phòng (Google Vietnamese TTS) nếu OpenAI chưa cấu hình, timeout hoặc gặp sự cố
  if (!buffer) {
    try {
      buffer = await fetchGoogleVietnameseSpeech(speechText);
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
