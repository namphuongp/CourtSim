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
 * Làm sạch văn bản trước khi đưa vào Text-To-Speech (bỏ trích dẫn, mã [CC:], URL)
 */
export function cleanTextForSpeech(raw) {
  if (!raw) return '';
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1') // Giữ lại text của link markdown
    .replace(/<[^>]+>/gu, '') // Lược bỏ thẻ HTML
    .replace(/\[(?:CC|PL):[^\]]+\]/gu, '')
    .replace(/\[(?:Chứng cứ|Điều luật):[^\]]+\]/gu, '')
    .replace(/https?:\/\/[^\s]+/gu, '')
    .replace(/[#*`_~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

let activeAudio = null;
let activeUtterance = null;
let activeAbortController = null;
let currentAudioUrl = null;
let activeSpeechSessionId = 0;
let currentSpeakingRecordId = null;
let cachedVoices = [];
const clientAudioCache = new Map();
const speechListeners = new Set();

function notifySpeechListeners() {
  for (const listener of speechListeners) {
    try {
      listener(currentSpeakingRecordId);
    } catch { /* Bỏ qua */ }
  }
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
 * Chia văn bản dài thành danh sách các câu/đoạn ngắn tự nhiên (<= 240 ký tự)
 * để đọc lần lượt hết toàn bộ phát biểu từ câu đầu đến câu cuối, không bao giờ bị ngắt giữa chừng.
 */
export function splitTextIntoSentences(cleanText, maxSegmentLength = 240) {
  if (!cleanText) return [];
  const rawSentences = cleanText.match(/[^.!?;\n]+[.!?;\n]*|\S+/gu) || [cleanText];
  const segments = [];
  let current = '';

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxSegmentLength) {
      if (current) {
        segments.push(current);
        current = '';
      }
      const clauses = trimmed.split(/(?<=,)\s+/u);
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
    } else if ((current + ' ' + trimmed).trim().length <= maxSegmentLength) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) segments.push(current);
      current = trimmed;
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
  if (!blob || !(blob instanceof Blob)) {
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
export function speakCourtroomText(text, { role = 'judge', recordId = null, onStart, onEnd, onError } = {}) {
  stopCourtroomSpeech();

  const clean = cleanTextForSpeech(text);
  if (!clean) return () => {};

  const segments = splitTextIntoSentences(clean, 240);
  if (!segments.length) return () => {};

  const sessionId = ++activeSpeechSessionId;
  currentSpeakingRecordId = recordId || `speech-${sessionId}`;
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
      onStart?.();
    }
  }

  function finishSession() {
    if (sessionId !== activeSpeechSessionId) return;
    currentSpeakingRecordId = null;
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
      if (role === 'judge') {
        utterance.rate = 0.95;
        utterance.pitch = 0.95;
      } else if (role === 'opponent') {
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }
      utterance.onstart = () => markStarted();
      utterance.onend = () => {
        if (activeUtterance === utterance) activeUtterance = null;
        resolve(true);
      };
      utterance.onerror = () => {
        if (activeUtterance === utterance) activeUtterance = null;
        resolve(false);
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
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
      audio.src = audioUrl;

      audio.onplay = () => {
        markStarted();
      };
      audio.onended = () => {
        if (currentAudioUrl === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          currentAudioUrl = null;
        }
        resolve();
      };
      audio.onerror = (err) => {
        if (currentAudioUrl === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          currentAudioUrl = null;
        }
        reject(err);
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(reject);
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
          onError?.(err);
        }
      }
      // Dự phòng sang Web Speech API nếu có gói giọng tiếng Việt
      await playViaWebSpeech(segments[i]);
    }
    finishSession();
  })();

  return stopCourtroomSpeech;
}

/**
 * Dừng phát âm thanh hiện tại (cả AI Audio Player và Web Speech API).
 */
export function stopCourtroomSpeech() {
  activeSpeechSessionId++;
  currentSpeakingRecordId = null;
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
