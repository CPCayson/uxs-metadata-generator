const SESSION_KEY = 'uxsReactPilotSessionV1'
const DEBOUNCE_MS = 450

let timer = null

/** Drop a pending debounced write so it cannot overwrite a fresh session after Start over. */
export function cancelScheduledPersistPilotSession() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

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
 * Heuristic: saved pilot looks user-edited or imported (not an empty shell).
 * Used when legacy session payloads omit `validationPrimed`.
 *
 * @param {unknown} pilot
 */
export function pilotSessionPilotLooksEngaged(pilot) {
  if (!pilot || typeof pilot !== 'object') return false
  const p = /** @type {Record<string, unknown>} */ (pilot)
  const m = p.mission && typeof p.mission === 'object' ? /** @type {Record<string, unknown>} */ (p.mission) : null
  if (!m) return false
  if (String(m.missionTitle || m.title || '').trim().length > 2) return true
  if (String(m.abstract || '').trim().length > 12) return true
  const identFi =
    p.ident && typeof p.ident === 'object'
      ? String(/** @type {{ fileIdentifier?: string }} */ (p.ident).fileIdentifier || '').trim()
      : ''
  if (identFi.length > 3) return true
  if (String(m.contactEmail || '').includes('@')) return true
  return false
}

/**
 * Initial {@link WizardShell} validation priming: idle until first edit/import unless session says otherwise.
 *
 * @returns {boolean}
 */
export function readInitialValidationPrimed() {
  try {
    const session = readPilotSessionPayload()
    if (!session) return false
    if (session.validationPrimed === false) return false
    if (session.validationPrimed === true) return true
    // Legacy payloads without `validationPrimed`: stay idle. Inferring from pilot fields
    // caused false positives once sanitized defaults / NCEI boilerplate populated title/abstract/etc.
    return false
  } catch {
    return false
  }
}

/**
 * @param {{ validationPrimed?: boolean, startFresh?: boolean }} [prev]
 * @param {{ validationPrimed?: boolean, startFresh?: boolean }} [meta]
 */
function resolveValidationPrimed(prev, meta) {
  if (meta?.validationPrimed !== undefined) return Boolean(meta.validationPrimed)
  if (prev && typeof prev === 'object' && prev.validationPrimed === false) return false
  if (prev && typeof prev === 'object' && prev.validationPrimed === true) return true
  return false
}

/** @param {object | null} prev @param {{ startFresh?: boolean }} [meta] */
function resolveStartFresh(prev, meta) {
  if (meta?.startFresh === true) return true
  if (meta?.startFresh === false) return false
  return false
}

/**
 * Write session immediately (used after Manta auto-fix so the widget re-reads fresh state).
 * @param {object} pilotState
 * @param {{ validationPrimed?: boolean, startFresh?: boolean }} [meta]
 */
export function writePilotSessionPayloadNow(pilotState, meta = {}) {
  if (typeof sessionStorage === 'undefined') return
  cancelScheduledPersistPilotSession()
  try {
    const prev = readPilotSessionPayload()
    const validationPrimed = resolveValidationPrimed(prev, meta)
    const startFresh = resolveStartFresh(prev, meta)
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        pilot: pilotState,
        savedAt: new Date().toISOString(),
        validationPrimed,
        ...(startFresh ? { startFresh: true } : {}),
      }),
    )
    notifyPilotSessionWritten()
  } catch {
    // Quota or privacy mode
  }
}

/**
 * @param {object} pilotState
 * @param {{ validationPrimed?: boolean }} [meta]
 */
export function schedulePersistPilotSession(pilotState, meta = {}) {
  if (typeof sessionStorage === 'undefined') return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    try {
      const prev = readPilotSessionPayload()
      const validationPrimed = resolveValidationPrimed(prev, meta)
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          pilot: pilotState,
          savedAt: new Date().toISOString(),
          validationPrimed,
          startFresh: false,
        }),
      )
      notifyPilotSessionWritten()
    } catch {
      // Quota or privacy mode
    }
  }, DEBOUNCE_MS)
}
