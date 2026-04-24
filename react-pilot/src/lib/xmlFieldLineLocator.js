/**
 * Locate the best-matching line number in the generated XML preview for a
 * given pilot field (e.g. `mission.title`, `sensors[0].modelId`).
 *
 * Strategy:
 *   1. If the pilot state holds a non-empty value at that path, search for
 *      the escaped value between `>` and `<` (first occurrence after the
 *      field's element name, when known).
 *   2. Fall back to matching the field's expected XML element name/anchor
 *      (e.g. `<gmd:title>` for `mission.title`). For empty fields this is
 *      usually enough to jump to the right block.
 *
 * Line numbers are 1-based to match gutter display conventions.
 */

const FIELD_ELEMENT_HINT = {
  'mission.title': /<gmd:title>\s*<gco:CharacterString>/,
  'mission.abstract': /<gmd:abstract>/,
  'mission.purpose': /<gmd:purpose>/,
  'mission.fileId': /<gmd:fileIdentifier>/,
  'mission.language': /<gmd:language>/,
  'mission.status': /<gmd:status>/,
  'mission.org': /<gmd:organisationName>/,
  'mission.individualName': /<gmd:individualName>/,
  'mission.email': /<gmd:electronicMailAddress>/,
  'mission.startDate': /<gml:beginPosition|<gmd:beginPosition|beginPosition/,
  'mission.endDate': /<gml:endPosition|<gmd:endPosition|endPosition/,
  'mission.publicationDate': /<gmd:CI_DateTypeCode[^>]*codeListValue=["']publication/,
  'mission.metadataRecordDate': /<gmd:dateStamp>/,
  'mission.doi': /<gmd:MD_Identifier>[\s\S]{0,80}10\./,
  'mission.accession': /<gmd:MD_Identifier>/,
  'mission.contactUrl': /<gmd:contactInfo>/,
  'mission.licenseUrl': /<gmd:useLimitation>|<gmd:otherConstraints>/,
  'mission.dataLicensePreset': /<gmd:useLimitation>|<gmd:otherConstraints>/,
  'mission.relatedDataUrl': /<gmd:aggregationInfo>/,

  'mission.west': /<gmd:westBoundLongitude>/,
  'mission.east': /<gmd:eastBoundLongitude>/,
  'mission.north': /<gmd:northBoundLatitude>/,
  'mission.south': /<gmd:southBoundLatitude>/,
  'mission.vmin': /<gmd:minimumValue>/,
  'mission.vmax': /<gmd:maximumValue>/,
  'mission.bbox': /<gmd:geographicElement>/,
  'mission.vertical': /<gmd:verticalElement>/,

  'platform.platformType': /<gmi:platform>/,
  'platform.platformId': /<gmi:platform>[\s\S]*?<gmd:code>/,
  'platform.platformDesc': /<gmi:platform>[\s\S]*?<gmd:description>/,

  'spatial.referenceSystem': /<gmd:referenceSystemInfo>/,
  'spatial.gridRepresentation': /<gmd:MD_Georectified>|<gmd:MD_Georeferenceable>/,
  'spatial.trajectorySampling': /<gmd:samplingFrequency>|<gmd:trajectory/,
  'spatial.verticalCrsUrl': /<gmd:verticalCRS>|<gmd:verticalDatum>/,
  'spatial.accuracyValue': /<gmd:DQ_(Absolute|Relative)?PositionalAccuracy|positionalAccuracy/,
  'spatial.errorValue': /<gmd:DQ_QuantitativeResult>/,

  'distribution.format': /<gmd:distributionFormat>/,
  'distribution.license': /<gmd:MD_LegalConstraints>|<gmd:useLimitation>/,
  'distribution.landingUrl': /<gmd:linkage>/,
  'distribution.downloadUrl': /<gmd:linkage>/,
  'distribution.metadataLandingUrl': /<gmd:linkage>/,
  'distribution.publication': /<gmd:aggregationInfo>|<gmd:CI_Citation>/,
}

/**
 * Get a value from pilot state by a dotted path with `sensors[N].x` support.
 * @param {object} state
 * @param {string} path
 */
function getPath(state, path) {
  if (!state || typeof path !== 'string') return undefined
  const tokens = path.split('.')
  let cur = state
  for (const raw of tokens) {
    if (cur == null) return undefined
    const m = raw.match(/^([a-zA-Z_][\w]*)(?:\[(\d+)\])?$/)
    if (!m) return undefined
    cur = cur[m[1]]
    if (m[2] !== undefined && cur != null) cur = cur[Number(m[2])]
  }
  return cur
}

/** @param {unknown} v */
function toTextValue(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

/** XML-escape (matches xmlPreviewBuilder). @param {string} s */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Escape a string for use in a regex.
 * @param {string} s
 */
function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {string} xml
 * @param {number} charIndex
 */
function charIndexToLine(xml, charIndex) {
  if (charIndex < 0) return 0
  let line = 1
  for (let i = 0; i < charIndex && i < xml.length; i += 1) {
    if (xml.charCodeAt(i) === 10) line += 1
  }
  return line
}

/**
 * @param {object} args
 * @param {string} args.field              — dotted field path from anchor map
 * @param {string} args.xml                — current preview XML text
 * @param {object} [args.pilotState]       — used to look up the current value
 * @returns {number | null} 1-based line number, or null if no confident match
 */
export function findFieldLineInXml({ field, xml, pilotState }) {
  if (!field || typeof xml !== 'string' || xml.length === 0) return null

  const value = toTextValue(getPath(pilotState, field)).trim()
  const elementHint = FIELD_ELEMENT_HINT[field]

  // Value-based: fastest, works whenever the user has actually typed something
  if (value && value.length >= 2) {
    const escaped = xmlEscape(value)
    const needle = new RegExp(`>${regexEscape(escaped)}<`)
    if (elementHint) {
      const elIdx = xml.search(elementHint)
      if (elIdx >= 0) {
        const rest = xml.slice(elIdx)
        const rel = rest.search(needle)
        if (rel >= 0) return charIndexToLine(xml, elIdx + rel)
      }
    }
    const idx = xml.search(needle)
    if (idx >= 0) return charIndexToLine(xml, idx)
  }

  // Element-hint fallback: jump to the structural block for that field
  if (elementHint) {
    const idx = xml.search(elementHint)
    if (idx >= 0) return charIndexToLine(xml, idx)
  }

  // Sensor-specific: locate Nth <gmi:MI_Instrument> / <gmd:acquisitionInformation>
  const sensorMatch = field.match(/^sensors\[(\d+)\]/)
  if (sensorMatch) {
    const n = Number(sensorMatch[1])
    const sensorRe = /<gmi:MI_Instrument|<gmd:EX_(Platform|Instrument)|<gmi:instrument/g
    let k = 0
    let m
    while ((m = sensorRe.exec(xml)) !== null) {
      if (k === n) return charIndexToLine(xml, m.index)
      k += 1
    }
  }

  return null
}

/**
 * Find the pilot field string (e.g. "mission.title") for a focused DOM element.
 * Resolves via `data-pilot-field` first, then the small id→field reverse map.
 * @param {Element | null} el
 * @returns {string | null}
 */
export function fieldKeyForElement(el) {
  if (!(el instanceof HTMLElement)) return null

  const dataField = el.getAttribute('data-pilot-field')
  if (dataField) return dataField

  const id = el.id
  if (!id) return null

  // Sensors are `id="sensors[N]-<suffix>"`
  const sensor = id.match(/^sensors\[(\d+)\]-(sid|model|type|var|fw|[\w]+)$/)
  if (sensor) {
    const idx = sensor[1]
    const suffixToProp = {
      sid: 'sensorId',
      model: 'modelId',
      type: 'type',
      var: 'variable',
      fw: 'firmware',
    }
    const prop = suffixToProp[sensor[2]] ?? sensor[2]
    return `sensors[${idx}].${prop}`
  }

  const ID_TO_FIELD = {
    fileId: 'mission.fileId',
    title: 'mission.title',
    abstract: 'mission.abstract',
    startDate: 'mission.startDate',
    endDate: 'mission.endDate',
    org: 'mission.org',
    individualName: 'mission.individualName',
    email: 'mission.email',
    purpose: 'mission.purpose',
    missionStatus: 'mission.status',
    language: 'mission.language',
    publicationDate: 'mission.publicationDate',
    metadataRecordDate: 'mission.metadataRecordDate',
    contactUrl: 'mission.contactUrl',
    licenseUrl: 'mission.licenseUrl',
    doi: 'mission.doi',
    accession: 'mission.accession',
    dataLicensePreset: 'mission.dataLicensePreset',
    relatedDataUrl: 'mission.relatedDataUrl',
    west: 'mission.west',
    east: 'mission.east',
    north: 'mission.north',
    south: 'mission.south',
    vmin: 'mission.vmin',
    vmax: 'mission.vmax',
    platformType: 'platform.platformType',
    platformId: 'platform.platformId',
    platformDesc: 'platform.platformDesc',
    verticalCrsUrl: 'spatial.verticalCrsUrl',
    gridColumnSize: 'spatial.gridRepresentation',
    gridRowSize: 'spatial.gridRepresentation',
    gridVerticalSize: 'spatial.gridRepresentation',
    trajectorySampling: 'spatial.trajectorySampling',
    accuracyValue: 'spatial.accuracyValue',
    errorValue: 'spatial.errorValue',
    format: 'distribution.format',
    license: 'distribution.license',
    landingUrl: 'distribution.landingUrl',
    downloadUrl: 'distribution.downloadUrl',
    metadataLandingUrl: 'distribution.metadataLandingUrl',
    nceiMetadataContactHref: 'distribution.nceiMetadataContactHref',
    nceiDistributorContactHref: 'distribution.nceiDistributorContactHref',
    publication: 'distribution.publication',
  }

  return ID_TO_FIELD[id] ?? null
}
