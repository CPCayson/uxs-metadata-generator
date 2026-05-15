import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * In-app confirm — avoids native `window.confirm` flicker when the tree remounts or
 * extension/import confirms stack on the same click.
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function PilotConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (!open) return undefined
    openedAtRef.current = Date.now()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0)
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="pilot-confirm-backdrop" role="presentation">
      <div
        className="pilot-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pilot-confirm-title"
        aria-describedby="pilot-confirm-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="pilot-confirm-title" className="pilot-confirm-dialog__title">
          {title}
        </h2>
        <p id="pilot-confirm-desc" className="pilot-confirm-dialog__message">
          {message}
        </p>
        <div className="pilot-confirm-dialog__actions">
          <button type="button" className="button button-secondary button-tiny" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`button button-tiny${danger ? ' pilot-confirm-dialog__confirm--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
