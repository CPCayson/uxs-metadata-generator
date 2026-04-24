/**
 * Source adapter for raw ISO 19115-2 / 19139 XML strings (mission pilot shape).
 *
 * Wraps {@link importPilotPartialStateFromXml} and attaches {@link SourceProvenance}
 * on successful parses.  Intended as the single entry point for “paste / file ISO”
 * imports so future scanners, CruisePack, or CoMET loaders can share the same
 * contract without duplicating parser wiring.
 *
 * @module adapters/sources/RawIsoAdapter
 */

import { importPilotPartialStateFromXml } from '../../lib/xmlPilotImport.js'
import { buildSourceProvenance } from '../../lib/sourceProvenance.js'

export const RAW_ISO_ADAPTER_ID = 'rawIso'

export const RAW_ISO_ADAPTER_LABEL = 'Raw ISO 19115-2 XML'

/**
 * Heuristic: first bytes look like an ISO 19139 / 19115-2 metadata document.
 *
 * @param {unknown} input
 * @returns {boolean}
 */
export function canParseRawIsoMissionXml(input) {
  const s = String(input ?? '').trim()
  if (!s.includes('<')) return false
  const head = s.slice(0, 8000)
  return /<\s*(?:gmd\s*:\s*)?MD_Metadata\b|<\s*(?:gmi\s*:\s*)?MI_Metadata\b/i.test(head)
}

/**
 * Synchronous import result compatible with {@link import('../../core/registry/types.js').ImportParser}.
 *
 * @param {string} xmlString
 * @param {import('../../core/registry/types.js').ImportParseMeta} [meta]
 * @returns {import('../../core/registry/types.js').ImportParserResult}
 */
export function parseRawIsoMissionImportResult(xmlString, meta = {}) {
  const parsed = importPilotPartialStateFromXml(xmlString)
  if (!parsed.ok) return parsed
  const sourceType = meta?.forcedProvenanceType === 'comet' ? 'comet' : 'rawIso'
  return {
    ok:         true,
    partial:    parsed.partial,
    warnings:   parsed.warnings,
    provenance: buildSourceProvenance(sourceType, meta),
  }
}

/**
 * Async contract matching the planned SourceAdapter.parseExternal shape.
 *
 * @param {string} xmlString
 * @param {import('../../core/registry/types.js').ImportParseMeta} [meta]
 * @returns {Promise<import('../../core/registry/types.js').ImportParserResult>}
 */
export async function parseRawIsoExternal(xmlString, meta = {}) {
  return parseRawIsoMissionImportResult(xmlString, meta)
}

/** Canonical adapter bundle for registry / future wiring. */
export const rawIsoAdapter = {
  id:            RAW_ISO_ADAPTER_ID,
  label:         RAW_ISO_ADAPTER_LABEL,
  canParse:      canParseRawIsoMissionXml,
  parseExternal: parseRawIsoExternal,
}
