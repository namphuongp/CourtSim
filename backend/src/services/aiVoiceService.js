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

const VIETNAMESE_LETTER_PHONETICS = Object.freeze({
  A: 'A',
  B: 'Bê',
  C: 'Xê',
  D: 'Dê',
  Đ: 'Đê',
  E: 'E',
  F: 'Ép',
  G: 'Gờ',
  H: 'Hắt',
  I: 'Y',
  J: 'Giây',
  K: 'Ca',
  L: 'Lờ',
  M: 'Mờ',
  N: 'Nờ',
  O: 'O',
  P: 'Pê',
  Q: 'Quy',
  R: 'Rờ',
  S: 'Ét',
  T: 'Tê',
  U: 'U',
  V: 'Vê',
  W: 'Vê kép',
  X: 'Ích',
  Y: 'Y',
  Z: 'Dét'
});

const ROMAN_TO_NUMBER = Object.freeze({
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
  IX: '9',
  X: '10'
});

/**
 * Chuẩn hóa ngữ âm và văn phong tố tụng tiếng Việt cho động cơ Text-to-Speech:
 * - Đọc tự nhiên ngày tháng năm (18/12/2015 -> ngày 18 tháng 12 năm 2015)
 * - Đọc số tiền, tiền tệ lớn (1.600.000.000 đồng -> 1 tỷ 600 triệu đồng)
 * - Đọc phần trăm (2% -> 2 phần trăm)
 * - Mở rộng mã bản án/quyết định (17/2026/HC-PT -> 17 năm 2026 hành chính phúc thẩm)
 * - Mở rộng viết tắt pháp lý (HĐXX -> Hội đồng xét xử, BLDS -> Bộ luật Dân sự...)
 * - Phiên âm chữ cái viết tắt tên riêng (ông Đ. -> ông Đê, ông L -> ông Lờ) để không bao giờ đọc sang tiếng Anh
 * - Thêm khoảng nghỉ tự nhiên cho điều luật và các mệnh đề
 */
export function normalizeVietnameseSpeechForTts(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return '';
  let res = rawText;

  // 1. Chuẩn hóa dấu ngoặc kép, dấu nháy và ký hiệu nối
  res = res.replace(/[„“""«»]/gu, '"');
  res = res.replace(/[’'']/gu, "'");
  res = res.replace(/\s*&\s*/gu, ' và ');
  res = res.replace(/(?<![\p{L}\p{N}])vs\.?(?![\p{L}\p{N}])/giu, 'đối với');

  // 2. Mở rộng ký hiệu mã bản án / quyết định / văn bản pháp luật có dấu gạch chéo trước khi xử lý ngày tháng
  const caseCodeSuffixes = [
    [/\/HC-PT(?![\p{L}\p{N}])/giu, ' hành chính phúc thẩm'],
    [/\/HC-ST(?![\p{L}\p{N}])/giu, ' hành chính sơ thẩm'],
    [/\/DS-PT(?![\p{L}\p{N}])/giu, ' dân sự phúc thẩm'],
    [/\/DS-ST(?![\p{L}\p{N}])/giu, ' dân sự sơ thẩm'],
    [/\/HS-PT(?![\p{L}\p{N}])/giu, ' hình sự phúc thẩm'],
    [/\/HS-ST(?![\p{L}\p{N}])/giu, ' hình sự sơ thẩm'],
    [/\/KDTM-PT(?![\p{L}\p{N}])/giu, ' kinh doanh thương mại phúc thẩm'],
    [/\/KDTM-ST(?![\p{L}\p{N}])/giu, ' kinh doanh thương mại sơ thẩm'],
    [/\/LĐ-PT(?![\p{L}\p{N}])/giu, ' lao động phúc thẩm'],
    [/\/LĐ-ST(?![\p{L}\p{N}])/giu, ' lao động sơ thẩm'],
    [/\/HNGĐ-PT(?![\p{L}\p{N}])/giu, ' hôn nhân gia đình phúc thẩm'],
    [/\/HNGĐ-ST(?![\p{L}\p{N}])/giu, ' hôn nhân gia đình sơ thẩm'],
    [/\/TLPT-HC(?![\p{L}\p{N}])/giu, ' thụ lý phúc thẩm hành chính'],
    [/\/TLST-HC(?![\p{L}\p{N}])/giu, ' thụ lý sơ thẩm hành chính'],
    [/\/TLPT-DS(?![\p{L}\p{N}])/giu, ' thụ lý phúc thẩm dân sự'],
    [/\/TLST-DS(?![\p{L}\p{N}])/giu, ' thụ lý sơ thẩm dân sự'],
    [/\/QĐPT-HC(?![\p{L}\p{N}])/giu, ' quyết định phúc thẩm hành chính'],
    [/\/QĐST-HC(?![\p{L}\p{N}])/giu, ' quyết định sơ thẩm hành chính'],
    [/\/QĐPT-DS(?![\p{L}\p{N}])/giu, ' quyết định phúc thẩm dân sự'],
    [/\/QĐST-DS(?![\p{L}\p{N}])/giu, ' quyết định sơ thẩm dân sự'],
    [/\/QH(\d{1,2})(?![\p{L}\p{N}])/giu, ' Quốc hội khóa $1'],
    [/\/NĐ-CP(?![\p{L}\p{N}])/giu, ' Nghị định Chính phủ'],
    [/\/NQ-HĐTP(?![\p{L}\p{N}])/giu, ' Nghị quyết Hội đồng Thẩm phán']
  ];
  for (const [pattern, replacement] of caseCodeSuffixes) {
    res = res.replace(pattern, replacement);
  }
  res = res.replace(/(số\s*:?\s*\d+)\/(\d{4})(?![\p{L}\p{N}])/giu, '$1 năm $2');

  // 3. Chuyển đổi ngày tháng dạng dd/mm/yyyy hoặc d/m/yyyy sang lời nói tự nhiên
  res = res.replace(/(?:ngày\s+)?(?<![\p{L}\p{N}])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\p{L}\p{N}])/giu, (match, d, m, y) => {
    return `ngày ${parseInt(d, 10)} tháng ${parseInt(m, 10)} năm ${y}`;
  });
  res = res.replace(/(?:tháng\s+)?(?<![\p{L}\p{N}])(\d{1,2})\/(\d{4})(?![\p{L}\p{N}])/giu, (match, m, y) => {
    return `tháng ${parseInt(m, 10)} năm ${y}`;
  });

  // 4. Chuẩn hóa số tiền có phân cách hàng nghìn (1.600.000.000 đồng, 500.000 VNĐ, 20.000.000 đ)
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

  // 5. Chuẩn hóa phần trăm và đơn vị đo lường: 2% -> 2 phần trăm, 100m2 -> 100 mét vuông
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*%/gu, (match, n) => {
    return `${n.replace('.', ' phẩy ').replace(',', ' phẩy ')} phần trăm`;
  });
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(?:m2|m²)(?![\p{L}\p{N}])/giu, '$1 mét vuông');
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(?:km2|km²)(?![\p{L}\p{N}])/giu, '$1 ki lô mét vuông');

  // 6. Chuyển số La Mã sau Giai đoạn / Phần / Mục / Chương sang số tự nhiên để không đọc thành chữ tiếng Anh (I, II, III)
  res = res.replace(/(?<![\p{L}\p{N}])([Gg]iai đoạn|[Pp]hần|[Mm]ục|[Cc]hương)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)(?![\p{L}\p{N}])/gu, (match, prefix, roman) => {
    return `${prefix} ${ROMAN_TO_NUMBER[roman] || roman}`;
  });

  // 7. Phiên âm tên viết tắt 1 chữ cái (ông Đ., Ông Hồ Thành L, Quận A, phường B, điểm b) sang âm chữ cái tiếng Việt chuẩn
  res = res.replace(/(?<![\p{L}\p{N}])([Ôô]ng|[Bb]à|[Aa]nh|[Cc]hị|[Cc]ụ)((?:\s+\p{Lu}\p{Ll}+){0,3})\s+([A-ZĐ])\.?(?!(?:\.\p{L}|\p{L}))/gu, (match, title, middle, letter) => {
    const phonetic = VIETNAMESE_LETTER_PHONETICS[letter.toUpperCase()] || letter;
    return `${title}${middle || ''} ${phonetic}`;
  });
  res = res.replace(/(?<![\p{L}\p{N}])([Qq]uận|[Hh]uyện|[Pp]hường|[Xx]ã|[Tt]hôn|[Ấấ]p|[Tt]ổ)\s+([A-ZĐ])\.?(?!(?:\.\p{L}|\p{L}))/gu, (match, loc, letter) => {
    const phonetic = VIETNAMESE_LETTER_PHONETICS[letter.toUpperCase()] || letter;
    return `${loc} ${phonetic}`;
  });
  res = res.replace(/(?<![\p{L}\p{N}])([Đđ]iểm)\s+([a-zđ])\)?(?![\p{L}\p{N}])/gu, (match, prefix, letter) => {
    const upper = letter.toUpperCase();
    const phonetic = upper === 'A' ? 'a' : upper === 'E' ? 'e' : (VIETNAMESE_LETTER_PHONETICS[upper] || letter).toLowerCase();
    return `${prefix} ${phonetic}`;
  });

  // 8. Mở rộng từ viết tắt tố tụng phổ biến
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
    [/(?<![\p{L}\p{N}])LTTHC(?![\p{L}\p{N}])/gu, 'Luật Tố tụng Hành chính'],
    [/(?<![\p{L}\p{N}])BLDS(?![\p{L}\p{N}])/gu, 'Bộ luật Dân sự'],
    [/(?<![\p{L}\p{N}])BLHS(?![\p{L}\p{N}])/gu, 'Bộ luật Hình sự'],
    [/(?<![\p{L}\p{N}])BLLĐ(?![\p{L}\p{N}])/gu, 'Bộ luật Lao động'],
    [/(?<![\p{L}\p{N}])NQ-HĐTP(?![\p{L}\p{N}])/giu, 'Nghị quyết Hội đồng Thẩm phán'],
    [/(?<![\p{L}\p{N}])HĐTP(?![\p{L}\p{N}])/giu, 'Hội đồng Thẩm phán'],
    [/(?<![\p{L}\p{N}])NĐ-CP(?![\p{L}\p{N}])/giu, 'Nghị định Chính phủ'],
    [/(?<![\p{L}\p{N}])TT-BTP(?![\p{L}\p{N}])/giu, 'Thông tư Bộ Tư pháp'],
    [/(?<![\p{L}\p{N}])UBND(?![\p{L}\p{N}])/gu, 'Ủy ban nhân dân'],
    [/(?<![\p{L}\p{N}])HĐND(?![\p{L}\p{N}])/gu, 'Hội đồng nhân dân'],
    [/(?<![\p{L}\p{N}])CCCD(?![\p{L}\p{N}])/gu, 'Căn cước công dân'],
    [/(?<![\p{L}\p{N}])CMND(?![\p{L}\p{N}])/gu, 'Chứng minh nhân dân'],
    [/(?<![\p{L}\p{N}])GCNQSDĐ(?![\p{L}\p{N}])/giu, 'Giấy chứng nhận quyền sử dụng đất'],
    [/(?<![\p{L}\p{N}])GCN(?![\p{L}\p{N}])/gu, 'Giấy chứng nhận'],
    [/(?<![\p{L}\p{N}])QSDĐ(?![\p{L}\p{N}])/giu, 'quyền sử dụng đất'],
    [/(?<![\p{L}\p{N}])BL[- ]?(\d+)(?![\p{L}\p{N}])/giu, 'bút lục số $1'],
    [/(?<![\p{L}\p{N}])K\.?\s*(\d+)(?![\p{L}\p{N}])/gu, 'Khoản $1'],
    [/(?<![\p{L}\p{N}])Đ\.?\s*(\d+)(?![\p{L}\p{N}])/gu, 'Điều $1']
  ];

  for (const [pattern, replacement] of legalAbbreviations) {
    res = res.replace(pattern, replacement);
  }

  // 9. Thêm khoảng nghỉ tự nhiên sau số điều luật
  res = res.replace(/Điều\s+(\d+)\s+(Bộ luật|Luật|Nghị định|Thông tư|Nghị quyết)/giu, 'Điều $1, $2');

  // 10. Chuyển các dấu ngoặc đơn giải thích thành dấu phẩy để giọng đọc liền mạch
  res = res.replace(/\(([^)]+)\)/gu, ', $1,');

  // 11. Dọn dẹp khoảng trắng và dấu phẩy thừa
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
function getCacheKey(role, voice, speed, text) {
  return crypto.createHash('sha256').update(`${role || 'default'}:${voice}:${speed}:${text}`).digest('hex');
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
 * Động cơ TTS tiếng Việt bản địa tốc độ cao (Google Vietnamese TTS - khóa cứng ngôn ngữ tl=vi)
 * - Khóa cứng ngôn ngữ Tiếng Việt (tl=vi), tuyệt đối không bao giờ nhảy sang giọng tiếng Anh
 * - Tải song song toàn bộ các mệnh đề (Promise.all) giúp thời gian phản hồi chỉ ~200ms - 380ms
 */
export async function fetchGoogleVietnameseSpeech(text) {
  const chunks = splitIntoSpeechChunks(text, 175);

  const buffers = await Promise.all(
    chunks.map(async (chunk, i) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(6_000)
      });
      if (!res.ok) throw new Error(`Google TTS status: ${res.status}`);
      const rawBuf = Buffer.from(await res.arrayBuffer());
      return chunks.length === 1 ? rawBuf : stripMp3MetadataFrames(rawBuf, i === chunks.length - 1);
    })
  );

  return Buffer.concat(buffers);
}

/**
 * Tạo âm thanh giọng đọc tiếng Việt chất lượng cao, tốc độ tức thì (<350ms) và thuần Việt 100%
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

  const cacheKey = getCacheKey(role, voice, speed, speechText);

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
  let engineUsed = 'google-vi';
  const preferOpenAi = process.env.AI_TTS_ENGINE?.trim().toLowerCase() === 'openai';

  // 2. Mặc định ưu tiên động cơ Tiếng Việt bản địa (tl=vi) tải song song siêu tốc (~250ms)
  // để không bao giờ bị trễ 3-5 giây hoặc bị đọc lẫn sang tiếng Anh như model đa ngữ của OpenAI
  if (!preferOpenAi) {
    try {
      buffer = await fetchGoogleVietnameseSpeech(speechText);
      engineUsed = 'google-vi';
    } catch (viErr) {
      console.warn('Google VI TTS gặp sự cố, chuyển sang động cơ dự phòng OpenAI:', viErr.message);
    }
  }

  // 3. Dự phòng sang OpenAI TTS (gpt-4o-mini-tts khóa hướng dẫn Tiếng Việt) nếu cần
  if (!buffer && env.AI_API_KEY) {
    const preferredModel = process.env.AI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
    try {
      const requestBody = {
        model: preferredModel,
        voice,
        input: speechText,
        speed
      };
      if (preferredModel === 'gpt-4o-mini-tts') {
        requestBody.instructions =
          'Luôn đọc hoàn toàn bằng tiếng Việt chuẩn, phát âm rõ ràng, tự nhiên, nghiêm túc như thẩm phán và luật sư Việt Nam tại phiên tòa. Tuyệt đối không đọc sang tiếng Anh.';
      }
      const response = await fetch(`${env.AI_BASE_URL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.AI_API_KEY}`
        },
        signal: AbortSignal.timeout(6_000),
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const ct = String(response.headers.get('content-type') || '').toLowerCase();
        const candidate = Buffer.from(await response.arrayBuffer());
        if (candidate.length >= 128 && !ct.includes('json') && !ct.includes('html') && !ct.includes('text/plain')) {
          buffer = candidate;
          engineUsed = 'openai';
        }
      }
    } catch (openAiErr) {
      console.warn('OpenAI TTS timeout hoặc sự cố kết nối:', openAiErr.message);
    }
  }

  // 4. Nếu cấu hình ưu tiên OpenAI nhưng OpenAI lỗi thì fallback về Google VI TTS
  if (!buffer && preferOpenAi) {
    try {
      buffer = await fetchGoogleVietnameseSpeech(speechText);
      engineUsed = 'google-vi';
    } catch (fallbackErr) {
      console.error('Cả hai động cơ TTS đều gặp lỗi:', fallbackErr);
    }
  }

  if (!buffer) {
    throw new AppError(
      'Dịch vụ giọng đọc tiếng Việt tạm thời gặp sự cố kết nối mạng.',
      503,
      'AI_VOICE_UNAVAILABLE'
    );
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
