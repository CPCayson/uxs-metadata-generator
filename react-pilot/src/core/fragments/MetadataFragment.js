/**
 * Fragment evidence model for the Reverse Data Shredder.
 *
 * Every field value that enters pilotState from an external source carries
 * an evidence class. Higher-ranked evidence wins conflicts; lower-ranked
 * evidence can be overridden by user confirmation.
 *
 * @module core/fragments/MetadataFragment
 */

/**
 * Evidence classes ordered from most to least trustworthy.
 * Rank 0 is the strongest (user-confirmed beats everything).
 *
 * @type {Record<string, number>}
 */
export const EVIDENCE_CLASS_RANK = {
  'user-confirmed':          0,
  'on-prod-record':          1,
  'comet-pull':              2,
  'iso-xpath-exact':         3,
  'iso-xpath-recovered':     4,
  'template-token-resolved': 5,
  'cruisepack-json':         6,
  'csv-column-mapped':       7,
  'scanner-structured':      8,
  'llm-suggestion':          9,
  'regex-text':              10,
}

/**
 * Map from pilotState sourceType → evidence class.
 * @type {Record<string, string>}
 */
export const SOURCE_TYPE_TO_EVIDENCE = {
  manual:      'user-confirmed',
  comet:       'comet-pull',
  rawIso:      'iso-xpath-exact',
  bediXml:     'iso-xpath-exact',
  cruisepack:  'cruisepack-json',
  lensScanner: 'scanner-structured',
  unknown:     'regex-text',
}

/**
 * Human-readable label for an evidence class.
 * @param {string} cls
 * @returns {string}
 */
export function evidenceClassLabel(cls) {
  return {
    'user-confirmed':      'User confirmed',
    'on-prod-record':      'On-production record',
    'comet-pull':          'CoMET pull',
    'iso-xpath-exact':     'ISO XML (exact XPath)',
    'iso-xpath-recovered': 'ISO XML (recovered)',
    'template-token-resolved': 'Template token resolved',
    'cruisepack-json':     'CruisePack JSON',
    'csv-column-mapped':   'Spreadsheet column',
    'scanner-structured':  'Lens scanner',
    'llm-suggestion':      'LLM suggestion',
    'regex-text':          'Text extraction',
  }[cls] ?? cls
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true if a outranks b (lower rank number = higher trust)
 */
export function evidenceOutranks(a, b) {
  const ra = EVIDENCE_CLASS_RANK[a] ?? 99
  const rb = EVIDENCE_CLASS_RANK[b] ?? 99
  return ra < rb
}

/**
 * @typedef {{
 *   fieldPath: string,
 *   section: string,
 *   key: string,
 *   previousValue: unknown,
 *   newValue: unknown,
 *   isConflict: boolean,
 *   evidenceClass: string,
 *   sourceType: string,
 *   accepted: boolean | null,
 * }} FieldChange
 */

/**
 * MetadataFragment — a single extracted field value with full provenance.
 *
 * Contract for extractors: parsers observe and emit fragments; they do not decide records.
 *
 * @typedef {{
 *   id: string,
 *   entityType: 'cruise'|'platform'|'segment'|'party'|'constraint'|'docucomp'|'keyword',
 *   entityFingerprint: string,
 *   fieldPath: string,
 *   value: unknown,
 *   evidence: string,
 *   source: FragmentSource,
 *   rawSnippet?: string,
 *   extractedAt: string,
 * }} MetadataFragment
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: 'iso-xml'|'bedi-xml'|'csv'|'comet-pull'|'scanner'|'llm'|'user',
 *   location: string,
 * }} FragmentSource
 */

/**
 * Convert a pilotState partial object into a flat array of MetadataFragment records.
 * Evidence defaults to `iso-xpath-exact` for values from a clean ISO XML parse.
 * Null, undefined, and empty-string primitives are skipped.
 *
 * @param {object} partial — partial pilotState from {@link import('../../lib/xmlPilotImport.js').importPilotPartialStateFromXml}
 * @param {FragmentSource} source — source descriptor for all fragments in this batch
 * @param {string} [evidence] — override evidence class (default: `iso-xpath-exact`)
 * @returns {MetadataFragment[]}
 */
export function partialToFragments(partial, source, evidence = 'iso-xpath-exact') {
  /** @type {MetadataFragment[]} */
  const fragments = []
  const extractedAt = new Date().toISOString()

  /**
   * @param {unknown} obj
   * @param {string} path
   */
  function walk(obj, path) {
    if (obj === null || obj === undefined) return

    if (Array.isArray(obj)) {
      if (obj.length === 0) return
      fragments.push({
        id: generateId(),
        entityType: entityTypeFromPath(path),
        entityFingerprint: '',
        fieldPath: path,
        value: obj,
        evidence,
        source,
        extractedAt,
      })
      return
    }

    if (typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        walk(val, path ? `${path}.${key}` : key)
      }
      return
    }

    if (obj === '' || obj === false) return

    fragments.push({
      id: generateId(),
      entityType: entityTypeFromPath(path),
      entityFingerprint: '',
      fieldPath: path,
      value: obj,
      evidence,
      source,
      extractedAt,
    })
  }

  walk(partial, '')
  return fragments
}

/**
 * Infer entityType from a fieldPath prefix.
 * @param {string} path
 * @returns {MetadataFragment['entityType']}
 */
function entityTypeFromPath(path) {
  const p = String(path || '')
  if (p.startsWith('mission')) return 'cruise'
  if (p.startsWith('platform')) return 'platform'
  if (p.startsWith('sensors')) return 'platform'
  if (p.startsWith('spatial')) return 'cruise'
  if (p.startsWith('keywords')) return 'keyword'
  if (p.startsWith('distribution')) return 'constraint'
  return 'cruise'
}

/**
 * @returns {string}
 */
function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `frag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
