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

  function setListening(val) {
    if (isListeningState !== val) {
      isListeningState = val;
      onListeningChange?.(val);
    }
  }

  function flushPendingInterim() {
    if (pendingInterim.trim()) {
      const textToFlush = pendingInterim.trim();
      pendingInterim = '';
      onTranscript?.({ text: textToFlush, isFinal: true });
    }
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

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const transcriptText = item[0]?.transcript ?? '';
        if (item.isFinal) {
          finalTranscript += transcriptText;
        } else {
          interimTranscript += transcriptText;
        }
      }

      if (finalTranscript.trim()) {
        pendingInterim = '';
        onTranscript?.({ text: finalTranscript.trim(), isFinal: true });
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

      if (event.error === 'network') {
        // Lỗi mạng tạm thời của Google Speech: không tắt hoàn toàn, thông báo nhẹ để keep-alive tự kết nối lại
        onError?.('Kết nối mạng nhận dạng giọng nói đang kết nối lại...');
        return;
      }

      if (event.error !== 'aborted') {
        onError?.(`Thông báo nhận dạng: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Đảm bảo không mất từ cuối cùng nếu chưa kịp chuyển sang isFinal
      flushPendingInterim();

      // Cơ chế Keep-Alive vĩnh viễn: Nếu người dùng chưa bấm dừng, tự động khởi động lại ngay
      if (shouldBeListening) {
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
      } else {
        setListening(false);
      }
    };
  }

  return {
    supported: true,
    start() {
      shouldBeListening = true;
      pendingInterim = '';
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
      flushPendingInterim();
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
      flushPendingInterim();
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
let cachedVoices = [];

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
 * Kiểm tra xem hiện tại có đang phát âm thanh lời thoại phòng xử hay không.
 */
export function isSpeakingCourtroom() {
  return Boolean(activeAudio && !activeAudio.paused) || Boolean(activeUtterance);
}

/**
 * Phát âm thanh lời thoại tòa án (Text-to-Speech)
 * Ưu tiên gọi backend AI TTS (OpenAI TTS) chuẩn tiếng Việt 100% tự nhiên, trầm ấm uy nghiêm cho Chủ tọa và dứt khoát cho Bên đối lập.
 * @param {string} text - Lời thoại cần phát
 * @param {object} options
 * @param {'judge'|'opponent'|'learner'} [options.role='judge']
 * @param {function} [options.onStart]
 * @param {function} [options.onEnd]
 * @param {function} [options.onError]
 */
export function speakCourtroomText(text, { role = 'judge', onStart, onEnd, onError } = {}) {
  stopCourtroomSpeech();

  const clean = cleanTextForSpeech(text);
  if (!clean) return () => {};

  const abortController = new AbortController();
  activeAbortController = abortController;

  // 1. Ưu tiên gọi backend AI Voice Service để lấy giọng đọc tiếng Việt tự nhiên nhất
  api.post('/v1/voice/tts', { text: clean, role }, {
    responseType: 'blob',
    signal: abortController.signal
  })
    .then((response) => {
      if (abortController.signal.aborted) return;
      const blob = response.data;
      if (!blob || !(blob instanceof Blob)) {
        throw new Error('Dữ liệu âm thanh từ máy chủ không hợp lệ.');
      }

      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }

      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl = audioUrl;
      const audio = new Audio(audioUrl);
      activeAudio = audio;

      audio.onplay = () => {
        onStart?.();
      };

      audio.onended = () => {
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
          currentAudioUrl = null;
        }
        if (activeAudio === audio) activeAudio = null;
        onEnd?.();
      };

      audio.onerror = (e) => {
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
          currentAudioUrl = null;
        }
        if (activeAudio === audio) activeAudio = null;
        onError?.(e);
        onEnd?.();
      };

      return audio.play();
    })
    .catch((err) => {
      if (abortController.signal.aborted) return;

      console.warn('Backend AI TTS fallback:', err.message || err);

      // 2. Dự phòng: CHỈ dùng Web Speech API nếu máy khách THỰC SỰ có gói giọng tiếng Việt
      const viVoice = getVietnameseVoice();
      if (viVoice && isSpeechSynthesisSupported()) {
        const utterance = new SpeechSynthesisUtterance(clean);
        activeUtterance = utterance;
        utterance.voice = viVoice;
        utterance.lang = 'vi-VN';

        // Điều chỉnh cao độ và tốc độ theo vai
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

        utterance.onstart = () => {
          onStart?.();
        };

        utterance.onend = () => {
          if (activeUtterance === utterance) activeUtterance = null;
          onEnd?.();
        };

        utterance.onerror = (e) => {
          if (activeUtterance === utterance) activeUtterance = null;
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            onError?.(e.error);
          }
          onEnd?.();
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (synthErr) {
          onError?.(synthErr.message);
          onEnd?.();
        }
      } else {
        // Tuyệt đối KHÔNG fallback sang giọng tiếng Anh (Microsoft David) đọc bồi tiếng Việt!
        onError?.('Dịch vụ giọng đọc AI đang tải lại kết nối. Vui lòng bấm thử lại sau giây lát.');
        onEnd?.();
      }
    });

  return stopCourtroomSpeech;
}

/**
 * Dừng phát âm thanh hiện tại (cả AI Audio Player và Web Speech API).
 */
export function stopCourtroomSpeech() {
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch { /* Bỏ qua */ }
    activeAbortController = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch { /* Bỏ qua */ }
    activeAudio = null;
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
