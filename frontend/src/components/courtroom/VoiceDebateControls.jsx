import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../../services/voiceService';

export default function VoiceDebateControls({
  disabled = false,
  onAppendText,
  textareaRef,
}) {
  const [supported] = useState(isSpeechRecognitionSupported);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognizerRef = useRef(null);

  const lastEmittedRef = useRef({ text: '', time: 0 });

  const handleTranscript = useCallback(({ text, isFinal }) => {
    if (isFinal) {
      setInterimText('');
      const clean = text?.trim();
      if (!clean) return;
      const now = Date.now();
      // Ngăn chặn trùng lặp nếu cùng 1 đoạn văn bản được bắn nhiều lần liên tiếp
      if (
        clean.toLowerCase() === lastEmittedRef.current.text.toLowerCase() &&
        now - lastEmittedRef.current.time < 2000
      ) {
        return;
      }
      lastEmittedRef.current = { text: clean, time: now };
      onAppendText?.(clean);
    } else {
      setInterimText(text);
    }
  }, [onAppendText]);

  const handleListeningChange = useCallback((listening) => {
    setIsListening(listening);
    if (!listening) {
      setInterimText('');
    }
  }, []);

  useEffect(() => {
    if (!supported) return;

    recognizerRef.current = createSpeechRecognizer({
      onTranscript: handleTranscript,
      onListeningChange: handleListeningChange,
      lang: 'vi-VN',
    });

    return () => {
      recognizerRef.current?.abort();
    };
  }, [supported, handleTranscript, handleListeningChange]);

  function toggleListening() {
    if (disabled) return;

    if (isListening) {
      recognizerRef.current?.stop();
    } else {
      recognizerRef.current?.start();
      // Đưa focus về textarea để người dùng tiện theo dõi
      textareaRef?.current?.focus();
    }
  }

  // Tự động dừng micro khi ô nhập bị disabled (ví dụ đang gửi bài hoặc phiên kết thúc)
  useEffect(() => {
    if (disabled && isListening) {
      recognizerRef.current?.stop();
    }
  }, [disabled, isListening]);

  return (
    <div className="voice-debate-wrapper">
      <div className="voice-actions-bar">
        {/* Nút Micro Tranh Tụng */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || !supported}
          title={
            !supported
              ? 'Trình duyệt chưa hỗ trợ Web Speech API. Hãy dùng Chrome, Edge hoặc Cốc Cốc.'
              : isListening
                ? 'Đang lắng nghe... Bấm để dừng ghi âm'
                : 'Bấm để phát biểu bằng giọng nói tiếng Việt'
          }
          className={`voice-mic-btn ${isListening ? 'is-active' : ''}`}
          aria-pressed={isListening}
        >
          {isListening ? (
            <>
              <span className="voice-pulse-ring" aria-hidden="true" />
              <MicOff size={18} className="voice-icon text-rose-500 animate-pulse" />
              <span className="voice-btn-text">Đang nghe…</span>
              <span className="voice-wave" aria-hidden="true">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </span>
            </>
          ) : (
            <>
              <Mic size={18} className="voice-icon" />
              <span className="voice-btn-text">Nhập giọng nói</span>
            </>
          )}
        </button>

      </div>

      {/* Chữ đang nói hiển thị nhẹ nhàng khi đang thu âm */}
      {isListening && interimText && (
        <div className="voice-interim-preview" aria-live="polite">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <span className="preview-label">Đang nhận:</span>
          <em className="preview-content">"{interimText}"</em>
        </div>
      )}
    </div>
  );
}
