import { TRIAL_STAGES } from '../../services/courtroom.js';

export default function TrialPhaseStepper({ currentStageIndex, completed }) {
  return (
    <section className="summary-section" aria-labelledby="room-case-stage-heading">
      <h3 id="room-case-stage-heading" className="summary-section-heading">Tiến trình phiên tòa</h3>
      <ol className="room-case-stages" role="list">
        {TRIAL_STAGES.map((stage, index) => {
          const done = completed || index < currentStageIndex;
          const current = !completed && index === currentStageIndex;
          return (
            <li key={stage.key} aria-current={current ? 'step' : undefined}>
              <strong>{stage.title}</strong>
              {done && <span>Đã qua</span>}
              {current && <span>Đang diễn ra</span>}
              <p>{stage.description}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
