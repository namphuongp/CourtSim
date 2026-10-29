// Dịch vụ Nhận dạng giọng nói (Speech-to-Text) và Phát âm thanh (Text-to-Speech)
// Sử dụng chuẩn Web Speech API của trình duyệt: 100% miễn phí, vĩnh viễn, không phụ thuộc API key, không bị ngắt quãng.

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
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
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

  function setListening(val) {
    if (isListeningState !== val) {
      isListeningState = val;
      onListeningChange?.(val);
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
        onTranscript?.({ text: finalTranscript.trim(), isFinal: true });
      } else if (interimTranscript.trim()) {
        onTranscript?.({ text: interimTranscript.trim(), isFinal: false });
      }
    };

    recognition.onerror = (event) => {
      // no-speech xảy ra khi người dùng im lặng trong vài giây: KHÔNG coi là lỗi nghiêm trọng, tiếp tục nghe
      if (event.error === 'no-speech') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldBeListening = false;
        setListening(false);
        onError?.('Chưa cấp quyền truy cập Micro. Vui lòng bấm vào biểu tượng Micro/Ổ khoá trên thanh địa chỉ trình duyệt để cấp quyền.');
        return;
      }

      if (event.error === 'audio-capture') {
        shouldBeListening = false;
        setListening(false);
        onError?.('Không tìm thấy thiết bị thu âm Micro hoặc thiết bị đang bận.');
        return;
      }

      // Các lỗi khác (network, aborted...) thì ghi nhận nhẹ
      if (event.error !== 'aborted') {
        onError?.(`Lỗi giọng nói: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Cơ chế Keep-Alive: Nếu người dùng chưa bấm dừng (shouldBeListening = true),
      // tự động khởi động lại ngay sau 120ms để nhận dạng liên tục không bị gián đoạn!
      if (shouldBeListening) {
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (shouldBeListening) {
            try {
              recognition.start();
            } catch {
              // Nếu gọi start bị lỗi, thử tái tạo recognition mới
              initRecognizer();
              try { recognition.start(); } catch { /* Bỏ qua */ }
            }
          }
        }, 120);
      } else {
        setListening(false);
      }
    };
  }

  return {
    supported: true,
    start() {
      shouldBeListening = true;
      clearTimeout(restartTimeout);
      try {
        if (!recognition) initRecognizer();
        recognition.start();
      } catch (err) {
        // Có thể recognition đang chạy, thử khởi tạo lại
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

let activeUtterance = null;
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
 * Phát âm thanh lời thoại tòa án (Text-to-Speech)
 * @param {string} text - Lời thoại cần phát
 * @param {object} options
 * @param {'judge'|'opponent'|'learner'} [options.role='judge']
 * @param {function} [options.onStart]
 * @param {function} [options.onEnd]
 * @param {function} [options.onError]
 */
export function speakCourtroomText(text, { role = 'judge', onStart, onEnd, onError } = {}) {
  if (!isSpeechSynthesisSupported()) return () => {};

  stopCourtroomSpeech();

  const clean = cleanTextForSpeech(text);
  if (!clean) return () => {};

  const utterance = new SpeechSynthesisUtterance(clean);
  activeUtterance = utterance;

  // Lấy giọng đọc tiếng Việt tối ưu nhất
  const viVoice = getVietnameseVoice();
  if (viVoice) {
    utterance.voice = viVoice;
  }
  utterance.lang = 'vi-VN';

  // Điều chỉnh cao độ và tốc độ theo vai
  if (role === 'judge') {
    // Chủ tọa: đĩnh đạc, trầm ổn, uy nghiêm
    utterance.rate = 0.96;
    utterance.pitch = 0.95;
  } else if (role === 'opponent') {
    // Bên đối lập: dứt khoát, sắc bén
    utterance.rate = 1.02;
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
  } catch (err) {
    onError?.(err.message);
  }

  return stopCourtroomSpeech;
}

/**
 * Dừng phát âm thanh hiện tại.
 */
export function stopCourtroomSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { /* Bỏ qua */ }
  }
  activeUtterance = null;
}
