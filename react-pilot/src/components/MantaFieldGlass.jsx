/**
 * MantaFieldGlass — inline Lens chips for any form field.
 *
 * Wraps label + input + hint with:
 *   - Status chip: Detected / Good / Warning / Error / Optional
 *   - Length chip (for text fields ≥ 100 chars)
 *   - "Ask me more" button that fires manta:lens-goto-field
 *   - Suppresses native .field-error when lens chip is showing
 *
 * Usage:
 *   <MantaFieldGlass
 *     fieldPath="mission.abstract"
 *     value={mission.abstract}
 *     issues={issues}
 *     label="Abstract"
 *     required
 *     hint="Describe the mission, platform, instruments, and area."
 *     showValidationChrome={touched['mission.abstract'] || showAllErrors}
 *   >
 *     <textarea ... />
 *   </MantaFieldGlass>
 */

import { memo } from 'react'
import FieldHintTooltip from './FieldHintTooltip.jsx'

// ── Chip definitions ──────────────────────────────────────────────────────────

const CHIP = {
  detected:   { label: '✓ Detected',    bg: '#dcfce7', text: '#14532d', border: '#16a34a44' },
  good:       { label: '◎ Good length', bg: '#dbeafe', text: '#1e3a8a', border: '#3b82f644' },
  optional:   { label: '◌ Optional',    bg: 'var(--card-bg)', text: 'var(--text-muted)', border: 'var(--border-color)' },
  warning:    { label: '⚠ Warning',     bg: '#fefce8', text: '#713f12', border: '#ca8a0455' },
  error:      { label: '✗ Error',       bg: '#fee2e2', text: '#7f1d1d', border: '#dc262655' },
  suggestion: { label: '☆ Suggestion',  bg: '#f0f9ff', text: '#0369a1', border: '#0284c744' },
}

function StatusChip({ type, label: overrideLabel }) {
  const c = CHIP[type] ?? CHIP.optional
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      padding: '1px 8px',
      borderRadius: 9999,
      whiteSpace: 'nowrap',
      lineHeight: 1.6,
    }}>
      {overrideLabel ?? c.label}
    </span>
  )
}

function AskMoreButton({ fieldPath }) {
  function handleClick() {
    // Open Lens first, then navigate to Ask tab and highlight the field.
    // manta:lens-opened is dispatched by AssistantShell when it opens;
    // we fire goto-field after a short tick so the lens has time to mount.
    window.dispatchEvent(new CustomEvent('manta:lens-opened'))
    window.dispatchEvent(new CustomEvent('manta:assistant-tab', { detail: { tab: 'ask' } }))
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('manta:lens-goto-field', { detail: { field: fieldPath } }))
    }, 80)
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: '0.68rem',
        fontWeight: 700,
        background: 'var(--card-bg)',
        color: 'var(--primary-color, #006994)',
        border: '1px solid var(--border-color)',
        padding: '1px 9px',
        borderRadius: 9999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        lineHeight: 1.6,
      }}
      title={`Get Manta guidance for ${fieldPath}`}
    >
      ☆ Ask me more
    </button>
  )
}

// ── Chip row logic ────────────────────────────────────────────────────────────

function resolveChips({
  fieldPath,
  value,
  issues,
  required,
  textLengthThreshold = 80,
  showValidationChrome = true,
}) {
  const str = typeof value === 'string' ? value.trim() : ''
  const hasValue = str.length > 0
  const fieldIssues = issues.filter((iss) =>
    iss.field === fieldPath || String(iss.field || '').startsWith(fieldPath + '.'),
  )
  const errors   = fieldIssues.filter((i) => i.severity === 'e')
  const warnings = fieldIssues.filter((i) => i.severity === 'w')

  const chips = []

  // Match useFieldValidation: until the field is touched or "show all" is on, stay neutral (Start fresh).
  if (!showValidationChrome) {
    if (!hasValue) {
      chips.push({ type: 'optional' })
    } else {
      chips.push({ type: 'detected' })
      if (typeof value === 'string' && value.trim().length >= textLengthThreshold) {
        chips.push({ type: 'good' })
      }
    }
    return chips
  }

  if (!hasValue) {
    chips.push(required ? { type: 'error', label: '✗ Required' } : { type: 'optional' })
  } else {
    chips.push({ type: 'detected' })
    if (typeof value === 'string' && value.trim().length >= textLengthThreshold) {
      chips.push({ type: 'good' })
    }
  }

  if (errors.length > 0) {
    chips.push({ type: 'error', label: `✗ ${errors[0].message}` })
  } else if (warnings.length > 0) {
    chips.push({ type: 'warning', label: `⚠ ${warnings[0].message}` })
  }

  return chips
}

// ── Main component ────────────────────────────────────────────────────────────

function MantaFieldGlass({
  fieldPath,
  value,
  issues = [],
  label,
  required = false,
  hint,
  children,
  textLengthThreshold,
  hideAskMore = false,
  compact = false,
  /** When false, no red required/issue chrome until user touches the field or enables show-all (same as field validation). */
  showValidationChrome = true,
}) {
  const chips = resolveChips({
    fieldPath,
    value,
    issues,
    required,
    textLengthThreshold,
    showValidationChrome,
  })
  const hasError = chips.some((c) => c.type === 'error')
  const hasWarning = chips.some((c) => c.type === 'warning')

  return (
    <div
      className="mfg-field"
      data-mfg-field={fieldPath}
      style={{
        position: 'relative',
        marginBottom: compact ? '0.65rem' : '0.9rem',
      }}
    >
      {/* label row — guidance in ⓘ tooltip instead of a paragraph under the field */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: 3, flexWrap: 'wrap' }}>
        <label
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: hasError ? '#dc2626' : 'var(--text-color)',
            margin: 0,
          }}
        >
          {label}
          {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
        </label>
        {hint ? (
          <FieldHintTooltip ariaLabel={`Guidance for ${label}`}>{hint}</FieldHintTooltip>
        ) : null}
      </div>

      {/* input slot */}
      <div style={{
        borderRadius: 6,
        outline: hasError
          ? '1.5px solid #dc2626'
          : hasWarning
          ? '1.5px solid #ca8a04'
          : 'none',
        transition: 'outline 0.1s',
      }}>
        {children}
      </div>

      {/* chip row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 5,
        marginTop: 4,
      }}>
        {chips.map((chip, i) => (
          <StatusChip key={i} type={chip.type} label={chip.label} />
        ))}
        {/* If field has an error, show Quick Fix button that fires the real auto-fix pipeline */}
        {hasError && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('manta:pilot-auto-fix-request', { detail: { mode: 'lenient' } }))}
            title="Apply safe mechanical fixes (trim, dates, defaults)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.68rem', fontWeight: 700,
              background: '#fee2e2', color: '#7f1d1d',
              border: '1px solid #dc262644',
              padding: '1px 8px', borderRadius: 9999, cursor: 'pointer',
              lineHeight: 1.6,
            }}
          >
            ⚡ Quick fix
          </button>
        )}
        {!hideAskMore && (
          <AskMoreButton fieldPath={fieldPath} />
        )}
      </div>
    </div>
  )
}

export default memo(MantaFieldGlass)
export { StatusChip, AskMoreButton }
