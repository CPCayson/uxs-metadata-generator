/**
 * Collection validation rule sets.
 *
 * Collection records are lighter-weight than mission records:
 * identification + extent + distribution, no platform/sensor/keyword facets.
 *
 * Rule check(state, mode) returns true (issue) | false (ok) — no array returns
 * needed here since there are no looping rules.
 *
 * @module profiles/collection/collectionValidationRules
 */

import { normalizeMissionInstantString } from '../../lib/datetimeLocal.js'

function isBlank(s) {
  return !String(s || '').trim()
}
function isValidEmail(s) {
  const v = String(s || '').trim()
  return v.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
function isValidUrl(s) {
  const v = String(s || '').trim()
  if (!v) return false
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())
}
function isValidInstant(s) {
  const n = normalizeMissionInstantString(String(s || '').trim())
  if (!n) return false
  if (isValidDate(n)) return true
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(n)
}
function isValidNumber(s) {
  const v = String(s || '').trim()
  return v !== '' && !Number.isNaN(Number(v))
}

const TEMPORAL_XPATH = '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement'
const BBOX_XPATH = '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox'

/** @type {import('../../core/registry/types.js').ValidationRule[]} */
const coreRules = [
  // ── Identification ────────────────────────────────────────────────────────
  {
    field: 'identification.identifier',
    severity: 'e',
    message: 'Collection identifier is required',
    check: (s) => isBlank(s?.identification?.identifier),
  },
  {
    field: 'identification.title',
    severity: 'e',
    message: 'Title is required',
    check: (s) => isBlank(s?.identification?.title),
  },
  {
    field: 'identification.abstract',
    severity: 'e',
    message: 'Abstract is required',
    check: (s) => isBlank(s?.identification?.abstract),
  },
  {
    field: 'identification.status',
    severity: 'e',
    message: 'Status is required',
    check: (s) => isBlank(s?.identification?.status),
  },
  {
    field: 'identification.language',
    severity: 'e',
    message: 'Language is required',
    check: (s) => isBlank(s?.identification?.language),
  },
  {
    field: 'identification.org',
    severity: 'e',
    message: 'Organization name is required',
    check: (s) => isBlank(s?.identification?.org),
  },
  {
    field: 'identification.email',
    severity: 'e',
    message: 'Contact email is required',
    check: (s) => isBlank(s?.identification?.email),
  },
  {
    field: 'identification.email',
    severity: 'e',
    message: 'Contact email format looks invalid',
    check: (s) => !isBlank(s?.identification?.email) && !isValidEmail(s.identification.email),
  },
  // ── Extent ────────────────────────────────────────────────────────────────
  {
    field: 'extent.startDate',
    severity: 'e',
    message: 'Start date is required',
    xpath: TEMPORAL_XPATH,
    check: (s) => isBlank(s?.extent?.startDate),
  },
  {
    field: 'extent.startDate',
    severity: 'e',
    message: 'Start date must be YYYY-MM-DD or datetime-local',
    xpath: TEMPORAL_XPATH,
    check: (s) => !isBlank(s?.extent?.startDate) && !isValidInstant(s.extent.startDate),
  },
  {
    field: 'extent.endDate',
    severity: 'e',
    message: 'End date must be YYYY-MM-DD or datetime-local',
    xpath: TEMPORAL_XPATH,
    check: (s) => !isBlank(s?.extent?.endDate) && !isValidInstant(s.extent.endDate),
  },
  {
    field: 'extent.endDate',
    severity: 'e',
    message: 'End date must be on or after start date',
    xpath: TEMPORAL_XPATH,
    check: (s) => {
      const e = s?.extent || {}
      if (isBlank(e.startDate) || isBlank(e.endDate)) return false
      if (!isValidInstant(e.startDate) || !isValidInstant(e.endDate)) return false
      const na = normalizeMissionInstantString(e.startDate)
      const nb = normalizeMissionInstantString(e.endDate)
      const da = Date.parse(isValidDate(na) ? `${na}T00:00:00` : na)
      const db = Date.parse(isValidDate(nb) ? `${nb}T00:00:00` : nb)
      return Number.isFinite(da) && Number.isFinite(db) && db < da
    },
  },
  {
    field: 'extent.bbox',
    severity: 'e',
    message: 'Bounding box values must be numeric',
    xpath: BBOX_XPATH,
    check: (s) => {
      const e = s?.extent || {}
      return !['west', 'east', 'south', 'north'].every((k) => isValidNumber(e[k] ?? ''))
    },
  },
  {
    field: 'extent.bbox',
    severity: 'e',
    message: 'Bounding box invalid (west ≤ east, south ≤ north)',
    xpath: BBOX_XPATH,
    check: (s) => {
      const e = s?.extent || {}
      if (!['west', 'east', 'south', 'north'].every((k) => isValidNumber(e[k] ?? ''))) return false
      return Number(e.west) > Number(e.east) || Number(e.south) > Number(e.north)
    },
  },
  // ── Distribution ─────────────────────────────────────────────────────────
  {
    field: 'distribution.format',
    severity: 'e',
    message: 'Distribution format is required',
    check: (s) => isBlank(s?.distribution?.format),
  },
  {
    field: 'distribution.license',
    severity: 'e',
    message: 'License is required',
    check: (s) => isBlank(s?.distribution?.license),
  },
  {
    field: 'distribution.landingUrl',
    severity: 'e',
    message: 'Landing page URL must be http(s)',
    check: (s) => !isBlank(s?.distribution?.landingUrl) && !isValidUrl(s.distribution.landingUrl),
  },
  {
    field: 'distribution.downloadUrl',
    severity: 'e',
    message: 'Download URL must be http(s)',
    check: (s) => !isBlank(s?.distribution?.downloadUrl) && !isValidUrl(s.distribution.downloadUrl),
  },
]

/** @type {import('../../core/registry/types.js').ValidationRule[]} */
const strictExtraRules = [
  {
    field: 'identification.purpose',
    severity: 'e',
    message: 'Strict mode: purpose is required',
    check: (s) => isBlank(s?.identification?.purpose),
  },
  {
    field: 'distribution.landingUrl',
    severity: 'e',
    message: 'Strict mode: landing page URL is required',
    check: (s) => isBlank(s?.distribution?.landingUrl),
  },
]

/**
 * @type {import('../../core/registry/types.js').ValidationRuleSet[]}
 */
export const collectionValidationRuleSets = [
  {
    id: 'collection-core',
    modes: ['lenient', 'strict', 'catalog'],
    rules: coreRules,
  },
  {
    id: 'collection-strict',
    modes: ['strict'],
    rules: strictExtraRules,
  },
]
