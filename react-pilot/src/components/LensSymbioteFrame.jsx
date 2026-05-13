/**
 * Lens symbiote: **portals under the active field’s group** (e.g. after Abstract’s
 * `.mfg-field`) so copy stays in that section — not the wizard footer.
 *
 * @module components/LensSymbioteFrame
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getFieldElementForPilot } from '../core/registry/FieldRegistry.js'

const GROUP_SEL =
  '.form-group, .form-row, .form-row-2, .keyword-facet, .sensor-card, .input-group, .pilot-multivalue, .field-help, fieldset.pilot-fieldset, .mfg-field'

const HOST_CLS = 'manta-lens-symbiote-field-host'
const FIELD_ACTIVE = 'manta-lens-symbiote-field-active'

const RAF_RETRIES = 36

/**
 * @param {{
 *   show: boolean,
 *   inFixWalk?: boolean,
 *   fieldPath: string | null,
 *   fieldLabel?: string | null,
 *   issueMessage?: string | null,
 *   issueSeverity?: 'error' | 'warn' | null,
 *   guidedWalk?: boolean,
 *   moreIssueCount?: number,
 *   primaryIssue?: { field?: string, message?: string, severity?: string } | null,
 *   symbioteActionChips?: Array<{
 *     id: string,
 *     kind: string,
 *     label: string,
 *     action?: string,
 *     fieldPath?: string,
 *     value?: unknown,
 *     helpText?: string,
 *   }>,
 *   showSafeDefaults?: boolean,
 *   onWhy?: (issue: { field?: string, message?: string, severity?: string }) => void,
 *   onSymbioteChip?: (
 *     chip: { id: string, kind: string, label: string, helpText?: string },
 *     issue: { field?: string, message?: string, severity?: string },
 *   ) => void,
 *   onSafeDefaults?: () => void,
 *   onClearField?: () => void,
 *   lensAsk?: null | { issue: { field?: string }, answer: string },
 *   onDismissLensAsk?: () => void,
 * }} props
 */
export default function LensSymbioteFrame({
  show,
  inFixWalk = false,
  fieldPath,
  fieldLabel,
  issueMessage,
  issueSeverity,
  guidedWalk = false,
  moreIssueCount = 0,
  primaryIssue = null,
  symbioteActionChips = [],
  showSafeDefaults = false,
  onWhy,
  onSymbioteChip,
  onSafeDefaults,
  onClearField,
  lensAsk = null,
  onDismissLensAsk,
}) {
  const [host, setHost] = useState(/** @type {HTMLElement | null} */ (null))
  const wrapElRef = useRef(/** @type {HTMLElement | null} */ (null))
  const hostElRef = useRef(/** @type {HTMLElement | null} */ (null))

  useEffect(() => {
    if (!show || !fieldPath) {
      const w = wrapElRef.current
      if (w) {
        w.classList.remove(FIELD_ACTIVE)
        wrapElRef.current = null
      }
      const h = hostElRef.current
      if (h?.parentNode) {
        try {
          h.remove()
        } catch {
          /* */
        }
      }
      hostElRef.current = null
      setHost(null)
      return undefined
    }

    let cancelled = false
    let raf = 0
    let attempts = 0

    function teardownPrev() {
      const w = wrapElRef.current
      if (w) {
        w.classList.remove(FIELD_ACTIVE)
        wrapElRef.current = null
      }
      const h = hostElRef.current
      if (h?.parentNode) {
        try {
          h.remove()
        } catch {
          /* */
        }
      }
      hostElRef.current = null
      setHost(null)
    }

    function tryMount() {
      if (cancelled) return true
      const el = getFieldElementForPilot(fieldPath)
      if (!(el instanceof HTMLElement)) return false
      const wrap = el.closest('.mfg-field') || el.closest(GROUP_SEL)
      if (!(wrap instanceof HTMLElement)) return false

      teardownPrev()

      const hostEl = document.createElement('div')
      hostEl.className = HOST_CLS
      wrap.insertAdjacentElement('afterend', hostEl)
      wrap.classList.add(FIELD_ACTIVE)
      wrapElRef.current = wrap
      hostElRef.current = hostEl
      setHost(hostEl)
      return true
    }

    function tick() {
      if (cancelled) return
      if (tryMount()) return
      attempts += 1
      if (attempts < RAF_RETRIES) raf = window.requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      teardownPrev()
    }
  }, [show, fieldPath])

  if (!show || !fieldPath) return null

  const title = (fieldLabel && String(fieldLabel).trim()) || fieldPath
  const msgClass = [
    'manta-lens-symbiote-in-card__msg',
    issueMessage
      ? issueSeverity === 'error'
        ? 'manta-lens-symbiote-in-card__msg--error'
        : issueSeverity === 'warn'
          ? 'manta-lens-symbiote-in-card__msg--warn'
          : 'manta-lens-symbiote-in-card__msg--info'
      : 'manta-lens-symbiote-in-card__msg--idle',
  ].join(' ')

  const showActions =
    !inFixWalk &&
    (Boolean(issueMessage) ||
      symbioteActionChips.length > 0 ||
      showSafeDefaults ||
      Boolean(primaryIssue))

  const askField = lensAsk?.issue?.field != null ? String(lensAsk.issue.field) : ''
  const showInlineLensAsk = Boolean(lensAsk && fieldPath && askField === String(fieldPath))

  const inner = (
    <div className="manta-lens-symbiote-in-card manta-lens-symbiote-in-card--field-dock" aria-label="Lens field context">
      {showActions ? (
        <div className="manta-lens-symbiote-in-card__actions" role="region" aria-label="Lens field actions">
          <div className="manta-lens-symbiote-in-card__actions-head">
            <span className="manta-lens-symbiote-in-card__brand">Lens</span>
            {guidedWalk ? (
              <span className="manta-lens-symbiote-in-card__badge" title="Fix walk is targeting this field">
                Guided fix
              </span>
            ) : null}
            {moreIssueCount > 0 ? (
              <span className="manta-lens-symbiote-in-card__count" title="More issues on this field">
                +{moreIssueCount}
              </span>
            ) : null}
          </div>
          <div className="manta-lens-symbiote-in-card__title" title={title}>
            {title}
          </div>
          {issueMessage ? (
            <p className={msgClass}>{issueMessage}</p>
          ) : (
            <p className={msgClass}>No scoped checks surfaced for this field yet.</p>
          )}
          <div className="manta-lens-symbiote-in-card__btn-row">
            <button
              type="button"
              className="manta-lens-inline-glass__btn manta-lens-inline-glass__btn--primary"
              disabled={!primaryIssue}
              title={primaryIssue ? 'Explain this check and show field guidance' : undefined}
              onClick={() => primaryIssue && onWhy?.(primaryIssue)}
            >
              Why?
            </button>
            {symbioteActionChips.map((chip) => {
              const muted = chip.kind === 'help'
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={
                    muted
                      ? 'manta-lens-inline-glass__btn manta-lens-inline-glass__btn--muted'
                      : 'manta-lens-inline-glass__btn manta-lens-inline-glass__btn--fill'
                  }
                  title={chip.helpText ?? chip.label}
                  onClick={() => primaryIssue && onSymbioteChip?.(chip, primaryIssue)}
                >
                  {chip.label}
                </button>
              )
            })}
            {showSafeDefaults ? (
              <button
                type="button"
                className="manta-lens-inline-glass__btn manta-lens-inline-glass__btn--muted"
                title="Record-wide mechanical fixes (trim, defaults)"
                onClick={() => onSafeDefaults?.()}
              >
                Safe defaults
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showInlineLensAsk ? (
        <div className="manta-lens-ask-answer manta-lens-ask-answer--symbiote-field-dock" aria-live="polite">
          <div className="manta-lens-ask-answer__label">
            <span>ℹ</span>
            <code>{lensAsk.issue.field?.split('.').pop() ?? ''}</code>
            <button type="button" className="manta-lens-ask-answer__close" onClick={() => onDismissLensAsk?.()}>
              ✕
            </button>
          </div>
          <p className="manta-lens-ask-answer__text">{lensAsk.answer}</p>
        </div>
      ) : null}

      <div className="manta-lens-symbiote-rail" role="status">
        <div className="manta-lens-symbiote-rail__left">
          <span className="manta-lens-symbiote-rail__pill" aria-live="polite">
            <span className="manta-lens-symbiote-rail__dot" aria-hidden="true" />
            <span className="manta-lens-symbiote-rail__field-prefix">field:</span>
            <code className="manta-lens-symbiote-rail__path">{fieldPath}</code>
            <button
              type="button"
              className="manta-lens-symbiote-rail__clear"
              onClick={() => onClearField?.()}
              title="Clear field highlight"
              aria-label="Clear field highlight"
            >
              ✕
            </button>
          </span>
        </div>
        <div className="manta-lens-symbiote-rail__kbd" aria-label="Keyboard shortcuts">
          {inFixWalk ? (
            <>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">Esc</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">j</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">k</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">n</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">p</kbd>
            </>
          ) : (
            <>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">Esc</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">j</kbd>
              <kbd className="manta-lens-symbiote-rail__kbd-pill">k</kbd>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (!host) return null
  return createPortal(inner, host)
}
