/**
 * Pilot wizard step tabs — compact strip only (no stream / hero panel).
 *
 * @param {{
 *   steps: Array<{ id: string, label: string }>,
 *   activeStep: string,
 *   onSelect: (id: string) => void,
 *   stepStatus?: Record<string, 'ok'|'warn'|'err'|'pending'>,
 * }} props
 */

const STEP_STATUS_LABELS = {
  pending: 'Step not reviewed yet',
  ok: 'No issues on this step',
  warn: 'Warnings on this step',
  err: 'Errors on this step',
}

/** Sighted, compact; screen readers get full `STEP_STATUS_LABELS` on the tab. */
const STEP_STATUS_VISIBLE = {
  pending: 'Not reviewed',
  ok: 'No issues',
  warn: 'Warnings',
  err: 'Errors',
}

export default function StepNav({ steps, activeStep, onSelect, stepStatus = {} }) {
  return (
    <nav
      className="header-nav metadata-nav-wrap pilot-step-nav pilot-step-nav--compact"
      aria-label="Pilot steps"
    >
      <div className="metadata-nav-inner pilot-step-nav__row pilot-step-nav__row--tabs-only w-100">
        <ul className="nav nav-tabs metadata-tabs pilot-metadata-tabs" role="tablist">
          {steps.map((step, idx) => {
            const st = stepStatus[step.id] || 'pending'
            const statusLabel = STEP_STATUS_LABELS[st] || 'Status unknown'
            const stepIndex = String(idx + 1).padStart(2, '0')
            return (
              <li key={step.id} className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  id={`pilot-step-tab-${step.id}`}
                  aria-selected={activeStep === step.id}
                  aria-controls={`pilot-wizard-section-${step.id}`}
                  aria-label={`${step.label}: ${statusLabel}`}
                  title={`${step.label}: ${statusLabel}`}
                  className={`nav-link nav-link--step-${st}${activeStep === step.id ? ' active' : ''}`}
                  onClick={() => onSelect(step.id)}
                >
                  <span className="pilot-step-nav__index" aria-hidden="true">{stepIndex}</span>
                  <span className="pilot-step-nav__label">{step.label}</span>
                  <span className="pilot-step-nav__status" title={statusLabel} aria-hidden="true">
                    {STEP_STATUS_VISIBLE[st] ?? '—'}
                  </span>
                  <span className="pilot-step-nav__dot" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
