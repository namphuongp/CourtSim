import { Check, Scale } from 'lucide-react';
import { TRIAL_STAGES, getTrialStageIndex } from '../../services/courtroom.js';

export default function TrialPhaseStepper({ session, records = [], userTurns = 0, maxTurns = 20 }) {
  const currentStageIndex = getTrialStageIndex(session, records);
  const currentStage = TRIAL_STAGES[currentStageIndex] || TRIAL_STAGES[0];
  const currentIssue = session?.conversation?.hearing_state?.current_issue?.label;
  const isCompleted = session?.status === 'completed';

  const progressPercent = Math.min(100, Math.round((userTurns / maxTurns) * 100));
  const isNearLimit = userTurns >= maxTurns - 3 && !isCompleted;

  return (
    <div className="trial-stepper-container" role="region" aria-label="Tiến trình phiên tòa">
      <div className="trial-stepper-track">
        {TRIAL_STAGES.map((stage, idx) => {
          const isDone = idx < currentStageIndex || isCompleted;
          const isCurrent = idx === currentStageIndex && !isCompleted;
          const isFuture = idx > currentStageIndex && !isCompleted;

          return (
            <div
              key={stage.key}
              className={`trial-stepper-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${isFuture ? 'is-future' : ''}`}
              title={`${stage.title}: ${stage.description}`}
            >
              <div className="step-indicator">
                {isDone ? (
                  <Check size={12} className="step-icon-done" aria-hidden="true" />
                ) : (
                  <span className="step-number">{stage.index + 1}</span>
                )}
                {isCurrent && <span className="step-pulse-ring" aria-hidden="true" />}
              </div>

              <div className="step-content">
                <div className="step-header-text">
                  <span className="step-title">{stage.title}</span>
                  {isCurrent && (
                    <span className="step-live-pill" aria-label="Giai đoạn đang diễn ra">
                      Đang diễn ra
                    </span>
                  )}
                </div>
                <span className="step-sublabel">{stage.shortLabel}</span>
              </div>

              {idx < TRIAL_STAGES.length - 1 && (
                <div
                  className={`trial-stepper-connector ${idx < currentStageIndex ? 'is-done' : ''}`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="trial-stepper-meta">
        {currentIssue && !isCompleted && (
          <div className="stepper-issue-tag" title={`Trọng tâm đang xét hỏi/tranh tụng: ${currentIssue}`}>
            <Scale size={13} className="text-sky-400 shrink-0" aria-hidden="true" />
            <span className="issue-label">Trọng tâm:</span>
            <strong className="issue-name">{currentIssue}</strong>
          </div>
        )}

        <div className="stepper-turns-gauge" title={`Số lượt phát biểu của bạn: ${userTurns}/${maxTurns} lượt`}>
          <div className="turns-label-group">
            <span className="turns-text">Phát biểu:</span>
            <strong className={`turns-value ${isNearLimit ? 'text-amber-400' : ''}`}>
              {userTurns}/{maxTurns}
            </strong>
          </div>
          <div className="mini-progress-bar" aria-hidden="true">
            <div
              className={`mini-progress-fill ${isNearLimit ? 'is-warning' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

