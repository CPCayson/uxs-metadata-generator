import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** DOM id: `WizardShell` mounts this over `.workspace-grid` (dual surface). */
const SCANNER_HOST_ID = 'manta-scanner-host'

/**
 * Lens canvas — HUD is a flex column; “through-glass” is `flex:1` with
 * `pointer-events: none` so the wizard form + Validator/XML rail stay clickable
 * (see `.manta-lens--viewport` in futuristic.css). Host overlays **both** grid
 * columns (`.manta-workspace-lens-anchor`); tray order follows tuck-high / tuck-low.
 *
 *   +-- HUD bar (targets, score, exit) ------------------------+
 *   +-- readiness / section bars + optional fix guide ---------+
 *   +-- issues tray (tuck-high: here; tuck-low: after glass) --+
 *   +-- [ through-glass: pointer-events none ] ----------------+
 *   |     form column + side rail visible underneath          |
 *   +-- issues tray (tuck-low only) ---------------------------+
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
