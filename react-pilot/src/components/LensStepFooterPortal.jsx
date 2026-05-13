import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** DOM mount inside {@link WizardShell} `.workspace-main` after the active step form. */
export const LENS_STEP_FOOTER_HOST_ID = 'manta-lens-step-footer-host'

const RESOLVE_MS = 50
const RESOLVE_TRIES = 80

/**
 * Renders lens UI at the bottom of the wizard form column (`#manta-lens-step-footer-host`).
 * Retries briefly so content still mounts if AssistantShell renders before WizardShell.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function LensStepFooterPortal({ children }) {
  const [node, setNode] = useState(/** @type {HTMLElement | null} */ (null))

  useEffect(() => {
    const immediate = document.getElementById(LENS_STEP_FOOTER_HOST_ID)
    if (immediate instanceof HTMLElement) {
      setNode(immediate)
      return undefined
    }
    let tries = 0
    const id = window.setInterval(() => {
      tries += 1
      const el = document.getElementById(LENS_STEP_FOOTER_HOST_ID)
      if (el instanceof HTMLElement) {
        setNode(el)
        window.clearInterval(id)
        return
      }
      if (tries >= RESOLVE_TRIES) window.clearInterval(id)
    }, RESOLVE_MS)
    return () => window.clearInterval(id)
  }, [])

  if (!node) return null
  return createPortal(children, node)
}
