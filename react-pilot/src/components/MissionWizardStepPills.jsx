/**
 * Mission wizard step pills (step title inline; review status in tooltip to save width).
 * Rendered in #pilot-header-steps-slot above the XML tools strip, or inline when needed.
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

/**
 * @param {{
 *   wizardSteps: Array<{ id: string, label: string }>,
 *   activeWizardStep: string,
 *   onWizardStepSelect?: (id: string) => void,
 *   stepStatuses?: Record<string, 'ok'|'warn'|'err'|'pending'>,
 *   quietSurface?: boolean,
 * }} props
 * `quietSurface` is accepted for compatibility but ignored (status is always in the tooltip).
 */
export default function MissionWizardStepPills({
  wizardSteps,
  activeWizardStep,
  onWizardStepSelect,
  stepStatuses,
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
        const statusText = stepStatusLabel(st)
        const tip = `${step.label}: ${statusText}`
        return (
          <button
            key={step.id}
            type="button"
            className="pilot-header-step-pill"
            disabled={!clickable}
            onClick={() => onWizardStepSelect?.(step.id)}
            title={tip}
            aria-label={tip}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 10,
              border: `1px solid ${active ? 'color-mix(in srgb, var(--primary-color, #006994) 55%, var(--border-color))' : 'var(--border-color)'}`,
              background: active
                ? 'color-mix(in srgb, var(--primary-color, #006994) 10%, var(--card-bg))'
                : 'color-mix(in srgb, var(--card-bg) 96%, var(--text-color) 2%)',
              cursor: clickable ? 'pointer' : 'default',
              textAlign: 'center',
              minWidth: 0,
              flex: '1 1 0',
              width: '100%',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <span className="pilot-header-step-pill__label">{step.label}</span>
          </button>
        )
      })}
    </div>
  )
}
