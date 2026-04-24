/**
 * bediCollectionImportParser — extracts a BEDI collection state object from
 * an ISO 19115-2/19139 XML string with `hierarchyLevel = fieldSession`.
 *
 * Returns an ImportParser-compatible result.
 *
 * @module profiles/bedi/bediCollectionImportParser
 */

import {
  parseXml,
  txt,
  allTxt,
  codeVal,
  extractAccessionNumber,
  extractMdKeywordsTextHrefPairs,
  listMiMetadataDirectChildren,
} from './bediXmlUtils.js'
import { buildSourceProvenance } from '../../lib/sourceProvenance.js'

/**
 * @param {string} xmlString
 * @param {import('../../core/registry/types.js').ImportParseMeta} [meta]
 * @returns {import('../../core/registry/types.js').ImportParserResult}
 */
export function parseBediCollectionXml(xmlString, meta = {}) {
  const warnings = []
  const parsed = parseXml(xmlString)
  if (!parsed.ok) return { ok: false, error: parsed.error, warnings }

  const doc = parsed.doc
  const metadataUuid = String(doc.documentElement?.getAttribute?.('uuid') ?? '').trim()

  // ── Top-level identification ─────────────────────────────────────────────
  const fileId        = txt(doc, 'gmd:fileIdentifier') ||
                        txt(doc, 'fileIdentifier')
  const hierarchyLevel = codeVal(doc, 'gmd:MD_ScopeCode') || codeVal(doc, 'MD_ScopeCode')
  const hierarchyLevelName = txt(doc, 'gmd:hierarchyLevelName') ||
                             txt(doc, 'hierarchyLevelName')

  if (hierarchyLevel && hierarchyLevel !== 'fieldSession') {
    warnings.push(`Expected hierarchyLevel=fieldSession, got "${hierarchyLevel}". Parsing as collection anyway.`)
  }

  // ── Citation block ───────────────────────────────────────────────────────
  const citationEls = doc.getElementsByTagName('gmd:CI_Citation')
  const citEl = citationEls.length > 0 ? citationEls[0] : doc

  const title = txt(citEl, 'gmd:title') || txt(doc, 'gmd:title')

  // Collect all alternate titles
  const alternateTitleEls = doc.getElementsByTagName('gmd:alternateTitle')
  const alternateTitles = []
  for (let i = 0; i < alternateTitleEls.length; i++) {
    const t = alternateTitleEls[i]?.textContent?.trim()
    if (t && t !== title) alternateTitles.push(t)
  }
  // First alternate is dataset title, second often is vessel name
  const alternateTitle = alternateTitles[0] ?? ''
  const vesselName     = alternateTitles[1] ?? ''

  // Creation date from citation (first CI_Date with dateType=creation)
  let creationDate = ''
  const dateTags = doc.getElementsByTagName('gmd:CI_Date')
  for (let i = 0; i < dateTags.length; i++) {
    const dt = codeVal(dateTags[i], 'gmd:CI_DateTypeCode')
    if (dt === 'creation') {
      creationDate = txt(dateTags[i], 'gco:Date') || txt(dateTags[i], 'gco:DateTime')
      break
    }
  }

  // Identifiers — look for NCEI Accession and short collection code
  let collectionId  = ''
  let nceiAccessionId = ''
  let nceiMetadataId  = ''
  const identEls = doc.getElementsByTagName('gmd:MD_Identifier')
  for (let i = 0; i < identEls.length; i++) {
    const el   = identEls[i]
    const auth = txt(el, 'gmd:title')
    const code = txt(el, 'gmd:code')
    if (!code) continue

    if (auth.includes('NCEI Archive Management System')) {
      nceiAccessionId = extractAccessionNumber(code)
    } else if (auth.includes('National Centers for Environmental Information') && code.startsWith('NCEI Metadata ID')) {
      nceiMetadataId = code.replace(/^NCEI Metadata ID:\s*/i, '').trim()
    } else if (!auth) {
      // bare identifier code — first one without authority is the short collection ID
      if (!collectionId) collectionId = code
    }
  }

  // ── Abstract / Purpose / Status ──────────────────────────────────────────
  const abstract = txt(doc, 'gmd:abstract')
  const purpose  = txt(doc, 'gmd:purpose')

  // First status code
  const statusCodes = allTxt(doc, 'gmd:MD_ProgressCode')
  const status = statusCodes[0] ?? codeVal(doc, 'gmd:MD_ProgressCode')

  // Browse graphic URL
  const browseGraphicUrl = txt(doc, 'gmd:fileName')

  // Resource use / access (first useLimitation in document)
  const useLimEls = doc.getElementsByTagName('gmd:useLimitation')
  let resourceUseLimitation = ''
  for (let i = 0; i < useLimEls.length; i++) {
    const t = useLimEls[i]?.textContent?.trim()
    if (t) {
      resourceUseLimitation = t
      break
    }
  }

  // ── Docucomp xlink hrefs (NCEI cruise template) + xlink:title refs ────────
  let contactNceiHref = ''
  let contactOerHref = ''
  let contactPiHref = ''

  const rootContacts = listMiMetadataDirectChildren(doc, 'contact')
  if (rootContacts.length) {
    contactNceiHref = String(rootContacts[0].getAttribute('xlink:href') || '').trim()
  }

  const distributorEls = doc.getElementsByTagName('gmd:distributorContact')
  for (let i = 0; i < distributorEls.length; i++) {
    const href = String(distributorEls[i].getAttribute('xlink:href') || '').trim()
    if (href) {
      if (!contactNceiHref) contactNceiHref = href
      break
    }
  }

  const pocEls = doc.getElementsByTagName('gmd:pointOfContact')
  for (let i = 0; i < pocEls.length; i++) {
    const href = String(pocEls[i].getAttribute('xlink:href') || '').trim()
    const title = String(pocEls[i].getAttribute('xlink:title') || '')
    if (!href) continue
    if (/NCEI/i.test(title)) {
      if (!contactNceiHref) contactNceiHref = href
    } else if (/Ocean Exploration|OER/i.test(title)) {
      if (!contactOerHref) contactOerHref = href
    } else if (!contactPiHref) {
      contactPiHref = href
    }
  }

  const contactEls = doc.getElementsByTagName('gmd:contact')
  const contactRefs = []
  for (let i = 0; i < contactEls.length; i++) {
    const t = contactEls[i].getAttribute('xlink:title')
    if (t) contactRefs.push(t)
  }
  for (let i = 0; i < pocEls.length; i++) {
    const t = pocEls[i].getAttribute('xlink:title')
    if (t && !contactRefs.includes(t)) contactRefs.push(t)
  }

  // Inline PI name from pointOfContact blocks
  let piName = ''
  let piOrg  = ''
  let piEmail = ''
  for (let i = 0; i < pocEls.length; i++) {
    const name = txt(pocEls[i], 'gmd:individualName')
    if (name) {
      piName  = name
      piOrg   = txt(pocEls[i], 'gmd:organisationName') || piOrg
      piEmail = txt(pocEls[i], 'gmd:electronicMailAddress') || piEmail
      break
    }
  }

  // ── Keywords ─────────────────────────────────────────────────────────────
  const scienceKeywords = []
  const scienceKeywordHrefs = []
  const oerKeywords     = []
  const placeKeywords   = []
  const datacenters     = []
  const datacenterKeywordHrefs = []

  const kwBlocks = doc.getElementsByTagName('gmd:MD_Keywords')
  for (let i = 0; i < kwBlocks.length; i++) {
    const block    = kwBlocks[i]
    const typCode  = codeVal(block, 'gmd:MD_KeywordTypeCode')
    const thesName = txt(block, 'gmd:title')
    const { labels, hrefs } = extractMdKeywordsTextHrefPairs(block)
    const kws = labels.filter((k) => k && k !== thesName)

    if (typCode === 'dataCentre' || typCode === 'dataCenter') {
      for (let j = 0; j < labels.length; j++) {
        const k = labels[j]
        if (!k || k === thesName) continue
        datacenters.push(k)
        datacenterKeywordHrefs.push(hrefs[j] ?? '')
      }
    } else if (typCode === 'place') {
      placeKeywords.push(...kws)
    } else if (thesName.toLowerCase().includes('gcmd science')) {
      for (let j = 0; j < labels.length; j++) {
        const k = labels[j]
        if (!k || k === thesName) continue
        scienceKeywords.push(k)
        scienceKeywordHrefs.push(hrefs[j] ?? '')
      }
    } else {
      oerKeywords.push(...kws)
    }
  }

  // ── Bounding box ─────────────────────────────────────────────────────────
  const west  = txt(doc, 'gmd:westBoundLongitude')
  const east  = txt(doc, 'gmd:eastBoundLongitude')
  const south = txt(doc, 'gmd:southBoundLatitude')
  const north = txt(doc, 'gmd:northBoundLatitude')

  // ── Temporal extent ───────────────────────────────────────────────────────
  // Collection uses TimeInstant elements (separate start/end elements)
  let startDate = ''
  let endDate   = ''
  const timeInstants = doc.getElementsByTagName('gml:TimeInstant')
  for (let i = 0; i < timeInstants.length; i++) {
    const id  = timeInstants[i].getAttribute('gml:id')
    const pos = txt(timeInstants[i], 'gml:timePosition')
    if (id === 'start' || i === 0) startDate = pos
    if (id === 'end'   || i === 1) endDate   = pos
  }
  // Also try TimePeriod (granule style, for robustness)
  if (!startDate || !endDate) {
    const tp = doc.getElementsByTagName('gml:TimePeriod')[0]
    if (tp) {
      startDate = startDate || txt(tp, 'gml:beginPosition')
      endDate   = endDate   || txt(tp, 'gml:endPosition')
    }
  }

  // ── Platforms from acquisitionInformation ────────────────────────────────
  const platformEls = doc.getElementsByTagName('gmi:platform')
  const platforms = []
  for (let i = 0; i < platformEls.length; i++) {
    const t = platformEls[i].getAttribute('xlink:title')
    if (t) platforms.push(t)
  }

  // ── Distribution ─────────────────────────────────────────────────────────
  let landingPageUrl    = ''
  let granulesSearchUrl = ''
  const onlineEls = doc.getElementsByTagName('gmd:CI_OnlineResource')
  for (let i = 0; i < onlineEls.length; i++) {
    const el   = onlineEls[i]
    const name = txt(el, 'gmd:name')
    const fn   = codeVal(el, 'gmd:CI_OnLineFunctionCode')
    const url  = txt(el, 'gmd:URL')
    if (!url) continue
    if (name.includes('Landing Page') || fn === 'information') {
      if (!landingPageUrl) landingPageUrl = url
    }
    if (name.includes('Granule') || fn === 'search') {
      granulesSearchUrl = url
    }
  }

  const partial = {
    metadataUuid,

    // Identification
    fileId,
    collectionId,
    nceiAccessionId,
    nceiMetadataId,
    hierarchyLevel,
    hierarchyLevelName,
    title,
    alternateTitle,
    vesselName,
    creationDate,

    // Description
    abstract,
    purpose,
    status,
    browseGraphicUrl,
    resourceUseLimitation,

    // Contacts
    contactNceiHref,
    contactOerHref,
    contactPiHref,
    contactRefs,
    piName,
    piOrg,
    piEmail,

    // Keywords
    scienceKeywords,
    scienceKeywordHrefs,
    oerKeywords,
    placeKeywords,
    datacenters,
    datacenterKeywordHrefs,

    // Extent
    west,
    east,
    south,
    north,
    startDate,
    endDate,

    // Platforms
    platforms,

    // Distribution
    landingPageUrl,
    granulesSearchUrl,
  }

  // Sanity warnings
  if (!fileId)        warnings.push('No gmd:fileIdentifier found')
  if (!title)         warnings.push('No title found')
  if (!nceiAccessionId) warnings.push('No NCEI Accession ID found — expected in gmd:identifier with NCEI AMS authority')
  if (platforms.length === 0) warnings.push('No gmi:platform xlink:title references found')

  return {
    ok:         true,
    partial,
    warnings,
    provenance: buildSourceProvenance('bediXml', meta),
  }
}

/** @type {import('../../core/registry/types.js').ImportParser} */
export const bediCollectionImportParser = {
  format: 'bedi-collection-xml',
  parse: parseBediCollectionXml,
}
