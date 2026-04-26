import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** DOM id: wizard workspace grid that should frame the lens HUD (see WizardShell). */
const SCANNER_HOST_ID = 'manta-scanner-host'

/**
 * Lens canvas (product layout) — the HUD is a flex column; the “through-glass”
 * band must stay between the top chrome and the issues tray (see `.manta-lens--viewport`
 * in futuristic.css). Host = right-rail tabbed card (Validator / Live XML / CoMET), same
 * dimensions as that card; form stays outside the overlay (clicks on the form are never blocked).
 * Portal here so the overlay is not under the floating widget shell only.
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
