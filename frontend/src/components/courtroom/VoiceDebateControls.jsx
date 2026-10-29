import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { createSpeechRecognizer, isSpeechRecognitionSupported, isSpeechSynthesisSupported } from '../../services/voiceService';

export default function VoiceDebateControls({
  disabled = false,
  onAppendText,
  textareaRef,
  ttsEnabled = false,
  onToggleTts,
}) {
  const [supported, setSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognizerRef = useRef(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const handleTranscript = useCallback(({ text, isFinal }) => {
    if (isFinal) {
      setInterimText('');
      onAppendText?.(text);
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
              <span className="voice-btn-text">Đang nghe... (Bấm để dừng)</span>
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
              <span className="voice-btn-text">Tranh tụng bằng giọng nói</span>
            </>
          )}
        </button>

        {/* Nút Bật/Tắt Giọng đọc phiên toà (TTS) */}
        {isSpeechSynthesisSupported() && (
          <button
            type="button"
            onClick={onToggleTts}
            className={`voice-tts-btn ${ttsEnabled ? 'is-active' : ''}`}
            title={ttsEnabled ? 'Đang bật giọng đọc Tòa án (Bấm để tắt)' : 'Bấm để nghe giọng đọc của Chủ tọa và Bên đối lập'}
            aria-pressed={ttsEnabled}
          >
            {ttsEnabled ? (
              <>
                <Volume2 size={16} className="text-emerald-600" />
                <span>Giọng đọc Tòa: Bật</span>
              </>
            ) : (
              <>
                <VolumeX size={16} className="text-slate-400" />
                <span>Giọng đọc Tòa: Tắt</span>
              </>
            )}
          </button>
        )}
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
