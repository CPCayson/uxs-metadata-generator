/**
 * Diffs two pilotState objects field-by-field and returns structured
 * FieldChange records that the ImportReviewPanel can render.
 *
 * A "conflict" means the base already had a non-empty value that the
 * incoming state would overwrite with something different.
 *
 * @module core/fragments/diffPilotStates
 */

import { SOURCE_TYPE_TO_EVIDENCE } from './MetadataFragment.js'

const BLANK = new Set([undefined, null, '', 0])

function isBlankVal(v) {
  if (BLANK.has(v)) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

function stringify(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

/** Flat sections whose individual string/boolean fields we diff. */
const FLAT_SECTIONS = ['mission', 'platform', 'spatial', 'distribution']

/** Keyword facets — each is an array of { label, uuid } */
const KW_FACETS = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']

/**
 * Skip these mission keys — they are internal bookkeeping, not user-visible fields.
 * @type {Set<string>}
 */
const SKIP_KEYS = new Set([
  'uxsContext', 'ror', 'topicCategories', 'missionId', 'missionTitle', 'organization',
  'nceiAccessionId', 'sourceProvenance',
])

/**
 * @param {object} base   — current pilotState (before import)
 * @param {object} next   — pilotState after merge/import
 * @param {string} sourceType — from next.sourceProvenance?.sourceType
 * @returns {import('./MetadataFragment.js').FieldChange[]}
 */
export function diffPilotStates(base, next, sourceType = 'rawIso') {
  const evidenceClass = SOURCE_TYPE_TO_EVIDENCE[sourceType] ?? 'iso-xpath-exact'
  const changes = []

  // ── Flat sections ─────────────────────────────────────────────────────────
  for (const section of FLAT_SECTIONS) {
    const b = base[section] ?? {}
    const n = next[section] ?? {}
    const allKeys = new Set([...Object.keys(b), ...Object.keys(n)])
    for (const key of allKeys) {
      if (SKIP_KEYS.has(key)) continue
      const bv = b[key]
      const nv = n[key]
      if (stringify(bv) === stringify(nv)) continue
      if (isBlankVal(nv)) continue // import didn't add anything real
      changes.push({
        fieldPath: `${section}.${key}`,
        section,
        key,
        previousValue: isBlankVal(bv) ? null : bv,
        newValue: nv,
        isConflict: !isBlankVal(bv) && stringify(bv) !== stringify(nv),
        evidenceClass,
        sourceType,
        accepted: null,
      })
    }
  }

  // ── Sensors ───────────────────────────────────────────────────────────────
  const baseSensors = Array.isArray(base.sensors) ? base.sensors : []
  const nextSensors = Array.isArray(next.sensors) ? next.sensors : []
  if (nextSensors.length !== baseSensors.length || JSON.stringify(nextSensors) !== JSON.stringify(baseSensors)) {
    const wasEmpty = baseSensors.length === 0 || baseSensors.every(s => !s.sensorId && !s.modelId && !s.type)
    changes.push({
      fieldPath: 'sensors',
      section: 'sensors',
      key: 'sensors',
      previousValue: baseSensors.length ? `${baseSensors.length} sensor(s)` : null,
      newValue: nextSensors.length ? `${nextSensors.length} sensor(s): ${nextSensors.map(s => s.modelId || s.sensorId || s.type || '?').join(', ')}` : null,
      isConflict: !wasEmpty && nextSensors.length > 0,
      evidenceClass,
      sourceType,
      accepted: null,
    })
  }

  // ── Keywords ──────────────────────────────────────────────────────────────
  const bkw = base.keywords ?? {}
  const nkw = next.keywords ?? {}
  for (const facet of KW_FACETS) {
    const bArr = Array.isArray(bkw[facet]) ? bkw[facet] : []
    const nArr = Array.isArray(nkw[facet]) ? nkw[facet] : []
    if (JSON.stringify(bArr) === JSON.stringify(nArr)) continue
    if (nArr.length === 0) continue
    changes.push({
      fieldPath: `keywords.${facet}`,
      section: 'keywords',
      key: facet,
      previousValue: bArr.length ? `${bArr.length} chip(s): ${bArr.map(k => k.label).join(', ')}` : null,
      newValue: `${nArr.length} chip(s): ${nArr.map(k => k.label).join(', ')}`,
      isConflict: bArr.length > 0 && JSON.stringify(bArr) !== JSON.stringify(nArr),
      evidenceClass,
      sourceType,
      accepted: null,
    })
  }

  return changes
}

/**
 * Split changes into groups for the review UI.
 * @param {import('./MetadataFragment.js').FieldChange[]} changes
 */
export function partitionChanges(changes) {
  const newFields    = changes.filter(c => !c.isConflict)
  const conflicts    = changes.filter(c => c.isConflict)
  return { newFields, conflicts }
}

/**
 * Apply accepted/rejected decisions back onto the base state.
 * Rejected changes are excluded; accepted changes override base.
 *
 * @param {object} base
 * @param {object} next
 * @param {import('./MetadataFragment.js').FieldChange[]} changes
 * @returns {object} merged state
 */
export function applyDecisions(base, next, changes) {
  const out = JSON.parse(JSON.stringify(base))

  // Build a set of rejected field paths
  const rejected = new Set(
    changes.filter(c => c.accepted === false).map(c => c.fieldPath)
  )

  // For flat sections: apply accepted changes
  for (const section of FLAT_SECTIONS) {
    for (const change of changes) {
      if (change.section !== section) continue
      if (change.key === section) continue // skip section-level entries
      if (rejected.has(change.fieldPath)) continue
      if (!out[section]) out[section] = {}
      out[section][change.key] = change.newValue
    }
  }

  // Sensors: accept/reject whole block
  if (!rejected.has('sensors') && changes.some(c => c.fieldPath === 'sensors')) {
    out.sensors = next.sensors
  }

  // Keywords
  for (const facet of KW_FACETS) {
    const change = changes.find(c => c.fieldPath === `keywords.${facet}`)
    if (!change) continue
    if (rejected.has(change.fieldPath)) continue
    if (!out.keywords) out.keywords = {}
    out.keywords[facet] = next.keywords?.[facet] ?? []
  }

  // Always carry over provenance and mode from next
  if (next.sourceProvenance) out.sourceProvenance = next.sourceProvenance
  if (next.mode) out.mode = next.mode

  return out
}
