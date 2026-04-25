/**
 * @param {{
 *   steps: Array<{ id: string, label: string }>,
 *   activeStep: string,
 *   onSelect: (id: string) => void,
 *   stepStatus?: Record<string, 'ok'|'warn'|'err'>,
 * }} props
 */
const STEP_NAV_GRAPHIC_SRC = `${import.meta.env.BASE_URL}aitubo.mp4`

// Tiny inline gradient (cyan → deep blue) used as poster so the slot never
// flashes blank before the mp4 decodes, and also when hosted in contexts
// (e.g. some embedded hosts) where the mp4 can't be served relatively.
const STEP_NAV_POSTER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 390">
      <defs>
        <radialGradient id="g" cx="70%" cy="50%" r="70%">
          <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.55"/>
          <stop offset="45%" stop-color="#2563eb" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="720" height="390" fill="url(#g)"/>
    </svg>`,
  )

const STEP_STATUS_LABELS = {
  ok: 'No issues on this step',
  warn: 'Warnings on this step',
  err: 'Errors on this step',
}

/** Sighted, compact; screen readers get full `STEP_STATUS_LABELS` on the tab. */
const STEP_STATUS_VISIBLE = {
  ok: 'No issues',
  warn: 'Warnings',
  err: 'Errors',
}

export default function StepNav({ steps, activeStep, onSelect, stepStatus = {} }) {
  return (
    <nav className="header-nav metadata-nav-wrap pilot-step-nav" aria-label="Pilot steps">
      <div className="metadata-nav-inner pilot-step-nav__row w-100">
        <ul className="nav nav-tabs metadata-tabs pilot-metadata-tabs" role="tablist">
          {steps.map((step) => {
            const st = stepStatus[step.id] || 'ok'
            const statusLabel = STEP_STATUS_LABELS[st] || 'Status unknown'
            return (
              <li key={step.id} className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStep === step.id}
                  aria-label={`${step.label}: ${statusLabel}`}
                  title={`${step.label}: ${statusLabel}`}
                  className={`nav-link nav-link--step-${st}${activeStep === step.id ? ' active' : ''}`}
                  onClick={() => onSelect(step.id)}
                >
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
        <div className="pilot-step-nav__stream" aria-hidden="true">
          <video
            className="pilot-step-nav__graphic"
            src={STEP_NAV_GRAPHIC_SRC}
            poster={STEP_NAV_POSTER}
            width={720}
            height={390}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
            onError={(e) => {
              // Hide the whole stream if the video can't load (e.g. Apps
              // Script single-file deploy where relative mp4 has no host).
              const wrap = e.currentTarget.closest('.pilot-step-nav__stream')
              if (wrap) wrap.style.display = 'none'
            }}
          />
          <span className="pilot-step-nav__stream-scan" />
          <span className="pilot-step-nav__stream-grid" />
        </div>
      </div>
    </nav>
  )
}
