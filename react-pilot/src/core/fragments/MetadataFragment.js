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
  'user-confirmed':      0,
  'on-prod-record':      1,
  'comet-pull':          2,
  'iso-xpath-exact':     3,
  'iso-xpath-recovered': 4,
  'cruisepack-json':     5,
  'csv-column-mapped':   6,
  'scanner-structured':  7,
  'llm-suggestion':      8,
  'regex-text':          9,
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

export {}
