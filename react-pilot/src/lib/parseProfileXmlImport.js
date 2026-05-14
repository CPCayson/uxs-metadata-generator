import { applyPilotAutoFixes } from './pilotAutoFix.js'

/**
 * Run profile XML import parsers on raw text — same contract as XmlToolsBar “Apply”.
 *
 * @param {import('../core/registry/types.js').EntityProfile} profile
 * @param {string} xmlText
 * @param {Record<string, unknown>} [meta] originalFilename, originalUuid, sourceId
 * @returns {{ ok: true, merged: object, warnings?: string[], provenance?: unknown } | { ok: false, error: string, warnings?: string[] }}
 */
export function parseProfileXmlImport(profile, xmlText, meta = {}) {
  const importParsers = Array.isArray(profile.importParsers) ? profile.importParsers : []
  if (!importParsers.length) {
    return { ok: false, error: 'No import parser is available for this profile.' }
  }

  let result = null
  for (const parser of importParsers) {
    try {
      const r = parser?.parse?.(xmlText, meta)
      if (r) {
        result = r
        if (r.ok) break
      }
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        warnings: [],
      }
    }
  }

  if (!result) {
    return { ok: false, error: 'No import parser accepted the XML.' }
  }
  if (!result.ok) {
    return {
      ok: false,
      error: result.error || 'Import failed.',
      warnings: result.warnings,
    }
  }

  const payload = { ...result.partial }
  if (result.provenance) {
    payload.sourceProvenance = {
      ...result.provenance,
      ...(typeof result.partial?.sourceProvenance === 'object' ? result.partial.sourceProvenance : {}),
    }
  }
  const merged = profile.mergeLoaded
    ? profile.mergeLoaded(payload)
    : { ...profile.defaultState(), ...payload }

  const warnings = Array.isArray(result.warnings) ? [...result.warnings] : []
  const { pilot: fixed, applied } = applyPilotAutoFixes('lenient', merged)
  for (const line of applied) {
    if (line.includes('mission.bbox west/east')) {
      warnings.push(
        'Bounding box west/east were swapped (west was greater than east) — corrected automatically.',
      )
    }
  }
  const finalMerged = typeof profile.sanitize === 'function' ? profile.sanitize(fixed) : fixed

  return {
    ok: true,
    merged: finalMerged,
    warnings,
    provenance: result.provenance,
  }
}
