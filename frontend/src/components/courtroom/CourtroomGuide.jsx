import { useEffect, useRef, useState } from 'react';

function guideSteps(completed, maxTurns) {
  return [
    { target: '.tool-case', title: 'Xem hồ sơ vụ án', text: 'Mở Hồ sơ phiên tòa, chọn tab Vụ án để đọc tình tiết, yêu cầu và chứng cứ. Phân biệt lời trình bày của các bên với tình tiết đã được chứng minh.' + (completed ? ' Phiên đã kết thúc chỉ cho phép xem lại.' : ' Khi đến lượt bạn, có thể đưa chứng cứ vào ô lập luận rồi bổ sung phần phân tích của mình.') },
    { target: '.court-speech', title: 'Đọc và xem lại lời thoại', text: 'Cuộn trong ô lời thoại để đọc tiếp, chọn Phóng to để xem toàn văn và căn cứ nếu có. Hai mũi tên < > chỉ chuyển giữa các lời đã có, không chuyển sang lượt tiếp theo.' },
    ...(!completed ? [
      { target: '.court-speech', title: 'Tiếp tục đúng lượt', text: 'Đọc xong, bấm Tiếp tục: Chủ tọa hoặc Tiếp tục: Bên đối lập khi nút xuất hiện. Bấm Trình bày ý kiến để mở lượt của bạn. Nếu đang xem lời cũ, chọn Trở về lượt hiện tại. Nếu chưa có lời tiếp theo, hãy chờ; khi báo lỗi, bấm Thử lại lời thoại.' },
      { target: '.courtroom-composer', title: 'Gửi lập luận', text: `Ô nhập chỉ mở khi đến lượt bạn. Nêu yêu cầu, liên hệ chứng cứ và trả lời ý kiến vừa được đưa ra, rồi bấm Gửi lập luận. Mỗi lần nhập tối đa 4.000 ký tự, phiên có tối đa ${maxTurns} lượt của người học. Chưa gửi thì nội dung vẫn là bản nháp.` },
    ] : []),
    { target: '.tool-law', title: 'Tra cứu và sử dụng luật', text: 'Mở Trợ lý luật, nhập vấn đề hoặc số hiệu, điều khoản rồi bấm Hỏi trợ lý. Đọc trích đoạn, mở nguồn và kiểm tra trạng thái áp dụng theo thời điểm.' + (completed ? ' Phiên này không thể gửi thêm lập luận.' : ' Khi đến lượt bạn, chọn Đưa trích dẫn vào lập luận, nội dung chỉ được gửi khi bạn bấm Gửi lập luận.') },
    { target: '.tool-case', title: 'Xem biên bản', text: 'Mở Hồ sơ phiên tòa, chọn tab Biên bản để xem các lời trao đổi đã lưu. Bạn cũng có thể mở nhanh bằng nút Biên bản phiên dưới ô lời thoại. Chọn một lời để xem lại tại phòng xử án.' },
    { target: '.end-session, .courtroom-controls a', title: completed ? 'Xem kết quả' : 'Kết thúc và chấm điểm', text: completed ? 'Bấm Xem kết quả để đọc điểm và nhận xét của phiên đã hoàn tất. Bạn có thể xem lại biên bản để đối chiếu với nhận xét.' : 'Sau ít nhất một lượt gửi và khi lời thoại đã hoàn tất, bạn có thể bấm Kết thúc và chấm điểm rồi xác nhận, không cần dùng hết số lượt. Hãy gửi lập luận còn dang dở trước khi kết thúc. Phiên đã kết thúc chỉ có thể xem lại.' },
  ];
}

export default function CourtroomGuide({ onClose, completed = false, hasDialogue = true, maxTurns = 20 }) {
  const [step, setStep] = useState(0);
  const availableSteps = guideSteps(completed, maxTurns).filter(item => hasDialogue || item.target !== '.court-speech');
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
      <header><span className="guide-progress">Bước {currentStep + 1} / {availableSteps.length}</span><button ref={close} type="button" onClick={onClose} aria-label="Đóng hướng dẫn">Đóng ×</button></header>
      <div className="guide-step" aria-live="polite" aria-atomic="true"><h3 id="tour-title">{current.title}</h3><p id="tour-description">{current.text}</p></div>
      <nav aria-label="Các bước hướng dẫn" className="guide-dots">{availableSteps.map((entry, index) => <button type="button" key={entry.title} aria-label={`Bước ${index + 1}: ${entry.title}`} aria-current={index === currentStep ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}</button>)}</nav>
      <div className="guide-actions"><button type="button" disabled={currentStep === 0} onClick={() => setStep(currentStep - 1)}>Quay lại</button>{currentStep < availableSteps.length - 1 ? <button type="button" onClick={() => setStep(currentStep + 1)}>Tiếp theo →</button> : <button type="button" onClick={onClose}>{completed ? 'Quay lại phiên' : 'Tiếp tục thực hành'}</button>}</div>
    </section>
  </div>;
}
