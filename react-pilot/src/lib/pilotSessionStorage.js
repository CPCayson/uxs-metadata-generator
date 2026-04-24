const SESSION_KEY = 'uxsReactPilotSessionV1'
const DEBOUNCE_MS = 450

let timer = null

function notifyPilotSessionWritten() {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('manta:pilot-session-updated'))
  } catch {
    /* ignore */
  }
}

/**
 * @returns {object | null}
 */
export function readPilotSessionPayload() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

/**
 * Write session immediately (used after Manta auto-fix so the widget re-reads fresh state).
 * @param {object} pilotState
 */
export function writePilotSessionPayloadNow(pilotState) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        pilot:     pilotState,
        savedAt:   new Date().toISOString(),
      }),
    )
    notifyPilotSessionWritten()
  } catch {
    // Quota or privacy mode
  }
}

/**
 * @param {object} pilotState
 */
export function schedulePersistPilotSession(pilotState) {
  if (typeof sessionStorage === 'undefined') return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          pilot: pilotState,
          savedAt: new Date().toISOString(),
        }),
      )
      notifyPilotSessionWritten()
    } catch {
      // Quota or privacy mode
    }
  }, DEBOUNCE_MS)
}
