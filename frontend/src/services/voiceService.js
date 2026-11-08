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
  Z: 'Dét',
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
  X: '10',
});

/**
 * Chuẩn hóa văn phong tố tụng tiếng Việt tự nhiên nhất cho giọng đọc Text-to-Speech:
 * - Mở rộng mã bản án/quyết định (17/2026/HC-PT -> 17 năm 2026 hành chính phúc thẩm)
 * - Mở rộng viết tắt pháp lý (HĐXX -> Hội đồng xét xử, BLDS -> Bộ luật Dân sự...)
 * - Đọc tự nhiên ngày tháng năm (18/12/2015 -> ngày 18 tháng 12 năm 2015)
 * - Đọc số tiền, tiền tệ lớn (1.600.000.000 đồng -> 1 tỷ 600 triệu đồng)
 * - Đọc phần trăm (2% -> 2 phần trăm)
 * - Phiên âm tên tắt có dấu chấm (ông Đ. -> ông Đê, ông L -> ông Lờ) để tuyệt đối không đọc sang tiếng Anh
 */
export function normalizeVietnameseLegalSpeech(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let res = raw;

  // 1. Chuẩn hóa dấu ngoặc kép, dấu nháy và ký hiệu nối
  res = res.replace(/[„“""«»]/gu, '"');
  res = res.replace(/[’'']/gu, "'");
  res = res.replace(/\s*&\s*/gu, ' và ');
  res = res.replace(/(?<![\p{L}\p{N}])vs\.?(?![\p{L}\p{N}])/giu, 'đối với');

  // 2. Mở rộng ký hiệu mã bản án / quyết định / văn bản pháp luật có dấu gạch chéo
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
    [/\/NQ-HĐTP(?![\p{L}\p{N}])/giu, ' Nghị quyết Hội đồng Thẩm phán'],
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

  // 5. Chuẩn hóa phần trăm và đơn vị diện tích: 2% -> 2 phần trăm, 100m2 -> 100 mét vuông
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*%/gu, (match, n) => {
    return `${n.replace('.', ' phẩy ').replace(',', ' phẩy ')} phần trăm`;
  });
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(?:m2|m²)(?![\p{L}\p{N}])/giu, '$1 mét vuông');
  res = res.replace(/(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(?:km2|km²)(?![\p{L}\p{N}])/giu, '$1 ki lô mét vuông');

  // 6. Chuyển số La Mã sau Giai đoạn / Phần / Mục / Chương sang số tự nhiên
  res = res.replace(/(?<![\p{L}\p{N}])([Gg]iai đoạn|[Pp]hần|[Mm]ục|[Cc]hương)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)(?![\p{L}\p{N}])/gu, (match, prefix, roman) => {
    return `${prefix} ${ROMAN_TO_NUMBER[roman] || roman}`;
  });

  // 7. Phiên âm tên tắt như 'ông Đ.', 'Ông Hồ Thành L', 'Quận A', 'phường B', 'điểm b' sang chữ cái tiếng Việt chuẩn
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
    [/(?<![\p{L}\p{N}])Đ\.?\s*(\d+)(?![\p{L}\p{N}])/gu, 'Điều $1'],
  ];

  for (const [pattern, replacement] of legalAbbreviations) {
    res = res.replace(pattern, replacement);
  }

  // 9. Thêm khoảng nghỉ tự nhiên sau số điều luật
  res = res.replace(/Điều\s+(\d+)\s+(Bộ luật|Luật|Nghị định|Thông tư|Nghị quyết)/giu, 'Điều $1, $2');

  // 10. Chuyển các dấu ngoặc đơn giải thích thành dấu phẩy để câu nói liền mạch
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

let unlockAudioEl = null;

/**
 * Mở khóa quyền phát âm thanh của trình duyệt trên một phần tử Audio tách biệt hoàn toàn
 * để tuyệt đối không bao giờ chạm vào hoặc làm gián đoạn activeAudio đang đọc lời thoại.
 */
export function unlockCourtroomAudio() {
  if (typeof Audio === 'undefined') return;
  try {
    if (!unlockAudioEl) {
      unlockAudioEl = new Audio();
      unlockAudioEl.preload = 'auto';
    }
    if (unlockAudioEl.paused && !currentSpeakingRecordId) {
      // Phát 1 frame WAV câm siêu ngắn trên phần tử riêng biệt để mở khóa quyền Autoplay của tab
      unlockAudioEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      unlockAudioEl.volume = 0.01;
      const p = unlockAudioEl.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          unlockAudioEl.pause();
          unlockAudioEl.currentTime = 0;
        }).catch(() => {});
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
    cachedVoices.find((v) => /^vi(?:-|_|$)/i.test(v.lang || '')) ||
    cachedVoices.find((v) => /vietnam|vietnamese|tiếng việt/i.test(v.name || '')) ||
    null
  );
}

/**
 * Chia văn bản thành các phân đoạn lời nói tối ưu cho phát tức thì (Progressive Low-Latency):
 * - Phân đoạn đầu tiên (câu mở đầu) được giới hạn ngắn (<= 175 ký tự) để phát ngay lập tức sau ~200ms
 * - Các câu tiếp theo được gom theo cụm ~340 ký tự và tải ngầm song song (Prefetch) trong lúc câu 1 đang đọc
 */
export function splitTextIntoSentences(cleanText, maxSegmentLength = 340) {
  if (!cleanText) return [];
  const rawSentences = cleanText
    .split(/(?<=[.!?;\n])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!rawSentences.length) return [cleanText];
  const segments = [];
  let current = '';

  for (const s of rawSentences) {
    const targetLimit = segments.length === 0 ? Math.min(175, maxSegmentLength) : maxSegmentLength;
    if (s.length > targetLimit) {
      if (current) {
        segments.push(current);
        current = '';
      }
      const clauseLimit = segments.length === 0 ? Math.min(175, maxSegmentLength) : maxSegmentLength;
      const clauses = s.split(/(?<=,)\s+/u);
      let sub = '';
      for (const clause of clauses) {
        const activeLimit = segments.length === 0 ? clauseLimit : maxSegmentLength;
        if ((sub + ' ' + clause).trim().length <= activeLimit) {
          sub = (sub + ' ' + clause).trim();
        } else {
          if (sub) segments.push(sub);
          sub = clause.trim();
        }
      }
      if (sub) current = sub;
    } else if (!current) {
      current = s;
      // Nếu là phân đoạn mở đầu tiên và đã đủ 1 câu hoàn chỉnh (>= 45 ký tự), chốt ngay để phát tức thì!
      if (segments.length === 0 && current.length >= 45) {
        segments.push(current);
        current = '';
      }
    } else if ((current + ' ' + s).trim().length <= targetLimit) {
      current = (current + ' ' + s).trim();
    } else {
      segments.push(current);
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

function hashSpeechSegment(role, segmentText) {
  const input = `${role || 'judge'}:${segmentText || ''}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x811c9dc5);
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}_${input.length}`;
}

const inflightSegmentRequests = new Map();

function storeClientAudioCache(cacheKey, blob) {
  if (clientAudioCache.size >= 180) {
    const oldest = clientAudioCache.keys().next().value;
    if (oldest) clientAudioCache.delete(oldest);
  }
  clientAudioCache.set(cacheKey, blob);
}

async function requestTtsBlobFromApi(segmentText, normalizedRole, signal) {
  const segmentHash = hashSpeechSegment(normalizedRole, segmentText);
  const snippetParam = encodeURIComponent(segmentText.slice(0, 28));
  const response = await api.post(
    `/v1/voice/tts?r=${encodeURIComponent(normalizedRole)}&h=${encodeURIComponent(segmentHash)}&t=${snippetParam}`,
    { text: segmentText, role: normalizedRole },
    {
      responseType: 'blob',
      signal,
      timeout: 10_000,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }
  );
  const blob = response.data;
  if (!blob || !(blob instanceof Blob) || (blob.type && blob.type.includes('json'))) {
    throw new Error('Dữ liệu âm thanh từ máy chủ không hợp lệ.');
  }
  return blob;
}

async function fetchSegmentBlob(segmentText, role, signal) {
  const normalizedRole = role || 'judge';
  const cacheKey = `${normalizedRole}:${segmentText}`;
  if (clientAudioCache.has(cacheKey)) {
    return clientAudioCache.get(cacheKey);
  }
  if (inflightSegmentRequests.has(cacheKey)) {
    return inflightSegmentRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const blob = await requestTtsBlobFromApi(segmentText, normalizedRole);
      storeClientAudioCache(cacheKey, blob);
      return blob;
    } catch (firstErr) {
      if (signal?.aborted) throw firstErr;
      const retryBlob = await requestTtsBlobFromApi(segmentText, normalizedRole, signal);
      storeClientAudioCache(cacheKey, retryBlob);
      return retryBlob;
    } finally {
      inflightSegmentRequests.delete(cacheKey);
    }
  })();

  inflightSegmentRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Tải trước (Prefetch) phân đoạn mở đầu của lời thoại vào bộ nhớ đệm trình duyệt
 * để khi người dùng nhấn nút "Nghe đọc" sẽ phát tức thì (0ms trễ).
 */
export function prefetchCourtroomSpeech(text, { role = 'judge' } = {}) {
  const clean = cleanTextForSpeech(text);
  if (!clean) return;
  const segments = splitTextIntoSentences(clean, 340);
  if (!segments.length) return;
  fetchSegmentBlob(segments[0], role).catch(() => {});
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

  const normalizedRecordId = recordId != null ? String(recordId) : null;
  const now = Date.now();
  const callKey = `${role}:${normalizedRecordId || clean.slice(0, 100)}:${clean.length}`;
  // Deduplication: Chặn gọi lại cùng một câu/bản ghi trong vòng 1.2 giây (chỉ áp dụng cho tự động đọc)
  if (!isManual && lastSpeakingCall.key === callKey && now - lastSpeakingCall.timestamp < 1200) {
    return () => {};
  }
  lastSpeakingCall = { key: callKey, recordId: normalizedRecordId, timestamp: now };

  if (isManual) {
    manualSpeakingActive = true;
  }
  stopCourtroomSpeech({ keepManual: isManual });

  const segments = splitTextIntoSentences(clean, 340);
  if (!segments.length) {
    if (isManual) manualSpeakingActive = false;
    return () => {};
  }

  const sessionId = ++activeSpeechSessionId;
  currentSpeakingRecordId = normalizedRecordId || `speech-${sessionId}`;
  isPausedState = false;
  if (isManual) {
    manualSpeakingActive = true;
  }
  pendingBlockedSpeech = { text, options: { role, recordId: normalizedRecordId, isManual, onStart, onEnd, onError } };
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
      if (activeAudio) {
        try {
          activeAudio.onplay = null;
          activeAudio.onended = null;
          activeAudio.onerror = null;
          activeAudio.pause();
        } catch { /* Bỏ qua */ }
        activeAudio = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      const roleCadence =
        role === 'judge' || role === 'ai_judge'
          ? 0.98
          : role === 'opponent' || role === 'ai_prosecutor'
          ? 1.05
          : 1.01;
      const effectiveRate = Math.min(Math.max(roleCadence * currentSpeechRate, 0.5), 2.5);
      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl = audioUrl;
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      activeAudio = audio;
      audio.volume = 1;
      audio.defaultPlaybackRate = effectiveRate;
      audio.playbackRate = effectiveRate;

      const cleanup = () => {
        abortController.signal.removeEventListener('abort', onAbort);
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
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
        if (activeAudio === audio) activeAudio = null;
        resolve();
      };
      abortController.signal.addEventListener('abort', onAbort, { once: true });

      audio.onplay = () => {
        try {
          audio.playbackRate = Math.min(Math.max(roleCadence * currentSpeechRate, 0.5), 2.5);
        } catch { /* Bỏ qua */ }
        markStarted();
      };
      audio.onended = () => {
        cleanup();
        if (activeAudio === audio) activeAudio = null;
        resolve();
      };
      audio.onerror = (err) => {
        cleanup();
        if (activeAudio === audio) activeAudio = null;
        reject(err);
      };

      if (isPausedState) {
        return;
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          cleanup();
          if (activeAudio === audio) activeAudio = null;
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
    const audioToStop = activeAudio;
    activeAudio = null;
    try {
      audioToStop.onplay = null;
      audioToStop.onended = null;
      audioToStop.onerror = null;
      audioToStop.pause();
      audioToStop.currentTime = 0;
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
