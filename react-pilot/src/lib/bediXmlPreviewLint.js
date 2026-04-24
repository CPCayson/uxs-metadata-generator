/**
 * BEDI / ISO-19115-2 preview XML + form lint — patterns that often show up in
 * Oxygen (whitespace-only typed nodes, empty gco:Real, empty anchors).
 *
 * Used by BEDI profile validation rules so Lens / ValidationPanel surface the
 * same signals while editing, not only after external XML tools.
 *
 * @module lib/bediXmlPreviewLint
 */

const RE_EMPTY_GCO_REAL = /<gco:Real[^>]*>\s*<\/gco:Real>/gi
const RE_EMPTY_GCO_INT = /<gco:Integer[^>]*>\s*<\/gco:Integer>/gi
const RE_EMPTY_GCO_DEC = /<gco:Decimal[^>]*>\s*<\/gco:Decimal>/gi
const RE_EMPTY_ANCHOR_HREF = /<gmx:Anchor\b[^>]*\bxlink:href\s*=\s*["']\s*["']/gi
/** NBSP only — avoid exotic Unicode in the class (eslint no-misleading-character-class). */
const RE_WS_ONLY_CHARSTR =
  /<(?:gmd|gco):CharacterString[^>]*>([\s\u00a0]+)<\/(?:gmd|gco):CharacterString>/gi
/** Xerces: gco:Real is not nillable in common ISO 19139 configs (Vidhya Oxygen report). */
const RE_GCO_REAL_XSI_NIL = /<gco:Real[^>]*\bxsi:nil\s*=\s*["']true["']/gi
const RE_GCO_REAL_GCO_NILREASON = /<gco:Real[^>]*\bgco:nilReason\s*=/gi
/** xs:NCName / xs:ID — colons invalid in EX_Extent id. */
const RE_EX_EXTENT_ID_ATTR = /<gmd:EX_Extent\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi

/**
 * @param {string} xml
 * @param {number} index
 * @returns {number}
 */
function lineAtIndex(xml, index) {
  return xml.slice(0, index).split('\n').length
}

/**
 * @param {string} before
 * @returns {string}
 */
/**
 * @param {string} idVal
 * @returns {boolean}
 */
function isLikelyInvalidXmlNcNameId(idVal) {
  const s = String(idVal || '').trim()
  if (!s) return true
  if (s.includes(':')) return true
  if (!/^[A-Za-z_][\w.-]*$/.test(s)) return true
  return false
}

function fieldHintForEmptyReal(before) {
  const tail = before.slice(-Math.min(before.length, 1200))
  if (/minimumValue/i.test(tail)) return 'minDepth'
  if (/maximumValue/i.test(tail)) return 'maxDepth'
  if (/westBoundLongitude/i.test(tail)) return 'west'
  if (/eastBoundLongitude/i.test(tail)) return 'east'
  if (/southBoundLatitude/i.test(tail)) return 'south'
  if (/northBoundLatitude/i.test(tail)) return 'north'
  return 'abstract'
}

/**
 * @param {string} xml
 * @returns {Array<{ severity: 'e'|'w', field: string, message: string }>}
 */
export function collectBediXmlPreviewLintIssues(xml) {
  if (!xml || typeof xml !== 'string') return []

  /** @type {Array<{ severity: 'e'|'w', field: string, message: string }>} */
  const out = []
  const seen = new Set()

  function push(field, message, severity = 'w') {
    const k = `${field}:${message}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ severity, field, message })
  }

  for (const re of [RE_EMPTY_GCO_REAL, RE_EMPTY_GCO_INT, RE_EMPTY_GCO_DEC]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(xml)) !== null) {
      const line = lineAtIndex(xml, m.index)
      const tag = m[0].match(/^<([a-z0-9]+:[a-z0-9]+)/i)?.[1] ?? 'gco'
      const field = tag.toLowerCase() === 'gco:real' ? fieldHintForEmptyReal(xml.slice(0, m.index)) : 'abstract'
      push(
        field,
        `Preview XML line ${line}: empty or whitespace-only <${tag}>…</${tag}> — invalid for many NCEI schematron/Oxygen checks`,
        'w',
      )
    }
  }

  RE_EMPTY_ANCHOR_HREF.lastIndex = 0
  let am
  while ((am = RE_EMPTY_ANCHOR_HREF.exec(xml)) !== null) {
    const line = lineAtIndex(xml, am.index)
    push(
      'scienceKeywordHrefs',
      `Preview XML line ${line}: gmx:Anchor with empty xlink:href — GCMD anchors must point at a KMS concept URL`,
      'w',
    )
  }

  for (const re of [RE_GCO_REAL_XSI_NIL, RE_GCO_REAL_GCO_NILREASON]) {
    re.lastIndex = 0
    let xm
    while ((xm = re.exec(xml)) !== null) {
      const line = lineAtIndex(xml, xm.index)
      push(
        'minDepth',
        `Preview XML line ${line}: gco:Real uses xsi:nil or gco:nilReason — invalid for NCEI/Oxygen (use numeric values or omit the wrapper)`,
        'e',
      )
    }
  }

  RE_EX_EXTENT_ID_ATTR.lastIndex = 0
  let em
  while ((em = RE_EX_EXTENT_ID_ATTR.exec(xml)) !== null) {
    const idVal = em[1] ?? ''
    if (!isLikelyInvalidXmlNcNameId(idVal)) continue
    const line = lineAtIndex(xml, em.index)
    push(
      'west',
      `Preview XML line ${line}: gmd:EX_Extent id="${idVal}" is not NCName-safe (no colons; use archival stem + _Extents, e.g. BIOLUM2009_VID_…_Extents)`,
      'e',
    )
  }

  RE_WS_ONLY_CHARSTR.lastIndex = 0
  let cm
  while ((cm = RE_WS_ONLY_CHARSTR.exec(xml)) !== null) {
    const inner = cm[1] ?? ''
    if (!inner.length) continue
    const line = lineAtIndex(xml, cm.index)
    push(
      'title',
      `Preview XML line ${line}: CharacterString contains only whitespace — Oxygen often flags this; use real text or omit the element`,
      'w',
    )
  }

  return out
}

const BEDI_COLLECTION_TRIM_FIELDS = [
  'title',
  'abstract',
  'fileId',
  'collectionId',
  'alternateTitle',
  'vesselName',
  'nceiAccessionId',
  'nceiMetadataId',
  'purpose',
  'parentCollectionId',
]

const BEDI_GRANULE_TRIM_FIELDS = [
  'title',
  'abstract',
  'fileId',
  'granuleId',
  'parentCollectionId',
  'alternateTitle',
  'diveId',
  'tapeNumber',
  'segmentNumber',
]

/**
 * @param {object} state
 * @param {'collection' | 'granule'} kind
 * @returns {Array<{ severity: 'e'|'w', field: string, message: string }>}
 */
export function collectBediPilotWhitespaceIssues(state, kind) {
  const keys = kind === 'granule' ? BEDI_GRANULE_TRIM_FIELDS : BEDI_COLLECTION_TRIM_FIELDS
  /** @type {Array<{ severity: 'e'|'w', field: string, message: string }>} */
  const out = []
  for (const field of keys) {
    const v = state[field]
    if (typeof v !== 'string' || !v) continue
    if (v !== v.trim()) {
      out.push({
        severity: 'w',
        field,
        message: `${field} has leading or trailing whitespace — trim so exported XML matches catalog / Oxygen expectations`,
      })
    }
    if (/\u00a0/.test(v)) {
      out.push({
        severity: 'w',
        field,
        message: `${field} contains non-breaking spaces (U+00A0) — replace with normal spaces where possible`,
      })
    }
  }
  return out
}

/**
 * @param {object} state
 * @param {() => string} buildXml
 * @param {'collection' | 'granule'} kind
 * @returns {Array<{ severity: 'e'|'w', field: string, message: string }>}
 */
export function collectBediWizardLintIssues(state, buildXml, kind) {
  let xml = ''
  try {
    xml = buildXml() || ''
  } catch {
    return collectBediPilotWhitespaceIssues(state, kind)
  }
  return [...collectBediPilotWhitespaceIssues(state, kind), ...collectBediXmlPreviewLintIssues(xml)]
}
