/**
 * bediGranuleImportParser — extracts a BEDI granule state object from an
 * ISO 19115-2/19139 XML string with `hierarchyLevel = dataset` and
 * `hierarchyLevelName = Granule`.
 *
 * The most critical field is `parentCollectionId` (gmd:parentIdentifier).
 *
 * @module profiles/bedi/bediGranuleImportParser
 */

import {
  parseXml,
  txt,
  allTxt,
  codeVal,
  parseBediGranuleFileId,
  extractMdKeywordsTextHrefPairs,
  listMiMetadataDirectChildren,
} from './bediXmlUtils.js'
import { buildSourceProvenance } from '../../lib/sourceProvenance.js'

/**
 * @param {string} xmlString
 * @param {import('../../core/registry/types.js').ImportParseMeta} [meta]
 * @returns {import('../../core/registry/types.js').ImportParserResult}
 */
export function parseBediGranuleXml(xmlString, meta = {}) {
  const warnings = []
  const parsed = parseXml(xmlString)
  if (!parsed.ok) return { ok: false, error: parsed.error, warnings }

  const doc = parsed.doc
  const metadataUuid = String(doc.documentElement?.getAttribute?.('uuid') ?? '').trim()

  // ── Top-level identification ─────────────────────────────────────────────
  const fileId             = txt(doc, 'gmd:fileIdentifier') || txt(doc, 'fileIdentifier')
  const parentCollectionId = txt(doc, 'gmd:parentIdentifier') || txt(doc, 'parentIdentifier')
  const hierarchyLevel     = codeVal(doc, 'gmd:MD_ScopeCode') || codeVal(doc, 'MD_ScopeCode')
  const hierarchyLevelName = txt(doc, 'gmd:hierarchyLevelName') || txt(doc, 'hierarchyLevelName')

  if (!parentCollectionId) {
    warnings.push('CRITICAL: No gmd:parentIdentifier found — this is required for a BEDI granule')
  }
  if (hierarchyLevel && hierarchyLevel !== 'dataset') {
    warnings.push(`Expected hierarchyLevel=dataset, got "${hierarchyLevel}". Parsing as granule anyway.`)
  }

  // Parse structured fields from file ID
  const {
    diveId,
    tapeNumber,
    segmentNumber,
  } = parseBediGranuleFileId(fileId)

  // Derive short granule ID from file ID (strip namespace prefix)
  const granuleId = fileId.includes(':') ? fileId.split(':').pop() : fileId

  // ── Citation block ───────────────────────────────────────────────────────
  const citationEls = doc.getElementsByTagName('gmd:CI_Citation')
  const citEl = citationEls.length > 0 ? citationEls[0] : doc

  const title = txt(citEl, 'gmd:title') || txt(doc, 'gmd:title')

  // Alternate title (parent collection name)
  const alternateTitle = (() => {
    const els = doc.getElementsByTagName('gmd:alternateTitle')
    return els.length > 0 ? els[0]?.textContent?.trim() ?? '' : ''
  })()

  // Presentation form (videoDigital etc.)
  const presentationForm = codeVal(citEl, 'gmd:CI_PresentationFormCode') ||
                           codeVal(doc,   'gmd:CI_PresentationFormCode')

  // Creation date
  let creationDate = ''
  const dateTags = doc.getElementsByTagName('gmd:CI_Date')
  for (let i = 0; i < dateTags.length; i++) {
    const dt = codeVal(dateTags[i], 'gmd:CI_DateTypeCode')
    if (dt === 'creation') {
      creationDate = txt(dateTags[i], 'gco:Date') || txt(dateTags[i], 'gco:DateTime')
      break
    }
  }

  // Short identifier code from citation
  let citationCode = ''
  const identEls = doc.getElementsByTagName('gmd:MD_Identifier')
  for (let i = 0; i < identEls.length; i++) {
    const auth = txt(identEls[i], 'gmd:title')
    const code = txt(identEls[i], 'gmd:code')
    if (!auth && code && !code.includes(':')) {
      citationCode = code
      break
    }
  }

  // ── Abstract / Status ────────────────────────────────────────────────────
  const abstract = txt(doc, 'gmd:abstract')
  const status   = codeVal(doc, 'gmd:MD_ProgressCode') || txt(doc, 'gmd:MD_ProgressCode')

  const useLimEls = doc.getElementsByTagName('gmd:useLimitation')
  let resourceUseLimitation = ''
  for (let i = 0; i < useLimEls.length; i++) {
    const t = useLimEls[i]?.textContent?.trim()
    if (t) {
      resourceUseLimitation = t
      break
    }
  }

  // ── Principal Investigator (root `gmd:contact` or identification POC) ────
  let piName  = ''
  let piOrg   = ''
  let piEmail = ''
  const rootContacts = listMiMetadataDirectChildren(doc, 'contact')
  for (let i = 0; i < rootContacts.length; i++) {
    const party = rootContacts[i].getElementsByTagName('gmd:CI_ResponsibleParty')[0]
    if (!party) continue
    const name = txt(party, 'gmd:individualName')
    if (name) {
      piName  = name
      piOrg   = txt(party, 'gmd:organisationName')
      piEmail = txt(party, 'gmd:electronicMailAddress')
      break
    }
  }
  if (!piName) {
    const pocEls = doc.getElementsByTagName('gmd:pointOfContact')
    for (let i = 0; i < pocEls.length; i++) {
      const name = txt(pocEls[i], 'gmd:individualName')
      if (name) {
        piName  = name
        piOrg   = txt(pocEls[i], 'gmd:organisationName')
        piEmail = txt(pocEls[i], 'gmd:electronicMailAddress')
        break
      }
    }
  }

  if (!piName) {
    const citedEls = citEl.getElementsByTagName('gmd:citedResponsibleParty')
    for (let i = 0; i < citedEls.length; i++) {
      const party = citedEls[i].getElementsByTagName('gmd:CI_ResponsibleParty')[0]
      if (!party) continue
      const name = txt(party, 'gmd:individualName')
      if (name) {
        piName  = name
        piOrg   = txt(party, 'gmd:organisationName')
        piEmail = txt(party, 'gmd:electronicMailAddress')
        break
      }
    }
  }

  // ── Keywords ─────────────────────────────────────────────────────────────
  const oerKeywords      = []
  let   dataCenterKeyword = ''
  let   dataCenterKeywordHref = ''
  let   instrumentKeyword = ''
  let   instrumentKeywordHref = ''

  const kwBlocks = doc.getElementsByTagName('gmd:MD_Keywords')
  for (let i = 0; i < kwBlocks.length; i++) {
    const block   = kwBlocks[i]
    const typCode = codeVal(block, 'gmd:MD_KeywordTypeCode')

    if (typCode === 'dataCenter' || typCode === 'dataCentre') {
      const { labels, hrefs } = extractMdKeywordsTextHrefPairs(block)
      if (labels[0]) {
        dataCenterKeyword = labels[0]
        dataCenterKeywordHref = hrefs[0] || ''
      }
    } else if (typCode === 'instrument') {
      const { labels, hrefs } = extractMdKeywordsTextHrefPairs(block)
      if (labels[0]) {
        instrumentKeyword = labels[0]
        instrumentKeywordHref = hrefs[0] || ''
      }
    } else {
      const { labels } = extractMdKeywordsTextHrefPairs(block)
      const kws = labels.length ? labels : allTxt(block, 'gco:CharacterString').filter((k) => k)
      oerKeywords.push(...kws)
    }
  }

  // ── Bounding box ─────────────────────────────────────────────────────────
  const west  = txt(doc, 'gmd:westBoundLongitude')
  const east  = txt(doc, 'gmd:eastBoundLongitude')
  const south = txt(doc, 'gmd:southBoundLatitude')
  const north = txt(doc, 'gmd:northBoundLatitude')

  // ── Temporal extent (TimePeriod or dual TimeInstant like NCEI granules) ──
  let startDate = ''
  let endDate   = ''
  const tp = doc.getElementsByTagName('gml:TimePeriod')[0]
  if (tp) {
    startDate = txt(tp, 'gml:beginPosition')
    endDate   = txt(tp, 'gml:endPosition')
  }
  if (!startDate || !endDate) {
    const timeInstants = doc.getElementsByTagName('gml:TimeInstant')
    for (let i = 0; i < timeInstants.length; i++) {
      const id  = timeInstants[i].getAttribute('gml:id')
      const pos = txt(timeInstants[i], 'gml:timePosition')
      if (!pos) continue
      if (id === 'start' || (!startDate && i === 0)) startDate = startDate || pos
      if (id === 'end'   || (!endDate   && i === 1)) endDate   = endDate   || pos
    }
  }

  // ── Vertical extent (depth) ───────────────────────────────────────────────
  let minDepth = ''
  let maxDepth = ''
  const ve = doc.getElementsByTagName('gmd:EX_VerticalExtent')[0]
  if (ve) {
    minDepth = txt(ve, 'gmd:minimumValue') || txt(ve, 'gco:Real')
    // For max, get the second gco:Real
    const reals = ve.getElementsByTagName('gco:Real')
    if (reals.length >= 2) maxDepth = reals[1]?.textContent?.trim() ?? ''
    else if (reals.length === 1) maxDepth = reals[0]?.textContent?.trim() ?? ''
  }

  // ── Aggregation (largerWorkCitation + crossReference) ────────────────────
  let parentCollectionRef        = ''
  let parentCollectionLandingUrl = ''
  let diveSummaryReportUrl       = ''

  const aggEls = doc.getElementsByTagName('gmd:MD_AggregateInformation')
  for (let i = 0; i < aggEls.length; i++) {
    const el   = aggEls[i]
    const type = codeVal(el, 'gmd:DS_AssociationTypeCode')
    const aggTitle = txt(el, 'gmd:title')
    const url  = txt(el, 'gmd:URL')

    if (type === 'largerWorkCitation') {
      parentCollectionRef        = aggTitle
      parentCollectionLandingUrl = url
    } else if (type === 'crossReference') {
      diveSummaryReportUrl = url
    }
  }

  // ── Content info (observation variables) ─────────────────────────────────
  const observationVariables = []
  const covEls = doc.getElementsByTagName('gmd:MD_Band')
  for (let i = 0; i < covEls.length; i++) {
    const desc = txt(covEls[i], 'gmd:descriptor') || txt(covEls[i], 'gco:CharacterString')
    if (desc) observationVariables.push(desc)
  }
  // Also look for sequenceIdentifier / memberName patterns
  const seqEls = doc.getElementsByTagName('gmd:sequenceIdentifier')
  for (let i = 0; i < seqEls.length; i++) {
    const v = txt(seqEls[i], 'gco:MemberName') || txt(seqEls[i], 'gco:CharacterString')
    if (v && !observationVariables.includes(v)) observationVariables.push(v)
  }

  // ── Distribution / video format ───────────────────────────────────────────
  let videoFormat   = ''
  let videoFilename = ''
  let landingPageUrl = ''

  const fmtEls = doc.getElementsByTagName('gmd:MD_Format')
  if (fmtEls.length > 0) {
    videoFormat = txt(fmtEls[0], 'gmd:name')
  }
  const dtOpts = doc.getElementsByTagName('gmd:MD_DigitalTransferOptions')
  for (let i = 0; i < dtOpts.length; i++) {
    const fn = txt(dtOpts[i], 'gmd:fileName')
    if (fn) { videoFilename = fn; break }
  }

  let contactNceiHref = ''
  const distContEls = doc.getElementsByTagName('gmd:distributorContact')
  for (let i = 0; i < distContEls.length; i++) {
    const h = String(distContEls[i].getAttribute('xlink:href') || '').trim()
    if (h) {
      contactNceiHref = h
      break
    }
  }

  let contactOerHref = ''
  let contactPiHref = ''
  const pocHrefEls = doc.getElementsByTagName('gmd:pointOfContact')
  for (let i = 0; i < pocHrefEls.length; i++) {
    const href = String(pocHrefEls[i].getAttribute('xlink:href') || '').trim()
    const title = String(pocHrefEls[i].getAttribute('xlink:title') || '')
    if (!href) continue
    if (/NCEI/i.test(title)) {
      if (!contactNceiHref) contactNceiHref = href
    } else if (/Ocean Exploration|OER/i.test(title)) {
      if (!contactOerHref) contactOerHref = href
    } else if (!contactPiHref) {
      contactPiHref = href
    }
  }

  let granulesSearchUrl = ''
  const onlineEls = doc.getElementsByTagName('gmd:CI_OnlineResource')
  for (let i = 0; i < onlineEls.length; i++) {
    const url  = txt(onlineEls[i], 'gmd:URL')
    const name = txt(onlineEls[i], 'gmd:name')
    if (!url) continue
    const nl = name.toLowerCase()
    if (nl.includes('granule search')) {
      granulesSearchUrl = granulesSearchUrl || url
    } else if (nl.includes('landing') || nl.includes('dataset landing')) {
      landingPageUrl = landingPageUrl || url
    } else if (nl.includes('video') || codeVal(onlineEls[i], 'gmd:CI_OnLineFunctionCode') === 'download') {
      if (!videoFilename) videoFilename = url
    }
  }
  if (!landingPageUrl) {
    for (let i = 0; i < onlineEls.length; i++) {
      const url  = txt(onlineEls[i], 'gmd:URL')
      const name = txt(onlineEls[i], 'gmd:name')
      if (!url) continue
      if (name.toLowerCase().includes('granule')) continue
      if (videoFilename && url === videoFilename) continue
      landingPageUrl = url
      break
    }
  }

  const partial = {
    metadataUuid,

    // Identification
    fileId,
    granuleId: citationCode || granuleId,
    parentCollectionId,
    hierarchyLevel,
    hierarchyLevelName,
    diveId,
    tapeNumber,
    segmentNumber,

    // Citation
    title,
    alternateTitle,
    creationDate,
    presentationForm,

    // Description
    abstract,
    status,
    resourceUseLimitation,

    // Contacts
    piName,
    piOrg,
    piEmail,
    contactOerHref,
    contactPiHref,

    // Keywords
    oerKeywords,
    dataCenterKeyword,
    dataCenterKeywordHref,
    instrumentKeyword,
    instrumentKeywordHref,

    // Extent
    west,
    east,
    south,
    north,
    startDate,
    endDate,
    minDepth,
    maxDepth,

    // Aggregation
    parentCollectionRef,
    parentCollectionLandingUrl,
    diveSummaryReportUrl,

    // Content
    observationVariables,

    // Distribution
    contactNceiHref,
    granulesSearchUrl,
    videoFormat,
    videoFilename,
    landingPageUrl,
  }

  if (!parentCollectionId) warnings.push('Missing parentCollectionId — granule cannot be linked to collection')
  if (!fileId)             warnings.push('No gmd:fileIdentifier found')
  if (!title)              warnings.push('No title found')
  if (!diveId)             warnings.push('Could not parse diveId from fileId pattern')

  return {
    ok:         true,
    partial,
    warnings,
    provenance: buildSourceProvenance('bediXml', meta),
  }
}

/** @type {import('../../core/registry/types.js').ImportParser} */
export const bediGranuleImportParser = {
  format: 'bedi-granule-xml',
  parse: parseBediGranuleXml,
}
