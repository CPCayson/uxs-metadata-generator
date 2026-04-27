/**
 * DOM target for the Manta scanner portal (shared so {@link MantaScannerFrame.jsx} can stay
 * a components-only file for fast refresh).
 *
 * Prefer, in order:
 *   1. [data-manta-scanner-prefer="true"] — e.g. tutorial sample panel
 *   2. #manta-scanner-host — form + side rail
 *   … then main column, then body. No `.workspace-side-stack` only.
 *
 * @returns {HTMLElement}
 */
export function getMantaScannerPortalTarget() {
  const prefer = document.querySelector('[data-manta-scanner-prefer="true"]')
  if (prefer instanceof HTMLElement) return prefer

  const byId = document.getElementById('manta-scanner-host')
  if (byId instanceof HTMLElement) return byId

  const byAttr = document.querySelector('[data-manta-scanner-host]')
  if (byAttr instanceof HTMLElement) return byAttr

  const byClass = document.querySelector('.manta-scanner-host')
  if (byClass instanceof HTMLElement) return byClass

  // Full wizard surface (mission steps + tools) when host is missing
  const main = document.getElementById('pilot-main') ?? document.querySelector('main.pilot-shell')
  if (main instanceof HTMLElement) return main

  return document.body
}
