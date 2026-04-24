/**
 * Deterministic auto-fixes for common validation problems (trim, ordering, safe defaults).
 * Does not invent missing business content (titles, DOIs, contacts, keywords).
 *
 * @module lib/pilotAutoFix
 */

import { normalizeMissionInstantString } from './datetimeLocal.js'

function isBlank(s) {
  return !String(s || '').trim()
}

/**
 * @param {object | null | undefined} obj
 * @param {string} prefix
 * @param {string[]} applied
 */
function trimStringRecord(obj, prefix, applied) {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const t = v.trim()
      if (t !== v) {
        obj[k] = t
        applied.push(`${prefix}.${k} (trim)`)
      }
    }
  }
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())
}

function isValidDateTimeLocal(s) {
  const v = normalizeMissionInstantString(String(s || '').trim())
  return v.length > 0 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)
}

function isValidMissionInstant(s) {
  const n = normalizeMissionInstantString(String(s || '').trim())
  if (!n) return false
  return isValidDate(n) || isValidDateTimeLocal(n)
}

function isValidNumber(s) {
  const v = String(s || '').trim()
  return v !== '' && !Number.isNaN(Number(v))
}

function cloneState(p) {
  return typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p))
}

/**
 * Apply safe mechanical fixes. Caller should run `profile.sanitize` on the result.
 *
 * @param {string} _mode lenient | strict | catalog (reserved for future mode-specific fixes)
 * @param {object} pilot
 * @returns {{ pilot: object, applied: string[] }}
 */
export function applyPilotAutoFixes(_mode, pilot) {
  const applied = []
  const out = cloneState(pilot)

  if (!out.mission || typeof out.mission !== 'object') out.mission = {}
  if (!out.platform || typeof out.platform !== 'object') out.platform = {}
  if (!out.spatial || typeof out.spatial !== 'object') out.spatial = {}
  if (!out.distribution || typeof out.distribution !== 'object') out.distribution = {}

  trimStringRecord(out.mission, 'mission', applied)
  trimStringRecord(out.platform, 'platform', applied)
  trimStringRecord(out.spatial, 'spatial', applied)
  trimStringRecord(out.distribution, 'distribution', applied)

  if (Array.isArray(out.sensors)) {
    out.sensors = out.sensors.map((s, i) => {
      if (!s || typeof s !== 'object') return s
      const copy = { ...s }
      for (const k of ['sensorId', 'type', 'modelId', 'variable', 'firmware', 'localId']) {
        if (typeof copy[k] === 'string') {
          const t = copy[k].trim()
          if (t !== copy[k]) {
            copy[k] = t
            applied.push(`sensors[${i}].${k} (trim)`)
          }
        }
      }
      return copy
    })
  }

  const m = /** @type {Record<string, unknown>} */ (out.mission)
  if (m.accession != null) {
    const before = String(m.accession)
    const acc = before.replace(/\s/g, '').replace(/\u00a0/g, '')
    if (acc !== before) {
      m.accession = acc
      applied.push('mission.accession (normalize whitespace)')
    }
  }

  if (isBlank(m.language)) {
    m.language = 'eng'
    applied.push('mission.language → eng')
  }

  if (!isBlank(m.startDate) && !isBlank(m.endDate) && isValidMissionInstant(/** @type {string} */ (m.startDate)) && isValidMissionInstant(/** @type {string} */ (m.endDate))) {
    const na = normalizeMissionInstantString(String(m.startDate).trim())
    const nb = normalizeMissionInstantString(String(m.endDate).trim())
    const da = Date.parse(isValidDate(na) ? `${na}T00:00:00` : na)
    const db = Date.parse(isValidDate(nb) ? `${nb}T00:00:00` : nb)
    if (Number.isFinite(da) && Number.isFinite(db) && db < da) {
      const sd = m.startDate
      const ed = m.endDate
      m.startDate = ed
      m.endDate = sd
      applied.push('mission.startDate / mission.endDate (swapped)')
    }
  }

  const rw = String(m.west ?? '').trim()
  const re = String(m.east ?? '').trim()
  const rs = String(m.south ?? '').trim()
  const rn = String(m.north ?? '').trim()
  if ([rw, re, rs, rn].every(isValidNumber)) {
    let mw = rw
    let me = re
    let ms = rs
    let mn = rn
    if (Number(mw) > Number(me)) {
      ;[mw, me] = [me, mw]
      applied.push('mission.bbox west/east (swapped)')
    }
    if (Number(ms) > Number(mn)) {
      ;[ms, mn] = [mn, ms]
      applied.push('mission.bbox south/north (swapped)')
    }
    if (mw !== rw || me !== re || ms !== rs || mn !== rn) {
      m.west = mw
      m.east = me
      m.south = ms
      m.north = mn
    }
  }

  if (isValidNumber(m.vmin) && isValidNumber(m.vmax) && Number(m.vmin) > Number(m.vmax)) {
    const a = m.vmin
    const b = m.vmax
    m.vmin = b
    m.vmax = a
    applied.push('mission.vmin / mission.vmax (swapped)')
  }

  return { pilot: out, applied }
}
