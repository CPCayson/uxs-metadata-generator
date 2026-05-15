/** @typedef {() => void} WorkspaceClearExecutor */

/** @type {WorkspaceClearExecutor | null} */
let executor = null

/** @param {WorkspaceClearExecutor | null} fn */
export function registerWorkspaceClearExecutor(fn) {
  executor = typeof fn === 'function' ? fn : null
}

export function requestWorkspaceClear() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('manta:request-workspace-clear'))
}

export function runWorkspaceClearExecutor() {
  if (typeof executor === 'function') executor()
}
