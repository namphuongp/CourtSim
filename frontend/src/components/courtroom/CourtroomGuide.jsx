import { useEffect, useRef, useState } from 'react';

const steps = [
  { target: '.tool-case', title: 'Xem hồ sơ vụ án', text: 'Nhấn Hồ sơ phiên tòa, chọn tab Vụ án để đọc sự việc và chứng cứ. Chọn Đưa vào lập luận tại tài liệu bạn muốn sử dụng.' },
  { target: '.tool-law', title: 'Tra cứu luật', text: 'Nhấn Trợ lý luật, nhập câu hỏi rồi chọn Hỏi trợ lý. Đọc nguồn và chọn Đưa trích dẫn vào lập luận khi cần.' },
  { target: '.court-speech', title: 'Đọc lời thoại', text: 'Cuộn để đọc tiếp. Dùng hai mũi tên để xem lời trước hoặc lời tiếp theo; chọn Đọc đầy đủ để mở toàn văn.' },
  { target: '.courtroom-composer', title: 'Gửi lập luận', text: 'Nhập lập luận của bạn vào ô này, sau đó nhấn Gửi lập luận.' },
  { target: '.tool-case', title: 'Xem biên bản', text: 'Nhấn Hồ sơ phiên tòa, chọn tab Biên bản để đọc toàn bộ các lượt trao đổi.' },
  { target: '.end-session, .courtroom-controls a', title: 'Kết thúc phiên', text: 'Nhấn Kết thúc và chấm điểm, rồi xác nhận để xem điểm và nhận xét. Với phiên đã kết thúc, nhấn Xem kết quả.' },
];

export default function CourtroomGuide({ onClose, completed = false, hasDialogue = true }) {
  const [step, setStep] = useState(0);
  const availableSteps = steps.filter(item => !(completed && item.target === '.courtroom-composer') && !( !hasDialogue && item.target === '.court-speech'));
  const currentStep = Math.min(step, availableSteps.length - 1);
  const current = availableSteps[currentStep];
  const [box, setBox] = useState(null);
  const card = useRef(null);
  const close = useRef(null);
  const closeAction = useRef(onClose);
  useEffect(() => { closeAction.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...card.current.querySelectorAll('button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus(); };
  }, []);
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
      <header><span className="guide-progress">Bước {currentStep + 1} / {availableSteps.length}</span><button ref={close} type="button" onClick={onClose} aria-label="Đóng hướng dẫn">Bỏ qua ×</button></header>
      <div className="guide-step" aria-live="polite" aria-atomic="true"><h3 id="tour-title">{current.title}</h3><p id="tour-description">{current.text}</p></div>
      <nav aria-label="Các bước hướng dẫn" className="guide-dots">{availableSteps.map((entry, index) => <button type="button" key={entry.title} aria-label={`Bước ${index + 1}: ${entry.title}`} aria-current={index === currentStep ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}</button>)}</nav>
      <div className="guide-actions"><button type="button" disabled={currentStep === 0} onClick={() => setStep(currentStep - 1)}>Quay lại</button>{currentStep < availableSteps.length - 1 ? <button type="button" onClick={() => setStep(currentStep + 1)}>Tiếp theo →</button> : <button type="button" onClick={onClose}>Bắt đầu thực hành</button>}</div>
    </section>
  </div>;
}
