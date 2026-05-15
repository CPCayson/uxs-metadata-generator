/** @typedef {{ t: number, kind: string, detail?: string, ok?: boolean }} PilotDebugEntry */

const MAX = 100
/** @type {PilotDebugEntry[]} */
let buffer = []
/** @type {Set<(e: PilotDebugEntry[]) => void>} */
const subs = new Set()

/**
 * @returns {boolean}
 */
export function pilotDebugEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  } catch {
    return false
  }
}

/**
 * @param {Omit<PilotDebugEntry, 't'> & { t?: number }} entry
 */
export function pushPilotDebug(entry) {
  if (!pilotDebugEnabled()) return
  const row = { t: entry.t ?? Date.now(), kind: entry.kind, detail: entry.detail, ok: entry.ok }
  buffer.push(row)
  if (buffer.length > MAX) buffer = buffer.slice(-MAX)
  subs.forEach((fn) => {
    try {
      fn(buffer.slice())
    } catch {
      // ignore subscriber errors
    }
  })
}

/**
 * @param {(e: PilotDebugEntry[]) => void} fn
 * @returns {() => void}
 */
export function subscribePilotDebug(fn) {
  subs.add(fn)
  try {
    fn(buffer.slice())
  } catch {
    // ignore
  }
  return () => subs.delete(fn)
}

export function getPilotDebugSnapshot() {
  return buffer.slice()
}

/**
 * Workspace lifecycle (Start over, session write, init) — always logs in dev; also feeds `?debug=1` buffer.
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
export function logPilotWorkspace(event, detail = {}) {
  const row = { event, t: new Date().toISOString(), ...detail }
  if (typeof console !== 'undefined') {
    try {
      // eslint-disable-next-line no-console
      console.info('[manta:pilot-workspace]', row)
    } catch {
      // ignore
    }
  }
  try {
    pushPilotDebug({
      kind: `workspace:${event}`,
      detail: JSON.stringify(detail).slice(0, 280),
    })
  } catch {
    // ignore
  }
}

/** @param {unknown} pilot */
export function pilotWorkspaceSnapshot(pilot) {
  if (!pilot || typeof pilot !== 'object') return { fileId: '', title: '' }
  const m = /** @type {{ mission?: { fileId?: string, title?: string } }} */ (pilot).mission
  return {
    fileId: String(m?.fileId ?? '').slice(0, 80),
    title: String(m?.title ?? '').slice(0, 60),
  }
}
