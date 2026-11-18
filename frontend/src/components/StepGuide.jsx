import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './stepGuide.css';

const viewportMargin = 12;
const maximumCardWidth = 370;

function findVisibleTarget(selector) {
  if (!selector) return null;
  return Array.from(document.querySelectorAll(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === 'visible';
  });
}

function measureGuide(target, card) {
  const width = Math.min(maximumCardWidth, window.innerWidth - viewportMargin * 2);
  const height = Math.min(card.scrollHeight, window.innerHeight - viewportMargin * 2);
  const rect = target?.getBoundingClientRect();
  let spotlight = null;
  if (rect && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight) {
    const left = Math.max(4, rect.left - 5);
    const top = Math.max(4, rect.top - 5);
    spotlight = {
      left,
      top,
      width: Math.min(window.innerWidth - 4, rect.right + 5) - left,
      height: Math.min(window.innerHeight - 4, rect.bottom + 5) - top,
    };
  }
  if (!spotlight) {
    return { spotlight, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 };
  }
  const left = Math.max(viewportMargin, Math.min(spotlight.left, window.innerWidth - width - viewportMargin));
  const below = spotlight.top + spotlight.height + viewportMargin;
  const top = below + height <= window.innerHeight - viewportMargin
    ? below
    : Math.max(viewportMargin, spotlight.top - height - viewportMargin);
  return { spotlight, left, top };
}

export default function StepGuide({
  steps,
  reopenNote,
  onClose,
  onFinish,
  returnFocusRef,
  onSkip,
  skipNext = false,
  onSkipNextChange,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState(null);
  const card = useRef(null);
  const close = useRef(null);
  const closeAction = useRef(onClose);
  const currentStep = Math.min(step, steps.length - 1);
  const current = steps[currentStep];
  const hasSteps = Boolean(current);
  const targetSelector = current?.target;

  useEffect(() => { closeAction.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!hasSteps) return;
    const previous = document.activeElement;
    const fallback = returnFocusRef?.current;
    close.current?.focus({ preventScroll: true });

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAction.current();
      }
      if (event.key !== 'Tab' || !card.current) return;
      const controls = card.current.querySelectorAll('button:not(:disabled), input:not(:disabled)');
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !card.current.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !card.current.contains(active))) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else if (fallback?.isConnected) fallback.focus();
    };
  }, [hasSteps, returnFocusRef]);

  useEffect(() => {
    if (!hasSteps || !card.current) return;
    const tourCard = card.current;
    const target = findVisibleTarget(targetSelector);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    let frame;
    function measure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayout(measureGuide(findVisibleTarget(targetSelector), tourCard)));
    }
    const observer = new ResizeObserver(measure);
    observer.observe(tourCard);
    if (target) observer.observe(target);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [currentStep, hasSteps, targetSelector]);

  if (!current) return null;

  return (
    <div className="step-tour">
      <div className={layout?.spotlight ? 'tour-blocker' : 'tour-blocker is-unanchored'} aria-hidden="true" />
      {layout?.spotlight && <div className="tour-spotlight" style={layout.spotlight} aria-hidden="true" />}
      <section
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={layout ? { left: layout.left, top: layout.top, maxHeight: `calc(100dvh - ${layout.top + viewportMargin}px)` } : undefined}
      >
        <header>
          <span className="guide-progress">Bước {currentStep + 1} / {steps.length}</span>
          <button ref={close} className="tour-close" type="button" onClick={onClose} aria-label="Đóng hướng dẫn">
            <X size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>
        <div className="guide-step" aria-live="polite" aria-atomic="true">
          <h3 id={titleId}>{current.title}</h3>
          <p id={descriptionId}>{current.text}</p>
          {currentStep === 0 && reopenNote && <p className="guide-reopen-note">{reopenNote}</p>}
        </div>
        <nav aria-label="Các bước hướng dẫn" className="guide-dots">
          {steps.map((entry, index) => (
            <button
              type="button"
              key={entry.title}
              aria-label={`Bước ${index + 1}: ${entry.title}`}
              aria-current={index === currentStep ? 'step' : undefined}
              onClick={() => setStep(index)}
            >
              {index + 1}
            </button>
          ))}
        </nav>
        <div className="guide-footer">
          {onSkip && <button className="guide-skip" type="button" onClick={onSkip}>Bỏ qua các lần sau</button>}
          {onSkipNextChange && (
            <label className="guide-checkbox">
              <input type="checkbox" checked={skipNext} onChange={event => onSkipNextChange(event.target.checked)} />
              <span>Không hiện lại hướng dẫn này</span>
            </label>
          )}
          <div className="guide-actions">
            <button type="button" disabled={currentStep === 0} onClick={() => setStep(currentStep - 1)}>Quay lại</button>
            {currentStep < steps.length - 1
              ? <button type="button" onClick={() => setStep(currentStep + 1)}>Tiếp theo →</button>
              : <button type="button" onClick={onFinish}>Hoàn tất hướng dẫn</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
