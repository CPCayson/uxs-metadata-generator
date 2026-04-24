/**
 * Bridge HTML datetime-local (YYYY-MM-DDTHH:mm) and stored mission strings.
 * Keep normalization aligned with `pilotValidation` instant checks.
 */

/**
 * Normalize ISO / legacy HtmlService-style date strings (space vs T, Z, offsets, fractional seconds).
 * @param {unknown} v
 * @returns {string}
 */
export function normalizeMissionInstantString(v) {
  let s = String(v ?? '').trim()
  if (!s) return ''
  s = s.replace(/^(\d{4}-\d{2}-\d{2})[ T](?=\d{2}:\d{2})/, '$1T')
  if (s.includes('T')) {
    s = s.replace(/(\.\d+)(?=Z|[+-]|$)/i, '')
    s = s.replace(/Z$/i, '')
    s = s.replace(/[+-]\d{2}:\d{2}$/, '')
  }
  return s.trim()
}

/**
 * Return '' or a storage-friendly instant: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (no seconds, no TZ).
 * Unrecognized shapes become '' so controlled `datetime-local` inputs stay in sync with state.
 * @param {unknown} v
 * @returns {string}
 */
export function canonicalMissionInstantForStorage(v) {
  const s = normalizeMissionInstantString(v)
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?/)
  if (m) {
    return `${m[1]}T${m[2]}:${m[3]}`
  }
  return ''
}

/**
 * @param {string} [v]
 * @returns {string} value for input[type=datetime-local]
 */
export function toDatetimeLocalValue(v) {
  const c = canonicalMissionInstantForStorage(v)
  if (!c) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return `${c}T00:00`
  return c
}

/**
 * @param {string} v from datetime-local input
 * @returns {string}
 */
export function fromDatetimeLocalValue(v) {
  let s = String(v ?? '').trim()
  if (!s) return ''
  s = s.replace(/^(\d{4}-\d{2}-\d{2})[ T](?=\d{2}:\d{2})/, '$1T')
  const ti = s.indexOf('T')
  if (ti !== -1) {
    const head = s.slice(0, ti + 1)
    let tail = s.slice(ti + 1)
    tail = tail.replace(/^(\d{2}:\d{2})(:\d{2})?(\.\d+)?/, (_, hm, sec) => (sec ? `${hm}${sec}` : hm))
    s = head + tail
  }
  return canonicalMissionInstantForStorage(s)
}
