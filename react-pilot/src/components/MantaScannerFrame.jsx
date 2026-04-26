import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** DOM id: wizard workspace grid that should frame the lens HUD (see WizardShell). */
const SCANNER_HOST_ID = 'manta-scanner-host'

/**
 * Lens canvas (product layout) — the HUD is a flex column; the “through-glass”
 * band must stay between the top chrome and the issues tray (see `.manta-lens--viewport`
 * in futuristic.css). Two surfaces: `workspace-main` (form, left) + `workspace-side-stack`
 * (right: Validator, then Live XML). Portal here so the overlay is a child of the grid host, not
 * a stray node under the floating widget shell.
 *
 *   +-- HUD bar (targets, score, exit) ------------------------+
 *   +-- section bars + optional fix guide --------------------+
 *   +-- [ through-glass: pointer-events none, tint/scanline ]  |
 *   |     (full form + side rail visible underneath)         |
 *   +-- issues tray (pointer-events auto) ---------------------+
 */
export default function MantaScannerFrame({ children }) {
  const [host, setHost] = useState(/** @type {HTMLElement | null} */ (null))

  useLayoutEffect(() => {
    setHost(document.getElementById(SCANNER_HOST_ID))
  }, [])

  if (host) {
    return createPortal(children, host)
  }

  // Embed/tests: no wizard host — full-viewport frame (matches lens z-index)
  return <div className="manta-lens-fallback-host">{children}</div>
}
