/**
 * Merge Lens Scanner / GCMD suggestion envelopes into **flat** BEDI pilot state
 * ({@link bediCollectionProfile}, {@link bediGranuleProfile}).
 *
 * @module adapters/sources/bediScannerMerge
 */

import { buildSourceProvenance } from '../../lib/sourceProvenance.js'
import { isScannerSuggestionEnvelope } from './ScannerSuggestionAdapter.js'

/** @type {ReadonlySet<string>} */
const BEDI_PROFILE_IDS = new Set(['bediCollection', 'bediGranule'])

/** GCMD KMS concept URI (stable per UUID). */
export const GCMD_CONCEPT_URI_BASE = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept/'

/**
 * @param {unknown} env
 * @returns {boolean}
 */
export function isBediScannerSuggestionEnvelope(env) {
  if (!isScannerSuggestionEnvelope(env)) return false
  const id = String(/** @type {{ profileId?: unknown }} */ (env).profileId || '').trim()
  return BEDI_PROFILE_IDS.has(id)
}

/**
 * @param {unknown} v
 * @returns {{ label: string, uuid: string } | null}
 */
function asLabelUuid(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = /** @type {Record<string, unknown>} */ (v)
  const label = String(o.label ?? o.prefLabel ?? '').trim()
  const uuid = String(o.uuid ?? '').trim()
  if (!label || !uuid) return null
  return { label, uuid }
}

/**
 * @param {unknown[]} raw
 * @returns {{ label: string, uuid: string }[]}
 */
function normalizeLabelUuidList(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const v of raw) {
    const row = asLabelUuid(v)
    if (row) out.push(row)
  }
  return out
}

/**
 * Union science keywords by UUID; extends `scienceKeywordHrefs` in lockstep.
 *
 * @param {string[]} baseLabels
 * @param {string[]} baseHrefs
 * @param {{ label: string, uuid: string }[]} incoming
 */
function unionScienceKeywords(baseLabels, baseHrefs, incoming) {
  const byUuid = new Map()
  /** Pairs without a KMS concept UUID (keep after GCMD rows, order preserved). */
  const legacyPairs = []
  for (let i = 0; i < baseLabels.length; i++) {
    const href = String(baseHrefs[i] || '').trim()
    const m = href.match(/concept\/([0-9a-f-]{36})/i)
    const uuid = m ? m[1].toLowerCase() : ''
    if (uuid) {
      byUuid.set(uuid, { label: baseLabels[i], href })
    } else if (String(baseLabels[i] || '').trim()) {
      legacyPairs.push({ label: String(baseLabels[i]).trim(), href })
    }
  }
  for (const row of incoming) {
    const u = row.uuid.toLowerCase()
    byUuid.set(u, { label: row.label, href: `${GCMD_CONCEPT_URI_BASE}${row.uuid}` })
  }
  const labels = []
  const hrefs = []
  for (const { label, href } of legacyPairs) {
    labels.push(label)
    hrefs.push(href)
  }
  for (const { label, href } of byUuid.values()) {
    labels.push(label)
    hrefs.push(href)
  }
  return { labels, hrefs }
}

/**
 * @param {unknown[]} base
 * @param {unknown[]} incoming
 * @returns {string[]}
 */
function unionStringKeywords(base, incoming) {
  const a = (Array.isArray(base) ? base : []).map((s) => String(s || '').trim()).filter(Boolean)
  const b = (Array.isArray(incoming) ? incoming : [])
    .map((x) => {
      if (typeof x === 'string') return x.trim()
      const row = asLabelUuid(x)
      return row ? row.label : ''
    })
    .filter(Boolean)
  const seen = new Set(a.map((s) => s.toLowerCase()))
  const out = [...a]
  for (const t of b) {
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/**
 * @param {object} basePilotState
 * @param {Record<string, unknown>} partial
 * @returns {object}
 */
export function mergeBediScannerPartialIntoPilotState(basePilotState, partial) {
  const base = basePilotState && typeof basePilotState === 'object' ? basePilotState : {}
  const p = partial && typeof partial === 'object' ? partial : {}
  const out = { ...base }

  if (Array.isArray(p.scienceKeywords) && p.scienceKeywords.length) {
    const inc = /** @type {unknown[]} */ (p.scienceKeywords)
    const rows = normalizeLabelUuidList(inc)
    if (rows.length) {
      const curL = Array.isArray(out.scienceKeywords) ? out.scienceKeywords.map((x) => String(x || '').trim()) : []
      const curH = Array.isArray(out.scienceKeywordHrefs) ? out.scienceKeywordHrefs.map((x) => String(x || '').trim()) : []
      const { labels, hrefs } = unionScienceKeywords(curL, curH, rows)
      out.scienceKeywords = labels
      out.scienceKeywordHrefs = hrefs
    } else {
      const labels = unionStringKeywords(
        Array.isArray(out.scienceKeywords) ? /** @type {unknown[]} */ (out.scienceKeywords) : [],
        inc,
      )
      out.scienceKeywords = labels
    }
  }

  if (p.placeKeywords !== undefined && Array.isArray(p.placeKeywords)) {
    out.placeKeywords = unionStringKeywords(out.placeKeywords, /** @type {unknown[]} */ (p.placeKeywords))
  }
  if (p.datacenters !== undefined && Array.isArray(p.datacenters)) {
    out.datacenters = unionStringKeywords(out.datacenters, /** @type {unknown[]} */ (p.datacenters))
    if (Array.isArray(p.datacenterKeywordHrefs)) {
      const cur = Array.isArray(out.datacenterKeywordHrefs) ? out.datacenterKeywordHrefs : []
      const merged = [...cur]
      const inc = /** @type {string[]} */ (p.datacenterKeywordHrefs).map((x) => String(x || '').trim())
      for (let i = 0; i < inc.length; i++) {
        if (inc[i] && !merged[i]) merged[i] = inc[i]
      }
      out.datacenterKeywordHrefs = merged
    }
  }

  if (p.oerKeywords !== undefined && Array.isArray(p.oerKeywords)) {
    out.oerKeywords = unionStringKeywords(out.oerKeywords, /** @type {unknown[]} */ (p.oerKeywords))
  }

  if (typeof p.dataCenterKeyword === 'string' && p.dataCenterKeyword.trim()) {
    out.dataCenterKeyword = p.dataCenterKeyword.trim()
  }
  if (typeof p.dataCenterKeywordHref === 'string' && p.dataCenterKeywordHref.trim()) {
    out.dataCenterKeywordHref = p.dataCenterKeywordHref.trim()
  }
  if (typeof p.instrumentKeyword === 'string' && p.instrumentKeyword.trim()) {
    out.instrumentKeyword = p.instrumentKeyword.trim()
  }
  if (typeof p.instrumentKeywordHref === 'string' && p.instrumentKeywordHref.trim()) {
    out.instrumentKeywordHref = p.instrumentKeywordHref.trim()
  }

  return out
}

/** Allowed BEDI scanner field paths (flat keys on pilot state). */
const BEDI_SCANNER_PATHS = new Set([
  'scienceKeywords',
  'placeKeywords',
  'datacenters',
  'datacenterKeywordHrefs',
  'oerKeywords',
  'dataCenterKeyword',
  'dataCenterKeywordHref',
  'instrumentKeyword',
  'instrumentKeywordHref',
])

/**
 * @param {unknown} input
 * @param {import('../../core/registry/types.js').ImportParseMeta & { minConfidence?: number }} [meta]
 * @returns {import('../../core/registry/types.js').ScannerSuggestionResult}
 */
export function parseScannerSuggestionsToBediPartial(input, meta = {}) {
  if (!isBediScannerSuggestionEnvelope(input)) {
    return { ok: false, error: 'Not a valid BEDI scanner suggestion envelope.', warnings: [] }
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
    if (!BEDI_SCANNER_PATHS.has(fp)) {
      warnings.push(`Skipped "${fp}": not a supported BEDI scanner field`)
      continue
    }
    if (minC > 0 && typeof s.confidence === 'number' && s.confidence < minC) {
      warnings.push(`Skipped "${fp}": confidence ${s.confidence} < minConfidence ${minC}`)
      continue
    }
    const val = s.value
    if ((fp === 'scienceKeywords' || fp === 'oerKeywords') && Array.isArray(val)) {
      const prev = Array.isArray(partial[fp]) ? /** @type {unknown[]} */ (partial[fp]) : []
      partial[fp] = [...prev, ...val]
    } else if ((fp === 'placeKeywords' || fp === 'datacenters') && Array.isArray(val)) {
      partial[fp] = unionStringKeywords(
        Array.isArray(partial[fp]) ? /** @type {unknown[]} */ (partial[fp]) : [],
        /** @type {unknown[]} */ (val),
      )
    } else if (fp === 'datacenterKeywordHrefs' && Array.isArray(val)) {
      const prev = Array.isArray(partial.datacenterKeywordHrefs)
        ? /** @type {unknown[]} */ (partial.datacenterKeywordHrefs)
        : []
      partial.datacenterKeywordHrefs = [...prev, ...val.map((x) => String(x || '').trim())]
    } else if (typeof val === 'string' && (fp === 'dataCenterKeyword' || fp === 'dataCenterKeywordHref' || fp === 'instrumentKeyword' || fp === 'instrumentKeywordHref')) {
      const t = val.trim()
      if (t) partial[fp] = t
    }
  }

  const roots = Object.keys(partial)
  if (roots.length === 0) {
    return {
      ok:     false,
      error:  'No suggestions could be merged into BEDI pilot state.',
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

/** @type {import('../../core/registry/types.js').ScannerSuggestionAdapter} */
export const bediScannerSuggestionAdapter = {
  id:            'lensScannerBedi',
  label:         'Lens Scanner suggestions (BEDI)',
  canParse:      isBediScannerSuggestionEnvelope,
  parseExternal: async (input, meta) => parseScannerSuggestionsToBediPartial(input, meta),
}
