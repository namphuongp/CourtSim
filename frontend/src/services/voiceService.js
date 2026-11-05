// Dịch vụ Nhận dạng giọng nói (Speech-to-Text) và Phát âm thanh (Text-to-Speech)
// Hỗ trợ OpenAI TTS tiếng Việt chất lượng cao siêu tự nhiên và Web Speech API
import api from './api';

/**
 * Kiểm tra trình duyệt có hỗ trợ Web Speech Recognition hay không.
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Kiểm tra trình duyệt có hỗ trợ Web Speech Synthesis (đọc văn bản) hay không.
 */
export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return typeof Audio !== 'undefined' || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
}

/**
 * Tạo bộ lắng nghe giọng nói với cơ chế TỰ ĐỘNG DUY TRÌ (Keep-Alive) vĩnh viễn không bị ngắt.
 * @param {object} options
 * @param {function} options.onTranscript - Callback nhận { text, isFinal }
 * @param {function} [options.onError] - Callback khi có lỗi (ví dụ chưa cấp quyền micro)
 * @param {function} [options.onListeningChange] - Callback khi trạng thái nghe thay đổi (true/false)
 * @param {string} [options.lang='vi-VN'] - Ngôn ngữ nhận dạng (mặc định tiếng Việt)
 */
export function createSpeechRecognizer({
  onTranscript,
  onError,
  onListeningChange,
  lang = 'vi-VN',
}) {
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  if (!SpeechRecognition) {
    return {
      start: () => onError?.('Trình duyệt chưa hỗ trợ nhận dạng giọng nói trực tiếp. Hãy sử dụng Google Chrome, Cốc Cốc hoặc Microsoft Edge.'),
      stop: () => {},
      abort: () => {},
      isListening: () => false,
      supported: false,
    };
  }

  let recognition = null;
  let isListeningState = false;
  let shouldBeListening = false;
  let restartTimeout = null;
  let pendingInterim = '';
  let lastFinalResultIndex = -1;
  let lastEmittedFinalText = '';
  let lastEmittedFinalTime = 0;

  function setListening(val) {
    if (isListeningState !== val) {
      isListeningState = val;
      onListeningChange?.(val);
    }
  }

  function emitFinal(text) {
    const clean = text?.trim();
    if (!clean) return;
    const now = Date.now();
    // Chặn duplicate: Nếu cùng 1 câu được phát liên tiếp trong 2.5 giây thì bỏ qua
    if (
      clean.toLowerCase() === lastEmittedFinalText.toLowerCase() &&
      now - lastEmittedFinalTime < 2500
    ) {
      return;
    }
    lastEmittedFinalText = clean;
    lastEmittedFinalTime = now;
    pendingInterim = '';
    onTranscript?.({ text: clean, isFinal: true });
  }

  function flushPendingInterim() {
    if (!pendingInterim.trim()) return;
    const textToFlush = pendingInterim.trim();
    pendingInterim = '';
    emitFinal(textToFlush);
  }

  function initRecognizer() {
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch { /* Bỏ qua lỗi dọn dẹp */ }
    }

    lastFinalResultIndex = -1;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Chỉ xử lý các kết quả mới chưa từng được chốt isFinal để tránh lặp lại kết quả trước
      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        const transcriptText = item[0]?.transcript ?? '';
        if (item.isFinal) {
          if (i > lastFinalResultIndex) {
            finalTranscript += (finalTranscript ? ' ' : '') + transcriptText;
            lastFinalResultIndex = i;
          }
        } else {
          interimTranscript += (interimTranscript ? ' ' : '') + transcriptText;
        }
      }

      if (finalTranscript.trim()) {
        emitFinal(finalTranscript);
      }
      if (interimTranscript.trim()) {
        pendingInterim = interimTranscript.trim();
        onTranscript?.({ text: interimTranscript.trim(), isFinal: false });
      }
    };

    recognition.onerror = (event) => {
      // no-speech xảy ra khi người dùng im lặng trong vài giây: KHÔNG coi là lỗi nghiêm trọng, Chrome sẽ fire onend và keep-alive sẽ tự restart
      if (event.error === 'no-speech') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldBeListening = false;
        setListening(false);
        onError?.('Chưa cấp quyền truy cập Micro. Vui lòng bấm vào biểu tượng Micro/Ổ khoá trên thanh địa chỉ trình duyệt (bên trái URL) để cấp quyền.');
        return;
      }

      if (event.error === 'audio-capture') {
        shouldBeListening = false;
        setListening(false);
        onError?.('Không tìm thấy thiết bị thu âm Micro hoặc micro đang bị ứng dụng khác chiếm giữ.');
        return;
      }

      if (event.error === 'network' || event.error === 'aborted') {
        return;
      }
    };

    recognition.onend = () => {
      // Nếu người dùng đã chủ động bấm dừng thu âm, chỉ flush interim nếu còn sót lại và chưa được phát
      if (!shouldBeListening) {
        flushPendingInterim();
        setListening(false);
        return;
      }

      // Cơ chế Keep-Alive vĩnh viễn: Nếu người dùng chưa bấm dừng, tự động khởi động lại ngay
      clearTimeout(restartTimeout);
      restartTimeout = setTimeout(() => {
        if (shouldBeListening) {
          initRecognizer();
          try {
            recognition.start();
          } catch {
            restartTimeout = setTimeout(() => {
              if (shouldBeListening) {
                try { recognition.start(); } catch { /* Bỏ qua */ }
              }
            }, 200);
          }
        }
      }, 100);
    };
  }

  return {
    supported: true,
    start() {
      shouldBeListening = true;
      pendingInterim = '';
      lastFinalResultIndex = -1;
      clearTimeout(restartTimeout);
      initRecognizer();
      try {
        recognition.start();
      } catch {
        initRecognizer();
        try {
          recognition.start();
        } catch (startErr) {
          shouldBeListening = false;
          setListening(false);
          onError?.(startErr.message || 'Không thể khởi động micro.');
        }
      }
    },
    stop() {
      shouldBeListening = false;
      clearTimeout(restartTimeout);
      // LƯU Ý QUAN TRỌNG: KHÔNG gọi flushPendingInterim() ở đây!
      // Khi gọi recognition.stop(), trình duyệt sẽ xử lý nốt phần audio đệm và tự động phát onresult(isFinal=true).
      // Nếu flush ở đây sẽ khiến câu bị bắn 2 lần (lần 1 từ flush, lần 2 từ onresult).
      if (recognition) {
        try {
          recognition.stop();
        } catch { /* Bỏ qua */ }
      }
      setListening(false);
    },
    abort() {
      shouldBeListening = false;
      clearTimeout(restartTimeout);
      pendingInterim = '';
      if (recognition) {
        try {
          recognition.abort();
        } catch { /* Bỏ qua */ }
      }
      setListening(false);
    },
    isListening() {
      return isListeningState;
    },
  };
}

/**
 * Chuẩn hóa văn phong tố tụng tiếng Việt tự nhiên nhất cho giọng đọc Text-to-Speech:
 * - Mở rộng viết tắt pháp lý (HĐXX -> Hội đồng xét xử, BLDS -> Bộ luật Dân sự...)
 * - Đọc tự nhiên ngày tháng năm (18/12/2015 -> ngày 18 tháng 12 năm 2015)
 * - Đọc số tiền, tiền tệ lớn (1.600.000.000 đồng -> 1 tỷ 600 triệu đồng)
 * - Đọc phần trăm (2% -> 2 phần trăm)
 * - Xử lý tên tắt có dấu chấm (ông Đ. -> ông Đ) để không ngắt câu giật cục
 */
export function normalizeVietnameseLegalSpeech(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let res = raw;

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

  // 8. Chuyển các dấu ngoặc đơn giải thích thành dấu phẩy để câu nói liền mạch
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
 * Làm sạch văn bản trước khi đưa vào Text-To-Speech (bỏ trích dẫn, mã [CC:], URL)
 * và chuẩn hóa ngữ âm tiếng Việt tự nhiên nhất
 */
export function cleanTextForSpeech(raw) {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1') // Giữ lại text của link markdown
    .replace(/<[^>]+>/gu, '') // Lược bỏ thẻ HTML
    .replace(/\[(?:CC|PL|BL):[^\]]+\]/gu, '')
    .replace(/\[(?:Chứng cứ|Điều luật|Căn cứ|Bút lục):[^\]]+\]/gu, '')
    .replace(/https?:\/\/[^\s]+/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[-=_]{3,}/gu, ' ')
    .replace(/[#*`_~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalizeVietnameseLegalSpeech(cleaned);
}

export const COURTROOM_SPEECH_RATES = [1.0, 1.25, 1.5];
export const DEFAULT_COURTROOM_SPEECH_RATE = 1.0;
const STORAGE_KEY_RATE = 'courtsim_speech_rate';

let activeAudio = null;
let activeUtterance = null;
let activeAbortController = null;
let currentAudioUrl = null;
let activeSpeechSessionId = 0;
let currentSpeakingRecordId = null;
let isPausedState = false;
let isAutoplayBlockedState = false;
let pendingBlockedSpeech = null;
let cachedVoices = [];
const clientAudioCache = new Map();
const speechListeners = new Set();
const speechRateListeners = new Set();
const autoplayBlockedListeners = new Set();

export function isAutoplayBlockedError(err) {
  if (!err) return false;
  const name = err.name || '';
  const msg = String(err.message || err);
  return (
    name === 'NotAllowedError' ||
    name === 'AutoplayError' ||
    /notallowed|not-allowed|interact|gesture|autoplay/i.test(name) ||
    /notallowed|not-allowed|user didn't interact|user gesture|autoplay/i.test(msg)
  );
}

function notifyAutoplayBlocked(blocked) {
  for (const listener of autoplayBlockedListeners) {
    try {
      listener(blocked);
    } catch { /* Bỏ qua */ }
  }
}

export function subscribeAutoplayBlocked(listener) {
  autoplayBlockedListeners.add(listener);
  return () => autoplayBlockedListeners.delete(listener);
}

export function isAutoplayBlocked() {
  return isAutoplayBlockedState;
}

export function isCourtroomSpeechPaused() {
  return isPausedState;
}

export function pauseCourtroomSpeech() {
  if (!currentSpeakingRecordId) return;
  isPausedState = true;
  if (activeAudio && !activeAudio.paused) {
    try {
      activeAudio.pause();
    } catch { /* Bỏ qua */ }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
    try {
      window.speechSynthesis.pause();
    } catch { /* Bỏ qua */ }
  }
  notifySpeechListeners();
}

export function resumeCourtroomSpeech() {
  if (!currentSpeakingRecordId || !isPausedState) return;
  isPausedState = false;
  if (activeAudio && activeAudio.paused) {
    try {
      const playPromise = activeAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          if (isAutoplayBlockedError(err)) {
            isAutoplayBlockedState = true;
            notifyAutoplayBlocked(true);
          }
        });
      }
    } catch { /* Bỏ qua */ }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch { /* Bỏ qua */ }
  }
  notifySpeechListeners();
}

export function unlockAndResumeCourtroomSpeech() {
  unlockCourtroomAudio();
  isAutoplayBlockedState = false;
  notifyAutoplayBlocked(false);
  if (pendingBlockedSpeech) {
    const { text, options } = pendingBlockedSpeech;
    pendingBlockedSpeech = null;
    return speakCourtroomText(text, options);
  }
  return null;
}

let currentSpeechRate = (() => {
  if (typeof window === 'undefined') return DEFAULT_COURTROOM_SPEECH_RATE;
  try {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY_RATE));
    if (saved && COURTROOM_SPEECH_RATES.includes(saved)) {
      return saved;
    }
  } catch { /* Bỏ qua */ }
  return DEFAULT_COURTROOM_SPEECH_RATE;
})();

function notifySpeechListeners() {
  for (const listener of speechListeners) {
    try {
      listener(currentSpeakingRecordId, {
        isSpeaking: Boolean(currentSpeakingRecordId),
        isPaused: isPausedState,
        recordId: currentSpeakingRecordId,
      });
    } catch { /* Bỏ qua */ }
  }
}

function notifyRateListeners() {
  for (const listener of speechRateListeners) {
    try {
      listener(currentSpeechRate);
    } catch { /* Bỏ qua */ }
  }
}

export function subscribeCourtroomSpeechRate(listener) {
  speechRateListeners.add(listener);
  return () => speechRateListeners.delete(listener);
}

export function getCourtroomSpeechRate() {
  return currentSpeechRate;
}

export function setCourtroomSpeechRate(rate) {
  const numRate = Number(rate);
  if (!COURTROOM_SPEECH_RATES.includes(numRate)) return currentSpeechRate;
  currentSpeechRate = numRate;
  try {
    localStorage.setItem(STORAGE_KEY_RATE, String(numRate));
  } catch { /* Bỏ qua */ }
  if (activeAudio) {
    try {
      activeAudio.playbackRate = numRate;
    } catch { /* Bỏ qua */ }
  }
  notifyRateListeners();
  return currentSpeechRate;
}

export function cycleCourtroomSpeechRate() {
  const currentIndex = COURTROOM_SPEECH_RATES.indexOf(currentSpeechRate);
  const nextIndex = (currentIndex + 1) % COURTROOM_SPEECH_RATES.length;
  return setCourtroomSpeechRate(COURTROOM_SPEECH_RATES[nextIndex]);
}

export function subscribeCourtroomSpeech(listener) {
  speechListeners.add(listener);
  return () => speechListeners.delete(listener);
}

export function getSpeakingRecordId() {
  return currentSpeakingRecordId;
}

function getSharedAudio() {
  if (typeof Audio === 'undefined') return null;
  if (!activeAudio) {
    activeAudio = new Audio();
    activeAudio.preload = 'auto';
  }
  return activeAudio;
}

/**
 * Mở khóa HTMLAudioElement ngay trong sự kiện click/submit của người dùng
 * để trình duyệt không chặn Autoplay khi AI trả lời sau vài giây.
 */
export function unlockCourtroomAudio() {
  const audio = getSharedAudio();
  if (!audio) return;
  try {
    if (audio.paused && !currentSpeakingRecordId) {
      // Phát 1 frame WAV câm siêu ngắn để mở khóa quyền phát âm thanh của tab
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      audio.volume = 0.01;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
        }).catch(() => {
          audio.volume = 1;
        });
      } else {
        audio.volume = 1;
      }
    }
  } catch { /* Bỏ qua */ }
}

function updateVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    } catch { /* Bỏ qua */ }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateVoices();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
  } else {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

export function getVietnameseVoice() {
  if (!cachedVoices.length) updateVoices();
  return (
    cachedVoices.find(v => v.lang === 'vi-VN' || v.lang?.toLowerCase().startsWith('vi')) ||
    cachedVoices.find(v => /vietnam|vietnamese|tiếng việt/i.test(v.name)) ||
    null
  );
}

/**
 * Chia văn bản thành các phân đoạn lời nói tự nhiên theo ranh giới câu thực sự:
 * - Không bao giờ cắt giữa chừng số liệu hay tên viết tắt
 * - Gom các câu liên tiếp trong một lượt nói (tối đa 1.200 ký tự) để giọng đọc phát liền mạch,
 *   giữ trọn vẹn ngữ điệu, nhịp thở và cảm xúc như người thật phát biểu trước tòa
 */
export function splitTextIntoSentences(cleanText, maxSegmentLength = 1200) {
  if (!cleanText) return [];
  const rawSentences = cleanText
    .split(/(?<=[.!?;\n])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!rawSentences.length) return [cleanText];
  const segments = [];
  let current = '';

  for (const s of rawSentences) {
    if (s.length > maxSegmentLength) {
      if (current) {
        segments.push(current);
        current = '';
      }
      const clauses = s.split(/(?<=,)\s+/u);
      let sub = '';
      for (const clause of clauses) {
        if ((sub + ' ' + clause).trim().length <= maxSegmentLength) {
          sub = (sub + ' ' + clause).trim();
        } else {
          if (sub) segments.push(sub);
          sub = clause.trim();
        }
      }
      if (sub) current = sub;
    } else if ((current + ' ' + s).trim().length <= maxSegmentLength) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) segments.push(current);
      current = s;
    }
  }
  if (current) segments.push(current);
  return segments.length ? segments : [cleanText];
}

/**
 * Kiểm tra xem hiện tại có đang phát âm thanh lời thoại phòng xử hay không.
 */
export function isSpeakingCourtroom() {
  return Boolean(currentSpeakingRecordId) || Boolean(activeAudio && !activeAudio.paused) || Boolean(activeUtterance);
}

async function fetchSegmentBlob(segmentText, role, signal) {
  const cacheKey = `${role}:${segmentText}`;
  if (clientAudioCache.has(cacheKey)) {
    return clientAudioCache.get(cacheKey);
  }
  const response = await api.post('/v1/voice/tts', { text: segmentText, role }, {
    responseType: 'blob',
    signal,
    timeout: 15_000,
  });
  const blob = response.data;
  if (!blob || !(blob instanceof Blob) || (blob.type && blob.type.includes('json'))) {
    throw new Error('Dữ liệu âm thanh từ máy chủ không hợp lệ.');
  }
  if (clientAudioCache.size >= 150) {
    const oldest = clientAudioCache.keys().next().value;
    if (oldest) clientAudioCache.delete(oldest);
  }
  clientAudioCache.set(cacheKey, blob);
  return blob;
}

/**
 * Phát âm thanh lời thoại tòa án (Text-to-Speech)
 * Tự động đọc nối tiếp toàn bộ các câu trong lời phát biểu từ đầu đến cuối với bộ đệm Prefetch 0ms.
 * @param {string} text - Lời thoại cần phát
 * @param {object} options
 * @param {'judge'|'opponent'|'learner'} [options.role='judge']
 * @param {string} [options.recordId] - Mã bản ghi lời thoại đang đọc
 * @param {function} [options.onStart]
 * @param {function} [options.onEnd]
 * @param {function} [options.onError]
 */
let lastSpeakingCall = { key: '', recordId: null, timestamp: 0 };

let manualSpeakingActive = false;

export function isManualSpeaking() {
  return manualSpeakingActive;
}

export function speakCourtroomText(text, { role = 'judge', recordId = null, isManual = false, onStart, onEnd, onError } = {}) {
  const clean = cleanTextForSpeech(text);
  if (!clean) return () => {};

  const now = Date.now();
  const callKey = `${role}:${recordId || clean.slice(0, 100)}`;
  // Deduplication: Chặn gọi lại cùng một câu/bản ghi trong vòng 1.2 giây (chỉ áp dụng cho tự động đọc)
  if (!isManual && lastSpeakingCall.key === callKey && now - lastSpeakingCall.timestamp < 1200) {
    return () => {};
  }
  lastSpeakingCall = { key: callKey, recordId, timestamp: now };

  if (isManual) {
    manualSpeakingActive = true;
  }
  stopCourtroomSpeech({ keepManual: isManual });

  const segments = splitTextIntoSentences(clean, 1200);
  if (!segments.length) {
    if (isManual) manualSpeakingActive = false;
    return () => {};
  }

  const sessionId = ++activeSpeechSessionId;
  currentSpeakingRecordId = recordId || `speech-${sessionId}`;
  isPausedState = false;
  if (isManual) {
    manualSpeakingActive = true;
  }
  pendingBlockedSpeech = { text, options: { role, recordId, onStart, onEnd, onError } };
  notifySpeechListeners();

  const abortController = new AbortController();
  activeAbortController = abortController;

  // Khởi chạy prefetch song song các câu để phát nối tiếp không trễ
  const prefetchPromises = segments.map((seg) =>
    fetchSegmentBlob(seg, role, abortController.signal).catch(() => null)
  );

  let started = false;
  function markStarted() {
    if (!started && sessionId === activeSpeechSessionId) {
      started = true;
      isAutoplayBlockedState = false;
      notifyAutoplayBlocked(false);
      onStart?.();
    }
  }

  function finishSession() {
    if (sessionId !== activeSpeechSessionId) return;
    currentSpeakingRecordId = null;
    isPausedState = false;
    manualSpeakingActive = false;
    notifySpeechListeners();
    onEnd?.();
  }

  function playViaWebSpeech(segmentText) {
    return new Promise((resolve) => {
      if (sessionId !== activeSpeechSessionId || abortController.signal.aborted) {
        resolve(false);
        return;
      }
      const viVoice = getVietnameseVoice();
      if (!viVoice || !isSpeechSynthesisSupported() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(segmentText);
      activeUtterance = utterance;
      utterance.voice = viVoice;
      utterance.lang = 'vi-VN';
      let baseRate;
      if (role === 'judge' || role === 'ai_judge') {
        baseRate = 0.98;
        utterance.pitch = 0.82; // Giọng nam trầm, trang nghiêm của Thẩm phán
      } else if (role === 'opponent' || role === 'ai_prosecutor') {
        baseRate = 1.12;
        utterance.pitch = 1.25; // Giọng sắc sảo, đanh thép của Bên đối lập
      } else {
        baseRate = 1.05;
        utterance.pitch = 1.02; // Giọng tự nhiên của Luật sư người học
      }
      utterance.rate = Math.min(Math.max(baseRate * currentSpeechRate, 0.5), 2.5);
      utterance.onstart = () => markStarted();
      utterance.onend = () => {
        if (activeUtterance === utterance) activeUtterance = null;
        resolve(true);
      };
      utterance.onerror = (err) => {
        if (activeUtterance === utterance) activeUtterance = null;
        if (isAutoplayBlockedError(err)) {
          isAutoplayBlockedState = true;
          notifyAutoplayBlocked(true);
        }
        resolve(false);
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch (synthErr) {
        if (isAutoplayBlockedError(synthErr)) {
          isAutoplayBlockedState = true;
          notifyAutoplayBlocked(true);
        }
        resolve(false);
      }
    });
  }

  function playBlobSegment(blob) {
    return new Promise((resolve, reject) => {
      if (sessionId !== activeSpeechSessionId || abortController.signal.aborted) {
        resolve();
        return;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl = audioUrl;
      const audio = getSharedAudio() || new Audio();
      activeAudio = audio;
      audio.volume = 1;
      audio.defaultPlaybackRate = currentSpeechRate;
      audio.playbackRate = currentSpeechRate;
      audio.src = audioUrl;

      const cleanup = () => {
        abortController.signal.removeEventListener('abort', onAbort);
        if (currentAudioUrl === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          currentAudioUrl = null;
        }
      };

      const onAbort = () => {
        cleanup();
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch { /* Bỏ qua */ }
        resolve();
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });

      audio.onplay = () => {
        try {
          audio.playbackRate = currentSpeechRate;
        } catch { /* Bỏ qua */ }
        markStarted();
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = (err) => {
        cleanup();
        reject(err);
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          cleanup();
          if (isAutoplayBlockedError(err)) {
            isAutoplayBlockedState = true;
            notifyAutoplayBlocked(true);
          }
          reject(err);
        });
      }
    });
  }

  (async () => {
    for (let i = 0; i < segments.length; i++) {
      if (sessionId !== activeSpeechSessionId || abortController.signal.aborted) return;
      const blob = await prefetchPromises[i];
      if (sessionId !== activeSpeechSessionId || abortController.signal.aborted) return;

      if (blob) {
        try {
          await playBlobSegment(blob);
          continue;
        } catch (err) {
          if (isAutoplayBlockedError(err)) {
            isAutoplayBlockedState = true;
            notifyAutoplayBlocked(true);
            onError?.(err);
            stopCourtroomSpeech();
            return;
          }
          onError?.(err);
        }
      }
      // Dự phòng sang Web Speech API nếu có gói giọng tiếng Việt
      const webOk = await playViaWebSpeech(segments[i]);
      if (!webOk && isAutoplayBlockedState) {
        stopCourtroomSpeech();
        return;
      }
    }
    finishSession();
  })();

  return stopCourtroomSpeech;
}

/**
 * Dừng phát âm thanh hiện tại (cả AI Audio Player và Web Speech API).
 */
export function stopCourtroomSpeech({ keepManual = false } = {}) {
  activeSpeechSessionId++;
  currentSpeakingRecordId = null;
  isPausedState = false;
  if (!keepManual) {
    manualSpeakingActive = false;
  }
  lastSpeakingCall = { key: '', recordId: null, timestamp: 0 };
  if (!isAutoplayBlockedState) {
    pendingBlockedSpeech = null;
  }
  notifySpeechListeners();

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch { /* Bỏ qua */ }
    activeAbortController = null;
  }

  if (activeAudio) {
    try {
      activeAudio.onplay = null;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.removeAttribute('src');
      activeAudio.load();
    } catch { /* Bỏ qua */ }
  }

  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch { /* Bỏ qua */ }
    currentAudioUrl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { /* Bỏ qua */ }
  }
  activeUtterance = null;
}
