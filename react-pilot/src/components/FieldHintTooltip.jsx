import { useId } from 'react'

/**
 * Compact ⓘ control — long guidance lives in the hover/focus bubble (not under every field).
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   ariaLabel?: string,
 *   className?: string,
 * }} props
 */
export default function FieldHintTooltip({ children, ariaLabel = 'Field guidance', className = '' }) {
  const uid = useId()
  const bubbleId = `field-hint-${uid}`

  return (
    <span className={['field-hint-tooltip', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="field-hint-tooltip__trigger"
        aria-label={ariaLabel}
        aria-describedby={bubbleId}
      >
        ⓘ
      </button>
      <span id={bubbleId} role="tooltip" className="field-hint-tooltip__bubble">
        {children}
      </span>
    </span>
  )
}

/**
 * Flex row: primary label + optional required star + tooltip — keeps hint off the baseline under inputs.
 */
export function LabelWithHint({ htmlFor, label, required, hint, hintAriaLabel }) {
  const hintTriggerAria =
    hintAriaLabel ??
    (typeof label === 'string' || typeof label === 'number' ? `Help: ${label}` : 'Field guidance')

  return (
    <div className="field-label-with-hint">
      <label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="field-label-with-hint__req" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? <FieldHintTooltip ariaLabel={hintTriggerAria}>{hint}</FieldHintTooltip> : null}
    </div>
  )
}
