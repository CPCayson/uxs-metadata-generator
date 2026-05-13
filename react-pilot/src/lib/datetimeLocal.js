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
 * Coerce `YYYYMMDD` or bare `YYYY` (common in ISO XML) to `YYYY-MM-DD` when the calendar date is real.
 * @param {string} raw
 * @returns {string}
 */
function coerceIsoDateLikeToStorage(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (/^\d{8}$/.test(t)) {
    const y = t.slice(0, 4)
    const mo = t.slice(4, 6)
    const da = t.slice(6, 8)
    const iso = `${y}-${mo}-${da}`
    const d = Date.parse(`${iso}T12:00:00`)
    return Number.isFinite(d) ? iso : ''
  }
  if (/^\d{4}$/.test(t)) {
    const y = Number(t)
    if (y >= 1000 && y <= 9999) return `${t}-01-01`
  }
  return ''
}

/**
 * Return '' or a storage-friendly instant: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (no seconds, no TZ).
 * Unrecognized shapes become '' so controlled `datetime-local` inputs stay in sync with state.
 * @param {unknown} v
 * @returns {string}
 */
export function canonicalMissionInstantForStorage(v) {
  const s0 = normalizeMissionInstantString(v)
  if (!s0) return ''
  const coerced = coerceIsoDateLikeToStorage(s0)
  const s = coerced || s0
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

/**
 * Format a mission instant for `gco:DateTime` / XSD `xs:dateTime`: always includes a seconds field
 * (`:00` when the pilot stored minute-only `datetime-local`), preserves fractional seconds when present,
 * and keeps a trailing `Z` or `±HH:MM` / `±HHMM` offset when present.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function formatMissionInstantAsXsDateTime(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const withT = raw.replace(/^(\d{4}-\d{2}-\d{2})[ T](?=\d{2})/, '$1T')
  const head = withT.match(/^(\d{4}-\d{2}-\d{2})T(.+)$/i)
  if (!head) return withT
  const datePart = head[1]
  let rest = head[2]
  let tz = ''
  if (/Z$/i.test(rest)) {
    tz = 'Z'
    rest = rest.slice(0, -1)
  } else {
    const om = rest.match(/([+-]\d{2}:\d{2})$/) || rest.match(/([+-]\d{4})$/)
    if (om) {
      tz = om[1]
      rest = rest.slice(0, -tz.length)
    }
  }
  const timeM = rest.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/i)
  if (!timeM) return withT
  const sec = timeM[3] != null && timeM[3] !== '' ? timeM[3] : '00'
  const fracPart = timeM[4] != null && timeM[4] !== '' ? `.${timeM[4]}` : ''
  if (!tz) {
    tz = 'Z'
  }
  return `${datePart}T${timeM[1]}:${timeM[2]}:${sec}${fracPart}${tz}`
}
