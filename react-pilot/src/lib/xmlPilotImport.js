import {
  inferDataLicensePresetFromProse,
  inferLicensePresetFromDocucompHref,
  getDataLicensePresetDef,
  normalizeDataLicensePresetKey,
} from './noaaLicensePresets.js'
import { parseNceiUxsFileIdentifier } from './nceiUxsFileId.js'
import {
  acquisitionInstrumentHasContent,
  parseInstrumentDescriptionBlock,
  sensorInstrumentDedupeKey,
} from './sensorInstrumentDescription.js'
import { parseUxsPilotMachineBlockFromSupplemental } from './uxsOperationalModel.js'
import { isAcronymExplainedInAbstractText, normalizeNceiAccessionToken } from './pilotValidation.js'
import { NCEI_DEFAULT_MISSION_PURPOSE, resolveMissionPurposeForNcei } from './nceiMissionDefaults.js'

/** ISO / GML namespaces used by the pilot preview and UniversalXMLGenerator. */
const NS = {
  gmd: 'http://www.isotc211.org/2005/gmd',
  gco: 'http://www.isotc211.org/2005/gco',
  gmi: 'http://www.isotc211.org/2005/gmi',
  gml: 'http://www.opengis.net/gml/3.2',
  gmx: 'http://www.isotc211.org/2005/gmx',
  xlink: 'http://www.w3.org/1999/xlink',
}

/** ISO 19115-3 namespaces (standards.iso.org family — different from the 2005 isotc211.org GMD URIs). */
const NS3 = {
  mdb: 'http://standards.iso.org/iso/19115/-3/mdb/2.0',
  mri: 'http://standards.iso.org/iso/19115/-3/mri/1.0',
  cit: 'http://standards.iso.org/iso/19115/-3/cit/2.0',
  gco: 'http://standards.iso.org/iso/19115/-3/gco/1.0',
  lan: 'http://standards.iso.org/iso/19115/-3/lan/1.0',
  mcc: 'http://standards.iso.org/iso/19115/-3/mcc/1.0',
  mco: 'http://standards.iso.org/iso/19115/-3/mco/1.0',
  gex: 'http://standards.iso.org/iso/19115/-3/gex/1.0',
  mrs: 'http://standards.iso.org/iso/19115/-3/mrs/1.0',
  msr: 'http://standards.iso.org/iso/19115/-3/msr/2.0',
  mdq: 'http://standards.iso.org/iso/19157/-2/mdq/1.0',
  mac: 'http://standards.iso.org/iso/19115/-3/mac/2.0',
  mrd: 'http://standards.iso.org/iso/19115/-3/mrd/1.0',
  mmi: 'http://standards.iso.org/iso/19115/-3/mmi/1.0',
  swe: 'http://www.opengis.net/swe/2.0',
}

const KMS_UUID_INLINE_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

/** Canonical preview/export metadata standard (always 19115-2-shaped output). */
const PILOT_EXPORT_METADATA_STANDARD =
  'ISO 19115-2 Geographic Information - Metadata - Part 2: Extensions for Imagery and Gridded Data'
const PILOT_EXPORT_METADATA_VERSION = 'ISO 19115-2:2009(E)'

/**
 * GCMD / KMS concept UUID, query uuid=, or full URL for round-trip with `gmx:Anchor`.
 * @param {string} href
 * @returns {string}
 */
function keywordUuidFromConceptHref(href) {
  const h = String(href || '').trim()
  if (!h) return ''
  if (KMS_UUID_INLINE_RE.test(h)) return h.toLowerCase()
  const concept =
    h.match(/\/concept\/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/i) ||
    h.match(/\/kms\/concept\/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/i)
  if (concept) return concept[1].toLowerCase()
  const qu = h.match(/[?&]uuid=([a-f0-9-]{36})/i)
  if (qu) return qu[1].toLowerCase()
  const gcmd = h.match(/gcmd\.earthdata\.nasa\.gov\/[^?\s#]*\/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/i)
  if (gcmd) return gcmd[1].toLowerCase()
  const cmrKms = h.match(/cmr\.earthdata\.nasa\.gov\/kms\/(?:concept|concepts)\/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/i)
  if (cmrKms) return cmrKms[1].toLowerCase()
  if (/^https?:\/\//i.test(h)) {
    const embedded = h.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
    if (embedded && /(gcmd|earthdata|nasa\.gov|kms|cmr|docucomp)/i.test(h)) return embedded[1].toLowerCase()
    return ''
  }
  return h
}

/**
 * @param {Element} kw  `gmd:keyword`
 * @returns {{ label: string, uuid: string }}
 */
function keywordLabelAndUuidFromKeywordElement(kw) {
  if (!kw) return { label: '', uuid: '' }
  for (const c of kw.children) {
    if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) {
      const href = c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || ''
      const label =
        txt(c).trim() ||
        (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim()
      return { label: label || keywordUuidFromConceptHref(href) || href, uuid: keywordUuidFromConceptHref(href) }
    }
  }
  const lab = gcoCharacterString(kw)
  const trimmed = stripUxTemplateBraces(lab).trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const u = keywordUuidFromConceptHref(trimmed)
    if (u && KMS_UUID_INLINE_RE.test(u)) {
      const pathPart = trimmed.split(/[?#]/)[0]
      const tail = pathPart.split('/').filter(Boolean).pop() || trimmed
      return { label: tail, uuid: u }
    }
  }
  if (trimmed && KMS_UUID_INLINE_RE.test(trimmed)) {
    return { label: trimmed, uuid: trimmed }
  }
  return { label: lab, uuid: '' }
}

/**
 * DOMParser often yields U+FFFD when source bytes are not valid UTF-8; strip so UI/export stay clean.
 * @param {string} s
 */
function stripXmlReplacementChars(s) {
  return String(s ?? '').replace(/\uFFFD/g, '')
}

/**
 * @param {Element | null | undefined} el
 * @returns {string}
 */
function txt(el) {
  return stripXmlReplacementChars(el?.textContent?.trim() ?? '')
}

/**
 * UxS templates wrap instructional text in `{{ … }}`. Peel one layer at a time until stable.
 * @param {unknown} raw
 * @returns {string}
 */
function stripUxTemplateBraces(raw) {
  let s = String(raw ?? '')
  let prev
  do {
    prev = s
    s = s
      .replace(/\{\{\s*([^}{]*?)\s*\}\}/g, (_, inner) => String(inner).trim())
      .trim()
  } while (s !== prev)
  return s
}

/**
 * Replace UxS `{{fileIdentifier}}` tokens once `fileId` is known (after `fileIdentifier` parse).
 * @param {string} url
 * @param {string} fileId
 * @param {string} fileIdRaw
 */
function expandImportFileIdTokens(url, fileId, fileIdRaw) {
  let u = String(url || '')
  const fid = String(fileId || '').trim()
  const raw = String(fileIdRaw || '').trim()
  if (!u) return u
  const repl = [
    ['{{fileIdentifier}}', fid],
    ['{{fileidentifier}}', fid],
    ['{{Unique Identifier Assigned to Metadata Record}}', fid],
    ['gov.noaa.ncei.uxs:{{Unique Identifier Assigned to Metadata Record}}', raw || (fid ? `gov.noaa.ncei.uxs:${fid}` : '')],
  ]
  for (const [needle, val] of repl) {
    if (needle && u.includes(needle) && val) u = u.split(needle).join(val)
  }
  return u
}

/**
 * @param {Element | null | undefined} codeParent `gmd:code`
 * @returns {string}
 */
function mdIdentifierCodeString(codeParent) {
  if (!codeParent) return ''
  for (const c of codeParent.children) {
    if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) {
      const t = txt(c)
      const href = c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || ''
      if (/^10\.\d{4,9}\//.test(t)) return t.replace(/^https?:\/\/doi\.org\//i, '')
      const hm = href.match(/doi\.org\/(10\.\d{4,9}\/[^?\s#]+)/i)
      if (hm) return decodeURIComponent(hm[1])
      return t
    }
  }
  return gcoCharacterString(codeParent)
}

/**
 * @param {Element} mk `gmd:MD_Keywords`
 */
function keywordThesaurusTitleLower(mk) {
  const thesWrap = childNS(mk, NS.gmd, 'thesaurusName')
  if (!thesWrap) return ''
  const cite = childNS(thesWrap, NS.gmd, 'CI_Citation')
  if (cite) return gcoCharacterString(childNS(cite, NS.gmd, 'title')).toLowerCase()
  return (
    thesWrap.getAttributeNS(NS.xlink, 'title') ||
    thesWrap.getAttribute('xlink:title') ||
    ''
  ).toLowerCase()
}

/**
 * Map ISO 19139 `MD_KeywordTypeCode` (InPort/NOAA) to pilot GCMD-style facets when thesaurus title is absent.
 * @param {string} raw
 */
function keywordFacetFromIsoKeywordTypeCode(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!v) return ''
  if (v === 'theme' || v === 'topic') return 'sciencekeywords'
  if (v === 'place') return 'locations'
  if (v === 'project') return 'projects'
  if (v === 'datacentre' || v === 'datacenter') return 'datacenters'
  if (v === 'platform') return 'platforms'
  if (v === 'instrument') return 'instruments'
  if (v === 'provider') return 'providers'
  if (v === 'temporal') return ''
  return ''
}

/**
 * `gmd:descriptiveKeywords` / `mri:descriptiveKeywords` often carry a human-readable thesaurus hint on the
 * wrapper `xlink:title` (OER Program Discovery blocks) while inner `MD_Keywords` omits `thesaurusName`.
 * @param {Element | null | undefined} dkWrap
 */
function descriptiveKeywordsWrapperHintLower(dkWrap) {
  if (!dkWrap) return ''
  return (dkWrap.getAttributeNS(NS.xlink, 'title') || dkWrap.getAttribute('xlink:title') || '').trim().toLowerCase()
}

/**
 * Map wrapper-only titles to pilot GCMD-style facets when ISO type/thesaurus are absent.
 * @param {string} wrapLower
 */
function facetFromDescriptiveKeywordsWrapperHint(wrapLower) {
  if (!wrapLower) return ''
  if (/program\s+discovery|discovery\s+keywords/i.test(wrapLower)) return 'projects'
  if (/marine\s+archaeology/i.test(wrapLower)) return 'sciencekeywords'
  if (/(ship|vessel).*\bprogram\b|\bprogram\b.*(ship|vessel)/i.test(wrapLower)) return 'projects'
  return ''
}

/**
 * @param {Element} mk `gmd:MD_Keywords`
 * @param {Element | null | undefined} dkWrap parent `gmd:descriptiveKeywords`
 */
function facetFromMdKeywordsBlock(mk, dkWrap) {
  const thesTitle = keywordThesaurusTitleLower(mk)
  const wrapHint = descriptiveKeywordsWrapperHintLower(dkWrap)
  if (thesTitle.includes('platform instance') || wrapHint.includes('platform instance')) return ''

  let facet = ''
  if (thesTitle.includes('science')) facet = 'sciencekeywords'
  else if (thesTitle.includes('data center') || thesTitle.includes('datacenter')) facet = 'datacenters'
  else if (thesTitle.includes('platform')) facet = 'platforms'
  else if (thesTitle.includes('instrument')) facet = 'instruments'
  else if (thesTitle.includes('location')) facet = 'locations'
  else if (thesTitle.includes('project')) facet = 'projects'
  else if (thesTitle.includes('provider')) facet = 'providers'
  if (!facet && thesTitle.includes('gcmd') && /science|earth/i.test(thesTitle)) facet = 'sciencekeywords'
  if (!facet && /earth\s*science\s*keywords|global\s*change\s*master\s*directory|gcmd.*earth/i.test(thesTitle)) {
    facet = 'sciencekeywords'
  }
  if (!facet && thesTitle.includes('inport') && /keyword|theme|place|topic/i.test(thesTitle)) {
    facet = 'sciencekeywords'
  }

  if (!facet) {
    const typeEl = childNS(mk, NS.gmd, 'type')
    const codeEl = typeEl ? childNS(typeEl, NS.gmd, 'MD_KeywordTypeCode') : null
    const tv = codeEl?.getAttribute('codeListValue') || txt(codeEl) || ''
    facet = keywordFacetFromIsoKeywordTypeCode(tv)
  }
  if (!facet) facet = facetFromDescriptiveKeywordsWrapperHint(wrapHint)
  return facet
}

/**
 * @param {Element} mk `mri:MD_Keywords` (ISO 19115-3)
 * @param {Element | null | undefined} dkWrap parent `mri:descriptiveKeywords`
 */
function facetFromMriKeywordsBlock(mk, dkWrap) {
  const thesWrap = cn3(mk, NS3.mri, 'thesaurusName')
  const thesCite = thesWrap ? cn3(thesWrap, NS3.cit, 'CI_Citation') : null
  const thesTitle = thesCite ? gcs3(cn3(thesCite, NS3.cit, 'title')).toLowerCase() : ''
  const wrapHint = descriptiveKeywordsWrapperHintLower(dkWrap)
  if (thesTitle.includes('platform instance') || wrapHint.includes('platform instance')) return ''

  let facet = ''
  if (thesTitle.includes('science')) facet = 'sciencekeywords'
  else if (thesTitle.includes('data center') || thesTitle.includes('datacenter')) facet = 'datacenters'
  else if (thesTitle.includes('platform')) facet = 'platforms'
  else if (thesTitle.includes('instrument')) facet = 'instruments'
  else if (thesTitle.includes('location')) facet = 'locations'
  else if (thesTitle.includes('project')) facet = 'projects'
  else if (thesTitle.includes('provider')) facet = 'providers'
  if (!facet && thesTitle.includes('gcmd') && /science|earth/i.test(thesTitle)) facet = 'sciencekeywords'
  if (!facet && /earth\s*science\s*keywords|global\s*change\s*master\s*directory|gcmd.*earth/i.test(thesTitle)) {
    facet = 'sciencekeywords'
  }

  if (!facet) {
    const typeEl = cn3(mk, NS3.mri, 'type')
    const codeEl = typeEl ? cn3(typeEl, NS3.mcc, 'MD_KeywordTypeCode') || childLocal(typeEl, 'MD_KeywordTypeCode') : null
    const tv = codeEl?.getAttribute?.('codeListValue') || txt(codeEl) || ''
    facet = keywordFacetFromIsoKeywordTypeCode(tv)
  }
  if (!facet) facet = facetFromDescriptiveKeywordsWrapperHint(wrapHint)
  return facet
}

/**
 * @param {Element | null | undefined} numWrap e.g. `gmd:westBoundLongitude`
 */
function gcoDecimalFromWrapper(numWrap) {
  if (!numWrap) return ''
  const gco = childNS(numWrap, NS.gco, 'Decimal')
  if (gco) return txt(gco)
  const loc = childLocal(numWrap, 'Decimal')
  return loc ? txt(loc) : ''
}

/**
 * @param {Element | null | undefined} numWrap e.g. `gmd:minimumValue`
 */
function gcoRealFromWrapper(numWrap) {
  if (!numWrap) return ''
  const gco = childNS(numWrap, NS.gco, 'Real')
  if (gco) return txt(gco)
  const loc = childLocal(numWrap, 'Real')
  return loc ? txt(loc) : ''
}

/**
 * @param {Element | null | undefined} intWrap e.g. under `dimensionSize`
 */
function gcoIntegerFromWrapper(intWrap) {
  if (!intWrap) return ''
  const gco = childNS(intWrap, NS.gco, 'Integer')
  if (gco) return txt(gco)
  const loc = childLocal(intWrap, 'Integer')
  return loc ? txt(loc) : ''
}

/**
 * @param {Element | null | undefined} cite
 * @returns {string}
 */
function citationPublicationLine(cite) {
  if (!cite) return ''
  return stripUxTemplateBraces(gcoCharacterString(childNS(cite, NS.gmd, 'otherCitationDetails')))
}

/** @param {Element | null} cite  `cit:CI_Citation` (ISO 19115-3) */
function citationPublicationLine3(cite) {
  if (!cite) return ''
  return stripUxTemplateBraces(gcs3(cn3(cite, NS3.cit, 'otherCitationDetails')))
}

/**
 * @param {unknown} partial
 */
function deepStripUxTemplatePlaceholders(partial) {
  if (!partial || typeof partial !== 'object') return
  if (Array.isArray(partial)) {
    for (let i = 0; i < partial.length; i += 1) {
      const it = partial[i]
      if (typeof it === 'string') partial[i] = stripUxTemplateBraces(it)
      else deepStripUxTemplatePlaceholders(it)
    }
    return
  }
  for (const [k, v] of Object.entries(partial)) {
    if (typeof v === 'string') {
      /** @type {Record<string, unknown>} */ (partial)[k] = stripUxTemplateBraces(v)
    } else {
      deepStripUxTemplatePlaceholders(v)
    }
  }
}

/**
 * @param {Element | null | undefined} parent
 * @param {string} ns
 * @param {string} localName
 * @returns {Element | null}
 */
function childNS(parent, ns, localName) {
  if (!parent) return null
  for (const c of parent.children) {
    if (c.namespaceURI === ns && c.localName === localName) return c
  }
  return null
}

/**
 * @param {Element | null | undefined} parent
 * @param {string} localName
 * @returns {Element | null}
 */
function childLocal(parent, localName) {
  if (!parent) return null
  for (const c of parent.children) {
    if (c.localName === localName) return c
  }
  return null
}

/**
 * @param {Element | null | undefined} parent
 * @param {string} ns
 * @param {string} localName
 * @returns {Element[]}
 */
function childrenNS(parent, ns, localName) {
  if (!parent) return []
  const out = []
  for (const c of parent.children) {
    if (c.namespaceURI === ns && c.localName === localName) out.push(c)
  }
  return out
}

/**
 * @param {Element | null | undefined} el
 * @returns {string}
 */
function gcoCharacterString(el) {
  if (!el) return ''
  const cs = childNS(el, NS.gco, 'CharacterString')
  return cs ? txt(cs) : txt(el)
}

/**
 * Free-text from `gmd:*` elements that use `gco:CharacterString` or `gmx:Anchor` (NCEI / InPort style).
 * @param {Element | null | undefined} el
 * @returns {string}
 */
function gmdAnchorOrCharacterString(el) {
  if (!el) return ''
  const cs = childNS(el, NS.gco, 'CharacterString')
  if (cs) return stripUxTemplateBraces(txt(cs))
  for (const c of el.children || []) {
    if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) {
      const t = txt(c).trim()
      if (t) return stripUxTemplateBraces(t)
      const tit = (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim()
      if (tit) return stripUxTemplateBraces(tit)
    }
  }
  return stripUxTemplateBraces(txt(el))
}

/**
 * ISO 19115-3 `mcc` free text or Anchor (format name/version).
 * @param {Element | null | undefined} el
 */
function mccAnchorOrText(el) {
  if (!el) return ''
  const gcs = gcs3(el)
  if (gcs) return stripUxTemplateBraces(gcs)
  for (const c of el.children || []) {
    if (c.localName === 'Anchor') {
      const t = txt(c).trim()
      if (t) return stripUxTemplateBraces(t)
      const tit = (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim()
      if (tit) return stripUxTemplateBraces(tit)
    }
  }
  return stripUxTemplateBraces(txt(el))
}

/**
 * @param {Element | null} md `gmd:MD_Distribution`
 * @returns {{ name: string, version: string }}
 */
function extractMdFormatFromDistributionGmd(md) {
  const out = { name: '', version: '' }
  if (!md) return out
  let fmt = childNS(childNS(md, NS.gmd, 'distributionFormat'), NS.gmd, 'MD_Format')
  const distBlock = childNS(md, NS.gmd, 'distributor')
  const mdDist = distBlock ? childNS(distBlock, NS.gmd, 'MD_Distributor') : null
  if (!fmt && mdDist) {
    const dfw = childNS(mdDist, NS.gmd, 'distributorFormat')
    fmt = dfw ? childNS(dfw, NS.gmd, 'MD_Format') : null
  }
  if (!fmt) {
    const dfw = childNS(md, NS.gmd, 'distributorFormat')
    fmt = dfw ? childNS(dfw, NS.gmd, 'MD_Format') : null
  }
  if (!fmt) return out
  const nameEl = childNS(fmt, NS.gmd, 'name')
  const verEl = childNS(fmt, NS.gmd, 'version')
  out.name = gmdAnchorOrCharacterString(nameEl) || gcoCharacterString(nameEl)
  out.version = gmdAnchorOrCharacterString(verEl) || gcoCharacterString(verEl)
  return out
}

/**
 * @param {Element | null} md `mrd:MD_Distribution`
 */
function extractMdFormatFromDistribution3(md) {
  const out = { name: '', version: '' }
  if (!md) return out
  let fmt = cn3(cn3(md, NS3.mrd, 'distributionFormat'), NS3.mcc, 'MD_Format')
  const distBlock = cn3(md, NS3.mrd, 'distributor')
  const mdDist = distBlock ? cn3(distBlock, NS3.mrd, 'MD_Distributor') : null
  if (!fmt && mdDist) {
    const dfw = cn3(mdDist, NS3.mrd, 'distributorFormat')
    fmt = dfw ? cn3(dfw, NS3.mcc, 'MD_Format') : null
  }
  if (!fmt) {
    const dfw = cn3(md, NS3.mrd, 'distributorFormat')
    fmt = dfw ? cn3(dfw, NS3.mcc, 'MD_Format') : null
  }
  if (!fmt) return out
  out.name = mccAnchorOrText(cn3(fmt, NS3.mcc, 'name'))
  out.version = mccAnchorOrText(cn3(fmt, NS3.mcc, 'version'))
  return out
}

/**
 * Derive sensor id/model when MI_Instrument identifier code is empty.
 * @param {Record<string, string>} row
 */
function normalizeSensorInstrumentIds(row) {
  let sid = String(row.sensorId || '').trim()
  let mid = String(row.modelId || '').trim()
  if (sid && mid) return { ...row, sensorId: sid, modelId: mid }
  const type = String(row.type || '').trim()
  const variable = String(row.variable || '').trim()
  const fb =
    sid ||
    mid ||
    (type ? type.replace(/\s+/g, ' ').trim() : '') ||
    (variable ? variable.replace(/\s+/g, ' ').trim() : '') ||
    String(row.operationMode || row.firmware || '').trim()
  if (!fb) return row
  const slug = fb.replace(/[^\w\-+.]+/g, '_').replace(/_+/g, '_').slice(0, 120)
  return {
    ...row,
    sensorId: sid || slug,
    modelId: mid || slug,
  }
}

/**
 * HTTP(S) URL from `gmd:linkage` (`gmd:URL`, `gco:CharacterString`, or mixed content).
 * @param {Element | null | undefined} linkEl
 * @returns {string}
 */
function gmdLinkageUrl(linkEl) {
  if (!linkEl) return ''
  const urlChild = childNS(linkEl, NS.gmd, 'URL') || childLocal(linkEl, 'URL')
  if (urlChild) return txt(urlChild).trim()
  return gcoCharacterString(linkEl).trim() || txt(linkEl).trim()
}

/**
 * @param {Document} doc
 * @returns {Element | null}
 */
function metadataRoot(doc) {
  const r = doc.documentElement
  if (r && (r.localName === 'MD_Metadata' || r.localName === 'MI_Metadata')) return r
  const md = doc.getElementsByTagNameNS(NS.gmd, 'MD_Metadata')
  if (md.length) return md[0]
  const mi = doc.getElementsByTagNameNS(NS.gmi, 'MI_Metadata')
  return mi.length ? mi[0] : null
}

/**
 * @param {Element} root
 * @returns {Element | null}
 */
function dataIdentification(root) {
  const ii = childNS(root, NS.gmd, 'identificationInfo')
  return ii ? childNS(ii, NS.gmd, 'MD_DataIdentification') : null
}

/**
 * Strip URL wrappers and known NCEI path shapes so accession matches catalog ids.
 * @param {string} raw
 * @returns {string}
 */
function normalizeAccessionFromCitationCode(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  s = stripUxTemplateBraces(s).trim()
  if (!s) return ''
  s = s.replace(/^https?:\/\/doi\.org\//i, '')
  if (/^10\.\d{4,9}\//.test(s)) return ''
  const arch =
    s.match(/\/archive\/accession\/([^/?#]+)/i) || s.match(/\/accession\/([^/?#]+)/i)
  if (arch?.[1]) return arch[1].trim()
  const nodc = s.match(/^gov\.noaa\.nodc:?\s*(.+)$/i)
  if (nodc?.[1]) return nodc[1].trim().replace(/\s+/g, '')
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const last = u.pathname.split('/').filter(Boolean).pop() || ''
      if (last && /^[A-Za-z0-9._-]+$/.test(last) && last.length < 200) return last
    } catch {
      /* ignore */
    }
  }
  return s
}

/**
 * Only assign `mission.accession` when the citation code matches lenient validation (`normalizeNceiAccessionToken` + alphanumeric).
 * Skips DOI-like strings, URNs, and other identifiers that would raise **NCEI Accession must be alphanumeric**.
 * @param {string} norm result of {@link normalizeAccessionFromCitationCode}
 */
function isPlausibleNceiAccessionImport(norm) {
  const acc = normalizeNceiAccessionToken(norm)
  return !!acc && /^[A-Za-z0-9._-]+$/.test(acc)
}

/**
 * @param {Element | null} cite
 * @returns {{ publicationDate: string, startDate: string, endDate: string }}
 */
function citationDates(cite) {
  const out = { publicationDate: '', startDate: '', endDate: '' }
  if (!cite) return out
  for (const dateWrap of childrenNS(cite, NS.gmd, 'date')) {
    const ci = childNS(dateWrap, NS.gmd, 'CI_Date')
    if (!ci) continue
    const dt = childNS(ci, NS.gmd, 'date')
    const dateEl = dt ? childLocal(dt, 'Date') || childLocal(dt, 'DateTime') : null
    const dateStr = dateEl ? stripUxTemplateBraces(txt(dateEl)).trim() : ''
    const dtt = childNS(ci, NS.gmd, 'dateType')
    const code = dtt ? childNS(dtt, NS.gmd, 'CI_DateTypeCode') : null
    const typeVal = (code?.getAttribute('codeListValue') || txt(code)).toLowerCase()
    if (typeVal.includes('publication')) {
      out.publicationDate = dateStr
    } else if (
      !out.publicationDate &&
      (typeVal.includes('issue') || typeVal.includes('issued') || typeVal.includes('released'))
    ) {
      out.publicationDate = dateStr
    } else if (typeVal.includes('creation')) {
      out.startDate = dateStr
    } else if (!out.startDate && typeVal.includes('available')) {
      out.startDate = dateStr
    } else if (typeVal.includes('completion')) {
      out.endDate = dateStr
    } else if (
      !out.endDate &&
      (typeVal.includes('revision') ||
        typeVal.includes('last update') ||
        typeVal.includes('last modified') ||
        typeVal.includes('updated'))
    ) {
      out.endDate = dateStr
    } else if (
      !out.endDate &&
      (typeVal.includes('validity') || typeVal.includes('expiry') || typeVal.includes('expires'))
    ) {
      out.endDate = dateStr
    } else if (!out.endDate && (typeVal.includes('deprecated') || typeVal.includes('superseded'))) {
      out.endDate = dateStr
    }
  }
  return out
}

/**
 * @param {Element | null} cite
 * @returns {{ doi: string, accession: string }}
 */
function citationIdentifiers(cite) {
  const doi = { doi: '', accession: '' }
  if (!cite) return doi
  for (const idw of childrenNS(cite, NS.gmd, 'identifier')) {
    const mid = childNS(idw, NS.gmd, 'MD_Identifier')
    if (!mid) continue
    const codeRaw = mdIdentifierCodeString(childNS(mid, NS.gmd, 'code'))
    if (!codeRaw) continue
    const code = stripUxTemplateBraces(codeRaw).trim()
    if (!code) continue
    const doiNorm = code.replace(/^https?:\/\/doi\.org\//i, '')
    if (/^10\.\d{4,9}\//.test(doiNorm)) {
      doi.doi = doiNorm
    } else if (!doi.accession) {
      let acc = code
      const m = acc.match(/^NCEI\s*Accession\s*ID\s*:\s*(.+)$/i)
      if (m) acc = m[1].trim()
      acc = stripUxTemplateBraces(acc).trim()
      const norm = normalizeAccessionFromCitationCode(acc)
      if (norm && isPlausibleNceiAccessionImport(norm)) doi.accession = norm
    }
  }
  return doi
}

/**
 * Normalize `gml:endPosition` text (e.g. `ongoing`) and indeterminate endpoints for pilot date fields.
 * @param {string} endRaw
 * @param {string} beginRaw
 * @param {Element | null} endPosEl
 */
function normalizeTemporalExtentEndText(endRaw, beginRaw, endPosEl) {
  let endTxt = String(endRaw ?? '').trim()
  if (!endTxt && endPosEl) {
    endTxt = txt(endPosEl).trim()
    const indet = String(endPosEl.getAttribute('indeterminatePosition') || '').trim().toLowerCase()
    if (!endTxt && indet === 'now') {
      endTxt = new Date().toISOString().slice(0, 10)
    }
  }
  const low = endTxt.toLowerCase()
  if (low === 'ongoing' || low === 'present' || low === 'current' || low === 'indeterminate') {
    const b = String(beginRaw ?? '').trim()
    if (b) return b
    return new Date().toISOString().slice(0, 10)
  }
  return endTxt
}

/**
 * @param {Element | null} exExtent
 * @returns {{
 *   west: string, east: string, south: string, north: string,
 *   vmin: string, vmax: string,
 *   geographicDescription: string, verticalCrsUrl: string,
 *   trajectorySampling: string, hasTrajectory: boolean,
 *   startDate: string, endDate: string
 * }}
 */
function parseExtent(exExtent) {
  const out = {
    west: '',
    east: '',
    south: '',
    north: '',
    vmin: '',
    vmax: '',
    geographicDescription: '',
    verticalCrsUrl: '',
    trajectorySampling: '',
    hasTrajectory: false,
    startDate: '',
    endDate: '',
    temporalExtentIntervalUnit: '',
    temporalExtentIntervalValue: '',
  }
  if (!exExtent) return out

  const geoLines = []
  for (const d of childrenNS(exExtent, NS.gmd, 'description')) {
    const s = gcoCharacterString(d)
    if (!s) continue
    if (s.startsWith('Vertical CRS: ')) {
      out.verticalCrsUrl = s.slice('Vertical CRS: '.length).trim()
    } else if (s.startsWith('Trajectory sampling: ')) {
      out.hasTrajectory = true
      out.trajectorySampling = s.slice('Trajectory sampling: '.length).trim()
    } else {
      geoLines.push(s)
    }
  }
  if (geoLines.length) out.geographicDescription = geoLines.join('\n')

  for (const ge of childrenNS(exExtent, NS.gmd, 'geographicElement')) {
    const box = childNS(ge, NS.gmd, 'EX_GeographicBoundingBox')
    if (!box) continue
    const w = gcoDecimalFromWrapper(childNS(box, NS.gmd, 'westBoundLongitude'))
    const e = gcoDecimalFromWrapper(childNS(box, NS.gmd, 'eastBoundLongitude'))
    const s = gcoDecimalFromWrapper(childNS(box, NS.gmd, 'southBoundLatitude'))
    const n = gcoDecimalFromWrapper(childNS(box, NS.gmd, 'northBoundLatitude'))
    if (!out.west && w) out.west = w
    if (!out.east && e) out.east = e
    if (!out.south && s) out.south = s
    if (!out.north && n) out.north = n
  }

  for (const ve of childrenNS(exExtent, NS.gmd, 'verticalElement')) {
    const vx = childNS(ve, NS.gmd, 'EX_VerticalExtent')
    if (!vx) continue
    const lo = gcoRealFromWrapper(childNS(vx, NS.gmd, 'minimumValue'))
    const hi = gcoRealFromWrapper(childNS(vx, NS.gmd, 'maximumValue'))
    if (lo || hi) {
      out.vmin = lo
      out.vmax = hi
      break
    }
  }

  const instantSeries = []
  for (const tw of childrenNS(exExtent, NS.gmd, 'temporalElement')) {
    const ste = childNS(tw, NS.gmd, 'EX_SpatialTemporalExtent')
    if (ste) {
      const innerS = childNS(ste, NS.gmd, 'extent')
      if (innerS) {
        const ti0 = childLocal(innerS, 'TimeInstant')
        if (ti0) {
          const pos =
            txt(childNS(ti0, NS.gml, 'timePosition')) ||
            txt(childLocal(ti0, 'timePosition'))
          const p = pos.trim()
          if (p) instantSeries.push(p)
        }
        const tpS = childLocal(innerS, 'TimePeriod')
        if (tpS) {
          const begin =
            txt(childNS(tpS, NS.gml, 'begin')) ||
            txt(childNS(tpS, NS.gml, 'beginPosition')) ||
            txt(childLocal(tpS, 'begin')) ||
            txt(childLocal(tpS, 'beginPosition'))
          if (begin && !out.startDate) out.startDate = begin.trim()
          let endTxt =
            txt(childNS(tpS, NS.gml, 'end')) ||
            txt(childLocal(tpS, 'end')) ||
            ''
          endTxt = String(endTxt).trim()
          const endPosEl = childNS(tpS, NS.gml, 'endPosition') || childLocal(tpS, 'endPosition')
          const resolved = normalizeTemporalExtentEndText(endTxt, begin, endPosEl)
          if (resolved && !out.endDate) out.endDate = resolved
          const ti = childNS(tpS, NS.gml, 'timeInterval') || childLocal(tpS, 'timeInterval')
          if (ti && !out.temporalExtentIntervalValue) {
            out.temporalExtentIntervalUnit = ti.getAttribute('unit') || ti.getAttributeNS(NS.gml, 'unit') || ''
            out.temporalExtentIntervalValue = txt(ti)
          }
        }
      }
    }

    const temp = childNS(tw, NS.gmd, 'EX_TemporalExtent')
    const inner = temp ? childNS(temp, NS.gmd, 'extent') : null
    const tp = inner ? childLocal(inner, 'TimePeriod') : null
    if (inner) {
      const ti1 = childLocal(inner, 'TimeInstant')
      if (ti1) {
        const pos =
          txt(childNS(ti1, NS.gml, 'timePosition')) ||
          txt(childLocal(ti1, 'timePosition'))
        const p = pos.trim()
        if (p) instantSeries.push(p)
      }
    }
    if (!tp) continue
    const begin =
      txt(childNS(tp, NS.gml, 'begin')) ||
      txt(childNS(tp, NS.gml, 'beginPosition')) ||
      txt(childLocal(tp, 'begin')) ||
      txt(childLocal(tp, 'beginPosition'))
    if (begin && !out.startDate) out.startDate = begin.trim()
    let endTxt =
      txt(childNS(tp, NS.gml, 'end')) ||
      txt(childLocal(tp, 'end')) ||
      ''
    endTxt = String(endTxt).trim()
    const endPosEl = childNS(tp, NS.gml, 'endPosition') || childLocal(tp, 'endPosition')
    const resolved = normalizeTemporalExtentEndText(endTxt, begin, endPosEl)
    if (resolved && !out.endDate) out.endDate = resolved
    const ti = childNS(tp, NS.gml, 'timeInterval') || childLocal(tp, 'timeInterval')
    if (ti && !out.temporalExtentIntervalValue) {
      out.temporalExtentIntervalUnit = ti.getAttribute('unit') || ti.getAttributeNS(NS.gml, 'unit') || ''
      out.temporalExtentIntervalValue = txt(ti)
    }
  }
  if (!out.startDate && instantSeries[0]) out.startDate = instantSeries[0]
  if (!out.endDate && instantSeries[1]) out.endDate = instantSeries[1]
  swapWestEastIfReversed(out, undefined, undefined)
  swapSouthNorthIfReversed(out, undefined, undefined)
  return out
}

/**
 * Merge multiple extent parse results (fills empty axes/dates from sibling blocks).
 * @param {Array<Record<string, unknown>>} parts
 * @param {Record<string, unknown>} emptyTemplate
 */
function mergeExtentPartials(parts, emptyTemplate) {
  if (!parts.length) return /** @type {Record<string, unknown>} */ ({ ...emptyTemplate })
  const merged = { ...parts[0] }
  const keys = Object.keys(emptyTemplate)
  for (let i = 1; i < parts.length; i++) {
    const e = parts[i]
    for (const k of keys) {
      if (k === 'hasTrajectory') continue
      const ek = e[k]
      const mk = merged[k]
      if (!String(mk || '').trim() && String(ek || '').trim()) {
        merged[k] = ek
      }
    }
    merged.hasTrajectory = Boolean(merged.hasTrajectory || e.hasTrajectory)
  }
  return merged
}

/**
 * Merge all `gmd:extent` / `EX_Extent` blocks (records often split temporal vs geographic).
 * @param {Element | null} dataId
 * @returns {ReturnType<typeof parseExtent>}
 */
function mergeExtentsFromDataIdentification(dataId) {
  const empty = parseExtent(null)
  if (!dataId) return empty
  const parts = []
  for (const ew of childrenNS(dataId, NS.gmd, 'extent')) {
    const ex = childNS(ew, NS.gmd, 'EX_Extent')
    if (ex) parts.push(parseExtent(ex))
  }
  return /** @type {ReturnType<typeof parseExtent>} */ (
    mergeExtentPartials(parts, empty)
  )
}

/**
 * @param {Element | null} dataId
 * @returns {Record<string, Array<{ label: string, uuid: string }>>}
 */
function parseKeywords(dataId) {
  /** @type {Record<string, Array<{ label: string, uuid: string }>>} */
  const facets = {}
  if (!dataId) return facets

  for (const dk of childrenNS(dataId, NS.gmd, 'descriptiveKeywords')) {
    const mk = childNS(dk, NS.gmd, 'MD_Keywords')
    if (!mk) continue
    const facet = facetFromMdKeywordsBlock(mk, dk)
    if (!facet) continue

    const labels = []
    for (const kw of childrenNS(mk, NS.gmd, 'keyword')) {
      const { label, uuid } = keywordLabelAndUuidFromKeywordElement(kw)
      const lab = stripUxTemplateBraces(label).trim()
      if (!lab) continue
      labels.push({ label: lab, uuid })
    }
    if (labels.length) {
      if (!facets[facet]) facets[facet] = []
      facets[facet].push(...labels)
    }
  }
  if (facets.datacenters?.length && !facets.providers?.length) {
    facets.providers = facets.datacenters.map((row) => ({ ...row }))
  }
  return facets
}

/**
 * Resource language from identification (`MD_DataIdentification`).
 * @param {Element | null} dataId
 */
function parseIdentificationLanguageGmd(dataId) {
  if (!dataId) return ''
  const langWrap = childNS(dataId, NS.gmd, 'language')
  if (!langWrap) return ''
  const langEl = childNS(langWrap, NS.gmd, 'LanguageCode')
  const fromCode = (langEl?.getAttribute('codeListValue') || txt(langEl) || '').trim()
  if (fromCode) return fromCode
  return String(gcoCharacterString(langWrap) || '').trim()
}

/**
 * Record-level language from metadata root (`gmd:language`).
 * @param {Element | null} root
 */
function parseRootLanguageGmd(root) {
  if (!root) return ''
  const langWrap = childNS(root, NS.gmd, 'language')
  if (!langWrap) return ''
  const langEl = childNS(langWrap, NS.gmd, 'LanguageCode')
  const fromCode = (langEl?.getAttribute('codeListValue') || txt(langEl) || '').trim()
  if (fromCode) return fromCode
  return String(gcoCharacterString(langWrap) || '').trim()
}

/**
 * @param {Element | null} dataId
 */
function parseIdentificationCharacterSetGmd(dataId) {
  if (!dataId) return ''
  const csEl = childNS(childNS(dataId, NS.gmd, 'characterSet'), NS.gmd, 'MD_CharacterSetCode')
  return (csEl?.getAttribute('codeListValue') || txt(csEl) || '').trim()
}

/**
 * @param {Element | null} root
 */
function parseRootCharacterSetGmd(root) {
  if (!root) return ''
  const csEl = childNS(childNS(root, NS.gmd, 'characterSet'), NS.gmd, 'MD_CharacterSetCode')
  return (csEl?.getAttribute('codeListValue') || txt(csEl) || '').trim()
}

/**
 * @param {Element | null} dataId
 * @returns {string[]}
 */
function parseTopicCategories(dataId) {
  if (!dataId) return []
  const out = []
  for (const tc of childrenNS(dataId, NS.gmd, 'topicCategory')) {
    const code = childNS(tc, NS.gmd, 'MD_TopicCategoryCode')
    let v = (code?.getAttribute('codeListValue') || txt(code) || '').trim()
    if (!v && code) v = String(gcoCharacterString(code) || '').trim()
    if (!v) v = String(gcoCharacterString(tc) || '').trim()
    if (!v) v = txt(tc).trim()
    if (v) out.push(v)
  }
  return out
}

/**
 * @param {Element | null} cite  `gmd:CI_Citation`
 * @returns {{
 *   citationAuthorIndividualName: string,
 *   citationAuthorOrganisationName: string,
 *   citationPublisherOrganisationName: string,
 *   citationOriginatorIndividualName: string,
 *   citationOriginatorOrganisationName: string,
 *   citationPrincipalInvestigatorIndividualName: string,
 *   citationResourceProviderIndividualName: string,
 * }}
 */
function parseCitationParties(cite) {
  const out = {
    citationAuthorIndividualName: '',
    citationAuthorOrganisationName: '',
    citationPublisherOrganisationName: '',
    citationOriginatorIndividualName: '',
    citationOriginatorOrganisationName: '',
    citationPrincipalInvestigatorIndividualName: '',
    citationResourceProviderIndividualName: '',
  }
  if (!cite) return out
  for (const crp of childrenNS(cite, NS.gmd, 'citedResponsibleParty')) {
    const rp = childNS(crp, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    const roleEl = childNS(rp, NS.gmd, 'role')
    const roleCode = roleEl ? childNS(roleEl, NS.gmd, 'CI_RoleCode') : null
    const role = (roleCode?.getAttribute('codeListValue') || txt(roleCode)).toLowerCase()
    const ind = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'individualName'))
    const org = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'organisationName'))
    if (role.includes('author')) {
      if (!out.citationAuthorIndividualName && ind) out.citationAuthorIndividualName = ind
      if (!out.citationAuthorOrganisationName && org) out.citationAuthorOrganisationName = org
    } else if (role.includes('publisher')) {
      if (!out.citationPublisherOrganisationName && org) out.citationPublisherOrganisationName = org
      else if (!out.citationPublisherOrganisationName && ind) out.citationPublisherOrganisationName = ind
    } else if (role.includes('originator')) {
      if (!out.citationOriginatorIndividualName && ind) out.citationOriginatorIndividualName = ind
      if (!out.citationOriginatorOrganisationName && org) out.citationOriginatorOrganisationName = org
    } else if (role.includes('principalinvestigator')) {
      if (!out.citationPrincipalInvestigatorIndividualName && ind) out.citationPrincipalInvestigatorIndividualName = ind
    } else if (role.includes('resourceprovider')) {
      if (!out.citationResourceProviderIndividualName && ind) out.citationResourceProviderIndividualName = ind
    }
  }
  return out
}

/**
 * Root-level metadata preparer contact (often DocuComp xlink only).
 * @param {Element} root
 */
function parseRootMetadataContact(root) {
  const out = {
    nceiMetadataContactHref: '',
    nceiMetadataContactTitle: '',
    useNceiMetadataContactXlink: false,
  }
  for (const c of childrenNS(root, NS.gmd, 'contact')) {
    const href = c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || ''
    if (!href.trim()) continue
    out.nceiMetadataContactHref = href.trim()
    out.nceiMetadataContactTitle = (
      c.getAttributeNS(NS.xlink, 'title') ||
      c.getAttribute('xlink:title') ||
      'NCEI (pointOfContact)'
    ).trim()
    out.useNceiMetadataContactXlink = true
    break
  }
  return out
}

/**
 * Publishing-office org from root `gmd:contact` when identification POC omits `organisationName` (common in InPort).
 * @param {Element} root
 */
function firstRootContactOrganisationLegacy(root) {
  for (const c of childrenNS(root, NS.gmd, 'contact')) {
    const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (href) continue
    const rp = childNS(c, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    const o = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'organisationName'))
    const t = stripUxTemplateBraces(o).trim()
    if (t) return t
  }
  return ''
}

/**
 * Same as {@link firstRootContactOrganisationLegacy} for ISO 19115-3 `mdb:contact`.
 * @param {Element} root
 */
function firstRootContactOrganisation3(root) {
  for (const c of cns3(root, NS3.mdb, 'contact')) {
    const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (href) continue
    const resp = cn3(c, NS3.cit, 'CI_Responsibility')
    if (!resp) continue
    const p = parseCI_Responsibility3(resp)
    const t = stripUxTemplateBraces(String(p.organisationName || '').trim()).trim()
    if (t) return t
  }
  return ''
}

/**
 * First inline root `gmd:contact` / `mdb:contact` party (non-xlink) for filling mission email gaps.
 * @param {Element} root
 * @returns {ReturnType<typeof parseResponsibleParty> | null}
 */
function firstRootContactPartyLegacy(root) {
  for (const c of childrenNS(root, NS.gmd, 'contact')) {
    const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (href) continue
    const rp = childNS(c, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    return parseResponsibleParty(rp)
  }
  return null
}

/**
 * @param {Record<string, string>} base
 * @param {Record<string, string> | null | undefined} fill
 */
function mergeContactPartyFields(base, fill) {
  if (!fill) return base
  const out = { ...base }
  const keys = ['email', 'contactPhone', 'contactAddress', 'contactUrl', 'organisationName', 'individualName']
  for (const k of keys) {
    if (!String(out[k] || '').trim() && String(fill[k] || '').trim()) out[k] = fill[k]
  }
  return out
}

/**
 * @param {Element} pocEl `gmd:pointOfContact` possibly xlink-only.
 */
function syntheticPartyFromGmdPocXlink(pocEl) {
  const href = (pocEl.getAttributeNS(NS.xlink, 'href') || pocEl.getAttribute('xlink:href') || '').trim()
  const title = (pocEl.getAttributeNS(NS.xlink, 'title') || pocEl.getAttribute('xlink:title') || '').trim()
  if (!href || !title) return null
  const cleaned = title.replace(/\s*\(pointOfContact\)\s*$/i, '').trim()
  if (!cleaned) return null
  return {
    individualName: cleaned,
    organisationName: '',
    email: '',
    contactPhone: '',
    contactUrl: '',
    contactAddress: '',
  }
}

/**
 * Merge identification POC with inline root metadata contact (NCEI xlink POC + root email).
 * @param {ReturnType<typeof parsePointOfContact>} poc
 * @param {Element} root
 */
function mergeLegacyPointOfContactWithRootContact(poc, root) {
  const rootParty = firstRootContactPartyLegacy(root)
  return mergeContactPartyFields(poc, rootParty)
}

/**
 * Merge ISO 19115-3 identification POC with inline `mdb:contact` rows (root email when dataId POC is org-only).
 * @param {ReturnType<typeof parsePointOfContact3>} poc
 * @param {Element} root
 */
function merge19115_3PointOfContactWithRootContact(poc, root) {
  let out = { ...poc }
  for (const c of cns3(root, NS3.mdb, 'contact')) {
    const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (href) continue
    const resp = cn3(c, NS3.cit, 'CI_Responsibility')
    if (!resp) continue
    out = mergeContactPartyFields(out, parseCI_Responsibility3(resp))
  }
  return out
}

/**
 * @param {Element | null} dataId
 * @returns {{
 *   metadataMaintenanceFrequency: string,
 *   graphicOverviewHref: string,
 *   graphicOverviewTitle: string,
 * }}
 */
function parseIdentificationMaintenanceGraphic(dataId) {
  const out = {
    metadataMaintenanceFrequency: '',
    graphicOverviewHref: '',
    graphicOverviewTitle: '',
  }
  if (!dataId) return out
  const rm = childNS(dataId, NS.gmd, 'resourceMaintenance')
  const mi = rm ? childNS(rm, NS.gmd, 'MD_MaintenanceInformation') : null
  if (mi) {
    const freq = childNS(childNS(mi, NS.gmd, 'maintenanceAndUpdateFrequency'), NS.gmd, 'MD_MaintenanceFrequencyCode')
    const fv = (freq?.getAttribute('codeListValue') || txt(freq) || '').trim()
    if (fv) out.metadataMaintenanceFrequency = fv
  }
  for (const go of childrenNS(dataId, NS.gmd, 'graphicOverview')) {
    let href = (go.getAttributeNS(NS.xlink, 'href') || go.getAttribute('xlink:href') || '').trim()
    let title = (
      go.getAttributeNS(NS.xlink, 'title') ||
      go.getAttribute('xlink:title') ||
      ''
    ).trim()
    if (!href) {
      const bg = childNS(go, NS.gmd, 'MD_BrowseGraphic')
      if (bg) {
        const fnEl = childNS(bg, NS.gmd, 'fileName')
        const fromFile = fnEl ? gmdAnchorOrCharacterString(fnEl) || gcoCharacterString(fnEl) : ''
        const candidate = stripUxTemplateBraces(fromFile).trim()
        if (/^https?:\/\//i.test(candidate)) {
          href = candidate
          const fd = childNS(bg, NS.gmd, 'fileDescription')
          if (fd) title = (gmdAnchorOrCharacterString(fd) || gcoCharacterString(fd) || title).trim()
        }
      }
    }
    if (!href) continue
    out.graphicOverviewHref = href
    out.graphicOverviewTitle = title
    break
  }
  return out
}

/**
 * @param {Element} m
 * @returns {{ parentProjectTitle: string, parentProjectDate: string, parentProjectCode: string,
 *   relatedDatasetTitle: string, relatedDatasetDate: string, relatedDatasetCode: string, relatedDatasetOrg: string,
 *   relatedDataUrl: string, relatedDataUrlTitle: string, relatedDataUrlDescription: string,
 *   associatedPublicationTitle: string, associatedPublicationDate: string, associatedPublicationCode: string }}
 */
function parseAggregations(m) {
  const out = {
    parentProjectTitle: '',
    parentProjectDate: '',
    parentProjectCode: '',
    relatedDatasetTitle: '',
    relatedDatasetDate: '',
    relatedDatasetCode: '',
    relatedDatasetOrg: '',
    relatedDataUrl: '',
    relatedDataUrlTitle: '',
    relatedDataUrlDescription: '',
    associatedPublicationTitle: '',
    associatedPublicationDate: '',
    associatedPublicationCode: '',
  }
  for (const ai of childrenNS(m, NS.gmd, 'aggregationInfo')) {
    const inf = childNS(ai, NS.gmd, 'MD_AggregateInformation')
    if (!inf) continue
    const assoc = childNS(childNS(inf, NS.gmd, 'associationType'), NS.gmd, 'DS_AssociationTypeCode')
    const assocVal = (assoc?.getAttribute('codeListValue') || txt(assoc)).toLowerCase()
    const initWrap = childNS(inf, NS.gmd, 'initiativeType')
    const initCode = initWrap ? childNS(initWrap, NS.gmd, 'DS_InitiativeTypeCode') : null
    const initVal = (initCode?.getAttribute('codeListValue') || txt(initCode)).toLowerCase()

    const cite = childNS(childNS(inf, NS.gmd, 'aggregateDataSetName'), NS.gmd, 'CI_Citation')
    const title = cite ? gcoCharacterString(childNS(cite, NS.gmd, 'title')) : ''
    const pubDate = (() => {
      for (const dw of cite ? childrenNS(cite, NS.gmd, 'date') : []) {
        const ci = childNS(dw, NS.gmd, 'CI_Date')
        if (!ci) continue
        const dtt = childNS(ci, NS.gmd, 'dateType')
        const code = dtt ? childNS(dtt, NS.gmd, 'CI_DateTypeCode') : null
        const tv = (code?.getAttribute('codeListValue') || txt(code)).toLowerCase()
        if (tv.includes('publication')) {
          const dt = childNS(ci, NS.gmd, 'date')
          const dateEl = dt ? childLocal(dt, 'Date') : null
          return dateEl ? txt(dateEl) : ''
        }
      }
      return ''
    })()
    const code = (() => {
      for (const iw of cite ? childrenNS(cite, NS.gmd, 'identifier') : []) {
        const mid = childNS(iw, NS.gmd, 'MD_Identifier')
        const c = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
        if (c) return c
      }
      return ''
    })()
    const orgNote = cite ? gcoCharacterString(childNS(cite, NS.gmd, 'otherCitationDetails')) : ''
    const online = cite ? childNS(cite, NS.gmd, 'onlineResource') : null
    const ciOn = online ? childNS(online, NS.gmd, 'CI_OnlineResource') : null
    const linkEl = ciOn ? childNS(ciOn, NS.gmd, 'linkage') : null
    const url = linkEl ? txt(childNS(linkEl, NS.gmd, 'URL')) : ''

    if (assocVal.includes('largerwork') || assocVal.includes('larger_work')) {
      out.parentProjectTitle = title
      out.parentProjectDate = pubDate
      out.parentProjectCode = code
    } else if (assocVal.includes('crossreference') || assocVal.includes('cross_reference')) {
      if (initVal.includes('sciencepaper') || initVal.includes('science_paper')) {
        out.associatedPublicationTitle = title
        out.associatedPublicationDate = pubDate
        out.associatedPublicationCode = code
      } else {
        out.relatedDatasetTitle = title
        out.relatedDatasetDate = pubDate
        out.relatedDatasetCode = code
        out.relatedDatasetOrg = orgNote
        if (url) {
          out.relatedDataUrl = url
          out.relatedDataUrlTitle = ciOn ? gcoCharacterString(childNS(ciOn, NS.gmd, 'name')) : ''
          out.relatedDataUrlDescription = ciOn ? gcoCharacterString(childNS(ciOn, NS.gmd, 'description')) : ''
        }
      }
    }
  }
  return out
}

/**
 * ISO 19115-3 `mri:MD_DataIdentification` aggregation → same pilot fields as {@link parseAggregations}.
 * @param {Element | null} m  `mri:MD_DataIdentification`
 */
function parseAggregations3(m) {
  const out = {
    parentProjectTitle: '',
    parentProjectDate: '',
    parentProjectCode: '',
    relatedDatasetTitle: '',
    relatedDatasetDate: '',
    relatedDatasetCode: '',
    relatedDatasetOrg: '',
    relatedDataUrl: '',
    relatedDataUrlTitle: '',
    relatedDataUrlDescription: '',
    associatedPublicationTitle: '',
    associatedPublicationDate: '',
    associatedPublicationCode: '',
  }
  if (!m) return out
  for (const ai of cns3(m, NS3.mri, 'aggregationInfo')) {
    const inf = cn3(ai, NS3.mri, 'MD_AggregateInformation')
    if (!inf) continue
    const assoc = cn3(cn3(inf, NS3.mri, 'associationType'), NS3.mcc, 'DS_AssociationTypeCode')
    const assocVal = (assoc?.getAttribute('codeListValue') || txt(assoc)).toLowerCase()
    const initWrap = cn3(inf, NS3.mri, 'initiativeType')
    const initCode = initWrap ? cn3(initWrap, NS3.mcc, 'DS_InitiativeTypeCode') : null
    const initVal = (initCode?.getAttribute('codeListValue') || txt(initCode)).toLowerCase()

    const cite = cn3(cn3(inf, NS3.mri, 'aggregateDataSetName'), NS3.cit, 'CI_Citation')
    const title = cite ? gcs3(cn3(cite, NS3.cit, 'title')) : ''
    const pubDate = (() => {
      for (const dw of cite ? cns3(cite, NS3.cit, 'date') : []) {
        const ci = cn3(dw, NS3.cit, 'CI_Date')
        if (!ci) continue
        const dtt = cn3(ci, NS3.cit, 'dateType')
        const code = dtt ? cn3(dtt, NS3.cit, 'CI_DateTypeCode') : null
        const tv = (code?.getAttribute('codeListValue') || txt(code)).toLowerCase()
        if (tv.includes('publication')) {
          const dt = cn3(ci, NS3.cit, 'date')
          const dateEl = dt ? childLocal(dt, 'Date') || childLocal(dt, 'DateTime') : null
          return dateEl ? txt(dateEl) : ''
        }
      }
      return ''
    })()
    const code = (() => {
      for (const iw of cite ? cns3(cite, NS3.cit, 'identifier') : []) {
        const mid = cn3(iw, NS3.mcc, 'MD_Identifier')
        const c = mid ? gcs3(cn3(mid, NS3.mcc, 'code')) : ''
        if (c) return c
      }
      return ''
    })()
    const orgNote = cite ? gcs3(cn3(cite, NS3.cit, 'otherCitationDetails')) : ''
    const online = cite ? cn3(cite, NS3.cit, 'onlineResource') : null
    const ciOn = online ? cn3(online, NS3.cit, 'CI_OnlineResource') : null
    const linkEl = ciOn ? cn3(ciOn, NS3.cit, 'linkage') : null
    const url = citLinkageUrl(linkEl)

    if (assocVal.includes('largerwork') || assocVal.includes('larger_work')) {
      out.parentProjectTitle = title
      out.parentProjectDate = pubDate
      out.parentProjectCode = code
    } else if (assocVal.includes('crossreference') || assocVal.includes('cross_reference')) {
      if (initVal.includes('sciencepaper') || initVal.includes('science_paper')) {
        out.associatedPublicationTitle = title
        out.associatedPublicationDate = pubDate
        out.associatedPublicationCode = code
      } else {
        out.relatedDatasetTitle = title
        out.relatedDatasetDate = pubDate
        out.relatedDatasetCode = code
        out.relatedDatasetOrg = orgNote
        if (url) {
          out.relatedDataUrl = url
          out.relatedDataUrlTitle = ciOn ? gcs3(cn3(ciOn, NS3.cit, 'name')) : ''
          out.relatedDataUrlDescription = ciOn ? gcs3(cn3(ciOn, NS3.cit, 'description')) : ''
        }
      }
    }
  }
  return out
}

/**
 * Prefer a non-coordinate `gmd:MD_Band` dimension name as the observed variable when coverage `gmd:name` is empty.
 * @param {Element} covEl `gmi:MI_CoverageDescription`
 */
function firstObservableVariableFromCoverageDescription(covEl) {
  const skip = new Set([
    'time',
    'latitude',
    'longitude',
    'lat',
    'lon',
    'lat_bounds',
    'lon_bounds',
    'lat_bnds',
    'lon_bnds',
    'bounds',
    'bnds',
    'height',
    'altitude',
    'depth',
  ])
  for (const dim of childrenNS(covEl, NS.gmd, 'dimension')) {
    const band = childNS(dim, NS.gmd, 'MD_Band')
    if (!band) continue
    const mem = childNS(childNS(band, NS.gmd, 'sequenceIdentifier'), NS.gco, 'MemberName')
    const anameEl = mem ? childNS(mem, NS.gco, 'aName') : null
    const aNameRaw = anameEl ? gcoCharacterString(anameEl) : ''
    const t = String(aNameRaw || '').trim().toLowerCase()
    if (!t || skip.has(t)) continue
    return String(aNameRaw).trim()
  }
  return ''
}

/**
 * @param {Element} root
 * @returns {Array<Record<string, string>>}
 */
function parseSensors(root) {
  const nodes = root.getElementsByTagNameNS(NS.gmi, 'MI_CoverageDescription')
  const out = []
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const idw = childNS(n, NS.gmd, 'identifier')
    const mid = idw ? childNS(idw, NS.gmd, 'MD_Identifier') : null
    const sid = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
    const type = gcoCharacterString(childNS(n, NS.gmd, 'attributeDescription'))
    const variableFromName = gcoCharacterString(childNS(n, NS.gmd, 'name'))
    const desc = gcoCharacterString(childNS(n, NS.gmd, 'description'))
    const parsed = parseInstrumentDescriptionBlock(desc)
    const typeTrim = String(type || '').trim()
    const descTrim = String(desc || '').trim()
    const nameTrim = String(variableFromName || '').trim()
    let variable = typeTrim
    if (!variable) {
      const pv = String(parsed.variable || '').trim()
      if (nameTrim && !/manufacturer:|model:|s\/n:/i.test(nameTrim)) variable = nameTrim
      else if (pv && !/manufacturer:|model:|s\/n:/i.test(pv)) variable = pv
    }
    let row = {
      sensorId: sid,
      type,
      modelId: sid,
      description: descTrim,
      variable,
      firmware: parsed.firmware,
      operationMode: parsed.operationMode,
      uncertainty: parsed.uncertainty,
      frequency: parsed.frequency,
      beamCount: parsed.beamCount,
      depthRating: parsed.depthRating,
      confidenceInterval: parsed.confidenceInterval,
    }
    row = normalizeSensorInstrumentIds(row)
    if (!String(row.variable || '').trim()) {
      const fromBand = firstObservableVariableFromCoverageDescription(n)
      if (fromBand) row.variable = fromBand
    }
    if (acquisitionInstrumentHasContent(row)) out.push(row)
  }
  return out
}

/**
 * Text from `gmd:processStep` wrapping `LI_ProcessStep` or `gmi:LE_ProcessStep`.
 * @param {Element} ps
 */
function lineageProcessStepDescription(ps) {
  const lip =
    childNS(ps, NS.gmd, 'LI_ProcessStep') ||
    childNS(ps, NS.gmi, 'LE_ProcessStep') ||
    childLocal(ps, 'LI_ProcessStep') ||
    childLocal(ps, 'LE_ProcessStep')
  if (!lip) return ''
  return gmdAnchorOrCharacterString(childNS(lip, NS.gmd, 'description'))
}

/**
 * Label + value from legacy `gmd:DQ_*` → `DQ_QuantitativeResult` (`gmi:Quantity` / `gco:Decimal`).
 * @param {Element | null} block
 * @returns {{ label: string, value: string }}
 */
function legacyDqQuantitativeLabelValue(block) {
  const empty = { label: '', value: '' }
  if (!block) return empty
  const res = childNS(block, NS.gmd, 'result')
  const qr = res ? childNS(res, NS.gmd, 'DQ_QuantitativeResult') : null
  if (!qr) return empty
  const vtWrap = childLocal(qr, 'valueType')
  const rt = vtWrap ? childNS(vtWrap, NS.gco, 'RecordType') || childLocal(vtWrap, 'RecordType') : null
  const label = rt ? txt(rt) : ''
  const valWrap = childLocal(qr, 'value')
  const rec = valWrap ? childNS(valWrap, NS.gco, 'Record') || childLocal(valWrap, 'Record') : null
  const qty = rec ? childNS(rec, NS.gmi, 'Quantity') : null
  const decEl = qty ? childNS(qty, NS.gco, 'Decimal') : null
  const dec = decEl ? txt(decEl) : ''
  return { label, value: dec }
}

/**
 * @param {Element} root
 * @returns {{
 *   accuracyStandard: string,
 *   accuracyValue: string,
 *   errorLevel: string,
 *   errorValue: string,
 *   lineageStatement: string,
 *   lineageProcessSteps: string,
 * }}
 */
function parseDataQuality(root) {
  const out = {
    accuracyStandard: '',
    accuracyValue: '',
    errorLevel: '',
    errorValue: '',
    lineageStatement: '',
    lineageProcessSteps: '',
  }
  for (const dqi of childrenNS(root, NS.gmd, 'dataQualityInfo')) {
    const dq = childNS(dqi, NS.gmd, 'DQ_DataQuality')
    if (!dq) continue

    for (const rep of childrenNS(dq, NS.gmd, 'report')) {
      const qaa = childNS(rep, NS.gmd, 'DQ_QuantitativeAttributeAccuracy')
      const grid = childNS(rep, NS.gmd, 'DQ_GriddedDataPositionalAccuracy')
      const pos = childNS(rep, NS.gmd, 'DQ_AbsoluteExternalPositionalAccuracy')
      const rel = childNS(rep, NS.gmd, 'DQ_RelativeInternalPositionalAccuracy')

      const accBlock = qaa || grid
      if (accBlock) {
        const { label, value } = legacyDqQuantitativeLabelValue(accBlock)
        if (!out.accuracyStandard) out.accuracyStandard = label
        if (!out.accuracyValue) out.accuracyValue = value
      }
      const errBlock = pos || rel
      if (errBlock) {
        const { label, value } = legacyDqQuantitativeLabelValue(errBlock)
        if (!out.errorLevel) out.errorLevel = label
        if (!out.errorValue) out.errorValue = value
      }
    }
  }
  for (const dqi of childrenNS(root, NS.gmd, 'dataQualityInfo')) {
    const dq = childNS(dqi, NS.gmd, 'DQ_DataQuality')
    if (!dq) continue
    const lin = childNS(dq, NS.gmd, 'lineage')
    const li = lin ? childNS(lin, NS.gmd, 'LI_Lineage') : null
    if (!li) continue
    const st = gmdAnchorOrCharacterString(childNS(li, NS.gmd, 'statement'))
    if (st) out.lineageStatement = st
    const steps = []
    for (const ps of childrenNS(li, NS.gmd, 'processStep')) {
      const d = lineageProcessStepDescription(ps)
      if (d) steps.push(d)
    }
    if (steps.length) out.lineageProcessSteps = steps.join('\n\n')
    if (!out.lineageStatement && steps.length) out.lineageStatement = steps.join('\n\n')
    if (st || steps.length) break
  }
  return out
}

/**
 * @param {Element} root
 * @returns {{ referenceSystem: string }}
 */
function parseReferenceSystem(root) {
  const rsi = childNS(root, NS.gmd, 'referenceSystemInfo')
  const rs = rsi ? childNS(rsi, NS.gmd, 'MD_ReferenceSystem') : null
  const idf = rs ? childNS(childNS(rs, NS.gmd, 'referenceSystemIdentifier'), NS.gmd, 'RS_Identifier') : null
  const code = idf ? gcoCharacterString(childNS(idf, NS.gmd, 'code')) : ''
  return { referenceSystem: code }
}

/**
 * @param {Element} root
 * @returns {{
 *   useGridRepresentation: boolean,
 *   gridCellGeometry: string,
 *   gridColumnSize: string, gridColumnResolution: string,
 *   gridRowSize: string, gridRowResolution: string,
 *   gridVerticalSize: string, gridVerticalResolution: string,
 *   dimensions: string
 * }}
 */
function parseSpatialRepresentation(root) {
  const out = {
    useGridRepresentation: false,
    gridCellGeometry: '',
    gridColumnSize: '',
    gridColumnResolution: '',
    gridRowSize: '',
    gridRowResolution: '',
    gridVerticalSize: '',
    gridVerticalResolution: '',
    dimensions: '',
  }
  for (const sri of childrenNS(root, NS.gmd, 'spatialRepresentationInfo')) {
    const grid = childNS(sri, NS.gmd, 'MD_GridSpatialRepresentation')
    if (grid) {
      const cg = childNS(childNS(grid, NS.gmd, 'cellGeometry'), NS.gmd, 'MD_CellGeometryCode')
      out.gridCellGeometry = cg?.getAttribute('codeListValue') || txt(cg)
      for (const ax of childrenNS(grid, NS.gmd, 'axisDimensionProperties')) {
        const dim = childNS(ax, NS.gmd, 'MD_Dimension')
        if (!dim) continue
        const nameCode = childNS(childNS(dim, NS.gmd, 'dimensionName'), NS.gmd, 'MD_DimensionNameTypeCode')
        const axis = (nameCode?.getAttribute('codeListValue') || txt(nameCode)).toLowerCase()
        const size = stripUxTemplateBraces(gcoIntegerFromWrapper(childNS(dim, NS.gmd, 'dimensionSize'))).trim()
        const res = stripUxTemplateBraces(gcoCharacterString(childNS(dim, NS.gmd, 'resolution'))).trim()
        if (axis === 'column') {
          out.gridColumnSize = size
          out.gridColumnResolution = res
        } else if (axis === 'row') {
          out.gridRowSize = size
          out.gridRowResolution = res
        } else if (axis === 'vertical') {
          out.gridVerticalSize = size
          out.gridVerticalResolution = res
        }
      }
      out.useGridRepresentation = !!(String(out.gridColumnSize || '').trim() && String(out.gridRowSize || '').trim())
      continue
    }
    const geo = childNS(sri, NS.gmd, 'MD_Georectified')
    if (geo) {
      out.dimensions = stripUxTemplateBraces(gcoIntegerFromWrapper(childNS(geo, NS.gmd, 'numberOfDimensions'))).trim()
    }
  }
  return out
}

/**
 * Accept only real http(s) URLs without `{{…}}` placeholders so template XML
 * does not populate `distribution.*` with invalid values (UxS `{{accessURL}}`, etc.).
 * @param {string} raw
 * @returns {boolean}
 */
function isImportableOnlineUrl(raw) {
  const u = String(raw || '').trim()
  if (!u) return false
  if (u.includes('{{') || u.includes('}}')) return false
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * First http(s) linkage under citation citedResponsibleParty (InPort full-metadata URL often lives here).
 * Namespace-agnostic so ISO19115-3 `cit:CI_Citation` also works.
 * @param {Element | null} cite `gmd:CI_Citation` or `cit:CI_Citation`
 */
function firstCitationOnlineLinkageUrl(cite) {
  if (!cite) return ''
  const cited = []
  cited.push(...childrenNS(cite, NS.gmd, 'citedResponsibleParty'))
  if (!cited.length) {
    for (const c of cite.children || []) {
      if (c.localName === 'citedResponsibleParty') cited.push(c)
    }
  }
  for (const crp of cited) {
    let rp = childNS(crp, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) {
      for (const c of crp.children || []) {
        if (c.localName === 'CI_ResponsibleParty') {
          rp = c
          break
        }
      }
    }
    if (!rp) continue
    let ci = childNS(childNS(rp, NS.gmd, 'contactInfo'), NS.gmd, 'CI_Contact')
    if (!ci) {
      const ciWrap = childLocal(rp, 'contactInfo')
      ci = ciWrap ? childLocal(ciWrap, 'CI_Contact') : null
    }
    let or = ci ? childNS(ci, NS.gmd, 'onlineResource') : null
    if (!or && ci) or = childLocal(ci, 'onlineResource')
    let ciOn = or ? childNS(or, NS.gmd, 'CI_OnlineResource') : null
    if (!ciOn && or) ciOn = childLocal(or, 'CI_OnlineResource')
    let linkEl = ciOn ? childNS(ciOn, NS.gmd, 'linkage') : null
    if (!linkEl && ciOn) linkEl = childLocal(ciOn, 'linkage')
    let urlEl = linkEl ? childNS(linkEl, NS.gmd, 'URL') : null
    if (!urlEl && linkEl) urlEl = childLocal(linkEl, 'URL')
    const raw = urlEl ? txt(urlEl) : ''
    const u = stripUxTemplateBraces(raw).trim()
    if (u && isImportableOnlineUrl(u)) return u
  }
  return ''
}

/**
 * First http(s) linkage on root metadata contact when POC omits online resource (common for InPort).
 * @param {Element} root
 */
function firstRootContactOnlineLinkageUrl(root) {
  for (const c of childrenNS(root, NS.gmd, 'contact')) {
    const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (href) continue
    const rp = childNS(c, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    const ci = childNS(childNS(rp, NS.gmd, 'contactInfo'), NS.gmd, 'CI_Contact')
    const or = ci ? childNS(ci, NS.gmd, 'onlineResource') : null
    const ciOn = or ? childNS(or, NS.gmd, 'CI_OnlineResource') : null
    const linkEl = ciOn ? childNS(ciOn, NS.gmd, 'linkage') : null
    const urlEl = linkEl ? childNS(linkEl, NS.gmd, 'URL') : null
    const raw = urlEl ? txt(urlEl) : ''
    const u = stripUxTemplateBraces(raw).trim()
    if (u && isImportableOnlineUrl(u)) return u
  }
  return ''
}

/**
 * Sort key for `CI_OnlineResource` rows: lower = metadata-first slot (UxS template order).
 * @param {{ url: string, name: string, proto: string, description: string }} u
 * @returns {number}
 */
function onlineResourceSlotKind(u) {
  const blob = `${u.name} ${u.description} ${u.proto} ${u.url}`.toLowerCase()
  if (
    /\b(download|thredds|opendap|granule|file\s*access|\.nc\b|ncss|subset|distribution\s*url)\b/.test(blob)
  ) {
    return 2
  }
  if (/\b(metadata\s*record|catalog(ue)?\b|landing\s*page|information\b|doi\.org\/|data\.gov)\b/.test(blob)) {
    return 0
  }
  return 1
}

/**
 * @param {Array<{ url: string, name: string, proto: string, description: string }>} urls
 * @returns {typeof urls}
 */
function sortOnlineResourcesForSlots(urls) {
  return [...urls].sort((a, b) => onlineResourceSlotKind(a) - onlineResourceSlotKind(b))
}

/**
 * When there is no `MD_DigitalTransferOptions` / distributor online URL, use root metadata `gmd:contact`
 * http(s) hyperlinks (DocuComp xlink or embedded `CI_OnlineResource`) — common on ISO 19115-3 portfolio records.
 * @param {Element} root
 * @param {string} fileId
 * @param {string} fileIdRaw
 * @param {Set<string>} seenUrls
 * @param {{ url: string, name: string, proto: string, description: string }[]} urls
 */
function collectRootMetadataContactOnlineUrlsLegacy(root, fileId, fileIdRaw, seenUrls, urls) {
  for (const c of childrenNS(root, NS.gmd, 'contact')) {
    const hrefRaw = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (hrefRaw) {
      const url = stripUxTemplateBraces(expandImportFileIdTokens(hrefRaw, fileId, fileIdRaw)).trim()
      if (url && isImportableOnlineUrl(url) && !seenUrls.has(url)) {
        seenUrls.add(url)
        urls.push({
          url,
          name: (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim(),
          proto: 'HTTPS',
          description: '',
        })
      }
      continue
    }
    const rp = childNS(c, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    const p = parseResponsibleParty(rp)
    const u = stripUxTemplateBraces(expandImportFileIdTokens(String(p.contactUrl || '').trim(), fileId, fileIdRaw)).trim()
    if (!u || !isImportableOnlineUrl(u) || seenUrls.has(u)) continue
    seenUrls.add(u)
    urls.push({
      url: u,
      name: p.organisationName || p.individualName || '',
      proto: 'HTTPS',
      description: '',
    })
  }
}

/**
 * Root `mdb:contact` online URLs for ISO 19115-3 when `distributionInfo` is absent or empty.
 * @param {Element} root
 * @param {string} fileId
 * @param {string} fileIdRaw
 * @param {Set<string>} seenUrls
 * @param {{ url: string, name: string, proto: string, description: string }[]} urls
 */
function collectRootMetadataContactOnlineUrls3(root, fileId, fileIdRaw, seenUrls, urls) {
  for (const c of cns3(root, NS3.mdb, 'contact')) {
    const hrefRaw = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
    if (hrefRaw) {
      const url = stripUxTemplateBraces(expandImportFileIdTokens(hrefRaw, fileId, fileIdRaw)).trim()
      if (url && isImportableOnlineUrl(url) && !seenUrls.has(url)) {
        seenUrls.add(url)
        urls.push({
          url,
          name: (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim(),
          proto: 'HTTPS',
          description: '',
        })
      }
      continue
    }
    const resp = cn3(c, NS3.cit, 'CI_Responsibility')
    if (!resp) continue
    const p = parseCI_Responsibility3(resp)
    const u = stripUxTemplateBraces(expandImportFileIdTokens(String(p.contactUrl || '').trim(), fileId, fileIdRaw)).trim()
    if (!u || !isImportableOnlineUrl(u) || seenUrls.has(u)) continue
    seenUrls.add(u)
    urls.push({
      url: u,
      name: p.organisationName || p.individualName || '',
      proto: 'HTTPS',
      description: '',
    })
  }
}

/**
 * @param {Element} root
 * @param {string} fileId normalized file id (may omit uxs prefix)
 * @param {string} fileIdRaw raw `gmd:fileIdentifier` text
 */
function parseDistribution(root, fileId, fileIdRaw) {
  const dist = {
    distributionFormatName: '',
    distributionFileFormat: '',
    metadataLandingUrl: '',
    metadataLandingLinkName: '',
    metadataLandingDescription: '',
    landingUrl: '',
    downloadUrl: '',
    downloadProtocol: 'HTTPS',
    downloadLinkName: '',
    downloadLinkDescription: '',
    distributionFeesText: '',
    distributionOrderingInstructions: '',
    nceiDistributorContactHref: '',
    nceiDistributorContactTitle: '',
    distributorIndividualName: '',
    distributorOrganisationName: '',
    distributorEmail: '',
    distributorContactUrl: '',
  }
  for (const dix of childrenNS(root, NS.gmd, 'distributionInfo')) {
    const mdTry = childNS(dix, NS.gmd, 'MD_Distribution')
    const fp = extractMdFormatFromDistributionGmd(mdTry)
    if (fp.name) {
      dist.distributionFormatName = fp.name
      dist.distributionFileFormat = fp.version
      break
    }
  }

  const di = childNS(root, NS.gmd, 'distributionInfo')
  const md = di ? childNS(di, NS.gmd, 'MD_Distribution') : null
  /** @type {Element | null} */
  let mdDist = null

  if (md) {
    const distBlock = childNS(md, NS.gmd, 'distributor')
    mdDist = distBlock ? childNS(distBlock, NS.gmd, 'MD_Distributor') : null

    if (mdDist) {
      const orderWrap =
        childNS(mdDist, NS.gmd, 'distributionOrderProcess') || childNS(md, NS.gmd, 'distributionOrderProcess')
      const sop = orderWrap ? childNS(orderWrap, NS.gmd, 'MD_StandardOrderProcess') : null
      if (sop) {
        dist.distributionFeesText = gcoCharacterString(childNS(sop, NS.gmd, 'fees'))
        dist.distributionOrderingInstructions = gcoCharacterString(childNS(sop, NS.gmd, 'orderingInstructions'))
      }
      let xlinkDone = false
      for (const dc of childrenNS(mdDist, NS.gmd, 'distributorContact')) {
        const href = dc.getAttributeNS(NS.xlink, 'href') || dc.getAttribute('xlink:href') || ''
        if (!href.trim()) continue
        dist.nceiDistributorContactHref = href.trim()
        dist.nceiDistributorContactTitle = (
          dc.getAttributeNS(NS.xlink, 'title') ||
          dc.getAttribute('xlink:title') ||
          'NCEI (distributor)'
        ).trim()
        xlinkDone = true
        break
      }
      if (!xlinkDone) {
        for (const dc of childrenNS(mdDist, NS.gmd, 'distributorContact')) {
          const rp = childNS(dc, NS.gmd, 'CI_ResponsibleParty')
          if (!rp) continue
          const p = parseResponsibleParty(rp)
          if (p.individualName || p.organisationName || p.email || p.contactUrl) {
            dist.distributorIndividualName = p.individualName
            dist.distributorOrganisationName = p.organisationName
            dist.distributorEmail = p.email
            dist.distributorContactUrl = p.contactUrl
            break
          }
        }
      }
    }
  }

  /** @type {{ url: string, name: string, proto: string, description: string }[]} */
  const urls = []
  const seenUrls = new Set()
  /**
   * @param {Element | null} dto
   */
  function collectOnlineFromDto(dto) {
    if (!dto) return
    for (const ol of childrenNS(dto, NS.gmd, 'onLine')) {
      const ci = childNS(ol, NS.gmd, 'CI_OnlineResource')
      if (!ci) continue
      const link = childNS(ci, NS.gmd, 'linkage')
      const rawUrl = gmdLinkageUrl(link)
      const url = stripUxTemplateBraces(expandImportFileIdTokens(rawUrl, fileId, fileIdRaw)).trim()
      if (!isImportableOnlineUrl(url)) continue
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      const name = gcoCharacterString(childNS(ci, NS.gmd, 'name'))
      const proto = gcoCharacterString(childNS(ci, NS.gmd, 'protocol'))
      const description = gcoCharacterString(childNS(ci, NS.gmd, 'description'))
      urls.push({ url, name, proto, description })
    }
  }
  if (md) {
    let dtoWrap = childNS(md, NS.gmd, 'transferOptions')
    if (dtoWrap) collectOnlineFromDto(childNS(dtoWrap, NS.gmd, 'MD_DigitalTransferOptions'))
    if (!urls.length) {
      dtoWrap = childNS(md, NS.gmd, 'distributorTransferOptions')
      if (dtoWrap) collectOnlineFromDto(childNS(dtoWrap, NS.gmd, 'MD_DigitalTransferOptions'))
    }
    if (!urls.length && mdDist) {
      for (const dtt of childrenNS(mdDist, NS.gmd, 'distributorTransferOptions')) {
        collectOnlineFromDto(childNS(dtt, NS.gmd, 'MD_DigitalTransferOptions'))
      }
    }
  }
  if (!urls.length && mdDist) {
    for (const dc of childrenNS(mdDist, NS.gmd, 'distributorContact')) {
      const rp = childNS(dc, NS.gmd, 'CI_ResponsibleParty')
      if (!rp) continue
      const p = parseResponsibleParty(rp)
      const u = String(p.contactUrl || '').trim()
      if (!u || !isImportableOnlineUrl(u) || seenUrls.has(u)) continue
      seenUrls.add(u)
      urls.push({
        url: u,
        name: p.organisationName || p.individualName || '',
        proto: 'HTTPS',
        description: '',
      })
    }
  }
  if (!urls.length) {
    collectRootMetadataContactOnlineUrlsLegacy(root, fileId, fileIdRaw, seenUrls, urls)
  }
  if (!urls.length) return dist

  const sorted = sortOnlineResourcesForSlots(urls)
  if (sorted.length === 1) {
    const u = sorted[0]
    if (onlineResourceSlotKind(u) === 2) {
      dist.downloadUrl = u.url
      dist.downloadProtocol = u.proto || 'HTTPS'
      dist.downloadLinkName = u.name
      dist.downloadLinkDescription = u.description
    } else {
      dist.landingUrl = u.url
      dist.downloadProtocol = u.proto || 'HTTPS'
    }
  } else if (sorted.length === 2) {
    const u0 = sorted[0]
    const u1 = sorted[1]
    dist.metadataLandingUrl = u0.url
    dist.metadataLandingLinkName = u0.name
    dist.metadataLandingDescription = u0.description
    dist.landingUrl = u0.url
    if (onlineResourceSlotKind(u1) === 2) {
      dist.downloadUrl = u1.url
      dist.downloadProtocol = u1.proto || 'HTTPS'
      dist.downloadLinkName = u1.name
      dist.downloadLinkDescription = u1.description
    } else {
      dist.landingUrl = u1.url
      dist.downloadProtocol = u1.proto || 'HTTPS'
    }
  } else {
    dist.metadataLandingUrl = sorted[0].url
    dist.metadataLandingLinkName = sorted[0].name
    dist.metadataLandingDescription = sorted[0].description
    dist.landingUrl = sorted[1].url
    dist.downloadUrl = sorted[2].url
    dist.downloadProtocol = sorted[2].proto || 'HTTPS'
    dist.downloadLinkName = sorted[2].name
    dist.downloadLinkDescription = sorted[2].description
  }
  return dist
}

/**
 * Distribution block from ISO 19115-3 (`mdb:distributionInfo` / `mrd:MD_Distribution`).
 * Mirrors {@link parseDistribution} using cit/mrd/mcc paths and {@link citLinkageUrl}.
 */
function parseDistribution3(root, fileId, fileIdRaw) {
  const dist = {
    distributionFormatName: '',
    distributionFileFormat: '',
    metadataLandingUrl: '',
    metadataLandingLinkName: '',
    metadataLandingDescription: '',
    landingUrl: '',
    downloadUrl: '',
    downloadProtocol: 'HTTPS',
    downloadLinkName: '',
    downloadLinkDescription: '',
    distributionFeesText: '',
    distributionOrderingInstructions: '',
    nceiDistributorContactHref: '',
    nceiDistributorContactTitle: '',
    distributorIndividualName: '',
    distributorOrganisationName: '',
    distributorEmail: '',
    distributorContactUrl: '',
  }
  for (const dix of cns3(root, NS3.mdb, 'distributionInfo')) {
    const mdTry = cn3(dix, NS3.mrd, 'MD_Distribution')
    const fp = extractMdFormatFromDistribution3(mdTry)
    if (fp.name) {
      dist.distributionFormatName = fp.name
      dist.distributionFileFormat = fp.version
      break
    }
  }

  const di = cn3(root, NS3.mdb, 'distributionInfo')
  const md = di ? cn3(di, NS3.mrd, 'MD_Distribution') : null
  /** @type {Element | null} */
  let mdDist = null

  if (md) {
    const distBlock = cn3(md, NS3.mrd, 'distributor')
    mdDist = distBlock ? cn3(distBlock, NS3.mrd, 'MD_Distributor') : null

    if (mdDist) {
      const orderWrap =
        cn3(mdDist, NS3.mrd, 'distributionOrderProcess') || cn3(md, NS3.mrd, 'distributionOrderProcess')
      const sop = orderWrap
        ? cn3(orderWrap, NS3.mcc, 'MD_StandardOrderProcess') ||
          cn3(orderWrap, NS3.mrd, 'MD_StandardOrderProcess')
        : null
      if (sop) {
        dist.distributionFeesText = gcs3(cn3(sop, NS3.mcc, 'fees'))
        dist.distributionOrderingInstructions = gcs3(cn3(sop, NS3.mcc, 'orderingInstructions'))
      }
      let xlinkDone = false
      for (const dc of cns3(mdDist, NS3.mrd, 'distributorContact')) {
        const href = dc.getAttributeNS(NS.xlink, 'href') || dc.getAttribute('xlink:href') || ''
        if (!href.trim()) continue
        dist.nceiDistributorContactHref = href.trim()
        dist.nceiDistributorContactTitle = (
          dc.getAttributeNS(NS.xlink, 'title') ||
          dc.getAttribute('xlink:title') ||
          'NCEI (distributor)'
        ).trim()
        xlinkDone = true
        break
      }
      if (!xlinkDone) {
        for (const dc of cns3(mdDist, NS3.mrd, 'distributorContact')) {
          const resp = cn3(dc, NS3.cit, 'CI_Responsibility')
          if (!resp) continue
          const p = parseCI_Responsibility3(resp)
          if (p.individualName || p.organisationName || p.email || p.contactUrl) {
            dist.distributorIndividualName = p.individualName
            dist.distributorOrganisationName = p.organisationName
            dist.distributorEmail = p.email
            dist.distributorContactUrl = p.contactUrl
            break
          }
        }
      }
    }
  }

  /** @type {{ url: string, name: string, proto: string, description: string }[]} */
  const urls = []
  const seenUrls = new Set()
  /**
   * @param {Element | null} dto
   */
  function collectOnlineFromDto3(dto) {
    if (!dto) return
    for (const ol of cns3(dto, NS3.mrd, 'onLine')) {
      const ci = cn3(ol, NS3.cit, 'CI_OnlineResource')
      if (!ci) continue
      const link = cn3(ci, NS3.cit, 'linkage')
      const rawUrl = citLinkageUrl(link)
      const url = stripUxTemplateBraces(expandImportFileIdTokens(rawUrl, fileId, fileIdRaw)).trim()
      if (!isImportableOnlineUrl(url)) continue
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      const name = gcs3(cn3(ci, NS3.cit, 'name'))
      const proto = gcs3(cn3(ci, NS3.cit, 'protocol'))
      const description = gcs3(cn3(ci, NS3.cit, 'description'))
      urls.push({ url, name, proto, description })
    }
  }
  if (md) {
    let dtoWrap = cn3(md, NS3.mrd, 'transferOptions')
    if (dtoWrap) collectOnlineFromDto3(cn3(dtoWrap, NS3.mrd, 'MD_DigitalTransferOptions'))
    if (!urls.length) {
      dtoWrap = cn3(md, NS3.mrd, 'distributorTransferOptions')
      if (dtoWrap) collectOnlineFromDto3(cn3(dtoWrap, NS3.mrd, 'MD_DigitalTransferOptions'))
    }
    if (!urls.length && mdDist) {
      for (const dtt of cns3(mdDist, NS3.mrd, 'distributorTransferOptions')) {
        collectOnlineFromDto3(cn3(dtt, NS3.mrd, 'MD_DigitalTransferOptions'))
      }
    }
  }
  if (!urls.length && mdDist) {
    for (const dc of cns3(mdDist, NS3.mrd, 'distributorContact')) {
      const resp = cn3(dc, NS3.cit, 'CI_Responsibility')
      if (!resp) continue
      const p = parseCI_Responsibility3(resp)
      const u = String(p.contactUrl || '').trim()
      if (!u || !isImportableOnlineUrl(u) || seenUrls.has(u)) continue
      seenUrls.add(u)
      urls.push({
        url: u,
        name: p.organisationName || p.individualName || '',
        proto: 'HTTPS',
        description: '',
      })
    }
  }
  if (!urls.length) {
    collectRootMetadataContactOnlineUrls3(root, fileId, fileIdRaw, seenUrls, urls)
  }
  if (!urls.length) return dist

  const sorted = sortOnlineResourcesForSlots(urls)
  if (sorted.length === 1) {
    const u = sorted[0]
    if (onlineResourceSlotKind(u) === 2) {
      dist.downloadUrl = u.url
      dist.downloadProtocol = u.proto || 'HTTPS'
      dist.downloadLinkName = u.name
      dist.downloadLinkDescription = u.description
    } else {
      dist.landingUrl = u.url
      dist.downloadProtocol = u.proto || 'HTTPS'
    }
  } else if (sorted.length === 2) {
    const u0 = sorted[0]
    const u1 = sorted[1]
    dist.metadataLandingUrl = u0.url
    dist.metadataLandingLinkName = u0.name
    dist.metadataLandingDescription = u0.description
    dist.landingUrl = u0.url
    if (onlineResourceSlotKind(u1) === 2) {
      dist.downloadUrl = u1.url
      dist.downloadProtocol = u1.proto || 'HTTPS'
      dist.downloadLinkName = u1.name
      dist.downloadLinkDescription = u1.description
    } else {
      dist.landingUrl = u1.url
      dist.downloadProtocol = u1.proto || 'HTTPS'
    }
  } else {
    dist.metadataLandingUrl = sorted[0].url
    dist.metadataLandingLinkName = sorted[0].name
    dist.metadataLandingDescription = sorted[0].description
    dist.landingUrl = sorted[1].url
    dist.downloadUrl = sorted[2].url
    dist.downloadProtocol = sorted[2].proto || 'HTTPS'
    dist.downloadLinkName = sorted[2].name
    dist.downloadLinkDescription = sorted[2].description
  }
  return dist
}

/**
 * @param {Element | null} rp `gmd:CI_ResponsibleParty`
 * @returns {{ individualName: string, organisationName: string, email: string, contactPhone: string, contactUrl: string, contactAddress: string }}
 */
function parseResponsibleParty(rp) {
  const out = {
    individualName: '',
    organisationName: '',
    email: '',
    contactPhone: '',
    contactUrl: '',
    contactAddress: '',
  }
  if (!rp) return out
  out.individualName = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'individualName'))
  out.organisationName = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'organisationName'))
  const contact = childNS(childNS(rp, NS.gmd, 'contactInfo'), NS.gmd, 'CI_Contact')
  if (!contact) return out
  const addr = childNS(childNS(contact, NS.gmd, 'address'), NS.gmd, 'CI_Address')
  if (addr) {
    out.email = gcoCharacterString(childNS(addr, NS.gmd, 'electronicMailAddress'))
    out.contactAddress = gcoCharacterString(childNS(addr, NS.gmd, 'deliveryPoint'))
  }
  const phone = childNS(childNS(contact, NS.gmd, 'phone'), NS.gmd, 'CI_Telephone')
  if (phone) out.contactPhone = gcoCharacterString(childNS(phone, NS.gmd, 'voice'))
  const on = childNS(childNS(contact, NS.gmd, 'onlineResource'), NS.gmd, 'CI_OnlineResource')
  if (on) {
    const link = childNS(on, NS.gmd, 'linkage')
    out.contactUrl = gmdLinkageUrl(link)
  }
  const positionName = gmdAnchorOrCharacterString(childNS(rp, NS.gmd, 'positionName'))
  if (!String(out.individualName || '').trim()) {
    if (String(positionName || '').trim()) out.individualName = positionName.trim()
    else if (String(out.organisationName || '').trim()) out.individualName = out.organisationName.trim()
  }
  return out
}

/**
 * Walk `CI_ResponsibleParty` for a `gmx:Anchor` ROR href.
 * @param {Element | null | undefined} rp
 */
function parseRorFromResponsibleParty(rp) {
  if (!rp) return null
  const stack = [rp]
  for (let i = 0; i < stack.length; i += 1) {
    const el = stack[i]
    for (const c of el.children) {
      if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) {
        const href = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
        const m = href.match(/https?:\/\/ror\.org\/([a-z0-9]{9})/i)
        if (m) {
          const id = `https://ror.org/${m[1].toLowerCase()}`
          return { id, label: stripUxTemplateBraces(txt(c)).trim() || id }
        }
      }
      stack.push(c)
    }
  }
  return null
}

/**
 * @param {Element | null} dataId
 * @returns {{ individualName: string, organisationName: string, email: string, contactPhone: string, contactUrl: string, contactAddress: string, ror?: { id: string, label: string } | null }}
 */
function parsePointOfContact(dataId) {
  const empty = {
    individualName: '',
    organisationName: '',
    email: '',
    contactPhone: '',
    contactUrl: '',
    contactAddress: '',
  }
  if (!dataId) return empty
  /** Prefer a party with `individualName` when multiple `pointOfContact` blocks exist (NCEI org-first + scientist POC). */
  const candidates = []
  for (const poc of childrenNS(dataId, NS.gmd, 'pointOfContact')) {
    const party = childNS(poc, NS.gmd, 'CI_ResponsibleParty')
    if (party) {
      const parsed = parseResponsibleParty(party)
      const ror = parseRorFromResponsibleParty(party)
      candidates.push(ror ? { ...parsed, ror } : { ...parsed })
    } else {
      const xlinkParty = syntheticPartyFromGmdPocXlink(poc)
      if (xlinkParty) candidates.push(xlinkParty)
    }
  }
  if (!candidates.length) return empty
  const withEmail = candidates.find((c) => String(c.email || '').trim())
  const withInd = candidates.find((c) => String(c.individualName || '').trim())
  const chosen = withEmail || withInd || candidates[0]
  const rorMerge = chosen.ror || candidates.map((c) => c.ror).find(Boolean)
  if (rorMerge && !chosen.ror) return { ...chosen, ror: rorMerge }
  return chosen
}

/**
 * @param {Element} oc
 * @returns {boolean}
 */
function otherConstraintsHasAnchor(oc) {
  if (!oc) return false
  for (const c of oc.children) {
    if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) return true
  }
  return false
}

/**
 * Infer GCMD-style platform type from keywords + mission text when acquisition omits `platformType`.
 * @param {Record<string, unknown>} partial
 */
function inferPlatformTypeFromKeywordsAndMissionText(partial) {
  if (!partial || typeof partial !== 'object') return
  let plat =
    partial.platform && typeof partial.platform === 'object'
      ? /** @type {Record<string, unknown>} */ ({ ...partial.platform })
      : {}
  if (String(plat.platformType || '').trim()) {
    partial.platform = plat
    return
  }

  const chunks = []
  const m = partial.mission && typeof partial.mission === 'object' ? partial.mission : {}
  chunks.push(String(m.title || ''), String(m.abstract || ''))
  const kw = partial.keywords && typeof partial.keywords === 'object' ? partial.keywords : {}
  const platKw = Array.isArray(kw.platforms) ? kw.platforms : []
  for (const row of platKw) {
    if (row && typeof row === 'object') chunks.push(String(/** @type {{ label?: string }} */ (row).label || ''))
  }
  const hay = chunks.join('\n')
  const h = hay.toLowerCase()

  let pt = ''
  if (/satellite|landsat|sentinel|modis|orbiting|spacecraft/i.test(h)) {
    pt = 'Satellites'
  } else if (
    /submarine|\bauv\b|\buuv\b|autonomous underwater|remus|glider|underwater vehicle|\brov\b|remotely operated|submersible|hydroid|deep discoverer|ocean-based/i.test(
      h,
    )
  ) {
    pt = 'In Situ Ocean-based Platforms'
  } else if (/aircraft|airplane|helicopter|\buav\b|\buas\b|drone/i.test(h)) {
    pt = 'Aircraft'
  } else if (/research vessel|okeanos|research ship|\bcruise\b|\bship\b|noaa ship|research\s+vessel/i.test(h)) {
    pt = 'Ships'
  } else if (/mooring|buoys?\b/i.test(h)) {
    pt = 'Buoys'
  } else if (/fixed observ|weather station|station\b/i.test(h)) {
    pt = 'In Situ Land-based Platforms'
  } else if (/socioeconomic|socio-economic|household survey|coastal resource|jurisdictional|human dimensions/i.test(h)) {
    pt = 'Earth Science Services'
  }

  if (!pt && hay.trim()) {
    pt = 'Multiple'
  }

  if (pt) plat.platformType = pt
  if (Object.keys(plat).length) partial.platform = plat
}

/**
 * @param {Array<{ label: string, uuid: string }>} arr
 * @param {{ label: string, uuid?: string }} row
 */
function pushKeywordChipIfNew(arr, row) {
  const lab = String(row.label || '').trim()
  if (!lab) return
  const low = lab.toLowerCase()
  if (arr.some((x) => String(x.label || '').trim().toLowerCase() === low)) return
  arr.push({ label: lab, uuid: String(row.uuid || '').trim() })
}

/**
 * Map ISO topic category codes to a short GCMD-style science keyword label (label-only chip).
 * @param {string} tc
 */
function topicCategoryToScienceKeywordLabel(tc) {
  const t = String(tc || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (!t) return ''
  const map = {
    oceans: 'Oceans',
    atmosphere: 'Atmosphere',
    biota: 'Biota',
    boundaries: 'Boundaries',
    climatology: 'Climatology',
    economy: 'Economy',
    elevation: 'Elevation',
    environment: 'Environment',
    farming: 'Farming',
    geoscientificinformation: 'Geoscientific Information',
    health: 'Health',
    imagery: 'Imagery',
    location: 'Location',
    military: 'Military',
    planning: 'Planning',
    society: 'Society',
    structure: 'Structure',
    transportation: 'Transportation',
    utilities: 'Utilities',
  }
  if (map[t]) return map[t]
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * GCMD KMS **locations** scheme concept UUIDs (keywordVersion 23.8 `prefLabel` alignment)
 * for short labels emitted by {@link inferKeywordFacetsFromAcquisition}.
 * @see https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/locations
 */
const GCMD_LOCATION_INFER_UUID_BY_LABEL = Object.freeze({
  'Gulf of Mexico': '5c33b8a6-e2f2-6e0f-bc9f-2b7a2e7a7f23',
  'Gulf of Alaska': '9972bea3-3817-44e8-9c14-bcda7750d820',
  'Pacific Ocean': 'a19e4450-64c4-4687-9080-cebded8a90eb',
  'North Pacific Ocean': '922a749a-d663-495f-bd26-31e6cfb89c57',
  'Atlantic Ocean': 'cf249a36-2e82-4d32-84cd-23a4f40bb393',
  'North Atlantic Ocean': 'a4202721-0cba-4fa1-853f-890f146b04f9',
  'Caribbean Sea': 'eb176e48-13e2-413c-85d6-b37e16303573',
  'Bering Sea': 'd85ae1ed-4b5f-440d-aaf0-7f9d605fec3b',
  'Arctic Ocean': '1ed45273-3e2b-4586-b852-05578c04041b',
  Guam: 'da0e4453-5f69-4656-a7f1-a68da6640dc8',
  Hawaii: '017ac312-b650-4800-992f-5167708b4d31',
  /** KMS locations `AMERICAN SAMOA` (keywordVersion 23.8). */
  'American Samoa': 'd4db292f-3097-4843-a6c5-291cf993bea9',
  'AMERICAN SAMOA': 'd4db292f-3097-4843-a6c5-291cf993bea9',
  /** NCEI distribution phrase → KMS `GLOBAL` (worldwide holdings). */
  'World-Wide Distribution': '51e3593f-4b42-4141-972e-96666c479f9c',
  /** Broad marine fallback when bbox centroid does not match a named basin. */
  Ocean: 'ff03e9fc-9882-4a5e-ad0b-830d8f1186cb',
})

/** @param {string} label */
function gcmdLocationUuidForInferredLabel(label) {
  const k = String(label || '').trim()
  if (!k) return ''
  if (GCMD_LOCATION_INFER_UUID_BY_LABEL[k]) return GCMD_LOCATION_INFER_UUID_BY_LABEL[k]
  const low = k.toLowerCase()
  const hit = Object.keys(GCMD_LOCATION_INFER_UUID_BY_LABEL).find((x) => x.toLowerCase() === low)
  if (hit) return GCMD_LOCATION_INFER_UUID_BY_LABEL[hit]
  if (/\bamerican samoa\b/i.test(low)) return 'd4db292f-3097-4843-a6c5-291cf993bea9'
  if (/world[-\s]?wide\s+distribution|worldwide\s+distribution/i.test(low)) {
    return '51e3593f-4b42-4141-972e-96666c479f9c'
  }
  return ''
}

/**
 * Normalize imported keyword labels for UUID hydration (HTML entities, whitespace).
 * @param {string} raw
 */
function normalizeKeywordHydrateLabel(raw) {
  return String(raw || '')
    .replace(/\s*&gt;\s*/gi, ' > ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** GCMD KMS concept UUIDs for common **sciencekeywords** labels (fixtures + scheme hits). */
const GCMD_SCIENCE_KEYWORD_HYDRATE_UUID = Object.freeze({
  Oceans: '2ef69df0-bf69-4d5e-b7ff-0cece46ed206',
  OCEANS: '2ef69df0-bf69-4d5e-b7ff-0cece46ed206',
  'Bathymetry/Seafloor Topography': '91697b7d-8f2b-4954-850e-61d5f61c867d',
  /** KMS sciencekeywords (prefLabel scans, 2026-05). */
  'AGRICULTURAL AQUATIC SCIENCES': 'ca227ff0-4742-4e51-a763-4582fa28291c',
  'Agricultural Aquatic Sciences': 'ca227ff0-4742-4e51-a763-4582fa28291c',
  'AQUATIC ECOSYSTEMS': 'c6455081-132d-4661-bb5f-22edf2f90800',
  'Aquatic Ecosystems': 'c6455081-132d-4661-bb5f-22edf2f90800',
  'AQUATIC SCIENCES': 'f27ad52c-3dfd-4788-851a-427e60ae1b8f',
  'Aquatic Sciences': 'f27ad52c-3dfd-4788-851a-427e60ae1b8f',
  'MARINE ENVIRONMENT MONITORING': 'ca154e02-a226-4cc7-8e4a-4474e7eb1eeb',
  'Marine Environment Monitoring': 'ca154e02-a226-4cc7-8e4a-4474e7eb1eeb',
  /** KMS sciencekeywords (GHRSST / NODC-style chips). */
  'SEA SURFACE TEMPERATURE': 'bd24a9a9-7d52-4c29-b2a0-6cefd216ae78',
  'Sea Surface Temperature': 'bd24a9a9-7d52-4c29-b2a0-6cefd216ae78',
  'WIND SPEED': '661591b3-6685-4de7-a2a4-9ce8ae505044',
  'Wind Speed': '661591b3-6685-4de7-a2a4-9ce8ae505044',
})

/** @param {string} label */
function hydrateScienceKeywordUuid(label) {
  const norm = normalizeKeywordHydrateLabel(label)
  if (!norm) return ''
  const low = norm.toLowerCase()
  if (GCMD_SCIENCE_KEYWORD_HYDRATE_UUID[norm]) return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID[norm]
  if (/\bbathymetry\b|\bseafloor\b|\bhypsometry\b|\bseafloor\s+topography\b/i.test(low)) {
    return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID['Bathymetry/Seafloor Topography']
  }
  if (/\bearth\s+science\b/.test(low) && /\boceans\b/.test(low)) {
    return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID.Oceans
  }
  // Aquatic / monitoring (KMS sciencekeywords); agricultural before generic "aquatic sciences".
  if (/\bagricultural\s+aquatic/i.test(low)) return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID['AGRICULTURAL AQUATIC SCIENCES']
  if (/\baquatic\s+ecosystems\b/i.test(low)) return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID['AQUATIC ECOSYSTEMS']
  if (/\bmarine\s+environment\s+monitoring\b/i.test(low)) {
    return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID['MARINE ENVIRONMENT MONITORING']
  }
  if (/\baquatic\s+sciences\b/i.test(low)) return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID['AQUATIC SCIENCES']
  if (/\bsea surface temperature\b/i.test(low) && !/\banomal|indices\b/i.test(low)) {
    return 'bd24a9a9-7d52-4c29-b2a0-6cefd216ae78'
  }
  if (/\bwind speed\b/i.test(low) && !/tendency/i.test(low)) {
    return '661591b3-6685-4de7-a2a4-9ce8ae505044'
  }
  if (/\boceanography\b/i.test(low)) return GCMD_SCIENCE_KEYWORD_HYDRATE_UUID.Oceans
  return ''
}

/** @param {string} label */
function hydrateDatacenterUuid(label) {
  const t = normalizeKeywordHydrateLabel(label)
  if (!t) return ''
  if (/^DOC\/NOAA\/NESDIS\/NCEI$/i.test(t)) return '2f31b1f2-335f-4248-8165-215755953857'
  if (/DOC\/NOAA\/NESDIS\/NCEI\s*>/i.test(t) && /national\s+centers\s+for\s+environmental\s+information/i.test(t)) {
    return 'e59896e0-3b4d-43ea-9348-f1f456305d05'
  }
  if (/national\s+centers\s+for\s+environmental\s+information/i.test(t) && /\bncei\b/i.test(t)) {
    return 'e59896e0-3b4d-43ea-9348-f1f456305d05'
  }
  /** KMS-aligned org id (providers scheme) when datacenter chips repeat NMFS/PIFSC hierarchy text. */
  if (/\/NMFS\/PIFSC|DOC\/NOAA\/NMFS\/PIFSC|Pacific Islands Fisheries Science Center/i.test(t)) {
    return '65dbf947-199e-468d-9e2e-75defde139f2'
  }
  /** KMS providers `DOC/NOAA/NESDIS/OSPO` (e.g. NCEI accession 0299833 `gmx:Anchor`). */
  if (/\/NESDIS\/OSPO|Office of Satellite and Product Operations|\bOSPO\b/i.test(t)) {
    return 'd7cfdf0b-59cf-4668-aebb-f71233023f74'
  }
  if (/US DOC;\s*NOAA;\s*NESDIS.*Office of Satellite|Office of Satellite and Product Operations/i.test(t)) {
    return 'd7cfdf0b-59cf-4668-aebb-f71233023f74'
  }
  return ''
}

/** @param {string} label */
function hydrateProviderUuid(label) {
  const t = normalizeKeywordHydrateLabel(label)
  if (!t) return ''
  if (/^noaa$/i.test(t)) return '7e55d0c8-a4b4-8a2b-dfc0-4d9c4a0c9b45'
  if (/^usm$/i.test(t) || /\buniversity of southern mississippi\b|\busm\b/i.test(t)) return '7e55d0c8-a4b4-8a2b-dfc0-4d9c4a0c9b45'
  if (/^DOC\/NOAA\/NESDIS\/NCEI$/i.test(t)) return '2f31b1f2-335f-4248-8165-215755953857'
  if (/^DOC\/NOAA\/OAR\/PMEL\b/i.test(t)) return '8b9573fe-8097-41b7-9c0a-38627e8d7810'
  if (/^DOC\/NOAA\/OAR\/OER\b/i.test(t) || /^DOC\/NOAA\/OAR\/OER\s/i.test(t)) return 'd8a28a58-9af1-4904-8d4e-3dfde493b2c4'
  if (/NOAA\/OAR\/OER|ocean exploration and research/i.test(t)) return 'd8a28a58-9af1-4904-8d4e-3dfde493b2c4'
  if (/national centers for environmental information/i.test(t) && /\bncei\b/i.test(t)) {
    return 'e59896e0-3b4d-43ea-9348-f1f456305d05'
  }
  if (/\bunited states navy\b|\bu\.s\.\s*navy\b|\bus navy\b/i.test(t)) return '86b91e8f-c74b-499a-b9dc-6fd0f48fdde2'
  if (/\bnavoceano\b|naval oceanographic office|fleet numerical meteorology/i.test(t)) return '86b91e8f-c74b-499a-b9dc-6fd0f48fdde2'
  if (/\/NMFS\/PIFSC|DOC\/NOAA\/NMFS\/PIFSC|Pacific Islands Fisheries Science Center/i.test(t)) {
    return '65dbf947-199e-468d-9e2e-75defde139f2'
  }
  if (/\/NESDIS\/OSPO|Office of Satellite and Product Operations|\bOSPO\b/i.test(t)) {
    return 'd7cfdf0b-59cf-4668-aebb-f71233023f74'
  }
  if (/US DOC;\s*NOAA;\s*NESDIS.*Office of Satellite|Office of Satellite and Product Operations/i.test(t)) {
    return 'd7cfdf0b-59cf-4668-aebb-f71233023f74'
  }
  return ''
}

/** @param {string} label */
function hydratePlatformUuid(label) {
  const t = normalizeKeywordHydrateLabel(label)
  if (!t) return ''
  const low = t.toLowerCase()
  /** KMS platforms METOP-* / Meteorological Operational Satellite (METOP). */
  if (/metop-c|meteorological operational satellite-?c\b/i.test(low)) return '6120cea0-c943-4c7c-bddd-8d8648d58022'
  if (/metop-b|meteorological operational satellite-?b\b/i.test(low)) return 'c9f84df0-e807-46e3-8fce-c33e9201fbc2'
  if (/metop-a|meteorological operational satellite-?a\b/i.test(low)) return '8143808e-1005-4fed-a469-c2bd5f1521bf'
  if (/\bmetop\b|meteorological operational satellite/i.test(low)) return '8c192c86-d07c-4e7b-af8f-92aa4b40fca7'
  if (t === 'UAV' || low === 'uav') return '3a1196e4-c0d0-4c8d-9a7d-0f5e0c5e5d01'
  if (t === 'Autonomous Underwater Vehicle' || /autonomous underwater|remus|\bauv\b|\buuv\b/i.test(t)) {
    return '1ea3829f-9479-46f5-a075-315da09867ae'
  }
  if (t === 'Research Ship' || /research vessel|noaa ship|\bokeanos\b|cruise|expedition/i.test(t)) {
    return '1bb21d0f-bf48-42b5-8e09-cc0d58407e4a'
  }
  if (t === 'Aircraft' || /aircraft|airplane|\buas\b/i.test(t)) return '2fe09793-1571-4a43-8b42-8fd4dedf6d0c'
  if (t === 'Mooring' || /mooring|buoy/i.test(t)) return '99c4602d-1de6-4f4b-88e2-3bd13bd9a385'
  if (/okeanos explorer/i.test(t)) return '4838472f-2b4c-4107-bd9e-3bf78a7c5562'
  return ''
}

/** @param {string} label */
function hydrateInstrumentUuid(label) {
  const t = normalizeKeywordHydrateLabel(label)
  if (!t) return ''
  const low = t.toLowerCase()
  const map = {
    'Multibeam Swath Bathymetry System': '4b22a7f5-d1e1-5d9e-ab8e-1a6f1d6f6e12',
    CTD: '01cc0beb-7c9a-40ed-ad86-0661b41aee53',
    'Acoustic Doppler Current Profiler': 'ca8de50f-b795-42b7-9301-8baffe2de0f3',
    ADCP: 'ca8de50f-b795-42b7-9301-8baffe2de0f3',
    'Passive Acoustic Recorder': '8adf0af6-f62f-4559-a17b-d9d7cb1bba14',
  }
  if (map[t]) return map[t]
  /** KMS instruments AVHRR / AVHRR-2 / AVHRR-3. */
  if (/\bavhrr-3\b/i.test(low)) return '87c44e15-54c8-407d-a881-8035a2d5512b'
  if (/\bavhrr-2\b/i.test(low)) return '600b228b-165c-4f80-96e2-7ee2d9989680'
  if (/\bavhrr\b/i.test(low)) return 'e64e83bd-02b3-4a47-830d-00e1aa4b04d3'
  if (/\bparoscientific\b|\bdigiquartz\b|quartz.*pressure|pressure sensor\b/i.test(low)) {
    return 'fd1ac194-aa45-44b4-b155-8ef37c977736'
  }
  if (/\bctd\b|conductivity\s*,\s*temperature\s*,\s*depth|conductivity.*temperature.*depth/i.test(low)) return map.CTD
  if (/multibeam|bathymetry|sbes|mbes|echosounder|synthetic aperture|side.?scan|\bkraken\b|\bsas\b/i.test(low)) {
    return map['Multibeam Swath Bathymetry System']
  }
  if (/\badcp\b|acoustic doppler current|teledyne.*doppler|rd instruments.*adcp|doppler velocity|dvl\b/i.test(low)) {
    return map.ADCP
  }
  if (/passive acoustic|hydrophone|\bharp\b/i.test(low)) return map['Passive Acoustic Recorder']
  return ''
}

/** @param {string} label */
function hydrateProjectUuid(label) {
  const t = normalizeKeywordHydrateLabel(label)
  if (!t) return ''
  if (/^mdbc$/i.test(t) || (/\bmdbc\b/i.test(t) && t.length < 120)) return '6d44c9b7-f3a3-7f1a-cdaf-3c8b3f8b8a34'
  /** KMS projects `GHRSST` (long form appears on NODC accessions). */
  if (/\bghrsst\b|group for high resolution sea surface temperature/i.test(t)) {
    return 'e44e6bb9-dcf6-4c22-a524-05b6c3437d35'
  }
  /** KMS projects `MDBC` concept (Mesophotic / Deep Benthic Communities program titles). */
  if (/\bnoaa\b/i.test(t) && /\bmesophotic\b/i.test(t) && /\b(benthic|restoration|communities)\b/i.test(t)) {
    return 'bd779e0a-c8d2-4ee0-a438-7d724485060b'
  }
  if (/\bocean\s+exploration\b|\/oer\b|seascape\b|okeanos\b|ex\d{4}|\bremus\b|kraken|en\d{4}|\biso3\b|en2501|remus620|\bsynthetic aperture sonar\b/i.test(t)) {
    return 'd8a28a58-9af1-4904-8d4e-3dfde493b2c4'
  }
  if (
    /^(expedition|exploration|explorer|marine education|noaa|ocean|ocean discovery|ocean education|ocean exploration|ocean exploration and research|oer)$/i.test(
      t,
    )
  ) {
    return 'd8a28a58-9af1-4904-8d4e-3dfde493b2c4'
  }
  return ''
}

/** UxS ISO3 / EN2501 cruise ids use underscores; `\b` does not treat `_` as a delimiter. */
function fileIdHasIso3RemusKrakenHydrateSignal(fidRaw) {
  const f = String(fidRaw || '').trim()
  if (!f) return false
  if (/^iso3_en/i.test(f) && /remus/i.test(f)) return true
  const remus620 = /(?:^|[^A-Za-z0-9])REMUS620(?:[^A-Za-z0-9]|$)/i.test(f)
  const kraken = /(?:^|[^A-Za-z0-9])KRAKEN(?:[^A-Za-z0-9]|$)/i.test(f)
  return remus620 && kraken
}

/**
 * Fill empty GCMD chip UUIDs from known label → concept maps (lenient KMS href warnings).
 * @param {Record<string, unknown>} partial
 */
function hydrateGcmdKeywordChipUuidsFromKnownLabels(partial) {
  if (!partial.keywords || typeof partial.keywords !== 'object') return
  const kw = /** @type {Record<string, unknown>} */ (partial.keywords)
  const facets = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']
  for (const facet of facets) {
    const arr = kw[facet]
    if (!Array.isArray(arr)) continue
    for (let i = 0; i < arr.length; i += 1) {
      const row = arr[i]
      if (!row || typeof row !== 'object') continue
      const label = String(/** @type {{ label?: string }} */ (row).label || '').trim()
      const uuid = String(/** @type {{ uuid?: string }} */ (row).uuid || '').trim()
      if (!label || uuid) continue
      let next = ''
      if (facet === 'sciencekeywords') next = hydrateScienceKeywordUuid(label)
      else if (facet === 'datacenters') next = hydrateDatacenterUuid(label)
      else if (facet === 'platforms') next = hydratePlatformUuid(label)
      else if (facet === 'instruments') next = hydrateInstrumentUuid(label)
      else if (facet === 'locations') next = gcmdLocationUuidForInferredLabel(label)
      else if (facet === 'projects') next = hydrateProjectUuid(label)
      else if (facet === 'providers') next = hydrateProviderUuid(label)
      if (next && /^[0-9a-f-]{36}$/i.test(next)) {
        /** @type {{ uuid?: string }} */ (row).uuid = next.toLowerCase()
      }
    }
  }

  const mission =
    partial.mission && typeof partial.mission === 'object'
      ? /** @type {Record<string, unknown>} */ (partial.mission)
      : {}
  const projArr = /** @type {Array<{ label?: string, uuid?: string }> | undefined} */ (kw.projects)
  if (Array.isArray(projArr) && projArr[0] && !String(projArr[0].uuid || '').trim()) {
    const fid = String(mission.fileId || '').trim()
    const fromFid = fid ? hydrateProjectUuid(fid) : ''
    const fromPpt = String(mission.parentProjectTitle || '').trim()
    const fromPptU = fromPpt ? hydrateProjectUuid(fromPpt) : ''
    const pick = fromFid || fromPptU
    if (pick && /^[0-9a-f-]{36}$/i.test(pick)) projArr[0].uuid = pick.toLowerCase()
  }
  const provArr = /** @type {Array<{ label?: string, uuid?: string }> | undefined} */ (kw.providers)
  if (Array.isArray(provArr) && provArr[0] && !String(provArr[0].uuid || '').trim()) {
    const org = String(mission.org || '').trim()
    const pub = String(mission.citationPublisherOrganisationName || '').trim()
    const lab0 = String(provArr[0].label || '').trim()
    const pick =
      (org && hydrateProviderUuid(org)) ||
      (pub && hydrateProviderUuid(pub)) ||
      (lab0 && hydrateProviderUuid(lab0)) ||
      ''
    if (pick && /^[0-9a-f-]{36}$/i.test(pick)) provArr[0].uuid = pick.toLowerCase()
    else if (fileIdHasIso3RemusKrakenHydrateSignal(mission.fileId)) {
      provArr[0].uuid = 'd8a28a58-9af1-4904-8d4e-3dfde493b2c4'
    }
  }
  const insArr = /** @type {Array<{ label?: string, uuid?: string }> | undefined} */ (kw.instruments)
  const sensors = Array.isArray(partial.sensors) ? partial.sensors : []
  const s0 = sensors[0] && typeof sensors[0] === 'object' ? /** @type {Record<string, unknown>} */ (sensors[0]) : null
  if (Array.isArray(insArr) && insArr[0] && !String(insArr[0].uuid || '').trim()) {
    const r0 = insArr[0]
    const lab0 = String(r0.label || '').trim()
    let fromSens = ''
    if (s0) fromSens = hydrateInstrumentUuid(String(s0.type || s0.variable || s0.modelId || '').trim())
    if (!fromSens && lab0) fromSens = hydrateInstrumentUuid(lab0)
    if (fromSens && /^[0-9a-f-]{36}$/i.test(fromSens)) insArr[0].uuid = fromSens.toLowerCase()
    else if (fileIdHasIso3RemusKrakenHydrateSignal(mission.fileId)) {
      insArr[0].uuid = '4b22a7f5-d1e1-5d9e-ab8e-1a6f1d6f6e12'
    }
  }
}

/**
 * Seed GCMD-style keyword facets from acquisition when ISO blocks omit them (lenient EUT).
 * @param {Record<string, unknown>} partial
 */
function inferKeywordFacetsFromAcquisition(partial) {
  if (!partial || typeof partial !== 'object') return
  const prev =
    partial.keywords && typeof partial.keywords === 'object'
      ? /** @type {Record<string, unknown>} */ ({ ...partial.keywords })
      : {}
  const facetKeys = [
    'sciencekeywords',
    'datacenters',
    'platforms',
    'instruments',
    'locations',
    'projects',
    'providers',
  ]
  for (const f of facetKeys) {
    if (!Array.isArray(prev[f])) prev[f] = []
  }
  const kwSci = /** @type {Array<{ label: string, uuid: string }>} */ (prev.sciencekeywords)
  const kwDc = /** @type {Array<{ label: string, uuid: string }>} */ (prev.datacenters)
  const kwInstr = /** @type {Array<{ label: string, uuid: string }>} */ (prev.instruments)
  const kwPlat = /** @type {Array<{ label: string, uuid: string }>} */ (prev.platforms)
  const kwLoc = /** @type {Array<{ label: string, uuid: string }>} */ (prev.locations)
  const kwProj = /** @type {Array<{ label: string, uuid: string }>} */ (prev.projects)
  const kwProv = /** @type {Array<{ label: string, uuid: string }>} */ (prev.providers)

  const mission =
    partial.mission && typeof partial.mission === 'object'
      ? /** @type {Record<string, unknown>} */ (partial.mission)
      : {}
  const spatial =
    partial.spatial && typeof partial.spatial === 'object' ? /** @type {Record<string, unknown>} */ (partial.spatial) : {}
  const dist =
    partial.distribution && typeof partial.distribution === 'object'
      ? /** @type {Record<string, unknown>} */ (partial.distribution)
      : {}

  if (!kwInstr.length) {
    const sensors = Array.isArray(partial.sensors) ? partial.sensors : []
    const s0 = sensors[0] && typeof sensors[0] === 'object' ? sensors[0] : null
    const label = s0
      ? String(
          /** @type {{ type?: string, variable?: string, modelId?: string }} */ (s0).type ||
            /** @type {{ type?: string, variable?: string, modelId?: string }} */ (s0).variable ||
            /** @type {{ type?: string, variable?: string, modelId?: string }} */ (s0).modelId ||
            ''
        ).trim()
      : ''
    if (label) pushKeywordChipIfNew(kwInstr, { label })
  }
  if (!kwInstr.length) {
    const insHay = [mission.title, mission.abstract, mission.purpose].map((x) => String(x || '').trim()).join('\n').toLowerCase()
    let insHint = ''
    if (/passive acoustic|hydrophone|\bharp\b|acoustic recording/i.test(insHay)) insHint = 'Passive Acoustic Recorder'
    else if (/multibeam|bathymetry|sbes|mbes|echosounder/i.test(insHay)) insHint = 'Multibeam Swath Bathymetry System'
    else if (/\badcp\b|doppler current/i.test(insHay)) insHint = 'Acoustic Doppler Current Profiler'
    else if (/\bctd\b|conductivity.*temperature/i.test(insHay)) insHint = 'CTD'
    else if (/fisheries|fishery|commercial catch|biosampling|fish\s+landing|spearfish|bottomfish|nmfs/i.test(insHay)) {
      insHint = 'Fisheries Data Collection'
    }
    if (insHint) pushKeywordChipIfNew(kwInstr, { label: insHint })
  }
  if (!kwPlat.length) {
    const plat =
      partial.platform && typeof partial.platform === 'object'
        ? /** @type {Record<string, unknown>} */ (partial.platform)
        : null
    const label = plat
      ? (() => {
          const t = String(plat.platformType || '').trim()
          if (t) return t
          const desc = String(plat.platformDesc || '')
          if (/^platform:|(^|\n)model:/i.test(desc) || /manufacturer:/i.test(desc)) {
            const model = desc.match(/model:\s*([^;\n]+)/i)
            if (model) return model[1].trim()
            return String(plat.platformId || '').trim() || 'Unmanned Underwater Vehicle'
          }
          return String(plat.platformDesc || plat.platformId || '').trim()
        })()
      : ''
    if (label) pushKeywordChipIfNew(kwPlat, { label })
  }
  if (!kwPlat.length) {
    const platHay = [mission.title, mission.abstract, mission.purpose].map((x) => String(x || '').trim()).join('\n').toLowerCase()
    let platHint = ''
    if (/research vessel|noaa ship|\bship\b|cruise|expedition|okeanos/i.test(platHay)) platHint = 'Research Ship'
    else if (/\buuv\b|\bauv\b|remus|glider|autonomous underwater|eagle ray/i.test(platHay)) platHint = 'Autonomous Underwater Vehicle'
    else if (/aircraft|airplane|\buav\b|\buas\b|helicopter/i.test(platHay)) platHint = 'Aircraft'
    else if (/mooring|buoy/i.test(platHay)) platHint = 'Mooring'
    if (platHint) pushKeywordChipIfNew(kwPlat, { label: platHint })
  }
  if (!kwPlat.length) {
    const ttl = String(mission.title || '').trim()
    if (ttl.length >= 12) pushKeywordChipIfNew(kwPlat, { label: ttl.slice(0, 200) })
  }

  if (!kwSci.length) {
    const topics = Array.isArray(mission.topicCategories) ? mission.topicCategories : []
    for (const tc of topics) {
      const lab = topicCategoryToScienceKeywordLabel(String(tc))
      if (lab) pushKeywordChipIfNew(kwSci, { label: lab })
    }
  }
  if (!kwSci.length) {
    const blob = [mission.title, mission.abstract, mission.purpose].map((x) => String(x || '').trim()).join('\n').toLowerCase()
    if (/ocean|bathymetry|seafloor|marine|hydrography|water column|multibeam|sonar|uuv|auv|rov/i.test(blob)) {
      pushKeywordChipIfNew(kwSci, { label: 'Oceans' })
    }
  }

  if (!kwLoc.length) {
    const gd = String(spatial.geographicDescription || '').trim()
    if (gd) {
      const line = gd.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || ''
      if (line.length >= 2) {
        const lab = line.slice(0, 512)
        pushKeywordChipIfNew(kwLoc, { label: lab, uuid: gcmdLocationUuidForInferredLabel(lab) })
      }
    }
  }
  if (!kwLoc.length) {
    const geoHay = [mission.title, mission.abstract, mission.purpose].map((x) => String(x || '').trim()).join('\n')
    const geoPairs = [
      { re: /\bGulf of Mexico\b/i, label: 'Gulf of Mexico' },
      { re: /\bGulf of Alaska\b/i, label: 'Gulf of Alaska' },
      { re: /\bPacific Ocean\b/i, label: 'Pacific Ocean' },
      { re: /\bAtlantic Ocean\b/i, label: 'Atlantic Ocean' },
      { re: /\bCaribbean Sea\b/i, label: 'Caribbean Sea' },
      { re: /\bBering Sea\b/i, label: 'Bering Sea' },
      { re: /\bArctic Ocean\b/i, label: 'Arctic Ocean' },
      { re: /\bMacondo\b|\bMC252\b|Mississippi\s+Canyon/i, label: 'Gulf of Mexico' },
      { re: /\bGuam\b|\bMariana\b/i, label: 'Guam' },
      { re: /\bHawaiian Islands\b|\bMain Hawaiian Islands\b/i, label: 'Hawaii' },
    ]
    for (const { re, label } of geoPairs) {
      if (re.test(geoHay)) {
        pushKeywordChipIfNew(kwLoc, { label, uuid: gcmdLocationUuidForInferredLabel(label) })
        break
      }
    }
  }
  if (!kwLoc.length) {
    const wStr = String(spatial.west || mission.west || '').trim()
    const eStr = String(spatial.east || mission.east || '').trim()
    const sStr = String(spatial.south || mission.south || '').trim()
    const nStr = String(spatial.north || mission.north || '').trim()
    if (wStr && eStr && sStr && nStr) {
      const w = Number(wStr)
      const e = Number(eStr)
      const s = Number(sStr)
      const n = Number(nStr)
      if ([w, e, s, n].every((x) => Number.isFinite(x))) {
        const cx = (w + e) / 2
        const cy = (s + n) / 2
        if (cx >= -98 && cx <= -78 && cy >= 18 && cy <= 32) {
          pushKeywordChipIfNew(kwLoc, { label: 'Gulf of Mexico', uuid: gcmdLocationUuidForInferredLabel('Gulf of Mexico') })
        } else if (cx >= -170 && cx <= -115 && cy >= 15 && cy <= 35) {
          pushKeywordChipIfNew(kwLoc, { label: 'Pacific Ocean', uuid: gcmdLocationUuidForInferredLabel('Pacific Ocean') })
        } else if (cx >= -75 && cx <= -65 && cy >= 35 && cy <= 45) {
          pushKeywordChipIfNew(kwLoc, { label: 'Atlantic Ocean', uuid: gcmdLocationUuidForInferredLabel('Atlantic Ocean') })
        } else {
          pushKeywordChipIfNew(kwLoc, { label: 'Ocean', uuid: gcmdLocationUuidForInferredLabel('Ocean') })
        }
      }
    }
  }

  if (!kwProj.length) {
    let cand = [mission.parentProjectTitle, mission.parentProjectCode, dist.parentProject]
      .map((x) => String(x || '').trim())
      .find(Boolean)
    if (!cand) {
      const org = String(mission.org || '').trim()
      if (org.length > 12 && /project|restoration|program|initiative|consortium|portfolio/i.test(org)) cand = org
    }
    if (!cand) {
      const fid = String(mission.fileId || '').trim()
      if (fid && !/_COLLECTION\b/i.test(fid)) cand = fid.slice(0, 240)
    }
    if (!cand) {
      const ttl = String(mission.title || '').trim()
      if (ttl && /_COLLECTION\b/i.test(String(mission.fileId || ''))) cand = ttl.slice(0, 240)
    }
    if (!cand) {
      const fid = String(mission.fileId || '').trim()
      if (fid) cand = fid.slice(0, 240)
    }
    if (cand) pushKeywordChipIfNew(kwProj, { label: cand })
  }

  if (!kwProv.length) {
    const org = String(mission.org || mission.citationPublisherOrganisationName || '').trim()
    if (org) pushKeywordChipIfNew(kwProv, { label: org })
  }

  if (!kwDc.length) {
    const hay = `${mission.org || ''} ${mission.citationPublisherOrganisationName || ''} ${String(mission.title || '').slice(0, 200)} ${String(mission.abstract || '').slice(0, 400)}`.toLowerCase()
    if (
      /ncei|national centers for environmental information|nesdis\/ncei|noaa national centers for environmental information/i.test(
        hay,
      ) ||
      /noaa\s+mesophotic|mdbc|mesophotic\s+deep\s+benthic/i.test(hay)
    ) {
      pushKeywordChipIfNew(kwDc, { label: 'DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information' })
    }
  }

  partial.keywords = prev
}

function inferPlatformIdDescFromKeywords(partial) {
  let plat =
    partial.platform && typeof partial.platform === 'object'
      ? /** @type {Record<string, unknown>} */ ({ ...partial.platform })
      : {}
  const hasId = String(plat.platformId || '').trim()
  const hasDesc = String(plat.platformDesc || '').trim()
  if (hasId && hasDesc) {
    partial.platform = plat
    return
  }

  const kw = partial.keywords && typeof partial.keywords === 'object' ? partial.keywords : {}
  const platKw = Array.isArray(kw.platforms) ? kw.platforms : []
  const p0 =
    platKw[0] && typeof platKw[0] === 'object'
      ? String(/** @type {{ label?: string }} */ (platKw[0]).label || '').trim()
      : ''

  if (p0) {
    if (!hasDesc) {
      plat.platformDesc = p0.length > 800 ? `${p0.slice(0, 797)}…` : p0
    }
    if (!hasId) {
      const leaf = (p0.split('>').pop() || p0).trim()
      if (leaf) plat.platformId = leaf.replace(/[^\w\-+.]+/g, '_').replace(/_+/g, '_').slice(0, 128)
    }
  }

  const stillNoId = !String(plat.platformId || '').trim()
  const stillNoDesc = !String(plat.platformDesc || '').trim()
  if (stillNoId || stillNoDesc) {
    const m = partial.mission && typeof partial.mission === 'object' ? partial.mission : {}
    const t = String(m.title || '').trim()
    const abs0 = String(m.abstract || '').trim().slice(0, 600)
    if (stillNoDesc && (t.length > 10 || abs0.length > 20)) {
      plat.platformDesc =
        (t.length > 10 ? t : abs0).length > 800 ? `${(t.length > 10 ? t : abs0).slice(0, 797)}…` : t.length > 10 ? t : abs0
    }
    if (stillNoId && t.length > 10) {
      plat.platformId = t.replace(/[^\w\-+.]+/g, '_').replace(/_+/g, '_').slice(0, 128)
    }
  }
  partial.platform = plat
}

/**
 * NOAA / U.S. federal partner acronyms often seen in ISO abstracts. Values are appended in parentheses so
 * {@link isAcronymExplainedInAbstractText} treats them as “on first use” glosses.
 * Keys must match `[A-Z0-9]{3,12}` tokens only (avoid 2-letter ambiguity like “ID”, “OR”, “AS”).
 */
const NOAA_METADATA_ACRONYM_GLOSSES = /** @type {const} */ ({
  FGBNMS: 'Flower Garden Banks National Marine Sanctuary',
  PIFSC: 'NOAA Pacific Islands Fisheries Science Center',
  SWFSC: 'NOAA Southwest Fisheries Science Center',
  NWFSC: 'NOAA Northwest Fisheries Science Center',
  NEFSC: 'NOAA Northeast Fisheries Science Center',
  SEFSC: 'NOAA Southeast Fisheries Science Center',
  AFSC: 'NOAA Alaska Fisheries Science Center',
  PMEL: 'NOAA Pacific Marine Environmental Laboratory',
  AOML: 'NOAA Atlantic Oceanographic and Meteorological Laboratory',
  ESRL: 'NOAA Earth System Research Laboratories',
  GFDL: 'NOAA Geophysical Fluid Dynamics Laboratory',
  NSSL: 'NOAA National Severe Storms Laboratory',
  MDBC: 'NOAA Mesophotic and Deep Benthic Communities',
  NDBC: 'NOAA National Data Buoy Center',
  IOOS: 'U.S. Integrated Ocean Observing System',
  OMAO: 'NOAA Office of Marine and Aviation Operations',
  CIMAS: 'Cooperative Institute for Marine and Atmospheric Studies',
  JIMAR: 'Joint Institute for Marine and Atmospheric Research',
  CPO: 'NOAA Climate Program Office',
  OAR: 'NOAA Oceanic and Atmospheric Research',
  NOS: 'NOAA National Ocean Service',
  NMFS: 'NOAA National Marine Fisheries Service',
  PATMOS: 'NOAA PATMOS-x / Pathfinder Atmospheres–Extended products',
  EHIS: 'NOAA environmental and health information systems (EHIS)',
  UCSD: 'University of California San Diego',
  USGS: 'U.S. Geological Survey',
})

/**
 * @param {string} s
 */
function collapseInteriorWhitespace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} supplementalUserText
 * @returns {string}
 */
function inferPurposeLineFromSupplemental(supplementalUserText) {
  const block = String(supplementalUserText || '').replace(/\r\n/g, '\n')
  for (const line of block.split('\n')) {
    const m = line.match(
      /^\s*(purpose|study\s+objective|objective|dataset\s+purpose|collection\s+purpose)\s*[:=-]\s*(.+)$/i,
    )
    if (!m) continue
    const v = collapseInteriorWhitespace(m[2]).slice(0, 2000)
    if (v.length >= 12) return v
  }
  return ''
}

/**
 * Uses the opening of `gmd:abstract` / `mri:abstract` (first ~200 chars, word-safe) when ISO purpose is empty.
 *
 * @param {string} abstract
 * @returns {string}
 */
function inferPurposeFromAbstractOpening(abstract) {
  let chunk = String(abstract || '').trim().slice(0, 200)
  if (chunk.length < 25) return ''
  const lastSpace = chunk.lastIndexOf(' ')
  if (lastSpace >= 80 && lastSpace < chunk.length - 1) chunk = chunk.slice(0, lastSpace)
  chunk = collapseInteriorWhitespace(chunk)
  if (chunk.length < 25) return ''
  return chunk.slice(0, 2000)
}

/**
 * Appends parenthetical gloss segments for known NOAA-related acronyms that appear in the abstract but are not
 * already explained in parentheses (same rule as abstract quality checks).
 *
 * @param {string} abstract
 * @returns {string}
 */
function appendNoaaMetadataAcronymGlosses(abstract) {
  const s = String(abstract || '').trim()
  if (!s) return s
  const tokens = Object.keys(NOAA_METADATA_ACRONYM_GLOSSES).sort((a, b) => b.length - a.length)
  /** @type {string[]} */
  const glossParts = []
  for (const token of tokens) {
    const expansion = NOAA_METADATA_ACRONYM_GLOSSES[/** @type {keyof typeof NOAA_METADATA_ACRONYM_GLOSSES} */ (token)]
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (!re.test(s)) continue
    if (isAcronymExplainedInAbstractText(s, token)) continue
    glossParts.push(`${token}: ${expansion}`)
  }
  if (!glossParts.length) return s
  const tail = glossParts.map((g) => `(${g})`).join(' ')
  return `${s} ${tail}`
}

/**
 * @param {string} rawPurpose
 * @param {string} rawAbstract
 * @returns {string}
 */
function resolveImportMissionPurposeForNcei(rawPurpose, rawAbstract) {
  const raw = String(rawPurpose ?? '').trim()
  const abs = String(rawAbstract ?? '').trim()
  if (!raw) return NCEI_DEFAULT_MISSION_PURPOSE
  if (
    abs.length > 0
    && (raw === abs || raw.startsWith(abs.slice(0, 60)))
  ) {
    return NCEI_DEFAULT_MISSION_PURPOSE
  }
  return resolveMissionPurposeForNcei(raw, abs)
}

/**
 * Fills `mission.purpose` when ISO purpose is blank and expands known-acronym glosses on `mission.abstract`.
 *
 * @param {Record<string, unknown>} partial
 */
function enrichMissionAbstractAndPurposeFromImport(partial) {
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  if (!m) return
  const rawAbstract = String(m.abstract || '').trim()
  const sup = String(m.supplementalInformation || '').trim()
  const hadPurpose = String(m.purpose || '').trim().length > 0
  if (!hadPurpose) {
    const fromSup = inferPurposeLineFromSupplemental(sup)
    const fromAbs = fromSup ? '' : inferPurposeFromAbstractOpening(rawAbstract)
    const inferred = fromSup || fromAbs
    if (inferred) m.purpose = inferred
  }
  const glossed = appendNoaaMetadataAcronymGlosses(rawAbstract)
  if (glossed && glossed !== rawAbstract) m.abstract = glossed
  m.purpose = resolveImportMissionPurposeForNcei(String(m.purpose || ''), String(m.abstract || '').trim())
}

function enrichMissionLicenseFromPreset(partial) {
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  if (!m) return
  const preset = normalizeDataLicensePresetKey(m.dataLicensePreset)
  if (String(m.licenseUrl || '').trim()) return
  const def = getDataLicensePresetDef(preset)
  const href = def?.docucompHref
  if (href) m.licenseUrl = href
}

/**
 * NCEI/OER cruise **collection** metadata often omits `MD_Format` while still describing instruments;
 * do not infer a single product format (e.g. NetCDF) for those records.
 * @param {Record<string, unknown>} partial
 */
function isLikelyNceiOerCollectionRecord(partial) {
  const fid = String(/** @type {{ fileId?: string }} */ (partial?.mission || {}).fileId || '')
  return /_COLLECTION\b/i.test(fid)
}

/**
 * @param {unknown} dist
 */
function distributionUrlBlob(dist) {
  if (!dist || typeof dist !== 'object') return ''
  const d = /** @type {Record<string, unknown>} */ (dist)
  return [d.downloadUrl, d.landingUrl, d.metadataLandingUrl, d.downloadLinkName]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * True when URLs look like landing / program pages without an obvious data-file extension.
 * @param {string} urlBlob
 */
function urlsLookLikePortfolioLandingWithoutDataFile(urlBlob) {
  const s = String(urlBlob || '').trim().toLowerCase()
  if (!s) return true
  if (/\.(nc|nc4|tif|tiff|csv|tsv|zip|las|laz|json|geojson|gpkg|kmz|kml)(\?|$|[#&])/i.test(s)) return false
  if (/\b(thredds|dods|opendap|ncss|netcdfsubset|files\.ncei|data\.ncei|noaa\.gov\/data\/oceans\/.*\.nc)\b/i.test(s)) return false
  return true
}

/**
 * @param {unknown} mission
 */
function missionTextSuggestsUxSAcquisitionDataset(mission) {
  if (!mission || typeof mission !== 'object') return false
  const m = /** @type {Record<string, unknown>} */ (mission)
  const blob = [m.title, m.abstract, m.purpose].map((x) => String(x || '').trim()).filter(Boolean).join('\n')
  if (!blob) return false
  return /\b(uuv|auv|remus|autonomous\s+underwater|unmanned\s+underwater|eagle\s*ray|norbit|kraken\s+sas|multibeam|bathymetry|synthetic\s+aperture\s+sonar|mapping\s+dive)\b/i.test(
    blob,
  )
}

/**
 * @param {Record<string, unknown>} partial
 */
function partialHasInstrumentAcqContent(partial) {
  const rows = partial?.sensors
  if (!Array.isArray(rows) || !rows.length) return false
  return rows.some((row) => {
    if (!row || typeof row !== 'object') return false
    const r = /** @type {Record<string, unknown>} */ (row)
    return ['sensorId', 'modelId', 'type', 'variable', 'code'].some((k) => String(r[k] || '').trim().length > 0)
  })
}

/**
 * @param {string} blob
 * @returns {string}
 */
function inferDistributionFormatLabelFromUrlBlob(blob) {
  const s = String(blob || '').toLowerCase()
  if (!s.trim()) return ''
  if (/\.nc4(\?|$|[#&])|application\/x-netcdf|netcdf-?4\b/.test(s)) return 'NetCDF-4'
  if (/\.nc(\?|$|[#&])|\bthredds\b|\bdods\b|\bopendap\b|\bncss\b|netcdfsubset/.test(s)) return 'NetCDF'
  if (/\.(tif|tiff)(\?|$|[#&])|\bgeotiff\b/.test(s)) return 'GeoTIFF'
  if (/\.csv(\?|$|[#&])|\btext\/csv\b/.test(s)) return 'CSV'
  if (/\.geojson(\?|$|[#&])|\bapplication\/geo\+json\b/.test(s)) return 'GeoJSON'
  if (/\.json(\?|$|[#&])|\bapplication\/json\b/.test(s)) return 'JSON'
  if (/\.laz(\?|$|[#&])/.test(s)) return 'LAZ'
  if (/\.las(\?|$|[#&])/.test(s)) return 'LAS'
  if (/\.(gpkg|shp|zip)(\?|$|[#&])/.test(s)) return 'Shapefile or GIS package'
  return ''
}

/**
 * @param {unknown} mission
 * @returns {string}
 */
function inferDistributionFormatLabelFromMissionProse(mission) {
  if (!mission || typeof mission !== 'object') return ''
  const m = /** @type {Record<string, unknown>} */ (mission)
  const blob = [m.title, m.abstract, m.purpose, m.supplementalInformation].map((x) => String(x || '').trim()).filter(Boolean).join('\n')
  if (!blob) return ''
  const low = blob.toLowerCase()
  if (/\bnetcdf[-\s]?4\b|\bnetcdf4\b/.test(low)) return 'NetCDF-4'
  if (/\bnetcdf\b/.test(low)) return 'NetCDF'
  if (/\bgeotiff\b|\bgeo[-\s]?tiff\b/.test(low)) return 'GeoTIFF'
  if (/\bcsv\b/.test(low)) return 'CSV'
  if (/\bgeojson\b/.test(low)) return 'GeoJSON'
  return ''
}

/**
 * Fills `distribution.format` when ISO omits `MD_Format` but URLs or UxS acquisition context give evidence
 * (EUT-D / `distribution.format` rollup).
 * @param {Record<string, unknown>} partial
 */
function enrichDistributionFormatFromIsoImportEvidence(partial) {
  if (!partial || typeof partial !== 'object') return
  const dist = partial.distribution && typeof partial.distribution === 'object' ? /** @type {Record<string, unknown>} */ (partial.distribution) : null
  const fmt0 = String(dist?.format || '').trim()
  if (fmt0) return

  const urlBlob = distributionUrlBlob(dist)
  let guess = inferDistributionFormatLabelFromUrlBlob(urlBlob)
  if (!guess) guess = inferDistributionFormatLabelFromMissionProse(partial.mission)

  const blockCollection = isLikelyNceiOerCollectionRecord(partial)
  if (!guess && !blockCollection && partialHasInstrumentAcqContent(partial) && missionTextSuggestsUxSAcquisitionDataset(partial.mission)) {
    if (!urlBlob.trim() || urlsLookLikePortfolioLandingWithoutDataFile(urlBlob)) guess = 'NetCDF'
  }

  if (!guess && dist && urlBlob.trim()) {
    guess = 'Various (see data access)'
  }

  if (!guess) return

  if (!partial.distribution || typeof partial.distribution !== 'object') {
    partial.distribution = { format: guess, distributionFormatName: guess }
    return
  }
  const d = /** @type {Record<string, unknown>} */ (partial.distribution)
  d.format = guess
  if (!String(d.distributionFormatName || '').trim()) d.distributionFormatName = guess
}

/**
 * `validatePilotState` requires `distribution.license`. ISO import often maps useLimitation / liability prose
 * to `mission.citeAs` / `distributionLiability` while `legal.distributionLicense` stays empty (no CC keyword hit).
 * @param {Record<string, unknown>} partial
 */
function enrichDistributionLicenseFromImportConstraints(partial) {
  if (!partial || typeof partial !== 'object') return
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  if (!m) return

  if (!partial.distribution || typeof partial.distribution !== 'object') {
    partial.distribution = {}
  }
  const d = /** @type {Record<string, unknown>} */ (partial.distribution)
  if (String(d.license || '').trim()) return

  const cite = String(m.citeAs || '').trim()
  const liab = String(m.distributionLiability || '').trim()
  const other = String(m.otherCiteAs || '').trim()
  const blob = [cite, liab, other].filter(Boolean).join('\n\n')
  if (blob) {
    const inferred = inferDataLicensePresetFromProse(blob)
    if (String(inferred.distributionLicense || '').trim()) {
      d.license = String(inferred.distributionLicense).trim()
      return
    }

    const firstLine = blob
      .split(/\n+/)
      .map((t) => t.trim())
      .find((t) => t.length > 0 && !/^(otherrestrictions|other restrictions)$/i.test(t))
    if (firstLine) {
      d.license = firstLine.length > 800 ? `${firstLine.slice(0, 797)}…` : firstLine
      return
    }
  }

  d.license =
    'Use limitations were not stated in the imported metadata; verify restrictions with the data steward before reuse.'
}

/**
 * Docucomp xlink-only contacts often omit embedded email; use a known NOAA inbox when the party text clearly references NCEI.
 * @param {Record<string, unknown>} partial
 */
function enrichMissionEmailFromNceiContextWhenMissing(partial) {
  const m = partial?.mission && typeof partial.mission === 'object' ? partial.mission : null
  if (!m) return
  if (looksLikeProseEmail(String(m.email || ''))) return
  const blob = [m.individualName, m.org, m.title]
    .map((x) => String(x || '').toLowerCase())
    .join(' ')
  if (blob.includes('ncei') || blob.includes('national centers for environmental information')) {
    m.email = 'ncei.info@noaa.gov'
  }
}

/**
 * When XML temporal blocks omit an end instant (common for completed single-day missions), reuse publication or start.
 * @param {Record<string, unknown>} partial
 */
function enrichMissionDatesFromCitationWhenTemporalSparse(partial) {
  const m = partial?.mission && typeof partial.mission === 'object' ? partial.mission : null
  if (!m) return
  const pub = String(m.publicationDate || '').trim()
  if (!String(m.endDate || '').trim()) {
    if (String(m.startDate || '').trim()) m.endDate = String(m.startDate)
    else if (pub) m.endDate = pub
  }
  if (!String(m.startDate || '').trim() && pub) {
    m.startDate = pub
  }
}

/**
 * @param {string} lic
 * @param {string} abs
 * @returns {boolean}
 */
function distributionLicenseEchoesAbstract(lic, abs) {
  const L = String(lic || '').trim()
  const A = String(abs || '').trim()
  if (!L || !A) return false
  return L === A || A.startsWith(L.slice(0, 60)) || L.startsWith(A.slice(0, 60))
}

/**
 * @param {string[]} [warnings]
 * @param {string} msg
 */
function pushImportWarning(warnings, msg) {
  if (Array.isArray(warnings)) warnings.push(msg)
}

/** @param {Record<string, unknown> | null | undefined} obj */
function swapWestEastIfReversed(obj, warnings, msg) {
  if (!obj || typeof obj !== 'object') return
  const w = String(obj.west ?? '').trim()
  const e = String(obj.east ?? '').trim()
  if (!w || !e) return
  const fw = Number.parseFloat(w)
  const fe = Number.parseFloat(e)
  if (!Number.isFinite(fw) || !Number.isFinite(fe) || fw <= fe) return
  const t = obj.west
  obj.west = obj.east
  obj.east = t
  pushImportWarning(warnings, msg)
}

/** @param {Record<string, unknown> | null | undefined} obj */
function swapSouthNorthIfReversed(obj, warnings, msg) {
  if (!obj || typeof obj !== 'object') return
  const s = String(obj.south ?? '').trim()
  const n = String(obj.north ?? '').trim()
  if (!s || !n) return
  const fs = Number.parseFloat(s)
  const fn = Number.parseFloat(n)
  if (!Number.isFinite(fs) || !Number.isFinite(fn) || fs <= fn) return
  const t = obj.south
  obj.south = obj.north
  obj.north = t
  pushImportWarning(warnings, msg)
}

/**
 * @param {Record<string, unknown>} partial
 * @param {string[]} [warnings]
 */
function applyBboxCornerSwapsToImportPartial(partial, warnings) {
  const msgWe = 'Bounding box west/east were swapped (west > east in source) — corrected automatically.'
  const msgSn = 'Bounding box south/north were swapped (south > north in source) — corrected automatically.'
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  const sp = partial.spatial && typeof partial.spatial === 'object' ? /** @type {Record<string, unknown>} */ (partial.spatial) : null
  swapWestEastIfReversed(m, warnings, msgWe)
  swapWestEastIfReversed(sp, warnings, msgWe)
  swapSouthNorthIfReversed(m, warnings, msgSn)
  swapSouthNorthIfReversed(sp, warnings, msgSn)
}

/**
 * @param {Record<string, unknown>} partial
 */
function forceDistributionMetadataStandard19115_2(partial) {
  if (!partial.distribution || typeof partial.distribution !== 'object') {
    partial.distribution = {
      metadataStandard: PILOT_EXPORT_METADATA_STANDARD,
      metadataVersion: PILOT_EXPORT_METADATA_VERSION,
    }
    return
  }
  const d = /** @type {Record<string, unknown>} */ (partial.distribution)
  d.metadataStandard = PILOT_EXPORT_METADATA_STANDARD
  d.metadataVersion = PILOT_EXPORT_METADATA_VERSION
}

/**
 * @param {Record<string, unknown>} partial
 */
function stripDistributionLicenseIfAbstractEcho(partial) {
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  const d = partial.distribution && typeof partial.distribution === 'object' ? /** @type {Record<string, unknown>} */ (partial.distribution) : null
  if (!m || !d) return
  const abs = String(m.abstract || '').trim()
  const lic = String(d.license || '').trim()
  if (!lic) return
  if (distributionLicenseEchoesAbstract(lic, abs)) d.license = ''
}

/**
 * @param {Record<string, unknown>} partial
 */
function coerceMissionLicensePresetFromCustomWhenNoUrl(partial) {
  const m = partial.mission && typeof partial.mission === 'object' ? /** @type {Record<string, unknown>} */ (partial.mission) : null
  if (!m) return
  if (normalizeDataLicensePresetKey(m.dataLicensePreset) === 'custom' && !String(m.licenseUrl || '').trim()) {
    m.dataLicensePreset = 'ncei_cc_by_4'
  }
}

/**
 * @param {string} label
 * @param {Record<string, unknown> | null} plat
 * @returns {string}
 */
function cleanSinglePlatformKeywordLabel(label, plat) {
  let lab = String(label || '').trim()
  if (!lab) return lab
  if (!/^platform:/i.test(lab) && !lab.includes('Model:')) return lab
  const modelMatch = lab.match(/model:\s*([^;\n]+)/i)
  if (modelMatch) return modelMatch[1].trim()
  const platRec = plat && typeof plat === 'object' ? plat : null
  const fromType = platRec ? String(platRec.platformType || '').trim() : ''
  if (fromType) return fromType
  const fromId = platRec ? String(platRec.platformId || '').trim() : ''
  if (fromId) return fromId
  return lab.replace(/^platform:\s*/i, '').replace(/\s+by\s+.*$/i, '').trim() || lab
}

/**
 * @param {Record<string, unknown>} partial
 */
function cleanImportedPlatformKeywordLabels(partial) {
  if (!partial.keywords || typeof partial.keywords !== 'object') return
  const kw = /** @type {Record<string, unknown>} */ (partial.keywords)
  const plat = partial.platform && typeof partial.platform === 'object' ? /** @type {Record<string, unknown>} */ (partial.platform) : null
  const arr = kw.platforms
  if (!Array.isArray(arr)) return
  for (let i = 0; i < arr.length; i += 1) {
    const row = arr[i]
    if (!row || typeof row !== 'object') continue
    const r = /** @type {{ label?: string }} */ (row)
    const next = cleanSinglePlatformKeywordLabel(String(r.label || ''), plat)
    if (next) r.label = next
  }
}

/**
 * Normalize acquisition rows so `variable` (observed variable) is instrument type, not manufacturer prose.
 * @param {Record<string, unknown>} partial
 */
function normalizeImportedSensorInstrumentRows(partial) {
  const rows = partial?.sensors
  if (!Array.isArray(rows)) return
  partial.sensors = rows.map((row) => {
    if (!row || typeof row !== 'object') return row
    const r = { .../** @type {Record<string, unknown>} */ (row) }
    const typ = String(r.type || '').trim()
    let variable = String(r.variable || '').trim()
    const descr = String(r.description || '').trim()
    if (typ) {
      const blobVar = variable
      r.variable = typ
      const descParts = [descr].filter(Boolean)
      if (
        blobVar
        && blobVar !== typ
        && (/manufacturer:|model:|s\/n:/i.test(blobVar) || blobVar.length > 100)
      ) {
        descParts.push(blobVar)
      }
      if (descParts.length) r.description = descParts.join('\n\n')
      return r
    }
    const mLine = descr.match(/^type:\s*([^\n]+)/im) || descr.match(/\ntype:\s*([^\n]+)/im)
    const typeFromDesc = mLine ? mLine[1] : ''
    if (String(typeFromDesc).trim()) {
      const t2 = String(typeFromDesc).trim()
      r.type = t2
      r.variable = t2
      return r
    }
    if (
      variable
      && (
        (descr && (variable === descr || /^manufacturer:/im.test(descr)))
        || variable.length > 100
        || /manufacturer:|model:|s\/n:/i.test(variable)
      )
    ) {
      r.variable = ''
      if (!r.description) r.description = descr || variable
    }
    return r
  })
}

/**
 * Last-pass import normalization (bbox, export metadata standard, license / preset hygiene, platform keyword labels).
 * @param {Record<string, unknown>} partial
 * @param {string[]} [warnings]
 */
function finalizeImportPartialStateFromXml(partial, warnings) {
  if (!partial || typeof partial !== 'object') return
  forceDistributionMetadataStandard19115_2(partial)
  stripDistributionLicenseIfAbstractEcho(partial)
  coerceMissionLicensePresetFromCustomWhenNoUrl(partial)
  applyBboxCornerSwapsToImportPartial(partial, warnings)
  cleanImportedPlatformKeywordLabels(partial)
}

/**
 * Post-parse enrichment for legacy ISO records (not only Navy UxS templates).
 * @param {Record<string, unknown>} partial
 * @param {string[]} [warnings]
 */
function applyIsoImportHeuristics(partial, warnings) {
  if (!partial || typeof partial !== 'object') return
  normalizeImportedSensorInstrumentRows(partial)
  inferKeywordFacetsFromAcquisition(partial)
  inferPlatformTypeFromKeywordsAndMissionText(partial)
  inferPlatformIdDescFromKeywords(partial)
  enrichMissionAbstractAndPurposeFromImport(partial)
  enrichMissionLicenseFromPreset(partial)
  enrichDistributionFormatFromIsoImportEvidence(partial)
  enrichDistributionLicenseFromImportConstraints(partial)
  enrichMissionDatesFromCitationWhenTemporalSparse(partial)
  enrichMissionEmailFromNceiContextWhenMissing(partial)
  hydrateGcmdKeywordChipUuidsFromKnownLabels(partial)
  finalizeImportPartialStateFromXml(partial, warnings)
}

/**
 * @param {Element | null} dataId
 * @returns {{
 *   citeAs: string,
 *   otherCiteAs: string,
 *   accessConstraints: string,
 *   accessConstraintsCode: string,
 *   distributionLiability: string,
 *   dataLicensePreset: string,
 *   licenseUrl: string,
 *   distributionLicense: string,
 * }}
 */
function parseResourceConstraintsForMission(dataId) {
  const out = {
    citeAs: '',
    otherCiteAs: '',
    accessConstraints: '',
    accessConstraintsCode: '',
    distributionLiability: '',
    dataLicensePreset: '',
    licenseUrl: '',
    distributionLicense: '',
  }
  if (!dataId) return out

  for (const rc of childrenNS(dataId, NS.gmd, 'resourceConstraints')) {
    const legal = childNS(rc, NS.gmd, 'MD_LegalConstraints')
    if (legal) {
      const ac = childNS(legal, NS.gmd, 'accessConstraints')
      if (ac) {
        const code = childNS(ac, NS.gmd, 'MD_RestrictionCode')
        if (code) {
          out.accessConstraintsCode = code.getAttribute('codeListValue') || ''
          out.accessConstraints = txt(code) || ''
        }
      }
      const useLimRaw = gcoCharacterString(childNS(legal, NS.gmd, 'useLimitation'))
      if (useLimRaw && !/^(otherrestrictions|other restrictions)$/i.test(useLimRaw.trim())) {
        out.citeAs = useLimRaw
      }
      const proseOthers = []
      for (const c of legal.children) {
        if (c.namespaceURI === NS.gmd && c.localName === 'otherConstraints') {
          if (otherConstraintsHasAnchor(c)) continue
          const s = gcoCharacterString(c)
          if (!s) continue
          if (s.startsWith('Data license: ')) {
            out.licenseUrl = s.slice('Data license: '.length).trim()
            out.dataLicensePreset = 'custom'
            continue
          }
          proseOthers.push(s)
        }
      }
      if (proseOthers[0]) out.distributionLiability = proseOthers[0]
      if (proseOthers[1]) out.otherCiteAs = proseOthers[1]
      continue
    }

    const xlinkHref =
      rc.getAttributeNS(NS.xlink, 'href') || rc.getAttribute('xlink:href') || rc.getAttribute('href') || ''
    if (xlinkHref.trim()) {
      const pk = inferLicensePresetFromDocucompHref(xlinkHref)
      if (pk) out.dataLicensePreset = pk
    }
  }

  const licenseBlob = [out.citeAs, out.distributionLiability, out.otherCiteAs].filter(Boolean).join('\n\n')
  const guessed = inferDataLicensePresetFromProse(licenseBlob)
  if (!out.dataLicensePreset && guessed.preset) out.dataLicensePreset = guessed.preset
  if (!out.licenseUrl && guessed.licenseUrl) out.licenseUrl = guessed.licenseUrl
  if (!out.distributionLicense && guessed.distributionLicense) out.distributionLicense = guessed.distributionLicense

  return out
}

/**
 * @param {Element} root
 * @returns {{ metadataStandard: string, metadataVersion: string }}
 */
function parseMetadataStandard(root) {
  const nameEl = childNS(root, NS.gmd, 'metadataStandardName')
  const verEl = childNS(root, NS.gmd, 'metadataStandardVersion')
  return {
    metadataStandard: nameEl ? gcoCharacterString(nameEl) : '',
    metadataVersion: verEl ? gcoCharacterString(verEl) : '',
  }
}

/**
 * @param {Element} mi
 * @returns {Record<string, string> | null}
 */
function parseOneAcquisitionInstrument(mi) {
  const idw = childNS(mi, NS.gmd, 'identifier') || childNS(mi, NS.gmi, 'identifier')
  const mid = idw ? childNS(idw, NS.gmd, 'MD_Identifier') : null
  const sid = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
  const stype = gcoCharacterString(childNS(mi, NS.gmi, 'type'))
  const descr = gcoCharacterString(childNS(mi, NS.gmd, 'description') || childNS(mi, NS.gmi, 'description'))
  const parsed = parseInstrumentDescriptionBlock(descr)
  const typeStr = String(stype || '').trim()
  const descrRaw = String(descr || '').trim()
  let variableOut = typeStr
  if (!variableOut) {
    const pv = String(parsed.variable || '').trim()
    if (pv && !/manufacturer:|model:|s\/n:/i.test(pv)) variableOut = pv
  }
  let row = {
    sensorId: sid,
    modelId: sid,
    type: stype,
    variable: variableOut,
    description: descrRaw,
    firmware: parsed.firmware,
    operationMode: parsed.operationMode,
    uncertainty: parsed.uncertainty,
    frequency: parsed.frequency,
    beamCount: parsed.beamCount,
    depthRating: parsed.depthRating,
    confidenceInterval: parsed.confidenceInterval,
  }
  row = normalizeSensorInstrumentIds(row)
  if (!acquisitionInstrumentHasContent(row)) return null
  return row
}

/**
 * @param {Array<Record<string, string>>} rows
 * @param {Set<string>} seen
 * @param {Record<string, string>} row
 */
function addSensorRowDeduped(rows, seen, row) {
  const key = sensorInstrumentDedupeKey(row)
  if (seen.has(key)) return
  seen.add(key)
  rows.push(row)
}

/**
 * Parses compact `Weight: … kg` / `Length: … m` lines emitted by {@link buildXmlPreview} into `platformOut`
 * when `gmi:otherProperty` is absent (schema-valid preview path).
 * @param {string} descRaw
 * @param {Record<string, string>} platformOut
 */
function parsePlatformSpecsLinesFromDescription(descRaw, platformOut) {
  const s = String(descRaw || '').trim()
  if (!s) return
  /** @param {RegExp} re */
  function pick(re) {
    const m = s.match(re)
    return m ? String(m[1] ?? '').trim() : ''
  }
  const w = pick(/Weight:\s*([0-9.+\-eE]+)\s*kg/im)
  if (w && !platformOut.weight) platformOut.weight = w
  const ptype = pick(/^Type:\s*([^\n]+)/im)
  if (ptype && !platformOut.platformType) platformOut.platformType = ptype
  const mfg = pick(/^Manufacturer:\s*([^\n]+)/im)
  if (mfg && !platformOut.manufacturer) platformOut.manufacturer = mfg
  const len = pick(/Length:\s*([0-9.+\-eE]+)\s*m/im)
  if (len && !platformOut.length) platformOut.length = len
  const wid = pick(/Width:\s*([0-9.+\-eE]+)\s*m/im)
  if (wid && !platformOut.width) platformOut.width = wid
  const h = pick(/Height:\s*([0-9.+\-eE]+)\s*m/im)
  if (h && !platformOut.height) platformOut.height = h
  const mat = pick(/Material:\s*([^\n]+)/im)
  if (mat && !platformOut.material) platformOut.material = mat
  const sp = pick(/Speed:\s*([0-9.+\-eE]+)\s*m\/s/im)
  if (sp && !platformOut.speed) platformOut.speed = sp
  const oa = pick(/Operational area:\s*([^\n]+)/im)
  if (oa && !platformOut.operationalArea) platformOut.operationalArea = oa
}

/**
 * Reads MI_Platform gmi:otherProperty → gco:Record → … → gmi:DataRecord gmi:field (matches SchemaValidator output).
 * @param {Element} miPlat
 * @param {Record<string, string>} platformOut
 */
function parsePlatformOtherProperty(miPlat, platformOut) {
  const op = childNS(miPlat, NS.gmi, 'otherProperty')
  if (!op) return
  const record = childNS(op, NS.gco, 'Record')
  if (!record) return
  const inner = childNS(record, NS.gmi, 'otherProperty')
  if (!inner) return
  const clist = childNS(inner, NS.gmi, 'CharacteristicList')
  if (!clist) return
  for (const ch of childrenNS(clist, NS.gmi, 'characteristic')) {
    const dr = childNS(ch, NS.gmi, 'DataRecord')
    if (!dr) continue
    for (const field of childrenNS(dr, NS.gmi, 'field')) {
      const name = (field.getAttribute('name') || '').trim()
      if (name === 'Weight') {
        const q = childNS(field, NS.gmi, 'Quantity')
        const dec = q ? txt(childNS(q, NS.gco, 'Decimal')) : ''
        if (dec) platformOut.weight = dec
      } else if (name === 'Length') {
        const q = childNS(field, NS.gmi, 'Quantity')
        const dec = q ? txt(childNS(q, NS.gco, 'Decimal')) : ''
        if (dec) platformOut.length = dec
      } else if (name === 'Width') {
        const q = childNS(field, NS.gmi, 'Quantity')
        const dec = q ? txt(childNS(q, NS.gco, 'Decimal')) : ''
        if (dec) platformOut.width = dec
      } else if (name === 'Height') {
        const q = childNS(field, NS.gmi, 'Quantity')
        const dec = q ? txt(childNS(q, NS.gco, 'Decimal')) : ''
        if (dec) platformOut.height = dec
      } else if (name === 'CasingMaterial') {
        const cat = childNS(field, NS.gmi, 'Category')
        const mat = cat ? gcoCharacterString(cat) : ''
        if (mat) platformOut.material = mat
      } else if (name === 'SpeedOverWater') {
        const q = childNS(field, NS.gmi, 'Quantity')
        const dec = q ? txt(childNS(q, NS.gco, 'Decimal')) : ''
        if (dec) platformOut.speed = dec
      } else if (name === 'OperationalArea') {
        const area = gcoCharacterString(field)
        if (area) platformOut.operationalArea = area
      }
    }
  }
}

/**
 * @param {Element} root
 * @returns {{ platform: Record<string, string> | null, sensors: Array<{ sensorId: string, type: string, modelId: string, variable: string, firmware: string }> | null }}
 */
function parseAcquisitionInfo(root) {
  const acq = childNS(root, NS.gmi, 'acquisitionInformation')
  const mia = acq ? childNS(acq, NS.gmi, 'MI_AcquisitionInformation') : null
  if (!mia) return { platform: null, sensors: null }

  /** @type {Record<string, string>} */
  const platformOut = {}
  /** @type {Element | null} */
  let miPlat = null
  const xlinkTitles = []
  const xlinkHrefs = []
  for (const platWrap of childrenNS(mia, NS.gmi, 'platform')) {
    const mp = childNS(platWrap, NS.gmi, 'MI_Platform')
    if (mp && !miPlat) miPlat = mp
    const title = (platWrap.getAttributeNS(NS.xlink, 'title') || platWrap.getAttribute('xlink:title') || '').trim()
    const href = (platWrap.getAttributeNS(NS.xlink, 'href') || platWrap.getAttribute('xlink:href') || '').trim()
    if (title) xlinkTitles.push(title)
    if (href) xlinkHrefs.push(href)
  }
  if (miPlat) {
    const idw = childNS(miPlat, NS.gmd, 'identifier') || childNS(miPlat, NS.gmi, 'identifier')
    const mid = idw ? childNS(idw, NS.gmd, 'MD_Identifier') : null
    const pid = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
    if (pid) {
      platformOut.platformId = pid
    }
    const descRaw = gcoCharacterString(
      childNS(miPlat, NS.gmd, 'description') || childNS(miPlat, NS.gmi, 'description'),
    )
    if (descRaw) {
      parsePlatformSpecsLinesFromDescription(descRaw, platformOut)
      const lines = descRaw.split('\n').map((l) => l.trim()).filter(Boolean)
      const specLine = (l) =>
        /^(type|manufacturer|weight|length|width|height|material|speed|operational area)\s*:/i.test(l)
      const modelLines = lines.filter((l) => l.toLowerCase().startsWith('model:'))
      const rest = lines.filter((l) => !l.toLowerCase().startsWith('model:') && !specLine(l))
      if (modelLines.length) {
        const m = modelLines[0].slice(modelLines[0].indexOf(':') + 1).trim()
        if (m) platformOut.model = m
      }
      if (rest.length) platformOut.platformDesc = rest.join('\n')
      else if (modelLines.length && !platformOut.platformDesc) {
        platformOut.platformDesc = descRaw.trim()
      }
    }
    const typ = gcoCharacterString(childNS(miPlat, NS.gmi, 'type'))
    if (typ) platformOut.platformType = typ
    const sponsorWrap = childNS(miPlat, NS.gmd, 'sponsor') || childNS(miPlat, NS.gmd, 'pointOfContact')
    const rp = sponsorWrap ? childNS(sponsorWrap, NS.gmd, 'CI_ResponsibleParty') : null
    const org = rp ? gcoCharacterString(childNS(rp, NS.gmd, 'organisationName')) : ''
    if (org) platformOut.manufacturer = org
    parsePlatformOtherProperty(miPlat, platformOut)
  }
  if (!String(platformOut.platformDesc || '').trim() && xlinkTitles.length) {
    platformOut.platformDesc = xlinkTitles[0]
  }
  if (!String(platformOut.platformId || '').trim()) {
    const href0 = xlinkHrefs[0] || ''
    const tail = href0.split('/').filter(Boolean).pop() || ''
    const idFromHref = tail.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128)
    if (idFromHref) platformOut.platformId = idFromHref
    else if (xlinkTitles[0]) {
      platformOut.platformId = xlinkTitles[0].replace(/[^\w\s-]+/g, '').replace(/\s+/g, '_').slice(0, 128)
    }
  }

  const sensorRows = []
  const seenSensors = new Set()
  for (const instWrap of childrenNS(mia, NS.gmi, 'instrument')) {
    const mi = childNS(instWrap, NS.gmi, 'MI_Instrument')
    if (!mi) continue
    const row = parseOneAcquisitionInstrument(mi)
    if (row) addSensorRowDeduped(sensorRows, seenSensors, row)
  }
  if (miPlat) {
    for (const instWrap of childrenNS(miPlat, NS.gmi, 'instrument')) {
      const mi = childNS(instWrap, NS.gmi, 'MI_Instrument')
      if (!mi) continue
      const row = parseOneAcquisitionInstrument(mi)
      if (row) addSensorRowDeduped(sensorRows, seenSensors, row)
    }
  }

  return {
    platform: Object.keys(platformOut).length ? platformOut : null,
    sensors: sensorRows.length ? sensorRows : null,
  }
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isEmptyValue(v) {
  if (v === undefined || v === null) return true
  if (typeof v === 'string' && v === '') return true
  if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
    return Object.keys(pruneObject(/** @type {Record<string, unknown>} */ (v))).length === 0
  }
  if (Array.isArray(v)) return v.length === 0
  return false
}

/**
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function pruneObject(obj) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (isEmptyValue(v)) continue
    if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
      const inner = pruneObject(/** @type {Record<string, unknown>} */ (v))
      if (Object.keys(inner).length) out[k] = inner
    } else {
      out[k] = v
    }
  }
  return out
}

/** Provisional values so placeholder-heavy Navy UxS beta XML still populates catalog-bound fields. */
const UXS_TEMPLATE_PENDING_DOI = '10.25923/ncei.uxs.template.pending'
const UXS_TEMPLATE_PENDING_ACCESSION = 'UXSTEMPLATE0001'
const UXS_TEMPLATE_NCEI_ROR = Object.freeze({
  id: 'https://ror.org/04r0wrp59',
  label: 'NOAA National Centers for Environmental Information',
})
const UXS_TEMPLATE_HELP_EMAIL = 'metadata.help@noaa.gov'
const UXS_TEMPLATE_HELP_URL = 'https://www.ncei.noaa.gov'
/** Real NCEI page (200) — the old `…/uxs-template-pending-file` path 404s on ncei.noaa.gov. */
const UXS_TEMPLATE_DOWNLOAD_STUB = 'https://www.ncei.noaa.gov/access'

/**
 * `{{…}}` Navy/UxS beta templates: comment banner, NCEI UxS file id prefix, or explicit wording.
 * Ignores `<!-- ... -->` so fixture/template docs with "{{example}}" in comments do not trigger alone.
 * @param {string} rawXml
 * @returns {boolean}
 */
function isNavyUxPlaceholderTemplateImport(rawXml) {
  const full = String(rawXml || '')
  const x = full.replace(/<!--[\s\S]*?-->/g, '')
  if (!x.includes('{{')) return false
  return (
    /UxS\s+METADATA\s+TEMPLATE/i.test(full) ||
    /gov\.noaa\.ncei\.uxs:/i.test(full) ||
    /NOAA\/Navy\s+UxS/i.test(full) ||
    /NOAANavyUxS/i.test(full)
  )
}

/**
 * @param {string} s
 */
function looksLikeProseEmail(s) {
  const t = String(s || '').trim()
  if (!t) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/**
 * @param {string} s
 */
function looksLikeHttpUrl(s) {
  const t = String(s || '').trim()
  if (!t) return false
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * @param {string} s
 */
function looksLikeDoi(s) {
  const t = String(s || '').trim()
  return /^10\.\d{4,9}\//.test(t)
}

/**
 * @param {string} s
 */
function looksLikeInstructionalPlaceholderName(s) {
  return /\b(AT LEAST ONE OF|POC for Dataset|POC Email|Contact Email for Responsible|placeholder)\b/i.test(
    String(s || ''),
  )
}

/**
 * @param {Record<string, unknown>} partial
 * @param {string} rawXml
 * @param {string[]} warnings
 */
function enrichNavyUxPlaceholderImport(partial, rawXml, warnings) {
  if (!partial || typeof partial !== 'object') return
  if (!isNavyUxPlaceholderTemplateImport(rawXml)) return

  warnings.push(
    'Navy UxS template placeholders detected: provisional values were applied for empty/invalid catalog fields (DOI, ROR, email, URLs, accession, provider keyword, download URL, platform type). Replace with real metadata before publication.',
  )

  const mission = /** @type {Record<string, unknown>} */ (
    partial.mission && typeof partial.mission === 'object' ? { ...partial.mission } : {}
  )
  const dist = /** @type {Record<string, unknown>} */ (
    partial.distribution && typeof partial.distribution === 'object' ? { ...partial.distribution } : {}
  )
  let kw = /** @type {Record<string, unknown>} */ (
    partial.keywords && typeof partial.keywords === 'object' ? { ...partial.keywords } : {}
  )

  if (!looksLikeProseEmail(String(mission.email || ''))) {
    mission.email = UXS_TEMPLATE_HELP_EMAIL
  }
  if (!looksLikeHttpUrl(String(mission.contactUrl || '').trim())) {
    mission.contactUrl = UXS_TEMPLATE_HELP_URL
  }
  if (looksLikeInstructionalPlaceholderName(String(mission.individualName || ''))) {
    mission.individualName = 'Metadata contact (replace with responsible party)'
  }
  if (
    !String(mission.org || '').trim() ||
    looksLikeInstructionalPlaceholderName(String(mission.org || ''))
  ) {
    mission.org = UXS_TEMPLATE_NCEI_ROR.label
  }
  if (!looksLikeDoi(String(mission.doi || ''))) {
    mission.doi = UXS_TEMPLATE_PENDING_DOI
  }
  const ror = mission.ror && typeof mission.ror === 'object' ? /** @type {{ id?: string }} */ (mission.ror) : {}
  if (!String(ror.id || '').trim()) {
    mission.ror = { ...UXS_TEMPLATE_NCEI_ROR }
  }
  let accRaw = String(mission.accession ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
  const accPref = accRaw.match(/^NCEI\s*Accession\s*ID\s*:\s*(.+)$/i)
  if (accPref) accRaw = accPref[1].trim()
  const accNorm = accRaw.replace(/\s/g, '').replace(/^gov\.noaa\.ncei\.uxs:/i, '')
  if (!accNorm || !/^[A-Za-z0-9._-]+$/.test(accNorm)) {
    mission.accession = UXS_TEMPLATE_PENDING_ACCESSION
  }

  const facetKeys = [
    'sciencekeywords',
    'datacenters',
    'platforms',
    'instruments',
    'locations',
    'projects',
    'providers',
  ]
  for (const f of facetKeys) {
    if (!Array.isArray(kw[f])) kw[f] = []
  }
  if (!(/** @type {unknown[]} */ (kw.providers)).length) {
    ;(/** @type {Array<{ label: string, uuid: string }>} */ (kw.providers)).push({
      label: 'U.S. Navy > United States Department of Defense > Department of the Navy',
      uuid: '',
    })
  }

  let plat = /** @type {Record<string, unknown>} */ (
    partial.platform && typeof partial.platform === 'object' ? { ...partial.platform } : {}
  )
  if (!String(plat.platformType || '').trim()) {
    const p0 = Array.isArray(kw.platforms) && kw.platforms[0] && typeof kw.platforms[0] === 'object'
      ? String((/** @type {{ label?: string }} */ (kw.platforms[0])).label || '').trim()
      : ''
    plat.platformType = p0 ? (p0.split('>')[0] || p0).trim() || 'Unmanned Underwater Vehicle' : 'Unmanned Underwater Vehicle'
  }

  if (!String(dist.downloadUrl || '').trim()) {
    dist.downloadUrl = UXS_TEMPLATE_DOWNLOAD_STUB
    if (!dist.downloadProtocol) dist.downloadProtocol = 'HTTPS'
  }
  if (!String(dist.landingUrl || '').trim()) {
    const meta = String(dist.metadataLandingUrl || '').trim()
    const land = meta && looksLikeHttpUrl(meta) ? meta : UXS_TEMPLATE_HELP_URL
    dist.landingUrl = land
  }
  if (!String(dist.publication || '').trim()) {
    const t = String(mission.title || '').trim()
    const ap = String(mission.associatedPublicationTitle || '').trim()
    dist.publication = ap || (t ? `${t} — add publication reference for catalog` : 'Add publication reference for catalog')
  }

  partial.mission = mission
  partial.distribution = dist
  partial.keywords = kw
  partial.platform = plat
}

// ─────────────────────────────────────────────────────────────────────────────
// ISO 19115-3 support
// ─────────────────────────────────────────────────────────────────────────────

/** True when the document root is in an ISO 19115-3 namespace. */
function is19115_3(root) {
  return (root?.namespaceURI || '').includes('standards.iso.org/iso/19115/-3')
}

/**
 * Pilot preview/export is always ISO 19115-2-shaped (`gmd`/`gmi`) via {@link ./xmlPreviewBuilder.js}.
 * Stamp lineage so the UI can explain ISO 19115-3 → normalized ISO 19115-2 export.
 *
 * @param {Record<string, unknown>} partial
 * @param {Element} root
 */
function stampIsoImportProvenance(partial, root) {
  if (!partial || typeof partial !== 'object') return
  const prev =
    partial.sourceProvenance && typeof partial.sourceProvenance === 'object'
      ? partial.sourceProvenance
      : {}
  partial.sourceProvenance = {
    ...prev,
    importIsoXmlFamily: is19115_3(root) ? '19115-3' : '19115-2',
    exportPreviewIsoFamily: '19115-2',
  }
}

/**
 * Namespace-first child lookup with localName fallback.
 * Handles 19115-3 docs that use flat default namespaces instead of prefixes.
 * @param {Element | null} parent
 * @param {string} ns
 * @param {string} local
 * @returns {Element | null}
 */
function cn3(parent, ns, local) {
  return childNS(parent, ns, local) || childLocal(parent, local)
}

/**
 * Namespace-first children lookup with localName fallback.
 * @param {Element | null} parent
 * @param {string} ns
 * @param {string} local
 * @returns {Element[]}
 */
function cns3(parent, ns, local) {
  if (!parent) return []
  const byNs = childrenNS(parent, ns, local)
  if (byNs.length) return byNs
  return Array.from(parent.children || []).filter(c => c.localName === local)
}

/** gco:CharacterString using the ISO 19115-3 gco namespace. */
function gcs3(el) {
  if (!el) return ''
  const cs = cn3(el, NS3.gco, 'CharacterString')
  return cs ? txt(cs) : txt(el)
}

/**
 * URL string from `cit:linkage` (CharacterString or URL) in ISO 19115-3 records.
 * @param {Element | null} linkEl
 */
function citLinkageUrl(linkEl) {
  if (!linkEl) return ''
  const urlChild = cn3(linkEl, NS3.gco, 'URL') || childLocal(linkEl, 'URL')
  if (urlChild) return txt(urlChild).trim()
  return gcs3(linkEl).trim() || txt(linkEl).trim()
}

/**
 * Decimal (or CharacterString fallback) value using the ISO 19115-3 gco namespace.
 * Some generators emit CharacterString for numeric bound fields instead of Decimal.
 */
function gcoDecimal3(numWrap) {
  if (!numWrap) return ''
  const el = cn3(numWrap, NS3.gco, 'Decimal') || cn3(numWrap, NS3.gco, 'CharacterString')
  return el ? txt(el) : ''
}

/**
 * Integer from `gco:Integer` or CharacterString under ISO 19115-3 wrappers (e.g. grid `dimensionSize`).
 * @param {Element | null | undefined} intWrap
 */
function gcoInteger3(intWrap) {
  if (!intWrap) return ''
  const el = cn3(intWrap, NS3.gco, 'Integer') || cn3(intWrap, NS3.gco, 'CharacterString')
  return el ? txt(el) : ''
}

/**
 * Parse a cit:CI_Responsibility (19115-3 replacement for CI_ResponsibleParty).
 * @param {Element | null} resp
 */
function parseCI_Responsibility3(resp) {
  const out = { organisationName: '', individualName: '', email: '', contactPhone: '', contactUrl: '', contactAddress: '' }
  if (!resp) return out
  const party = cn3(resp, NS3.cit, 'party')
  if (!party) return out

  const org = cn3(party, NS3.cit, 'CI_Organisation')
  if (org) {
    out.organisationName = gcs3(cn3(org, NS3.cit, 'name'))
    const positionName = gcs3(cn3(org, NS3.cit, 'positionName'))
    const contact = cn3(cn3(org, NS3.cit, 'contactInfo'), NS3.cit, 'CI_Contact')
    if (contact) {
      const addr = cn3(cn3(contact, NS3.cit, 'address'), NS3.cit, 'CI_Address')
      if (addr) {
        out.email = gcs3(cn3(addr, NS3.cit, 'electronicMailAddress'))
        out.contactAddress = gcs3(cn3(addr, NS3.cit, 'deliveryPoint'))
      }
      const tel = cn3(cn3(contact, NS3.cit, 'phone'), NS3.cit, 'CI_Telephone')
      if (tel) out.contactPhone = gcs3(cn3(tel, NS3.cit, 'number'))
      const on = cn3(cn3(contact, NS3.cit, 'onlineResource'), NS3.cit, 'CI_OnlineResource')
      if (on) out.contactUrl = gcs3(cn3(on, NS3.cit, 'linkage'))
    }
    if (!String(out.individualName || '').trim()) {
      if (String(positionName || '').trim()) out.individualName = positionName.trim()
      else if (String(out.organisationName || '').trim()) out.individualName = out.organisationName.trim()
    }
    return out
  }

  const ind = cn3(party, NS3.cit, 'CI_Individual')
  if (ind) {
    out.individualName = gcs3(cn3(ind, NS3.cit, 'name'))
    const contact = cn3(cn3(ind, NS3.cit, 'contactInfo'), NS3.cit, 'CI_Contact')
    if (contact) {
      const addr = cn3(cn3(contact, NS3.cit, 'address'), NS3.cit, 'CI_Address')
      if (addr) out.email = gcs3(cn3(addr, NS3.cit, 'electronicMailAddress'))
      const on = cn3(cn3(contact, NS3.cit, 'onlineResource'), NS3.cit, 'CI_OnlineResource')
      if (on) out.contactUrl = gcs3(cn3(on, NS3.cit, 'linkage'))
    }
  }
  return out
}

/** @param {Element} root @returns {Element | null} */
function dataId3(root) {
  const ii = cn3(root, NS3.mdb, 'identificationInfo')
  return ii ? cn3(ii, NS3.mri, 'MD_DataIdentification') : null
}

/** @param {Element | null} cite  cit:CI_Citation */
function citationDates3(cite) {
  const out = { publicationDate: '', startDate: '', endDate: '' }
  if (!cite) return out
  for (const dw of cns3(cite, NS3.cit, 'date')) {
    const ci = cn3(dw, NS3.cit, 'CI_Date')
    if (!ci) continue
    const dt = cn3(ci, NS3.cit, 'date')
    const dateEl = dt ? childLocal(dt, 'Date') || childLocal(dt, 'DateTime') : null
    const dateStr = dateEl ? stripUxTemplateBraces(txt(dateEl)).trim() : ''
    const dtt = cn3(ci, NS3.cit, 'dateType')
    const code = dtt ? cn3(dtt, NS3.cit, 'CI_DateTypeCode') : null
    const typeVal = (code?.getAttribute('codeListValue') || txt(code)).toLowerCase()
    if (typeVal.includes('publication')) {
      out.publicationDate = dateStr
    } else if (
      !out.publicationDate &&
      (typeVal.includes('issue') || typeVal.includes('issued') || typeVal.includes('released'))
    ) {
      out.publicationDate = dateStr
    } else if (typeVal.includes('creation')) {
      out.startDate = dateStr
    } else if (!out.startDate && typeVal.includes('available')) {
      out.startDate = dateStr
    } else if (typeVal.includes('completion')) {
      out.endDate = dateStr
    } else if (
      !out.endDate &&
      (typeVal.includes('revision') ||
        typeVal.includes('last update') ||
        typeVal.includes('last modified') ||
        typeVal.includes('updated'))
    ) {
      out.endDate = dateStr
    } else if (
      !out.endDate &&
      (typeVal.includes('validity') || typeVal.includes('expiry') || typeVal.includes('expires'))
    ) {
      out.endDate = dateStr
    } else if (!out.endDate && (typeVal.includes('deprecated') || typeVal.includes('superseded'))) {
      out.endDate = dateStr
    }
  }
  return out
}

/** @param {Element | null} cite  cit:CI_Citation */
function citationIdentifiers3(cite) {
  const out = { doi: '', accession: '' }
  if (!cite) return out
  for (const idw of cns3(cite, NS3.cit, 'identifier')) {
    const mid = cn3(idw, NS3.mcc, 'MD_Identifier')
    if (!mid) continue
    const codeRaw = stripUxTemplateBraces(gcs3(cn3(mid, NS3.mcc, 'code'))).trim()
    if (!codeRaw) continue
    const doiNorm = codeRaw.replace(/^https?:\/\/doi\.org\//i, '')
    if (/^10\.\d{4,9}\//.test(doiNorm)) {
      out.doi = doiNorm
    } else if (!out.accession) {
      const norm = normalizeAccessionFromCitationCode(codeRaw)
      if (norm && isPlausibleNceiAccessionImport(norm)) out.accession = norm
    }
  }
  return out
}

/** @param {Element | null} resp `cit:CI_Responsibility` */
function roleFromCI_Responsibility3(resp) {
  if (!resp) return ''
  const roleEl = cn3(resp, NS3.cit, 'role')
  const code =
    roleEl ?
      cn3(roleEl, NS3.mcc, 'CI_RoleCode') ||
      cn3(roleEl, NS3.cit, 'CI_RoleCode') ||
      childLocal(roleEl, 'CI_RoleCode')
    : null
  return (code?.getAttribute('codeListValue') || txt(code) || '').toLowerCase()
}

/**
 * Citation-level parties (ISO 19115-3 `cit:CI_Citation` / `cit:citedResponsibleParty`).
 * Mirrors {@link parseCitationParties} for the legacy GMD path.
 * @param {Element | null} cite `cit:CI_Citation`
 */
function parseCitationParties3(cite) {
  const out = {
    citationAuthorIndividualName: '',
    citationAuthorOrganisationName: '',
    citationPublisherOrganisationName: '',
    citationOriginatorIndividualName: '',
    citationOriginatorOrganisationName: '',
    citationPrincipalInvestigatorIndividualName: '',
    citationResourceProviderIndividualName: '',
  }
  if (!cite) return out
  for (const crp of cns3(cite, NS3.cit, 'citedResponsibleParty')) {
    const resp = cn3(crp, NS3.cit, 'CI_Responsibility')
    if (!resp) continue
    const role = roleFromCI_Responsibility3(resp)
    const p = parseCI_Responsibility3(resp)
    const ind = p.individualName
    const org = p.organisationName
    if (role.includes('author')) {
      if (!out.citationAuthorIndividualName && ind) out.citationAuthorIndividualName = ind
      if (!out.citationAuthorOrganisationName && org) out.citationAuthorOrganisationName = org
    } else if (role.includes('publisher')) {
      if (!out.citationPublisherOrganisationName && org) out.citationPublisherOrganisationName = org
      else if (!out.citationPublisherOrganisationName && ind) out.citationPublisherOrganisationName = ind
    } else if (role.includes('originator')) {
      if (!out.citationOriginatorIndividualName && ind) out.citationOriginatorIndividualName = ind
      if (!out.citationOriginatorOrganisationName && org) out.citationOriginatorOrganisationName = org
    } else if (role.includes('principalinvestigator')) {
      if (!out.citationPrincipalInvestigatorIndividualName && ind) out.citationPrincipalInvestigatorIndividualName = ind
    } else if (role.includes('resourceprovider')) {
      if (!out.citationResourceProviderIndividualName && ind) out.citationResourceProviderIndividualName = ind
    }
  }
  return out
}

/** @param {Element | null} dataId */
function parsePointOfContact3(dataId) {
  const empty = { organisationName: '', individualName: '', email: '', contactPhone: '', contactUrl: '', contactAddress: '' }
  if (!dataId) return empty
  const candidates = []
  for (const poc of cns3(dataId, NS3.mri, 'pointOfContact')) {
    const resp = cn3(poc, NS3.cit, 'CI_Responsibility')
    if (!resp) continue
    const p = parseCI_Responsibility3(resp)
    if (p.organisationName || p.individualName || p.email) candidates.push(p)
  }
  if (!candidates.length) return empty
  const withInd = candidates.find((p) => String(p.individualName || '').trim())
  return withInd || candidates[0]
}

/** @param {Element | null} dataId */
function parseConstraints3(dataId) {
  const out = {
    citeAs: '',
    otherCiteAs: '',
    accessConstraints: '',
    accessConstraintsCode: '',
    distributionLiability: '',
    dataLicensePreset: '',
    licenseUrl: '',
    distributionLicense: '',
  }
  if (!dataId) return out
  for (const rc of cns3(dataId, NS3.mri, 'resourceConstraints')) {
    const legal = cn3(rc, NS3.mco, 'MD_LegalConstraints')
    if (!legal) {
      const xlinkHref =
        rc.getAttributeNS(NS.xlink, 'href') || rc.getAttribute('xlink:href') || rc.getAttribute('href') || ''
      if (xlinkHref.trim()) {
        const pk = inferLicensePresetFromDocucompHref(xlinkHref)
        if (pk) out.dataLicensePreset = pk
      }
      continue
    }
    const ac = cn3(legal, NS3.mco, 'accessConstraints')
    if (ac) {
      const code = cn3(ac, NS3.mco, 'MD_RestrictionCode')
      if (code) {
        out.accessConstraintsCode = code.getAttribute('codeListValue') || ''
        out.accessConstraints = txt(code) || out.accessConstraintsCode
      }
    }
    const useLim3 = gcs3(cn3(legal, NS3.mco, 'useLimitation')) || ''
    if (useLim3 && !/^(otherrestrictions|other restrictions)$/i.test(useLim3.trim())) {
      if (!out.citeAs) out.citeAs = useLim3
    }
    const proseOthers = []
    for (const c of legal.children || []) {
      if (c.localName !== 'otherConstraints') continue
      const s = gcs3(c)
      if (!s) continue
      if (s.startsWith('Data license: ')) {
        out.licenseUrl = s.slice('Data license: '.length).trim()
        out.dataLicensePreset = 'custom'
        continue
      }
      proseOthers.push(s)
    }
    if (proseOthers[0]) out.distributionLiability = proseOthers[0]
    if (proseOthers[1]) out.otherCiteAs = proseOthers[1]
  }

  const licenseBlob3 = [out.citeAs, out.distributionLiability, out.otherCiteAs].filter(Boolean).join('\n\n')
  const guessed3 = inferDataLicensePresetFromProse(licenseBlob3)
  if (!out.dataLicensePreset && guessed3.preset) out.dataLicensePreset = guessed3.preset
  if (!out.licenseUrl && guessed3.licenseUrl) out.licenseUrl = guessed3.licenseUrl
  if (!out.distributionLicense && guessed3.distributionLicense) out.distributionLicense = guessed3.distributionLicense

  return out
}

/** @param {Element} ex `gex:EX_Extent` */
function parseExtentSingle3(ex) {
  const out = {
    west: '',
    east: '',
    south: '',
    north: '',
    vmin: '',
    vmax: '',
    geographicDescription: '',
    verticalCrsUrl: '',
    startDate: '',
    endDate: '',
    temporalExtentIntervalUnit: '',
    temporalExtentIntervalValue: '',
    hasTrajectory: false,
    trajectorySampling: '',
  }
  for (const dw of cns3(ex, NS3.gex, 'description')) {
    const s = gcs3(dw)
    if (!s) continue
    if (s.startsWith('Vertical CRS: ')) {
      if (!out.verticalCrsUrl) out.verticalCrsUrl = s.slice('Vertical CRS: '.length).trim()
    } else if (s.startsWith('Trajectory sampling: ')) {
      out.hasTrajectory = true
      if (!out.trajectorySampling) out.trajectorySampling = s.slice('Trajectory sampling: '.length).trim()
    } else if (!out.geographicDescription) {
      out.geographicDescription = s
    }
  }
  for (const ge of cns3(ex, NS3.gex, 'geographicElement')) {
    const bbox = cn3(ge, NS3.gex, 'EX_GeographicBoundingBox')
    if (!bbox) continue
    if (!out.west) out.west = gcoDecimal3(cn3(bbox, NS3.gex, 'westBoundLongitude'))
    if (!out.east) out.east = gcoDecimal3(cn3(bbox, NS3.gex, 'eastBoundLongitude'))
    if (!out.south) out.south = gcoDecimal3(cn3(bbox, NS3.gex, 'southBoundLatitude'))
    if (!out.north) out.north = gcoDecimal3(cn3(bbox, NS3.gex, 'northBoundLatitude'))
  }
  for (const ve of cns3(ex, NS3.gex, 'verticalElement')) {
    const vx = cn3(ve, NS3.gex, 'EX_VerticalExtent')
    if (!vx) continue
    const lo = gcoDecimal3(cn3(vx, NS3.gex, 'minimumValue'))
    const hi = gcoDecimal3(cn3(vx, NS3.gex, 'maximumValue'))
    if (lo || hi) {
      out.vmin = lo
      out.vmax = hi
      break
    }
  }
  const instantSeries = []
  for (const te of cns3(ex, NS3.gex, 'temporalElement')) {
    const ste = cn3(te, NS3.gex, 'EX_SpatialTemporalExtent')
    if (ste) {
      const innerS = cn3(ste, NS3.gex, 'extent')
      if (innerS) {
        const ti0 = childLocal(innerS, 'TimeInstant')
        if (ti0) {
          const pos =
            txt(childNS(ti0, NS.gml, 'timePosition')) ||
            txt(childLocal(ti0, 'timePosition'))
          const p = pos.trim()
          if (p) instantSeries.push(p)
        }
        const tpS = childLocal(innerS, 'TimePeriod')
        if (tpS) {
          const begin =
            txt(childNS(tpS, NS.gml, 'beginPosition')) ||
            txt(childLocal(tpS, 'beginPosition')) ||
            txt(childNS(tpS, NS.gml, 'begin')) ||
            txt(childLocal(tpS, 'begin'))
          if (begin && !out.startDate) out.startDate = begin.trim()
          let endTxt =
            txt(childNS(tpS, NS.gml, 'end')) ||
            txt(childLocal(tpS, 'end')) ||
            ''
          endTxt = String(endTxt).trim()
          const endPosEl = childNS(tpS, NS.gml, 'endPosition') || childLocal(tpS, 'endPosition')
          const resolved = normalizeTemporalExtentEndText(endTxt, begin, endPosEl)
          if (resolved && !out.endDate) out.endDate = resolved
          const ti = childNS(tpS, NS.gml, 'timeInterval') || childLocal(tpS, 'timeInterval')
          if (ti && !out.temporalExtentIntervalValue) {
            out.temporalExtentIntervalUnit = ti.getAttribute('unit') || ti.getAttributeNS(NS.gml, 'unit') || ''
            out.temporalExtentIntervalValue = txt(ti)
          }
        }
      }
    }

    const ext = cn3(te, NS3.gex, 'EX_TemporalExtent')
    const inner = ext ? cn3(ext, NS3.gex, 'extent') : null
    const tp = inner ? childLocal(inner, 'TimePeriod') : null
    if (inner) {
      const ti1 = childLocal(inner, 'TimeInstant')
      if (ti1) {
        const pos =
          txt(childNS(ti1, NS.gml, 'timePosition')) ||
          txt(childLocal(ti1, 'timePosition'))
        const p = pos.trim()
        if (p) instantSeries.push(p)
      }
    }
    if (!tp) continue
    const begin =
      txt(childNS(tp, NS.gml, 'beginPosition')) ||
      txt(childLocal(tp, 'beginPosition')) ||
      txt(childNS(tp, NS.gml, 'begin')) ||
      txt(childLocal(tp, 'begin'))
    if (begin && !out.startDate) out.startDate = begin.trim()
    let endTxt =
      txt(childNS(tp, NS.gml, 'end')) ||
      txt(childLocal(tp, 'end')) ||
      ''
    endTxt = String(endTxt).trim()
    const endPosEl = childNS(tp, NS.gml, 'endPosition') || childLocal(tp, 'endPosition')
    const resolved = normalizeTemporalExtentEndText(endTxt, begin, endPosEl)
    if (resolved && !out.endDate) out.endDate = resolved
    const ti = childNS(tp, NS.gml, 'timeInterval') || childLocal(tp, 'timeInterval')
    if (ti && !out.temporalExtentIntervalValue) {
      out.temporalExtentIntervalUnit = ti.getAttribute('unit') || ti.getAttributeNS(NS.gml, 'unit') || ''
      out.temporalExtentIntervalValue = txt(ti)
    }
  }
  if (!out.startDate && instantSeries[0]) out.startDate = instantSeries[0]
  if (!out.endDate && instantSeries[1]) out.endDate = instantSeries[1]
  swapWestEastIfReversed(out, undefined, undefined)
  swapSouthNorthIfReversed(out, undefined, undefined)
  return out
}

/** @param {Element | null} dataId */
function parseExtent3(dataId) {
  const empty = {
    west: '',
    east: '',
    south: '',
    north: '',
    vmin: '',
    vmax: '',
    geographicDescription: '',
    verticalCrsUrl: '',
    startDate: '',
    endDate: '',
    temporalExtentIntervalUnit: '',
    temporalExtentIntervalValue: '',
    hasTrajectory: false,
    trajectorySampling: '',
  }
  if (!dataId) return empty
  const parts = []
  for (const ew of cns3(dataId, NS3.mri, 'extent')) {
    const ex = cn3(ew, NS3.gex, 'EX_Extent')
    if (!ex) continue
    parts.push(parseExtentSingle3(ex))
  }
  return /** @type {typeof empty} */ (mergeExtentPartials(parts, empty))
}

/** @param {Element} root */
function parseDataQuality3(root) {
  const out = { accuracyStandard: '', accuracyValue: '', errorLevel: '', errorValue: '', lineageStatement: '', lineageProcessSteps: '' }
  const SWE = 'http://www.opengis.net/swe/2.0'
  /**
   * @param {Element | null} block
   * @returns {{ label: string, value: string }}
   */
  function sweQuantityFromMdqBlock(block) {
    const empty = { label: '', value: '' }
    if (!block) return empty
    const qr = cn3(cn3(block, NS3.mdq, 'result'), NS3.mdq, 'DQ_QuantitativeResult')
    if (!qr) return empty
    const rec = cn3(cn3(qr, NS3.mdq, 'value'), NS3.gco, 'Record')
    const qty = rec ? childNS(rec, SWE, 'Quantity') || childLocal(rec, 'Quantity') : null
    const label = qty ? txt(childNS(qty, SWE, 'label') || childLocal(qty, 'label')) : ''
    const val = qty ? txt(childNS(qty, SWE, 'value') || childLocal(qty, 'value')) : ''
    return { label, value: val }
  }
  for (const dqi of cns3(root, NS3.mdb, 'dataQualityInfo')) {
    const dq = cn3(dqi, NS3.mdq, 'DQ_DataQuality')
    if (!dq) continue
    for (const rep of cns3(dq, NS3.mdq, 'report')) {
      const qAttr = cn3(rep, NS3.mdq, 'DQ_QuantitativeAttributeAccuracy')
      const gridAcc = cn3(rep, NS3.mdq, 'DQ_GriddedDataPositionalAccuracy')
      const posAcc = cn3(rep, NS3.mdq, 'DQ_AbsoluteExternalPositionalAccuracy')
      const relAcc = cn3(rep, NS3.mdq, 'DQ_RelativeInternalPositionalAccuracy')

      const accBlock = qAttr || gridAcc
      if (accBlock) {
        const { label, value } = sweQuantityFromMdqBlock(accBlock)
        if (!out.accuracyStandard) out.accuracyStandard = label
        if (!out.accuracyValue) out.accuracyValue = value
      }
      const errBlock = posAcc || relAcc
      if (errBlock) {
        const { label, value } = sweQuantityFromMdqBlock(errBlock)
        if (!out.errorLevel) out.errorLevel = label
        if (!out.errorValue) out.errorValue = value
      }
    }
  }
  return out
}

/** @param {Element} root */
function parseReferenceSystem3(root) {
  const rsi = cn3(root, NS3.mdb, 'referenceSystemInfo')
  const rs = rsi ? cn3(rsi, NS3.mrs, 'MD_ReferenceSystem') : null
  const idf = rs ? cn3(cn3(rs, NS3.mrs, 'referenceSystemIdentifier'), NS3.mcc, 'MD_Identifier') : null
  return { referenceSystem: idf ? gcs3(cn3(idf, NS3.mcc, 'code')) : '' }
}

/** @param {Element} root */
function parseSpatialRepresentation3(root) {
  const out = { useGridRepresentation: false, gridCellGeometry: '', gridColumnSize: '', gridColumnResolution: '', gridRowSize: '', gridRowResolution: '', gridVerticalSize: '', gridVerticalResolution: '', dimensions: '' }
  for (const sri of cns3(root, NS3.mdb, 'spatialRepresentationInfo')) {
    const geo = cn3(sri, NS3.msr, 'MD_Georectified')
    if (geo) {
      const dimsWrap = cn3(geo, NS3.msr, 'numberOfDimensions')
      if (dimsWrap) {
        const intEl = cn3(dimsWrap, NS3.gco, 'Integer')
        if (intEl) out.dimensions = txt(intEl)
      }
      const cg = cn3(cn3(geo, NS3.msr, 'cellGeometry'), NS3.msr, 'MD_CellGeometryCode')
      if (cg) out.gridCellGeometry = cg.getAttribute('codeListValue') || txt(cg)
      continue
    }
    const grid = cn3(sri, NS3.msr, 'MD_GridSpatialRepresentation')
    if (grid) {
      const cg = cn3(cn3(grid, NS3.msr, 'cellGeometry'), NS3.msr, 'MD_CellGeometryCode')
      if (cg) out.gridCellGeometry = cg.getAttribute('codeListValue') || txt(cg)
      for (const ax of cns3(grid, NS3.msr, 'axisDimensionProperties')) {
        const dim = cn3(ax, NS3.msr, 'MD_Dimension')
        if (!dim) continue
        const nameCode = cn3(cn3(dim, NS3.msr, 'dimensionName'), NS3.msr, 'MD_DimensionNameTypeCode')
        const axis = (nameCode?.getAttribute('codeListValue') || txt(nameCode)).toLowerCase()
        const size = stripUxTemplateBraces(gcoInteger3(cn3(dim, NS3.msr, 'dimensionSize'))).trim()
        const resWrap = cn3(dim, NS3.msr, 'resolution')
        const res = stripUxTemplateBraces(resWrap ? gcs3(resWrap) : '').trim()
        if (axis === 'column') {
          out.gridColumnSize = size
          out.gridColumnResolution = res
        } else if (axis === 'row') {
          out.gridRowSize = size
          out.gridRowResolution = res
        } else if (axis === 'vertical') {
          out.gridVerticalSize = size
          out.gridVerticalResolution = res
        }
      }
      out.useGridRepresentation = !!(String(out.gridColumnSize || '').trim() && String(out.gridRowSize || '').trim())
    }
  }
  return out
}

/** @param {Element} root */
function parseMetadataStandard3(root) {
  const wrap = cn3(root, NS3.mdb, 'metadataStandard')
  const cite = wrap ? cn3(wrap, NS3.cit, 'CI_Citation') : null
  return {
    metadataStandard: cite ? gcs3(cn3(cite, NS3.cit, 'title')) : '',
    metadataVersion: cite ? gcs3(cn3(cite, NS3.cit, 'edition')) : '',
  }
}

/**
 * ISO 19115-3 `mri:keyword` may wrap text in `gco:CharacterString` or `gmx:Anchor` (GCMD concepts).
 * @param {Element | null} kw
 */
function keywordLabelUuidFromMriKeyword(kw) {
  if (!kw) return { label: '', uuid: '' }
  for (const c of kw.children) {
    if (c.localName === 'Anchor') {
      const href = c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || ''
      const label =
        txt(c).trim() ||
        (c.getAttributeNS(NS.xlink, 'title') || c.getAttribute('xlink:title') || '').trim()
      return {
        label: label || keywordUuidFromConceptHref(href) || href,
        uuid: keywordUuidFromConceptHref(href),
      }
    }
  }
  const lab = stripUxTemplateBraces(gcs3(kw)).trim() || txt(kw).trim()
  if (/^https?:\/\//i.test(lab)) {
    const u = keywordUuidFromConceptHref(lab)
    if (u && KMS_UUID_INLINE_RE.test(u)) {
      const pathPart = lab.split(/[?#]/)[0]
      const tail = pathPart.split('/').filter(Boolean).pop() || lab
      return { label: tail, uuid: u }
    }
  }
  return { label: lab, uuid: '' }
}

/**
 * ISO 19115-3 `lan:PT_Locale` → language + character set strings.
 * @param {Element | null} locale
 */
function parseLocaleLanguageCharsetFromPtLocale3(locale) {
  if (!locale) return { language: '', characterSet: '' }
  const langEl = cn3(cn3(locale, NS3.lan, 'language'), NS3.lan, 'LanguageCode')
  let language = langEl ? langEl.getAttribute('codeListValue') || txt(langEl) : ''
  language = String(language || '').trim()
  const csEl = cn3(cn3(locale, NS3.lan, 'characterEncoding'), NS3.lan, 'MD_CharacterSetCode')
  let characterSet = csEl ? csEl.getAttribute('codeListValue') || txt(csEl) : ''
  characterSet = String(characterSet || '').trim()
  return { language, characterSet }
}

/** Resource locale from identification when root `mdb:defaultLocale` is empty. */
function parseIdentificationLocale3(dataId) {
  if (!dataId) return { language: '', characterSet: '' }
  const locWrap = cn3(dataId, NS3.mri, 'defaultLocale')
  const locale = locWrap ? cn3(locWrap, NS3.lan, 'PT_Locale') : null
  return parseLocaleLanguageCharsetFromPtLocale3(locale)
}

/** @param {Element | null} dataId */
function parseTopicCategories3(dataId) {
  if (!dataId) return []
  const out = []
  for (const tc of cns3(dataId, NS3.mri, 'topicCategory')) {
    const code = cn3(tc, NS3.mcc, 'MD_TopicCategoryCode')
    let v = (code?.getAttribute('codeListValue') || txt(code) || '').trim()
    if (!v && code) v = String(gcs3(code) || '').trim()
    if (!v) v = String(gcs3(tc) || '').trim()
    if (!v) v = txt(tc).trim()
    if (v) out.push(v)
  }
  return out
}

/**
 * Maintenance frequency + browse-graphic URL from ISO 19115-3 identification.
 * @param {Element | null} dataId `mri:MD_DataIdentification`
 */
function parseIdentificationMaintenanceGraphic3(dataId) {
  const out = {
    metadataMaintenanceFrequency: '',
    graphicOverviewHref: '',
    graphicOverviewTitle: '',
  }
  if (!dataId) return out
  const rm = cn3(dataId, NS3.mri, 'resourceMaintenance')
  const mi = rm ? cn3(rm, NS3.mmi, 'MD_MaintenanceInformation') : null
  if (mi) {
    const freq = cn3(cn3(mi, NS3.mmi, 'maintenanceAndUpdateFrequency'), NS3.mcc, 'MD_MaintenanceFrequencyCode')
    const fv = (freq?.getAttribute('codeListValue') || txt(freq) || '').trim()
    if (fv) out.metadataMaintenanceFrequency = fv
  }
  for (const go of cns3(dataId, NS3.mri, 'graphicOverview')) {
    const bg = cn3(go, NS3.mcc, 'MD_BrowseGraphic')
    const href = (
      go.getAttributeNS(NS.xlink, 'href') ||
      go.getAttribute('xlink:href') ||
      (bg ? bg.getAttributeNS(NS.xlink, 'href') || bg.getAttribute('xlink:href') : '') ||
      ''
    ).trim()
    if (href) {
      out.graphicOverviewHref = href
      out.graphicOverviewTitle = (
        go.getAttributeNS(NS.xlink, 'title') ||
        go.getAttribute('xlink:title') ||
        (bg ? bg.getAttributeNS(NS.xlink, 'title') || bg.getAttribute('xlink:title') : '') ||
        ''
      ).trim()
      break
    }
    if (bg) {
      const fileName = cn3(bg, NS3.mcc, 'fileName')
      const online = fileName ? cn3(fileName, NS3.cit, 'CI_OnlineResource') : null
      if (online) {
        const url = citLinkageUrl(cn3(online, NS3.cit, 'linkage'))
        if (url) {
          out.graphicOverviewHref = stripUxTemplateBraces(url)
          out.graphicOverviewTitle = gcs3(cn3(online, NS3.cit, 'name'))
          break
        }
      }
      if (fileName && !out.graphicOverviewHref) {
        let plain = gcs3(fileName).trim()
        if (!/^https?:\/\//i.test(plain)) {
          for (const c of fileName.children || []) {
            if (c.localName === 'Anchor' && (c.namespaceURI === NS.gmx || !c.namespaceURI)) {
              const u = (c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || '').trim()
              if (/^https?:\/\//i.test(u)) {
                plain = u
                break
              }
              const t = txt(c).trim()
              if (/^https?:\/\//i.test(t)) {
                plain = t
                break
              }
            }
          }
        }
        if (/^https?:\/\//i.test(plain)) {
          out.graphicOverviewHref = stripUxTemplateBraces(plain)
          const fd = cn3(bg, NS3.mcc, 'fileDescription')
          if (fd) out.graphicOverviewTitle = gcs3(fd).trim()
          break
        }
      }
    }
  }
  return out
}

/** Root-level metadata contact xlink (ISO 19115-3 `mdb:contact`). */
function parseRootMetadataContact3(root) {
  const out = {
    nceiMetadataContactHref: '',
    nceiMetadataContactTitle: '',
    useNceiMetadataContactXlink: false,
  }
  for (const c of cns3(root, NS3.mdb, 'contact')) {
    const href = c.getAttributeNS(NS.xlink, 'href') || c.getAttribute('xlink:href') || ''
    if (!href.trim()) continue
    out.nceiMetadataContactHref = href.trim()
    out.nceiMetadataContactTitle = (
      c.getAttributeNS(NS.xlink, 'title') ||
      c.getAttribute('xlink:title') ||
      'NCEI (pointOfContact)'
    ).trim()
    out.useNceiMetadataContactXlink = true
    break
  }
  return out
}

/** @param {Element | null} dataId */
function parseKeywords3(dataId) {
  /** @type {Record<string, Array<{ label: string, uuid: string }>>} */
  const facets = {}
  if (!dataId) return facets
  for (const dk of cns3(dataId, NS3.mri, 'descriptiveKeywords')) {
    const mk = cn3(dk, NS3.mri, 'MD_Keywords')
    if (!mk) continue
    const facet = facetFromMriKeywordsBlock(mk, dk)
    if (!facet) continue
    const labels = []
    for (const kw of cns3(mk, NS3.mri, 'keyword')) {
      const { label: kwLab, uuid } = keywordLabelUuidFromMriKeyword(kw)
      const lab = stripUxTemplateBraces(kwLab).trim()
      if (lab) labels.push({ label: lab, uuid: uuid || '' })
    }
    if (labels.length) {
      if (!facets[facet]) facets[facet] = []
      facets[facet].push(...labels)
    }
  }
  if (facets.datacenters?.length && !facets.providers?.length) {
    facets.providers = facets.datacenters.map((row) => ({ ...row }))
  }
  return facets
}

/** @param {Element} root */
function parseAcquisition3(root) {
  const acqi = cn3(root, NS3.mdb, 'acquisitionInformation')
  const mia = acqi ? cn3(acqi, NS3.mac, 'MI_AcquisitionInformation') : null
  if (!mia) return { platform: null, sensors: null }

  /** @type {Record<string, string>} */
  const platformOut = {}
  /** @type {Element | null} */
  let miPlat = null
  const xlinkTitles = []
  const xlinkHrefs = []
  for (const platWrap of cns3(mia, NS3.mac, 'platform')) {
    const mp = cn3(platWrap, NS3.mac, 'MI_Platform')
    if (mp && !miPlat) miPlat = mp
    const title = (platWrap.getAttributeNS(NS.xlink, 'title') || platWrap.getAttribute('xlink:title') || '').trim()
    const href = (platWrap.getAttributeNS(NS.xlink, 'href') || platWrap.getAttribute('xlink:href') || '').trim()
    if (title) xlinkTitles.push(title)
    if (href) xlinkHrefs.push(href)
  }
  if (miPlat) {
    const idw = cn3(miPlat, NS3.mac, 'identifier')
    const mid = idw ? cn3(idw, NS3.mcc, 'MD_Identifier') : null
    const pid = mid ? gcs3(cn3(mid, NS3.mcc, 'code')) : ''
    if (pid) platformOut.platformId = pid
    const desc = gcs3(cn3(miPlat, NS3.mac, 'description'))
    if (desc) platformOut.platformDesc = desc
    const sponsor = cn3(miPlat, NS3.mac, 'sponsor')
    const resp = sponsor ? cn3(sponsor, NS3.cit, 'CI_Responsibility') : null
    if (resp) {
      const p = parseCI_Responsibility3(resp)
      if (p.organisationName) platformOut.manufacturer = p.organisationName
    }
  }
  if (!String(platformOut.platformDesc || '').trim() && xlinkTitles.length) {
    platformOut.platformDesc = xlinkTitles[0]
  }
  if (!String(platformOut.platformId || '').trim()) {
    const href0 = xlinkHrefs[0] || ''
    const tail = href0.split('/').filter(Boolean).pop() || ''
    const idFromHref = tail.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128)
    if (idFromHref) platformOut.platformId = idFromHref
    else if (xlinkTitles[0]) {
      platformOut.platformId = xlinkTitles[0].replace(/[^\w\s-]+/g, '').replace(/\s+/g, '_').slice(0, 128)
    }
  }

  /**
   * Parse one mac:MI_Instrument element into a sensor row.
   * @param {Element} mi
   */
  function parseInst3(mi) {
    const idw = cn3(mi, NS3.mac, 'identifier')
    const mid = idw ? cn3(idw, NS3.mcc, 'MD_Identifier') : null
    const sid = mid ? gcs3(cn3(mid, NS3.mcc, 'code')) : ''
    const stype = gcs3(cn3(mi, NS3.mac, 'type'))
    const descr = gcs3(cn3(mi, NS3.mac, 'description'))
    const parsed = parseInstrumentDescriptionBlock(descr)
    const typeStr = String(stype || '').trim()
    const descrRaw = String(descr || '').trim()
    let variableOut = typeStr
    if (!variableOut) {
      const pv = String(parsed.variable || '').trim()
      if (pv && !/manufacturer:|model:|s\/n:/i.test(pv)) variableOut = pv
    }
    let row = {
      sensorId: sid,
      modelId: sid,
      type: stype,
      variable: variableOut,
      description: descrRaw,
      firmware: parsed.firmware,
      operationMode: parsed.operationMode,
      uncertainty: parsed.uncertainty,
      frequency: parsed.frequency,
      beamCount: parsed.beamCount,
      depthRating: parsed.depthRating,
      confidenceInterval: parsed.confidenceInterval,
    }
    row = normalizeSensorInstrumentIds(row)
    return row
  }

  const sensorRows = []
  const seenSensors = new Set()

  // Instruments nested inside the platform (MDBC/AUV pattern)
  if (miPlat) {
    for (const instWrap of cns3(miPlat, NS3.mac, 'instrument')) {
      const mi = cn3(instWrap, NS3.mac, 'MI_Instrument')
      if (!mi) continue
      const row = parseInst3(mi)
      if (acquisitionInstrumentHasContent(row)) addSensorRowDeduped(sensorRows, seenSensors, row)
    }
  }

  // Instruments as direct children of MI_AcquisitionInformation (EN2501/REMUS pattern)
  for (const instWrap of cns3(mia, NS3.mac, 'instrument')) {
    const mi = cn3(instWrap, NS3.mac, 'MI_Instrument')
    if (!mi) continue
    const row = parseInst3(mi)
    if (acquisitionInstrumentHasContent(row)) addSensorRowDeduped(sensorRows, seenSensors, row)
  }

  return {
    platform: Object.keys(platformOut).length ? platformOut : null,
    sensors: sensorRows.length ? sensorRows : null,
  }
}

/**
 * Full extraction path for ISO 19115-3 documents.
 * @param {Element} root
 * @param {string} raw
 * @param {string[]} warnings
 */
function extractFrom19115_3(root, raw, warnings) {
  const dataId = dataId3(root)
  if (!dataId) warnings.push('No mri:MD_DataIdentification; mission fields may be incomplete.')

  // File identifier: mdb:metadataIdentifier/mcc:MD_Identifier/mcc:code
  const metaIdWrap = cn3(root, NS3.mdb, 'metadataIdentifier')
  const metaIdMid = metaIdWrap ? cn3(metaIdWrap, NS3.mcc, 'MD_Identifier') : null
  const fiRaw = metaIdMid ? stripUxTemplateBraces(gcs3(cn3(metaIdMid, NS3.mcc, 'code'))).trim() : ''
  const { fileId, hadNceiUxsPrefix } = parseNceiUxsFileIdentifier(fiRaw)

  // Scope: mdb:metadataScope/mdb:MD_MetadataScope/mdb:resourceScope/mcc:MD_ScopeCode
  const scopeMs = cn3(cn3(root, NS3.mdb, 'metadataScope'), NS3.mdb, 'MD_MetadataScope')
  const scopeEl = scopeMs ? cn3(cn3(scopeMs, NS3.mdb, 'resourceScope'), NS3.mcc, 'MD_ScopeCode') : null
  const scopeCode = scopeEl ? (scopeEl.getAttribute('codeListValue') || txt(scopeEl)) : ''

  // Metadata record date: mdb:dateInfo/cit:CI_Date[dateType=creation]
  let metadataRecordDate = ''
  for (const di of cns3(root, NS3.mdb, 'dateInfo')) {
    const ci = cn3(di, NS3.cit, 'CI_Date')
    if (!ci) continue
    const code = cn3(cn3(ci, NS3.cit, 'dateType'), NS3.cit, 'CI_DateTypeCode')
    if ((code?.getAttribute('codeListValue') || '').toLowerCase().includes('creation')) {
      const dt = cn3(ci, NS3.cit, 'date')
      const el = dt ? childLocal(dt, 'Date') || childLocal(dt, 'DateTime') : null
      if (el) { metadataRecordDate = txt(el); break }
    }
  }

  // Language / characterSet: mdb:defaultLocale/lan:PT_Locale; fill gaps from mri:defaultLocale on identification
  const rootLocale = cn3(cn3(root, NS3.mdb, 'defaultLocale'), NS3.lan, 'PT_Locale')
  let { language, characterSet } = parseLocaleLanguageCharsetFromPtLocale3(rootLocale)
  if (!language || !characterSet) {
    const idLoc = parseIdentificationLocale3(dataId)
    if (!language && idLoc.language) language = idLoc.language
    if (!characterSet && idLoc.characterSet) characterSet = idLoc.characterSet
  }

  // Citation
  const citWrap = dataId ? cn3(dataId, NS3.mri, 'citation') : null
  const cite = citWrap ? cn3(citWrap, NS3.cit, 'CI_Citation') : null
  const title = cite ? gcs3(cn3(cite, NS3.cit, 'title')) : ''
  const alternateTitle = cite ? gcs3(cn3(cite, NS3.cit, 'alternateTitle')) : ''
  const cdates = citationDates3(cite)
  const ids = citationIdentifiers3(cite)

  // Description fields
  const abstract = dataId ? gcs3(cn3(dataId, NS3.mri, 'abstract')) : ''
  const purposeEl = dataId ? cn3(dataId, NS3.mri, 'purpose') : null
  const purpose = purposeEl
    ? stripUxTemplateBraces(mccAnchorOrText(purposeEl) || gcs3(purposeEl)).trim()
    : ''
  const supplementalInformation = dataId ? gcs3(cn3(dataId, NS3.mri, 'supplementalInformation')) : ''

  // Status: try mri:status first, fall back to mac:MI_Operation/mac:status
  const stEl = dataId ? cn3(cn3(dataId, NS3.mri, 'status'), NS3.mcc, 'MD_ProgressCode') : null
  let status = stEl ? (stEl.getAttribute('codeListValue') || txt(stEl)) : ''

  // Dates / status fallback from mac:MI_Operation when not in identification section
  let macStartDate = ''
  let macEndDate = ''
  let macStatus = ''
  const acqiWrap = cn3(root, NS3.mdb, 'acquisitionInformation')
  const miaEl = acqiWrap ? cn3(acqiWrap, NS3.mac, 'MI_AcquisitionInformation') : null
  if (miaEl) {
    for (const opWrap of cns3(miaEl, NS3.mac, 'operation')) {
      const op = cn3(opWrap, NS3.mac, 'MI_Operation')
      if (!op) continue
      if (!macStatus) {
        const sc = cn3(cn3(op, NS3.mac, 'status'), NS3.mcc, 'MD_ProgressCode')
        macStatus = sc ? (sc.getAttribute('codeListValue') || txt(sc)) : ''
      }
      for (const evWrap of cns3(op, NS3.mac, 'significantEvent')) {
        const ev = cn3(evWrap, NS3.mac, 'MI_Event')
        if (!ev) continue
        const seqEl = cn3(cn3(ev, NS3.mac, 'sequence'), NS3.mac, 'MI_SequenceCode')
        const seq = seqEl ? (seqEl.getAttribute('codeListValue') || txt(seqEl)).toLowerCase() : ''
        const timeEl = cn3(ev, NS3.mac, 'time')
        const dt = timeEl ? childLocal(timeEl, 'DateTime') || childLocal(timeEl, 'Date') : null
        const dateStr = dt ? txt(dt) : ''
        if (seq === 'start' && !macStartDate) macStartDate = dateStr
        else if (seq === 'end' && !macEndDate) macEndDate = dateStr
        else if (!macStartDate && dateStr) macStartDate = dateStr
      }
      break
    }
  }
  if (!status) status = macStatus

  const poc = merge19115_3PointOfContactWithRootContact(parsePointOfContact3(dataId), root)
  const legal = parseConstraints3(dataId)
  const ext = parseExtent3(dataId)
  const dq = parseDataQuality3(root)
  const ref = parseReferenceSystem3(root)
  const spr = parseSpatialRepresentation3(root)
  const metaStd = parseMetadataStandard3(root)
  const topicCats = parseTopicCategories3(dataId)
  const idMaintGraphic = parseIdentificationMaintenanceGraphic3(dataId)
  const citeParties = parseCitationParties3(cite)
  const ag = parseAggregations3(dataId)
  const rootContact = parseRootMetadataContact3(root)
  const kw = parseKeywords3(dataId)
  const acqParsed = parseAcquisition3(root)

  const mergedContactUrl =
    String(poc.contactUrl || '').trim() ||
    firstCitationOnlineLinkageUrl(cite) ||
    firstRootContactOnlineLinkageUrl(root)

  const supParsed19115 = parseUxsPilotMachineBlockFromSupplemental(stripUxTemplateBraces(supplementalInformation))
  const missionFields = {
    fileId,
    title: stripUxTemplateBraces(title),
    alternateTitle: stripUxTemplateBraces(alternateTitle),
    abstract: stripUxTemplateBraces(abstract),
    purpose: stripUxTemplateBraces(purpose),
    supplementalInformation: supParsed19115.userSupplemental,
    startDate: ext.startDate || cdates.startDate || macStartDate,
    endDate: ext.endDate || cdates.endDate || macEndDate,
    publicationDate: cdates.publicationDate,
    metadataRecordDate: metadataRecordDate || undefined,
    language,
    characterSet,
    status,
    ...(scopeCode ? { scopeCode } : {}),
    doi: ids.doi,
    accession: ids.accession,
    org: poc.organisationName,
    individualName: poc.individualName,
    email: poc.email,
    contactPhone: poc.contactPhone,
    contactUrl: mergedContactUrl,
    contactAddress: poc.contactAddress,
    west: ext.west,
    east: ext.east,
    south: ext.south,
    north: ext.north,
    vmin: ext.vmin,
    vmax: ext.vmax,
    citeAs: legal.citeAs,
    otherCiteAs: legal.otherCiteAs,
    accessConstraints: legal.accessConstraints,
    ...(legal.accessConstraintsCode ? { accessConstraintsCode: legal.accessConstraintsCode } : {}),
    distributionLiability: legal.distributionLiability,
    ...ag,
    ...citeParties,
  }
  if (legal.dataLicensePreset) missionFields.dataLicensePreset = legal.dataLicensePreset
  if (legal.licenseUrl) missionFields.licenseUrl = legal.licenseUrl
  if (topicCats.length) missionFields.topicCategories = topicCats
  if (idMaintGraphic.graphicOverviewHref) {
    missionFields.graphicOverviewHref = idMaintGraphic.graphicOverviewHref
    if (idMaintGraphic.graphicOverviewTitle) missionFields.graphicOverviewTitle = idMaintGraphic.graphicOverviewTitle
  }
  const pickInd3 =
    citeParties.citationAuthorIndividualName ||
    citeParties.citationOriginatorIndividualName ||
    citeParties.citationPrincipalInvestigatorIndividualName ||
    citeParties.citationResourceProviderIndividualName ||
    ''
  const pickOrg3 =
    citeParties.citationPublisherOrganisationName ||
    citeParties.citationAuthorOrganisationName ||
    citeParties.citationOriginatorOrganisationName ||
    ''
  if (!String(missionFields.individualName || '').trim() && pickInd3) {
    missionFields.individualName = pickInd3
  }
  if (!String(missionFields.org || '').trim() && pickOrg3) {
    missionFields.org = pickOrg3
  }
  if (!String(missionFields.org || '').trim()) {
    const rootOrg = firstRootContactOrganisation3(root)
    if (rootOrg) missionFields.org = rootOrg
  }
  if (supParsed19115.uxsPatch) missionFields.uxsContext = supParsed19115.uxsPatch
  const mission = pruneObject(missionFields)

  const spatial = pruneObject({
    referenceSystem: ref.referenceSystem,
    geographicDescription: ext.geographicDescription,
    verticalCrsUrl: ext.verticalCrsUrl,
    hasTrajectory: ext.hasTrajectory,
    trajectorySampling: ext.trajectorySampling,
    west: ext.west,
    east: ext.east,
    south: ext.south,
    north: ext.north,
    accuracyStandard: dq.accuracyStandard,
    accuracyValue: dq.accuracyValue,
    errorLevel: dq.errorLevel,
    errorValue: dq.errorValue,
    useGridRepresentation: spr.useGridRepresentation,
    gridCellGeometry: spr.gridCellGeometry,
    gridColumnSize: spr.gridColumnSize,
    gridColumnResolution: spr.gridColumnResolution,
    gridRowSize: spr.gridRowSize,
    gridRowResolution: spr.gridRowResolution,
    gridVerticalSize: spr.gridVerticalSize,
    gridVerticalResolution: spr.gridVerticalResolution,
    dimensions: spr.dimensions,
    lineageStatement: dq.lineageStatement,
    lineageProcessSteps: dq.lineageProcessSteps,
  })

  const distRaw = parseDistribution3(root, fileId, fiRaw)
  /** @type {Record<string, unknown>} */
  const distInput = {
    format: distRaw.distributionFormatName,
    distributionFormatName: distRaw.distributionFormatName,
    distributionFileFormat: distRaw.distributionFileFormat,
    metadataLandingUrl: distRaw.metadataLandingUrl,
    metadataLandingLinkName: distRaw.metadataLandingLinkName,
    metadataLandingDescription: distRaw.metadataLandingDescription,
    landingUrl: distRaw.landingUrl,
    downloadUrl: distRaw.downloadUrl,
    downloadProtocol: distRaw.downloadProtocol,
    downloadLinkName: distRaw.downloadLinkName,
    downloadLinkDescription: distRaw.downloadLinkDescription,
    distributionFeesText: distRaw.distributionFeesText,
    distributionOrderingInstructions: distRaw.distributionOrderingInstructions,
    nceiDistributorContactHref: distRaw.nceiDistributorContactHref,
    nceiDistributorContactTitle: distRaw.nceiDistributorContactTitle,
    distributorIndividualName: distRaw.distributorIndividualName,
    distributorOrganisationName: distRaw.distributorOrganisationName,
    distributorEmail: distRaw.distributorEmail,
    distributorContactUrl: distRaw.distributorContactUrl,
  }
  if (rootContact.nceiMetadataContactHref) {
    distInput.nceiMetadataContactHref = rootContact.nceiMetadataContactHref
    distInput.nceiMetadataContactTitle = rootContact.nceiMetadataContactTitle
    distInput.useNceiMetadataContactXlink = rootContact.useNceiMetadataContactXlink
  }
  if (idMaintGraphic.metadataMaintenanceFrequency) {
    distInput.metadataMaintenanceFrequency = idMaintGraphic.metadataMaintenanceFrequency
  }
  if (metaStd.metadataStandard) distInput.metadataStandard = metaStd.metadataStandard
  if (metaStd.metadataVersion) distInput.metadataVersion = metaStd.metadataVersion
  if (hadNceiUxsPrefix) distInput.nceiFileIdPrefix = true
  const citePub = citationPublicationLine3(cite)
  const agPub = [ag.associatedPublicationTitle, ag.associatedPublicationDate, ag.associatedPublicationCode]
    .map((x) => stripUxTemplateBraces(String(x || '')).trim())
    .filter(Boolean)
    .join('; ')
  if (citePub) distInput.publication = citePub
  else if (agPub) distInput.publication = agPub
  if (mission.parentProjectTitle) distInput.parentProject = mission.parentProjectTitle
  if (legal.distributionLicense) distInput.license = legal.distributionLicense
  const distribution = pruneObject(distInput)
  const sensors = acqParsed.sensors || []

  /** @type {Record<string, unknown>} */
  const partial = {}
  if (Object.keys(mission).length) partial.mission = mission
  if (Object.keys(spatial).length) partial.spatial = spatial
  if (Object.keys(kw).length) partial.keywords = kw
  if (sensors.length) partial.sensors = sensors
  // Always ensure distribution exists so forceDistributionMetadataStandard19115_2 can set the canonical standard
  partial.distribution = Object.keys(distribution).length ? distribution : {}
  if (acqParsed.platform && Object.keys(acqParsed.platform).length) {
    partial.platform = pruneObject(/** @type {Record<string, unknown>} */ (acqParsed.platform))
  }

  if (!Object.keys(partial).length) {
    return { ok: false, error: 'No recognizable pilot fields in ISO 19115-3 XML.', warnings }
  }

  deepStripUxTemplatePlaceholders(partial)
  enrichNavyUxPlaceholderImport(partial, raw, warnings)
  applyIsoImportHeuristics(partial, warnings)

  return { ok: true, partial, warnings }
}

/**
 * Parse ISO 19115-ish XML into a partial pilot state for `mergeLoadedPilotState`.
 * Best effort: matches pilot XML preview and common UniversalXMLGenerator output.
 *
 * @param {string} xmlString
 * @returns {{ ok: true, partial: object, warnings: string[] } | { ok: false, error: string, warnings: string[] }}
 */
export function importPilotPartialStateFromXml(xmlString) {
  const warnings = []
  const raw = String(xmlString || '').trim()
  if (!raw) {
    return { ok: false, error: 'Paste XML first.', warnings }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'application/xml')
  const perr = doc.getElementsByTagName('parsererror')
  if (perr.length) {
    return { ok: false, error: 'Could not parse XML (not well-formed).', warnings }
  }

  const root = metadataRoot(doc)
  if (!root) {
    return { ok: false, error: 'No gmd:MD_Metadata or gmi:MI_Metadata element found.', warnings }
  }

  if (is19115_3(root)) {
    const r = extractFrom19115_3(root, raw, warnings)
    if (r.ok && r.partial) stampIsoImportProvenance(r.partial, root)
    return r
  }

  const dataId = dataIdentification(root)
  if (!dataId) {
    warnings.push('No gmd:MD_DataIdentification; mission fields may be incomplete.')
  }

  const cite = dataId ? childNS(childNS(dataId, NS.gmd, 'citation'), NS.gmd, 'CI_Citation') : null
  const ids = citationIdentifiers(cite)
  const cdates = citationDates(cite)

  const ext = mergeExtentsFromDataIdentification(dataId)

  const poc = mergeLegacyPointOfContactWithRootContact(parsePointOfContact(dataId), root)
  const legal = parseResourceConstraintsForMission(dataId)
  const ag = dataId ? parseAggregations(dataId) : {}
  const citeParties = parseCitationParties(cite)
  const topicCats = parseTopicCategories(dataId)
  const idMaintGraphic = parseIdentificationMaintenanceGraphic(dataId)
  const rootContact = parseRootMetadataContact(root)
  const metaStd = parseMetadataStandard(root)
  const acqParsed = parseAcquisitionInfo(root)

  let language = parseIdentificationLanguageGmd(dataId).trim()
  if (!language) language = parseRootLanguageGmd(root).trim()

  let characterSet = parseIdentificationCharacterSetGmd(dataId).trim()
  if (!characterSet) characterSet = parseRootCharacterSetGmd(root).trim()

  const stEl = dataId ? childNS(childNS(dataId, NS.gmd, 'status'), NS.gmd, 'MD_ProgressCode') : null
  const status = stEl?.getAttribute('codeListValue') || txt(stEl)

  const fi = childNS(root, NS.gmd, 'fileIdentifier')
  const fiRaw = fi ? gcoCharacterString(fi) : ''
  const fiStripped = stripUxTemplateBraces(fiRaw).trim()
  const { fileId, hadNceiUxsPrefix } = parseNceiUxsFileIdentifier(fiStripped)

  const dsEl = childNS(root, NS.gmd, 'dateStamp')
  let metadataRecordDate = ''
  if (dsEl) {
    const inner =
      childNS(dsEl, NS.gco, 'Date') ||
      childNS(dsEl, NS.gco, 'DateTime') ||
      childLocal(dsEl, 'Date') ||
      childLocal(dsEl, 'DateTime')
    metadataRecordDate = inner ? txt(inner) : ''
  }

  const hl = childNS(root, NS.gmd, 'hierarchyLevel')
  const scEl = hl ? childNS(hl, NS.gmd, 'MD_ScopeCode') : null
  const scopeFromRoot = scEl ? scEl.getAttribute('codeListValue') || txt(scEl) : ''

  const mergedContactUrl =
    String(poc.contactUrl || '').trim() ||
    firstCitationOnlineLinkageUrl(cite) ||
    firstRootContactOnlineLinkageUrl(root)

  const supParsedGmd = parseUxsPilotMachineBlockFromSupplemental(
    dataId ? stripUxTemplateBraces(gcoCharacterString(childNS(dataId, NS.gmd, 'supplementalInformation'))) : '',
  )
  /** @type {Record<string, unknown>} */
  const missionFields = {
    fileId,
    title: cite ? gmdAnchorOrCharacterString(childNS(cite, NS.gmd, 'title')) : '',
    alternateTitle: cite ? gmdAnchorOrCharacterString(childNS(cite, NS.gmd, 'alternateTitle')) : '',
    abstract: dataId ? gcoCharacterString(childNS(dataId, NS.gmd, 'abstract')) : '',
    purpose: dataId ? gmdAnchorOrCharacterString(childNS(dataId, NS.gmd, 'purpose')) : '',
    supplementalInformation: supParsedGmd.userSupplemental,
    startDate: ext.startDate || cdates.startDate,
    endDate: ext.endDate || cdates.endDate,
    publicationDate: cdates.publicationDate,
    metadataRecordDate: metadataRecordDate || undefined,
    temporalExtentIntervalUnit: ext.temporalExtentIntervalUnit || undefined,
    temporalExtentIntervalValue: ext.temporalExtentIntervalValue || undefined,
    language,
    characterSet,
    status,
    ...(scopeFromRoot ? { scopeCode: scopeFromRoot } : {}),
    doi: ids.doi,
    accession: ids.accession,
    org: poc.organisationName,
    individualName: poc.individualName,
    email: poc.email,
    contactPhone: poc.contactPhone,
    contactUrl: mergedContactUrl,
    contactAddress: poc.contactAddress,
    ...(poc.ror ? { ror: poc.ror } : {}),
    west: ext.west,
    east: ext.east,
    south: ext.south,
    north: ext.north,
    vmin: ext.vmin,
    vmax: ext.vmax,
    citeAs: legal.citeAs,
    otherCiteAs: legal.otherCiteAs,
    accessConstraints: legal.accessConstraints,
    ...(legal.accessConstraintsCode ? { accessConstraintsCode: legal.accessConstraintsCode } : {}),
    distributionLiability: legal.distributionLiability,
    ...ag,
    ...citeParties,
  }
  if (topicCats.length) missionFields.topicCategories = topicCats
  if (idMaintGraphic.graphicOverviewHref) {
    missionFields.graphicOverviewHref = idMaintGraphic.graphicOverviewHref
    if (idMaintGraphic.graphicOverviewTitle) missionFields.graphicOverviewTitle = idMaintGraphic.graphicOverviewTitle
  }
  if (legal.dataLicensePreset) missionFields.dataLicensePreset = legal.dataLicensePreset
  if (legal.licenseUrl) missionFields.licenseUrl = legal.licenseUrl
  const pickInd =
    citeParties.citationAuthorIndividualName ||
    citeParties.citationOriginatorIndividualName ||
    citeParties.citationPrincipalInvestigatorIndividualName ||
    citeParties.citationResourceProviderIndividualName ||
    ''
  const pickOrg =
    citeParties.citationPublisherOrganisationName ||
    citeParties.citationAuthorOrganisationName ||
    citeParties.citationOriginatorOrganisationName ||
    ''
  if (!String(missionFields.individualName || '').trim() && pickInd) {
    missionFields.individualName = pickInd
  }
  if (!String(missionFields.org || '').trim() && pickOrg) {
    missionFields.org = pickOrg
  }
  if (!String(missionFields.org || '').trim()) {
    const rootOrg = firstRootContactOrganisationLegacy(root)
    if (rootOrg) missionFields.org = rootOrg
  }
  if (supParsedGmd.uxsPatch) missionFields.uxsContext = supParsedGmd.uxsPatch
  const mission = pruneObject(missionFields)

  const dq = parseDataQuality(root)
  const ref = parseReferenceSystem(root)
  const spr = parseSpatialRepresentation(root)

  const spatial = pruneObject({
    referenceSystem: ref.referenceSystem,
    geographicDescription: ext.geographicDescription,
    verticalCrsUrl: ext.verticalCrsUrl,
    hasTrajectory: ext.hasTrajectory,
    trajectorySampling: ext.trajectorySampling,
    west: ext.west,
    east: ext.east,
    south: ext.south,
    north: ext.north,
    accuracyStandard: dq.accuracyStandard,
    accuracyValue: dq.accuracyValue,
    errorLevel: dq.errorLevel,
    errorValue: dq.errorValue,
    useGridRepresentation: spr.useGridRepresentation,
    gridCellGeometry: spr.gridCellGeometry,
    gridColumnSize: spr.gridColumnSize,
    gridColumnResolution: spr.gridColumnResolution,
    gridRowSize: spr.gridRowSize,
    gridRowResolution: spr.gridRowResolution,
    gridVerticalSize: spr.gridVerticalSize,
    gridVerticalResolution: spr.gridVerticalResolution,
    dimensions: spr.dimensions,
    lineageStatement: dq.lineageStatement,
    lineageProcessSteps: dq.lineageProcessSteps,
  })

  const kw = parseKeywords(dataId)
  const sensorsFromContent = parseSensors(root)
  const sensors = acqParsed.sensors?.length ? acqParsed.sensors : sensorsFromContent
  const distRaw = parseDistribution(root, fileId, fiStripped)
  /** @type {Record<string, unknown>} */
  const distInput = {
    format: distRaw.distributionFormatName,
    distributionFormatName: distRaw.distributionFormatName,
    distributionFileFormat: distRaw.distributionFileFormat,
    metadataLandingUrl: distRaw.metadataLandingUrl,
    metadataLandingLinkName: distRaw.metadataLandingLinkName,
    metadataLandingDescription: distRaw.metadataLandingDescription,
    landingUrl: distRaw.landingUrl,
    downloadUrl: distRaw.downloadUrl,
    downloadProtocol: distRaw.downloadProtocol,
    downloadLinkName: distRaw.downloadLinkName,
    downloadLinkDescription: distRaw.downloadLinkDescription,
    distributionFeesText: distRaw.distributionFeesText,
    distributionOrderingInstructions: distRaw.distributionOrderingInstructions,
    nceiDistributorContactHref: distRaw.nceiDistributorContactHref,
    nceiDistributorContactTitle: distRaw.nceiDistributorContactTitle,
    distributorIndividualName: distRaw.distributorIndividualName,
    distributorOrganisationName: distRaw.distributorOrganisationName,
    distributorEmail: distRaw.distributorEmail,
    distributorContactUrl: distRaw.distributorContactUrl,
  }
  if (rootContact.nceiMetadataContactHref) {
    distInput.nceiMetadataContactHref = rootContact.nceiMetadataContactHref
    distInput.nceiMetadataContactTitle = rootContact.nceiMetadataContactTitle
    distInput.useNceiMetadataContactXlink = rootContact.useNceiMetadataContactXlink
  }
  if (idMaintGraphic.metadataMaintenanceFrequency) {
    distInput.metadataMaintenanceFrequency = idMaintGraphic.metadataMaintenanceFrequency
  }
  if (metaStd.metadataStandard) distInput.metadataStandard = metaStd.metadataStandard
  if (metaStd.metadataVersion) distInput.metadataVersion = metaStd.metadataVersion
  if (mission.parentProjectTitle) distInput.parentProject = mission.parentProjectTitle
  if (hadNceiUxsPrefix) distInput.nceiFileIdPrefix = true
  const citePub = citationPublicationLine(cite)
  const agPub = [ag.associatedPublicationTitle, ag.associatedPublicationDate, ag.associatedPublicationCode]
    .map((x) => stripUxTemplateBraces(String(x || '')).trim())
    .filter(Boolean)
    .join('; ')
  if (citePub) distInput.publication = citePub
  else if (agPub) distInput.publication = agPub
  if (legal.distributionLicense) distInput.license = legal.distributionLicense
  const distribution = pruneObject(distInput)

  /** @type {Record<string, unknown>} */
  const partial = {}
  if (Object.keys(mission).length) partial.mission = mission
  if (Object.keys(spatial).length) partial.spatial = spatial
  if (Object.keys(kw).length) partial.keywords = kw
  if (sensors.length) partial.sensors = sensors
  if (Object.keys(distribution).length) partial.distribution = distribution
  if (acqParsed.platform && Object.keys(acqParsed.platform).length) {
    partial.platform = pruneObject(/** @type {Record<string, unknown>} */ (acqParsed.platform))
  }

  if (!Object.keys(partial).length) {
    return { ok: false, error: 'No recognizable pilot fields in XML.', warnings }
  }

  deepStripUxTemplatePlaceholders(partial)
  enrichNavyUxPlaceholderImport(partial, raw, warnings)
  applyIsoImportHeuristics(partial, warnings)

  stampIsoImportProvenance(partial, root)
  return { ok: true, partial, warnings }
}
