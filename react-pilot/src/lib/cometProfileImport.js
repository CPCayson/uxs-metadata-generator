/**
 * Shared CoMET ISO → profile merge payload (used by AssistantShell and wizard CoMET UI).
 *
 * @module lib/cometProfileImport
 */

/**
 * Run the active profile's import parsers against CoMET-exported ISO XML.
 *
 * @param {import('../core/registry/types.js').EntityProfile} profile
 * @param {string|null|undefined} xml  Raw ISO from CoMET, or null/empty for skeleton records
 * @param {import('../core/registry/types.js').ImportParseMeta} importMeta
 * @returns {object}  Payload suitable for `profile.mergeLoaded` (may be empty)
 */
export function buildPilotPayloadFromCometXml(profile, xml, importMeta) {
  if (xml == null || !String(xml).trim()) return {}
  const importParsers = Array.isArray(profile?.importParsers) ? profile.importParsers : []
  for (const parser of importParsers) {
    try {
      const r = parser?.parse?.(xml, importMeta)
      if (r?.ok) {
        const base = { ...(r.partial ?? {}) }
        if (r.provenance) base.sourceProvenance = r.provenance
        return base
      }
    } catch {
      /* try next parser */
    }
  }
  return {}
}
