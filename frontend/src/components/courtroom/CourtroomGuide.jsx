import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

function guideSteps(completed, concluded, maxTurns) {
  let closingStep = {
    target: '.room-header-end',
    title: 'Kết thúc phiên tòa',
    text: 'Sau khi gửi ít nhất một lượt lập luận, bấm Kết thúc phiên tòa ở đầu màn hình rồi xác nhận để nhận đánh giá.',
  };
  if (completed) {
    closingStep = {
      target: '.room-turn-action',
      title: 'Xem kết quả',
      text: 'Bấm Xem kết quả để đọc điểm và nhận xét. Bạn có thể xem lại biên bản để đối chiếu với nhận xét.',
    };
  } else if (concluded) {
    closingStep = {
      target: '.room-turn-action',
      title: 'Nghị án và chấm điểm',
      text: 'Chủ tọa đã khép lại phần tranh luận. Chọn Nghị án và chấm điểm để mở kết quả ngay.',
    };
  }
  return [
    { target: '.deck-evidence-btn', title: 'Xem hồ sơ vụ án', text: 'Bấm Hồ sơ chứng cứ để xem tài liệu. Chọn Tổng quan để đọc diễn biến, hoặc Các bên & yêu cầu để xem quan điểm của từng phía.' + (completed ? ' Phiên đã kết thúc chỉ cho phép xem lại.' : ' Khi đến lượt bạn, có thể đưa chứng cứ vào ô lập luận rồi bổ sung phần phân tích của mình.') },
    { target: '.court-speech', title: 'Đọc và xem lại lời thoại', text: 'Cuộn trong khung hội thoại để đọc các lượt đã lưu. Chọn nút Phóng to lời thoại để xem toàn văn và căn cứ nếu có.' },
    ...(!completed ? [
      { target: '.room-turn-action', title: 'Tiếp tục đúng lượt', text: 'Đọc xong, bấm Tiếp tục để nghe lượt kế tiếp, hoặc Trình bày ý kiến khi được mời phát biểu. Nếu đang xem lời cũ, chọn Trở về lượt hiện tại. Khi báo lỗi, bấm Thử lại lời thoại.' },
      { target: '.courtroom-composer-form', title: 'Gửi lập luận', text: `Nêu yêu cầu, liên hệ chứng cứ và trả lời ý kiến vừa được đưa ra, rồi bấm Gửi lập luận trên thanh điều khiển. Mỗi lần nhập tối đa 4.000 ký tự, phiên có tối đa ${maxTurns} lượt của người học. Chưa gửi thì nội dung vẫn là bản nháp.` },
    ] : []),
    { target: '.room-tools-trigger', title: 'Tra cứu và sử dụng luật', text: 'Trong Công cụ khác, chọn Trợ lý luật, nhập vấn đề hoặc số hiệu, điều khoản rồi bấm Hỏi trợ lý. Đọc trích đoạn, mở nguồn và kiểm tra trạng thái áp dụng theo thời điểm.' + (completed ? ' Phiên này không thể gửi thêm lập luận.' : ' Khi đến lượt bạn, chọn Đưa trích dẫn vào lập luận, nội dung chỉ được gửi khi bạn bấm Gửi lập luận.') },
    { target: '.deck-transcript-btn', title: 'Xem biên bản', text: 'Bấm Biên bản trên thanh điều khiển để xem các lời trao đổi đã lưu. Chọn một lời để xem lại tại phòng xử án.' },
    closingStep,
  ];
}

export default function CourtroomGuide({ onClose, onDismissPermanently, returnFocusRef, completed = false, concluded = false, hasDialogue = true, maxTurns = 20 }) {
  const [step, setStep] = useState(0);
  const availableSteps = guideSteps(completed, concluded, maxTurns).filter(item => hasDialogue || item.target !== '.court-speech');
  const currentStep = Math.min(step, availableSteps.length - 1);
  const current = availableSteps[currentStep];
  const [box, setBox] = useState(null);
  const card = useRef(null);
  const close = useRef(null);
  const closeAction = useRef(onClose);
  useEffect(() => { closeAction.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const fallback = returnFocusRef?.current;
    close.current?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); }
      if (event.key !== 'Tab') return;
      const controls = card.current?.querySelectorAll('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else if (fallback?.isConnected) fallback.focus();
    };
  }, [returnFocusRef]);
  useEffect(() => {
    const target = document.querySelector(current.target);
    // Cuộn tới thao tác thật; không thay đổi nội dung hay trạng thái của phiên.
    target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const measure = () => {
      const rect = target?.getBoundingClientRect();
      setBox(rect ? { left: Math.max(4, rect.left - 5), top: Math.max(4, rect.top - 5), width: Math.min(rect.width + 10, innerWidth - 8), height: rect.height + 10 } : null);
    };
    const observer = new ResizeObserver(measure);
    if (target) observer.observe(target);
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [current.target]);
  const width = Math.min(370, window.innerWidth - 24);
  const left = Math.max(12, Math.min(box?.left ?? 12, window.innerWidth - width - 12));
  const below = (box?.top ?? 0) + (box?.height ?? 0) + 14;
  const top = below + 310 < window.innerHeight ? below : Math.max(12, (box?.top ?? window.innerHeight / 2) - 310);
  return <div className="court-tour">
    <div className="tour-blocker" aria-hidden="true" />
    {box && <div className="tour-spotlight" style={box} aria-hidden="true" />}
    <section ref={card} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" className="tour-card court-guide" style={{ left, top, width, maxHeight: `calc(100dvh - ${top + 12}px)` }}>
      <header><span className="guide-progress">Bước {currentStep + 1} / {availableSteps.length}</span><button ref={close} className="tour-close" type="button" onClick={onClose} aria-label="Đóng hướng dẫn"><X size={17} strokeWidth={2.4} aria-hidden="true"/></button></header>
      <div className="guide-step" aria-live="polite" aria-atomic="true">
        <h3 id="tour-title">{current.title}</h3>
        <p id="tour-description">{current.text}</p>
        {currentStep === 0 && <p className="guide-reopen-note">Bạn luôn có thể mở lại từ Công cụ khác → Hướng dẫn.</p>}
      </div>
      <nav aria-label="Các bước hướng dẫn" className="guide-dots">{availableSteps.map((entry, index) => <button type="button" key={entry.title} aria-label={`Bước ${index + 1}: ${entry.title}`} aria-current={index === currentStep ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}</button>)}</nav>
      <div className="guide-footer">
        <button className="guide-skip" type="button" onClick={onDismissPermanently}>Bỏ qua các lần sau</button>
        <div className="guide-actions">
          <button type="button" disabled={currentStep === 0} onClick={() => setStep(currentStep - 1)}>Quay lại</button>
          {currentStep < availableSteps.length - 1
            ? <button type="button" onClick={() => setStep(currentStep + 1)}>Tiếp theo →</button>
            : <button type="button" onClick={onDismissPermanently}>Hoàn tất hướng dẫn</button>}
        </div>
      </div>
    </section>
  </div>;
}
