import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** DOM mount inside {@link WizardShell} `.workspace-main` after the active step form. */
export const LENS_STEP_FOOTER_HOST_ID = 'manta-lens-step-footer-host'

/**
 * Renders lens “step rail” UI (issues tray, Fix Issues, etc.) at the bottom of the
 * wizard step column instead of inside the floating lens overlay.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function LensStepFooterPortal({ children }) {
  const [node, setNode] = useState(/** @type {HTMLElement | null} */ (null))

  useLayoutEffect(() => {
    setNode(document.getElementById(LENS_STEP_FOOTER_HOST_ID))
  }, [])

  if (!node) return null
  return createPortal(children, node)
}
