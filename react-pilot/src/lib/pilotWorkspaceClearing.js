/** @type {boolean} */
let workspaceClearing = false

export function setPilotWorkspaceClearing(active) {
  workspaceClearing = Boolean(active)
  if (typeof window !== 'undefined') {
    window.__mantaWorkspaceClearing = workspaceClearing
  }
}

export function isPilotWorkspaceClearing() {
  return workspaceClearing
}
