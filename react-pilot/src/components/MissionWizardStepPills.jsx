/**
 * Mission wizard step pills (labels + per-step review status).
 * Rendered in #pilot-header-steps-slot next to XML tools, or inline when needed.
 */

/** @param {'ok'|'warn'|'err'|'pending'|undefined} st */
function stepStatusLabel(st) {
  switch (st) {
    case 'ok':
      return 'OK'
    case 'warn':
      return 'Warnings'
    case 'err':
      return 'Errors'
    default:
      return 'Not reviewed'
  }
}

/** @param {'ok'|'warn'|'err'|'pending'|undefined} st */
function stepStatusSubColor(st) {
  switch (st) {
    case 'ok':
      return '#15803d'
    case 'warn':
      return '#a16207'
    case 'err':
      return '#b91c1c'
    default:
      return 'var(--text-muted)'
  }
}

/**
 * @param {{
 *   wizardSteps: Array<{ id: string, label: string }>,
 *   activeWizardStep: string,
 *   onWizardStepSelect?: (id: string) => void,
 *   stepStatuses?: Record<string, 'ok'|'warn'|'err'|'pending'>,
 *   quietSurface?: boolean,
 * }} props
 */
export default function MissionWizardStepPills({
  wizardSteps,
  activeWizardStep,
  onWizardStepSelect,
  stepStatuses,
  quietSurface = false,
}) {
  if (!wizardSteps?.length) return null

  return (
    <div
      role="navigation"
      aria-label="Wizard steps"
      className="pilot-header-mission-steps"
    >
      {wizardSteps.map((step) => {
        const active = activeWizardStep === step.id
        const clickable = typeof onWizardStepSelect === 'function'
        const st = stepStatuses?.[step.id]
        const subLabel = stepStatusLabel(st)
        const subColor = stepStatusSubColor(st)
        const showStepSub = !quietSurface || st === 'ok' || st === 'warn' || st === 'err'
        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => onWizardStepSelect?.(step.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              padding: '0.35rem 0.55rem',
              borderRadius: 8,
              border: `1px solid ${active ? 'color-mix(in srgb, var(--primary-color, #006994) 55%, var(--border-color))' : 'var(--border-color)'}`,
              background: active
                ? 'color-mix(in srgb, var(--primary-color, #006994) 10%, var(--card-bg))'
                : 'color-mix(in srgb, var(--card-bg) 96%, var(--text-color) 2%)',
              cursor: clickable ? 'pointer' : 'default',
              textAlign: 'center',
              minWidth: '6.5rem',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-color)', lineHeight: 1.25 }}>
              {step.label}
            </span>
            {showStepSub ? (
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: subColor }}>
                {subLabel}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
