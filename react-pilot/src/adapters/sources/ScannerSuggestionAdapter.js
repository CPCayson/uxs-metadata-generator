/**
 * Lens Scanner suggestion adapter — turns an external suggestion envelope into a
 * shallow nested partial compatible with {@link mergeLoadedPilotState} for most
 * roots, or with {@link mergeScannerPartialIntoPilotState} when **`sensors`** patches
 * use numeric indices (avoids wiping the whole sensors array).
 *
 * No HTTP or CV runtime here: this module only defines the contract and a
 * deterministic merge so a future ScannerHostBridge can `parseExternal` the
 * same shape the UI would eventually postMessage or receive from `/api/scan`.
 *
 * Supported `fieldPath` values are dot paths under pilot roots:
 * **`mode`**, **`mission`**, **`spatial`**, **`platform`**, **`keywords`**, **`distribution`**, **`sensors`**.
 * Numeric segments are allowed only as **`sensors.<index>.<field>`** (e.g. `sensors.0.modelId`).
 * Keyword facets use whole-array values (e.g. `keywords.sciencekeywords`, `keywords.platforms`, `keywords.instruments`, `keywords.locations`, `keywords.providers`, `keywords.projects`); {@link mergeScannerPartialIntoPilotState} unions rows by **`uuid`** instead of replacing the list.
 *
 * @module adapters/sources/ScannerSuggestionAdapter
 */

import { buildSourceProvenance } from '../../lib/sourceProvenance.js'
import { SENSOR_XML_OPTIONAL_DEFAULTS } from '../../lib/sensorInstrumentDescription.js'

export const SCANNER_SUGGESTION_ADAPTER_ID = 'lensScannerMission'

export const SCANNER_SUGGESTION_ADAPTER_LABEL = 'Lens Scanner suggestions (mission)'

/** @type {ReadonlySet<string>} */
const ALLOWED_ROOTS = new Set(['mode', 'mission', 'spatial', 'platform', 'keywords', 'distribution', 'sensors'])

const MAX_SENSOR_INDEX = 64

/** GCMD-style keyword facets merged by `uuid` when the scanner supplies whole-array updates. */
const KEYWORD_FACET_KEYS = [
  'sciencekeywords',
  'datacenters',
  'platforms',
  'instruments',
  'locations',
  'projects',
  'providers',
]

/**
 * Union keyword facet rows by UUID; incoming fields overlay existing rows with the same UUID.
 *
 * @param {unknown[]} base
 * @param {unknown[]} incoming
 * @returns {unknown[]}
 */
export function mergeKeywordFacetArrays(base, incoming) {
  const a = Array.isArray(base) ? base : []
  const b = Array.isArray(incoming) ? incoming : []
  const map = new Map()
  const order = []
  function touch(uuid) {
    if (!map.has(uuid)) order.push(uuid)
  }
  for (const item of a) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const u = String(/** @type {{ uuid?: unknown }} */ (item).uuid || '').trim()
    if (!u) continue
    touch(u)
    map.set(u, { .../** @type {Record<string, unknown>} */ (item) })
  }
  for (const item of b) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const u = String(/** @type {{ uuid?: unknown }} */ (item).uuid || '').trim()
    if (!u) continue
    touch(u)
    const prev = map.get(u) || {}
    map.set(u, { ...prev, .../** @type {Record<string, unknown>} */ (item) })
  }
  return order.map((u) => map.get(u)).filter(Boolean)
}

/**
 * @param {unknown} input
 * @returns {input is import('../../core/registry/types.js').ScannerSuggestionEnvelope}
 */
export function isScannerSuggestionEnvelope(input) {
  if (!input || typeof input !== 'object') return false
  const o = /** @type {Record<string, unknown>} */ (input)
  if (!Array.isArray(o.suggestions)) return false
  return o.suggestions.every(
    (s) => s && typeof s === 'object' && typeof /** @type {{ fieldPath?: unknown }} */ (s).fieldPath === 'string',
  )
}

/**
 * @param {Record<string, unknown>} partial
 * @param {string} fieldPath
 * @param {unknown} value
 * @param {string[]} warnings
 */
function applyDotPath(partial, fieldPath, value, warnings) {
  const keys = fieldPath.split('.').map((k) => k.trim()).filter(Boolean)
  if (keys.length < 2) {
    warnings.push(`Skipped "${fieldPath}": expected at least root.field`)
    return
  }
  const root = keys[0]
  if (!ALLOWED_ROOTS.has(root)) {
    warnings.push(`Skipped "${fieldPath}": root "${root}" is not supported for mission scanner merge`)
    return
  }

  // sensors.<index>.<field>[.nested...] — index merge (partial.sensors is sparse-friendly)
  if (root === 'sensors') {
    if (keys.length < 3) {
      warnings.push(`Skipped "${fieldPath}": use sensors.<index>.<field> (e.g. sensors.0.modelId)`)
      return
    }
    const idxPart = keys[1]
    if (!/^\d+$/.test(idxPart)) {
      warnings.push(`Skipped "${fieldPath}": second segment must be a sensor index (e.g. sensors.0.modelId)`)
      return
    }
    const idx = parseInt(idxPart, 10)
    if (idx < 0 || idx > MAX_SENSOR_INDEX) {
      warnings.push(`Skipped "${fieldPath}": sensor index out of allowed range 0–${MAX_SENSOR_INDEX}`)
      return
    }
    if (!Array.isArray(partial.sensors)) partial.sensors = []
    while (partial.sensors.length <= idx) partial.sensors.push({})
    let cur = /** @type {Record<string, unknown>} */ (partial.sensors[idx])
    for (let i = 2; i < keys.length - 1; i++) {
      const k = keys[i]
      if (/^\d+$/.test(k)) {
        warnings.push(`Skipped "${fieldPath}": nested numeric paths under a sensor are not supported`)
        return
      }
      const next = cur[k]
      if (next != null && (typeof next !== 'object' || Array.isArray(next))) {
        warnings.push(`Skipped "${fieldPath}": "${keys.slice(0, i + 1).join('.')}" is not an object`)
        return
      }
      if (cur[k] == null) cur[k] = {}
      cur = /** @type {Record<string, unknown>} */ (cur[k])
    }
    const leaf = keys[keys.length - 1]
    cur[leaf] = value
    return
  }

  const hasUnsupportedNumeric = keys.slice(1).some((k) => /^\d+$/.test(k))
  if (hasUnsupportedNumeric) {
    warnings.push(`Skipped "${fieldPath}": numeric path segments are only supported under sensors.<index>`)
    return
  }

  if (!partial[root] || typeof partial[root] !== 'object' || Array.isArray(partial[root])) {
    partial[root] = {}
  }
  let cur = /** @type {Record<string, unknown>} */ (partial[root])
  for (let i = 1; i < keys.length - 1; i++) {
    const k = keys[i]
    const next = cur[k]
    if (next != null && (typeof next !== 'object' || Array.isArray(next))) {
      warnings.push(`Skipped "${fieldPath}": "${keys.slice(0, i + 1).join('.')}" is not an object`)
      return
    }
    if (cur[k] == null) cur[k] = {}
    cur = /** @type {Record<string, unknown>} */ (cur[k])
  }
  const leaf = keys[keys.length - 1]
  cur[leaf] = value
}

/**
 * Deep-clone pilot state for safe merging.
 * @param {object} base
 * @returns {object}
 */
function clonePilotState(base) {
  if (typeof structuredClone === 'function') return structuredClone(base)
  return JSON.parse(JSON.stringify(base))
}

/**
 * Merge a scanner **partial** into existing pilot state without replacing the entire
 * **`sensors`** array when only indexed patches are present. Shallow-merge **`mission`**,
 * **`spatial`**, **`platform`**, **`keywords`**, **`distribution`**, and **`mode`** the
 * same way as {@link import('../../lib/pilotValidation.js').mergeLoadedPilotState} for those keys.
 *
 * Prefer this over `mergeLoadedPilotState(base, partial)` when `partial.sensors` came from
 * {@link parseScannerSuggestionsToMissionPartial} with `sensors.N.*` paths.
 *
 * @param {object} basePilotState
 * @param {Record<string, unknown>} partial
 * @returns {object}
 */
export function mergeScannerPartialIntoPilotState(basePilotState, partial) {
  const out = clonePilotState(basePilotState)
  if (!partial || typeof partial !== 'object') return out

  if (partial.mode) out.mode = partial.mode

  if (partial.mission && typeof partial.mission === 'object') {
    const lm = /** @type {Record<string, unknown>} */ (partial.mission)
    out.mission = { ...out.mission, ...lm }
    if (lm.missionId && !out.mission.fileId) out.mission.fileId = lm.missionId
    if (lm.missionTitle && !out.mission.title) out.mission.title = lm.missionTitle
    if (lm.organization && !out.mission.org) out.mission.org = lm.organization
    if (lm.nceiAccessionId && !out.mission.accession) out.mission.accession = lm.nceiAccessionId
  }
  if (partial.spatial && typeof partial.spatial === 'object') {
    out.spatial = { ...out.spatial, ...partial.spatial }
  }
  if (partial.platform && typeof partial.platform === 'object') {
    const lp = /** @type {Record<string, unknown>} */ (partial.platform)
    out.platform = { ...out.platform, ...lp }
    if (lp.status && !out.mission.status) out.mission.status = /** @type {string} */ (lp.status)
    if (lp.purpose && !out.mission.purpose) out.mission.purpose = /** @type {string} */ (lp.purpose)
    if (lp.lang && !out.mission.language) out.mission.language = /** @type {string} */ (lp.lang)
  }
  if (partial.keywords && typeof partial.keywords === 'object') {
    const pk = /** @type {Record<string, unknown>} */ (partial.keywords)
    out.keywords = { ...out.keywords }
    for (const k of Object.keys(pk)) {
      if (KEYWORD_FACET_KEYS.includes(k) && Array.isArray(pk[k])) {
        out.keywords[k] = mergeKeywordFacetArrays(
          Array.isArray(out.keywords[k]) ? out.keywords[k] : [],
          /** @type {unknown[]} */ (pk[k]),
        )
      } else if (!KEYWORD_FACET_KEYS.includes(k)) {
        out.keywords[k] = pk[k]
      }
    }
    KEYWORD_FACET_KEYS.forEach((k) => {
      if (!Array.isArray(out.keywords[k])) out.keywords[k] = []
    })
  }
  if (partial.distribution && typeof partial.distribution === 'object') {
    out.distribution = { ...out.distribution, ...partial.distribution }
  }

  if (partial.sensors && Array.isArray(partial.sensors)) {
    if (!Array.isArray(out.sensors)) out.sensors = []
    partial.sensors.forEach((patch, i) => {
      if (!patch || typeof patch !== 'object') return
      if (Object.keys(patch).length === 0) return
      const baseSensor = out.sensors[i] && typeof out.sensors[i] === 'object' ? out.sensors[i] : {}
      const p = /** @type {Record<string, unknown>} */ (patch)
      out.sensors[i] = {
        ...SENSOR_XML_OPTIONAL_DEFAULTS,
        ...baseSensor,
        ...p,
        localId:
          /** @type {{ localId?: string }} */ (baseSensor).localId
          || p.localId
          || p.sensorId
          || p.id
          || `sen_${i}_${Date.now()}`,
        sensorId: String(p.sensorId || p.id || /** @type {{ sensorId?: string }} */ (baseSensor).sensorId || ''),
        type: String(p.type || p.sensorType || /** @type {{ type?: string }} */ (baseSensor).type || ''),
        modelId: String(p.modelId ?? /** @type {{ modelId?: string }} */ (baseSensor).modelId ?? ''),
        variable: String(p.variable ?? /** @type {{ variable?: string }} */ (baseSensor).variable ?? ''),
        firmware: String(p.firmware ?? /** @type {{ firmware?: string }} */ (baseSensor).firmware ?? ''),
      }
    })
  }

  return out
}

/**
 * @param {unknown} input
 * @param {import('../../core/registry/types.js').ImportParseMeta & { minConfidence?: number }} [meta]
 *   When **`meta.minConfidence`** is in `(0, 1]`, suggestions with **`confidence`** below it are skipped.
 * @returns {import('../../core/registry/types.js').ScannerSuggestionResult}
 */
export function parseScannerSuggestionsToMissionPartial(input, meta = {}) {
  if (!isScannerSuggestionEnvelope(input)) {
    return { ok: false, error: 'Not a valid scanner suggestion envelope.', warnings: [] }
  }
  const env = /** @type {import('../../core/registry/types.js').ScannerSuggestionEnvelope} */ (input)
  const warnings = []
  /** @type {Record<string, unknown>} */
  const partial = {}

  const minC = typeof meta.minConfidence === 'number' && meta.minConfidence > 0 ? meta.minConfidence : 0

  for (const s of env.suggestions) {
    const fp = String(s.fieldPath || '').trim()
    if (!fp) {
      warnings.push('Skipped suggestion with empty fieldPath')
      continue
    }
    if (minC > 0 && typeof s.confidence === 'number' && s.confidence < minC) {
      warnings.push(`Skipped "${fp}": confidence ${s.confidence} < minConfidence ${minC}`)
      continue
    }
    applyDotPath(partial, fp, s.value, warnings)
  }

  const roots = Object.keys(partial)
  if (roots.length === 0) {
    return {
      ok:     false,
      error:  'No suggestions could be merged into mission pilot state.',
      warnings,
    }
  }

  return {
    ok:         true,
    partial,
    warnings,
    provenance: buildSourceProvenance('lensScanner', {
      ...meta,
      sourceId: meta.sourceId || env.runId || '',
    }),
  }
}

/**
 * Async entry matching {@link import('../../core/registry/types.js').ScannerSuggestionAdapter}.
 *
 * @param {unknown} input
 * @param {import('../../core/registry/types.js').ImportParseMeta & { minConfidence?: number }} [meta]
 * @returns {Promise<import('../../core/registry/types.js').ScannerSuggestionResult>}
 */
export async function parseScannerSuggestionsExternal(input, meta = {}) {
  return parseScannerSuggestionsToMissionPartial(input, meta)
}

/** Default bundle for registry / future HostBridge wiring. */
export const scannerMissionSuggestionAdapter = {
  id:            SCANNER_SUGGESTION_ADAPTER_ID,
  label:         SCANNER_SUGGESTION_ADAPTER_LABEL,
  canParse:      isScannerSuggestionEnvelope,
  parseExternal: parseScannerSuggestionsExternal,
}
