/**
 * IsoXmlFragmentExtractor — wraps {@link import('../../lib/xmlPilotImport.js').importPilotPartialStateFromXml}
 * and emits {@link import('../../core/fragments/MetadataFragment.js').MetadataFragment}[].
 *
 * The underlying importer is not modified; this is a thin evidence-tagging wrapper.
 *
 * @module adapters/sources/IsoXmlFragmentExtractor
 */

import { importPilotPartialStateFromXml } from '../../lib/xmlPilotImport.js'
import { enrichPartialSensorsFromLibrary } from '../../lib/sensorLibraryResolve.js'
import { partialToFragments } from '../../core/fragments/MetadataFragment.js'
import { stampFingerprints } from '../../core/identity/cruiseFingerprint.js'

/**
 * Extract MetadataFragment[] from an ISO XML string.
 *
 * @param {string} xmlString — raw ISO 19115-2 or 19115-3 XML
 * @param {string} [sourceId] — filename or identifier (e.g. `PS2418L0-UUV01-GOOD.xml`)
 * @param {{ sensorLibraryRows?: Array<Record<string, unknown>> }} [options]
 * @returns {{
 *   ok: boolean,
 *   fragments: import('../../core/fragments/MetadataFragment.js').MetadataFragment[],
 *   warnings: string[],
 *   error?: string,
 *   partial?: object,
 * }}
 */
export function extractFragmentsFromIsoXml(xmlString, sourceId = 'unknown.xml', options = {}) {
  const result = importPilotPartialStateFromXml(xmlString)

  if (!result.ok) {
    return {
      ok: false,
      fragments: [],
      warnings: result.warnings ?? [],
      error: result.error,
    }
  }

  const evidence = (result.warnings?.length ?? 0) > 0 ? 'iso-xpath-recovered' : 'iso-xpath-exact'

  const source = {
    id: sourceId,
    kind: 'iso-xml',
    location: 'importPilotPartialStateFromXml',
  }

  const lib = options?.sensorLibraryRows
  const partial =
    Array.isArray(lib) && lib.length > 0
      ? enrichPartialSensorsFromLibrary(result.partial, lib)
      : result.partial

  const fragments = partialToFragments(partial, source, evidence)
  stampFingerprints(fragments)

  return {
    ok: true,
    fragments,
    warnings: result.warnings ?? [],
    partial,
  }
}
