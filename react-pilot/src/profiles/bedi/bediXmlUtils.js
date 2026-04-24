/**
 * bediXmlUtils — lightweight DOM helpers for parsing ISO 19115-2/19139 XML.
 *
 * Works with both browser DOMParser and @xmldom/xmldom (used in Node tests).
 * All helpers are defensive: missing elements return '' or [].
 *
 * @module profiles/bedi/bediXmlUtils
 */

/**
 * Parse an XML string into a Document. Requires `DOMParser` to be available
 * globally (browser) or polyfilled (Node via @xmldom/xmldom + globalThis.DOMParser).
 *
 * @param {string} xmlString
 * @returns {{ ok: true, doc: Document } | { ok: false, error: string }}
 */
export function parseXml(xmlString) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'application/xml')
    // Both browser and xmldom set a parseerror element on failure.
    const err = doc.getElementsByTagName('parsererror')[0]
    if (err) return { ok: false, error: err.textContent?.trim() ?? 'XML parse error' }
    return { ok: true, doc }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Return the trimmed text content of the FIRST element matching `tagName`
 * within `context`, or `''`.
 *
 * Uses prefixed tag names (e.g. `'gmd:title'`) which is consistent with
 * the existing xmlPilotImport.js patterns.
 *
 * @param {Element|Document} context
 * @param {string} tagName
 * @returns {string}
 */
export function txt(context, tagName) {
  const els = context.getElementsByTagName(tagName)
  if (!els || els.length === 0) return ''
  return els[0]?.textContent?.trim() ?? ''
}

/**
 * Return an array of trimmed text contents for ALL elements matching `tagName`.
 *
 * @param {Element|Document} context
 * @param {string} tagName
 * @returns {string[]}
 */
export function allTxt(context, tagName) {
  const els = context.getElementsByTagName(tagName)
  if (!els || els.length === 0) return []
  const results = []
  for (let i = 0; i < els.length; i++) {
    const t = els[i]?.textContent?.trim()
    if (t) results.push(t)
  }
  return results
}

/**
 * Return the `codeListValue` attribute (or text content) of the FIRST element
 * matching `tagName`, or `''`.
 *
 * @param {Element|Document} context
 * @param {string} tagName
 * @returns {string}
 */
export function codeVal(context, tagName) {
  const els = context.getElementsByTagName(tagName)
  if (!els || els.length === 0) return ''
  const el = els[0]
  return el?.getAttribute?.('codeListValue') ?? el?.textContent?.trim() ?? ''
}

/**
 * Walk direct `gmd:keyword` children of `gmd:MD_Keywords` in document order.
 * Collects `gco:CharacterString` text or `gmx:Anchor` body + optional `xlink:href`.
 *
 * @param {Element} block  `gmd:MD_Keywords` element
 * @returns {{ labels: string[], hrefs: string[] }}  `hrefs[i]` is `''` when keyword used CharacterString only.
 */
export function extractMdKeywordsTextHrefPairs(block) {
  const labels = []
  const hrefs = []
  if (!block) return { labels, hrefs }
  const kids = block.children
  if (!kids || !kids.length) return { labels, hrefs }
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    if (!el || el.localName !== 'keyword') continue
    const anchors = el.getElementsByTagName('gmx:Anchor')
    const strs = el.getElementsByTagName('gco:CharacterString')
    const anchor = anchors[0]
    const ch = strs[0]
    if (anchor) {
      const t = anchor.textContent?.trim() ?? ''
      if (!t) continue
      labels.push(t)
      hrefs.push(
        String(
          anchor.getAttribute?.('xlink:href')
            ?? anchor.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href')
            ?? anchor.getAttribute?.('href')
            ?? '',
        ).trim(),
      )
    } else if (ch) {
      const t = ch.textContent?.trim() ?? ''
      if (!t) continue
      labels.push(t)
      hrefs.push('')
    }
  }
  return { labels, hrefs }
}

/**
 * Return the value of `attrName` on the FIRST element matching `tagName`, or `''`.
 *
 * @param {Element|Document} context
 * @param {string} tagName
 * @param {string} attrName
 * @returns {string}
 */
export function attr(context, tagName, attrName) {
  const els = context.getElementsByTagName(tagName)
  if (!els || els.length === 0) return ''
  return els[0]?.getAttribute?.(attrName) ?? ''
}

/**
 * Return an array of `attrName` values for ALL elements matching `tagName`
 * that have a non-empty value for that attribute.
 *
 * @param {Element|Document} context
 * @param {string} tagName
 * @param {string} attrName
 * @returns {string[]}
 */
export function allAttr(context, tagName, attrName) {
  const els = context.getElementsByTagName(tagName)
  if (!els || els.length === 0) return []
  const results = []
  for (let i = 0; i < els.length; i++) {
    const v = els[i]?.getAttribute?.(attrName)?.trim()
    if (v) results.push(v)
  }
  return results
}

/**
 * Extract the NCEI Accession ID number from an accession identifier string.
 * Handles patterns like:
 *   "NCEI Accession ID:0039615"
 *   "NCEI Accession Number: 0039615"
 *   "0039615"
 *
 * @param {string} raw
 * @returns {string}
 */
export function extractAccessionNumber(raw) {
  const s = raw.trim()
  // "NCEI Accession ID:0039615" or "NCEI Accession Number: 12345"
  const m = s.match(/(?:NCEI\s+Accession\s+(?:ID|Number)\s*:\s*)(\d+)/i)
  if (m) return m[1]
  // bare number
  if (/^\d+$/.test(s)) return s
  return s
}

/**
 * Direct child elements of `gmi:MI_Metadata` with a given local name (any gmd/gmi NS).
 * Uses `children` / `childNodes` so `@xmldom/xmldom` (no `firstElementChild`) still works.
 *
 * @param {Document} doc
 * @param {string} localName  e.g. `'contact'`
 * @returns {Element[]}
 */
export function listMiMetadataDirectChildren(doc, localName) {
  const root = doc?.documentElement
  if (!root || root.localName !== 'MI_Metadata') return []
  const out = []
  const kids = root.children
  if (kids && kids.length) {
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i]
      if (el && el.localName === localName) out.push(el)
    }
    return out
  }
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1) continue
    const el = /** @type {Element} */ (c)
    if (el.localName === localName) out.push(el)
  }
  return out
}

/**
 * Extract dive number, tape number, segment number from a BEDI granule file ID.
 * Pattern: ...DIVE_<vehicle>-<number>_TAPE<n>OF<total>_SEG<n>OF<total>
 *
 * @param {string} fileId e.g. "BIOLUM2009_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1"
 * @returns {{ diveId: string, tapeNumber: string, segmentNumber: string }}
 */
export function parseBediGranuleFileId(fileId) {
  const diveMatch = fileId.match(/DIVE_([A-Z0-9]+-\d+)/i)
  const tapeMatch = fileId.match(/TAPE(\d+)OF\d+/i)
  const segMatch  = fileId.match(/SEG(\d+)OF\d+/i)
  return {
    diveId:        diveMatch ? diveMatch[1] : '',
    tapeNumber:    tapeMatch ? tapeMatch[1] : '',
    segmentNumber: segMatch  ? segMatch[1]  : '',
  }
}

/**
 * Extract the first URL from an `gmd:CI_OnlineResource/gmd:linkage/gmd:URL`
 * inside a given context element.
 *
 * @param {Element} context
 * @returns {string}
 */
export function firstUrl(context) {
  return txt(context, 'gmd:URL')
}
