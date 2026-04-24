import { inferLicensePresetFromDocucompHref } from './noaaLicensePresets.js'
import { parseNceiUxsFileIdentifier } from './nceiUxsFileId.js'
import {
  acquisitionInstrumentHasContent,
  parseInstrumentDescriptionBlock,
  sensorInstrumentDedupeKey,
} from './sensorInstrumentDescription.js'

/** ISO / GML namespaces used by the pilot preview and UniversalXMLGenerator. */
const NS = {
  gmd: 'http://www.isotc211.org/2005/gmd',
  gco: 'http://www.isotc211.org/2005/gco',
  gmi: 'http://www.isotc211.org/2005/gmi',
  gml: 'http://www.opengis.net/gml/3.2',
  gmx: 'http://www.isotc211.org/2005/gmx',
  xlink: 'http://www.w3.org/1999/xlink',
}

/**
 * GCMD / KMS concept UUID, query uuid=, or full URL for round-trip with `gmx:Anchor`.
 * @param {string} href
 * @returns {string}
 */
function keywordUuidFromConceptHref(href) {
  const h = String(href || '').trim()
  if (!h) return ''
  const concept = h.match(/\/concept\/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/i)
  if (concept) return concept[1]
  const qu = h.match(/[?&]uuid=([a-f0-9-]{36})/i)
  if (qu) return qu[1]
  if (/^https?:\/\//i.test(h)) return h
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
  return { label: lab, uuid: '' }
}

/**
 * @param {Element | null | undefined} el
 * @returns {string}
 */
function txt(el) {
  return el?.textContent?.trim() ?? ''
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
    const dateStr = dateEl ? txt(dateEl) : ''
    const dtt = childNS(ci, NS.gmd, 'dateType')
    const code = dtt ? childNS(dtt, NS.gmd, 'CI_DateTypeCode') : null
    const typeVal = (code?.getAttribute('codeListValue') || txt(code)).toLowerCase()
    if (typeVal.includes('publication')) out.publicationDate = dateStr
    else if (typeVal.includes('creation')) out.startDate = dateStr
    else if (typeVal.includes('completion')) out.endDate = dateStr
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
    const code = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
    if (!code) continue
    if (/^10\.\d{4,9}\//.test(code)) doi.doi = code
    else if (!doi.accession) doi.accession = code
  }
  return doi
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

  const box = childNS(childNS(exExtent, NS.gmd, 'geographicElement'), NS.gmd, 'EX_GeographicBoundingBox')
  if (box) {
    out.west = txt(childNS(childNS(box, NS.gmd, 'westBoundLongitude'), NS.gco, 'Decimal'))
    out.east = txt(childNS(childNS(box, NS.gmd, 'eastBoundLongitude'), NS.gco, 'Decimal'))
    out.south = txt(childNS(childNS(box, NS.gmd, 'southBoundLatitude'), NS.gco, 'Decimal'))
    out.north = txt(childNS(childNS(box, NS.gmd, 'northBoundLatitude'), NS.gco, 'Decimal'))
  }

  for (const ve of childrenNS(exExtent, NS.gmd, 'verticalElement')) {
    const vx = childNS(ve, NS.gmd, 'EX_VerticalExtent')
    if (!vx) continue
    const lo = txt(childNS(childNS(vx, NS.gmd, 'minimumValue'), NS.gco, 'Real'))
    const hi = txt(childNS(childNS(vx, NS.gmd, 'maximumValue'), NS.gco, 'Real'))
    if (lo || hi) {
      out.vmin = lo
      out.vmax = hi
      break
    }
  }

  const temp = childNS(childNS(exExtent, NS.gmd, 'temporalElement'), NS.gmd, 'EX_TemporalExtent')
  const inner = temp ? childNS(temp, NS.gmd, 'extent') : null
  const tp = inner ? childLocal(inner, 'TimePeriod') : null
  if (tp) {
    out.startDate =
      txt(childNS(tp, NS.gml, 'begin')) ||
      txt(childNS(tp, NS.gml, 'beginPosition')) ||
      txt(childLocal(tp, 'begin'))
    out.endDate =
      txt(childNS(tp, NS.gml, 'end')) ||
      txt(childNS(tp, NS.gml, 'endPosition')) ||
      txt(childLocal(tp, 'end'))
    const ti = childNS(tp, NS.gml, 'timeInterval') || childLocal(tp, 'timeInterval')
    if (ti) {
      out.temporalExtentIntervalUnit = ti.getAttribute('unit') || ti.getAttributeNS(NS.gml, 'unit') || ''
      out.temporalExtentIntervalValue = txt(ti)
    }
  }
  return out
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
    const thes = childNS(childNS(mk, NS.gmd, 'thesaurusName'), NS.gmd, 'CI_Citation')
    const thesTitle = (thes ? gcoCharacterString(childNS(thes, NS.gmd, 'title')) : '').toLowerCase()
    if (thesTitle.includes('platform instance')) continue

    let facet = ''
    if (thesTitle.includes('science')) facet = 'sciencekeywords'
    else if (thesTitle.includes('data center') || thesTitle.includes('datacenter')) facet = 'datacenters'
    else if (thesTitle.includes('platform')) facet = 'platforms'
    else if (thesTitle.includes('instrument')) facet = 'instruments'
    else if (thesTitle.includes('location')) facet = 'locations'
    else if (thesTitle.includes('project')) facet = 'projects'
    else if (thesTitle.includes('provider')) facet = 'providers'
    if (!facet) continue

    const labels = []
    for (const kw of childrenNS(mk, NS.gmd, 'keyword')) {
      const { label, uuid } = keywordLabelAndUuidFromKeywordElement(kw)
      if (label) labels.push({ label, uuid })
    }
    if (labels.length) {
      if (!facets[facet]) facets[facet] = []
      facets[facet].push(...labels)
    }
  }
  return facets
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
    const v = (code?.getAttribute('codeListValue') || txt(code) || gcoCharacterString(tc)).trim()
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
 * }}
 */
function parseCitationParties(cite) {
  const out = {
    citationAuthorIndividualName: '',
    citationAuthorOrganisationName: '',
    citationPublisherOrganisationName: '',
    citationOriginatorIndividualName: '',
    citationOriginatorOrganisationName: '',
  }
  if (!cite) return out
  for (const crp of childrenNS(cite, NS.gmd, 'citedResponsibleParty')) {
    const rp = childNS(crp, NS.gmd, 'CI_ResponsibleParty')
    if (!rp) continue
    const roleEl = childNS(rp, NS.gmd, 'role')
    const roleCode = roleEl ? childNS(roleEl, NS.gmd, 'CI_RoleCode') : null
    const role = (roleCode?.getAttribute('codeListValue') || txt(roleCode)).toLowerCase()
    const ind = gcoCharacterString(childNS(rp, NS.gmd, 'individualName'))
    const org = gcoCharacterString(childNS(rp, NS.gmd, 'organisationName'))
    if (role.includes('author')) {
      if (!out.citationAuthorIndividualName && ind) out.citationAuthorIndividualName = ind
      if (!out.citationAuthorOrganisationName && org) out.citationAuthorOrganisationName = org
    } else if (role.includes('publisher')) {
      if (!out.citationPublisherOrganisationName && org) out.citationPublisherOrganisationName = org
      else if (!out.citationPublisherOrganisationName && ind) out.citationPublisherOrganisationName = ind
    } else if (role.includes('originator')) {
      if (!out.citationOriginatorIndividualName && ind) out.citationOriginatorIndividualName = ind
      if (!out.citationOriginatorOrganisationName && org) out.citationOriginatorOrganisationName = org
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
    const href = go.getAttributeNS(NS.xlink, 'href') || go.getAttribute('xlink:href') || ''
    if (!href.trim()) continue
    out.graphicOverviewHref = href.trim()
    out.graphicOverviewTitle = (
      go.getAttributeNS(NS.xlink, 'title') ||
      go.getAttribute('xlink:title') ||
      ''
    ).trim()
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
    const row = {
      sensorId: sid,
      type,
      modelId: sid,
      variable: variableFromName || parsed.variable,
      firmware: parsed.firmware,
      operationMode: parsed.operationMode,
      uncertainty: parsed.uncertainty,
      frequency: parsed.frequency,
      beamCount: parsed.beamCount,
      depthRating: parsed.depthRating,
      confidenceInterval: parsed.confidenceInterval,
    }
    if (acquisitionInstrumentHasContent(row)) out.push(row)
  }
  return out
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
      const pos = childNS(rep, NS.gmd, 'DQ_AbsoluteExternalPositionalAccuracy')
      const block = qaa || pos
      if (!block) continue
      const res = childNS(block, NS.gmd, 'result')
      const qr = res ? childNS(res, NS.gmd, 'DQ_QuantitativeResult') : null
      if (!qr) continue
      const vtWrap = childLocal(qr, 'valueType')
      const rt = vtWrap ? childNS(vtWrap, NS.gco, 'RecordType') || childLocal(vtWrap, 'RecordType') : null
      const label = rt ? txt(rt) : ''
      const valWrap = childLocal(qr, 'value')
      const rec = valWrap ? childNS(valWrap, NS.gco, 'Record') || childLocal(valWrap, 'Record') : null
      const qty = rec ? childNS(rec, NS.gmi, 'Quantity') : null
      const decEl = qty ? childNS(qty, NS.gco, 'Decimal') : null
      const dec = decEl ? txt(decEl) : ''
      if (qaa) {
        if (!out.accuracyStandard) out.accuracyStandard = label
        if (!out.accuracyValue) out.accuracyValue = dec
      } else if (pos) {
        if (!out.errorLevel) out.errorLevel = label
        if (!out.errorValue) out.errorValue = dec
      }
    }
  }
  for (const dqi of childrenNS(root, NS.gmd, 'dataQualityInfo')) {
    const dq = childNS(dqi, NS.gmd, 'DQ_DataQuality')
    if (!dq) continue
    const lin = childNS(dq, NS.gmd, 'lineage')
    const li = lin ? childNS(lin, NS.gmd, 'LI_Lineage') : null
    if (!li) continue
    const st = gcoCharacterString(childNS(li, NS.gmd, 'statement'))
    if (st) out.lineageStatement = st
    const steps = []
    for (const ps of childrenNS(li, NS.gmd, 'processStep')) {
      const lip = childNS(ps, NS.gmd, 'LI_ProcessStep')
      if (!lip) continue
      const d = gcoCharacterString(childNS(lip, NS.gmd, 'description'))
      if (d) steps.push(d)
    }
    if (steps.length) out.lineageProcessSteps = steps.join('\n\n')
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
      out.useGridRepresentation = true
      const cg = childNS(childNS(grid, NS.gmd, 'cellGeometry'), NS.gmd, 'MD_CellGeometryCode')
      out.gridCellGeometry = cg?.getAttribute('codeListValue') || txt(cg)
      for (const ax of childrenNS(grid, NS.gmd, 'axisDimensionProperties')) {
        const dim = childNS(ax, NS.gmd, 'MD_Dimension')
        if (!dim) continue
        const nameCode = childNS(childNS(dim, NS.gmd, 'dimensionName'), NS.gmd, 'MD_DimensionNameTypeCode')
        const axis = (nameCode?.getAttribute('codeListValue') || txt(nameCode)).toLowerCase()
        const size = txt(childNS(childNS(dim, NS.gmd, 'dimensionSize'), NS.gco, 'Integer'))
        const res = gcoCharacterString(childNS(dim, NS.gmd, 'resolution'))
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
      continue
    }
    const geo = childNS(sri, NS.gmd, 'MD_Georectified')
    if (geo) {
      out.dimensions = txt(childNS(childNS(geo, NS.gmd, 'numberOfDimensions'), NS.gco, 'Integer'))
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
 * @param {Element} root
 * @returns {Record<string, string>}
 */
function parseDistribution(root) {
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
  const di = childNS(root, NS.gmd, 'distributionInfo')
  const md = di ? childNS(di, NS.gmd, 'MD_Distribution') : null
  if (!md) return dist

  let fmt = childNS(childNS(md, NS.gmd, 'distributionFormat'), NS.gmd, 'MD_Format')
  if (!fmt) {
    const dfw = childNS(md, NS.gmd, 'distributorFormat')
    fmt = dfw ? childNS(dfw, NS.gmd, 'MD_Format') : null
  }
  if (fmt) {
    dist.distributionFormatName = gcoCharacterString(childNS(fmt, NS.gmd, 'name'))
    dist.distributionFileFormat = gcoCharacterString(childNS(fmt, NS.gmd, 'version'))
  }

  const distBlock = childNS(md, NS.gmd, 'distributor')
  const mdDist = distBlock ? childNS(distBlock, NS.gmd, 'MD_Distributor') : null
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
      const url = link ? txt(childNS(link, NS.gmd, 'URL')) : ''
      if (!isImportableOnlineUrl(url)) continue
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      const name = gcoCharacterString(childNS(ci, NS.gmd, 'name'))
      const proto = gcoCharacterString(childNS(ci, NS.gmd, 'protocol'))
      const description = gcoCharacterString(childNS(ci, NS.gmd, 'description'))
      urls.push({ url, name, proto, description })
    }
  }
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
    dist.metadataLandingUrl = sorted[0].url
    dist.metadataLandingLinkName = sorted[0].name
    dist.metadataLandingDescription = sorted[0].description
    dist.landingUrl = sorted[1].url
    dist.downloadProtocol = sorted[1].proto || 'HTTPS'
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
  out.individualName = gcoCharacterString(childNS(rp, NS.gmd, 'individualName'))
  out.organisationName = gcoCharacterString(childNS(rp, NS.gmd, 'organisationName'))
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
    out.contactUrl = link ? txt(childNS(link, NS.gmd, 'URL')) : ''
  }
  return out
}

/**
 * @param {Element | null} dataId
 * @returns {{ individualName: string, organisationName: string, email: string, contactPhone: string, contactUrl: string, contactAddress: string }}
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
  /** Prefer first `pointOfContact` that embeds CI_ResponsibleParty (UxS template puts DocuComp xlink-only first). */
  for (const poc of childrenNS(dataId, NS.gmd, 'pointOfContact')) {
    const party = childNS(poc, NS.gmd, 'CI_ResponsibleParty')
    if (party) return parseResponsibleParty(party)
  }
  return empty
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
 * @param {Element | null} dataId
 * @returns {{
 *   citeAs: string,
 *   otherCiteAs: string,
 *   accessConstraints: string,
 *   distributionLiability: string,
 *   dataLicensePreset: string,
 *   licenseUrl: string,
 * }}
 */
function parseResourceConstraintsForMission(dataId) {
  const out = {
    citeAs: '',
    otherCiteAs: '',
    accessConstraints: '',
    distributionLiability: '',
    dataLicensePreset: '',
    licenseUrl: '',
  }
  if (!dataId) return out

  for (const rc of childrenNS(dataId, NS.gmd, 'resourceConstraints')) {
    const legal = childNS(rc, NS.gmd, 'MD_LegalConstraints')
    if (legal) {
      const ac = childNS(legal, NS.gmd, 'accessConstraints')
      if (ac) {
        const code = childNS(ac, NS.gmd, 'MD_RestrictionCode')
        out.accessConstraints = txt(code) || gcoCharacterString(ac)
      }
      out.citeAs = gcoCharacterString(childNS(legal, NS.gmd, 'useLimitation'))
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
  const idw = childNS(mi, NS.gmd, 'identifier')
  const mid = idw ? childNS(idw, NS.gmd, 'MD_Identifier') : null
  const sid = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
  const stype = gcoCharacterString(childNS(mi, NS.gmi, 'type'))
  const descr = gcoCharacterString(childNS(mi, NS.gmd, 'description'))
  const parsed = parseInstrumentDescriptionBlock(descr)
  const row = {
    sensorId: sid,
    modelId: sid,
    type: stype,
    variable: parsed.variable,
    firmware: parsed.firmware,
    operationMode: parsed.operationMode,
    uncertainty: parsed.uncertainty,
    frequency: parsed.frequency,
    beamCount: parsed.beamCount,
    depthRating: parsed.depthRating,
    confidenceInterval: parsed.confidenceInterval,
  }
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
  const platWrap = childNS(mia, NS.gmi, 'platform')
  const miPlat = platWrap ? childNS(platWrap, NS.gmi, 'MI_Platform') : null
  if (miPlat) {
    const idw = childNS(miPlat, NS.gmd, 'identifier')
    const mid = idw ? childNS(idw, NS.gmd, 'MD_Identifier') : null
    const pid = mid ? gcoCharacterString(childNS(mid, NS.gmd, 'code')) : ''
    if (pid) {
      platformOut.platformId = pid
    }
    const descRaw = gcoCharacterString(childNS(miPlat, NS.gmd, 'description'))
    if (descRaw) {
      const lines = descRaw.split('\n').map((l) => l.trim()).filter(Boolean)
      const modelLines = lines.filter((l) => l.toLowerCase().startsWith('model:'))
      const rest = lines.filter((l) => !l.toLowerCase().startsWith('model:'))
      if (modelLines.length) {
        const m = modelLines[0].slice(modelLines[0].indexOf(':') + 1).trim()
        if (m) platformOut.model = m
      }
      if (rest.length) platformOut.platformDesc = rest.join('\n')
    }
    const typ = gcoCharacterString(childNS(miPlat, NS.gmi, 'type'))
    if (typ) platformOut.platformType = typ
    const sponsor = childNS(miPlat, NS.gmd, 'pointOfContact')
    const rp = sponsor ? childNS(sponsor, NS.gmd, 'CI_ResponsibleParty') : null
    const org = rp ? gcoCharacterString(childNS(rp, NS.gmd, 'organisationName')) : ''
    if (org) platformOut.manufacturer = org
    parsePlatformOtherProperty(miPlat, platformOut)
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

  const dataId = dataIdentification(root)
  if (!dataId) {
    warnings.push('No gmd:MD_DataIdentification; mission fields may be incomplete.')
  }

  const cite = dataId ? childNS(childNS(dataId, NS.gmd, 'citation'), NS.gmd, 'CI_Citation') : null
  const ids = citationIdentifiers(cite)
  const cdates = citationDates(cite)

  const extentWrap = dataId ? childNS(childNS(dataId, NS.gmd, 'extent'), NS.gmd, 'EX_Extent') : null
  const ext = parseExtent(extentWrap)

  const poc = parsePointOfContact(dataId)
  const legal = parseResourceConstraintsForMission(dataId)
  const ag = dataId ? parseAggregations(dataId) : {}
  const citeParties = parseCitationParties(cite)
  const topicCats = parseTopicCategories(dataId)
  const idMaintGraphic = parseIdentificationMaintenanceGraphic(dataId)
  const rootContact = parseRootMetadataContact(root)
  const metaStd = parseMetadataStandard(root)
  const acqParsed = parseAcquisitionInfo(root)

  const langWrap = dataId ? childNS(dataId, NS.gmd, 'language') : null
  const langEl = langWrap ? childNS(langWrap, NS.gmd, 'LanguageCode') : null
  const language =
    (langEl?.getAttribute('codeListValue') || txt(langEl)) ||
    (langWrap ? gcoCharacterString(langWrap) : '')

  const csEl = dataId ? childNS(childNS(dataId, NS.gmd, 'characterSet'), NS.gmd, 'MD_CharacterSetCode') : null
  const characterSet = csEl?.getAttribute('codeListValue') || txt(csEl)

  const stEl = dataId ? childNS(childNS(dataId, NS.gmd, 'status'), NS.gmd, 'MD_ProgressCode') : null
  const status = stEl?.getAttribute('codeListValue') || txt(stEl)

  const fi = childNS(root, NS.gmd, 'fileIdentifier')
  const fiRaw = fi ? gcoCharacterString(fi) : ''
  const { fileId, hadNceiUxsPrefix } = parseNceiUxsFileIdentifier(fiRaw)

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

  /** @type {Record<string, unknown>} */
  const missionFields = {
    fileId,
    title: cite ? gcoCharacterString(childNS(cite, NS.gmd, 'title')) : '',
    alternateTitle: cite ? gcoCharacterString(childNS(cite, NS.gmd, 'alternateTitle')) : '',
    abstract: dataId ? gcoCharacterString(childNS(dataId, NS.gmd, 'abstract')) : '',
    purpose: dataId ? gcoCharacterString(childNS(dataId, NS.gmd, 'purpose')) : '',
    supplementalInformation: dataId ? gcoCharacterString(childNS(dataId, NS.gmd, 'supplementalInformation')) : '',
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
    contactUrl: poc.contactUrl,
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
  const distRaw = parseDistribution(root)
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

  return { ok: true, partial, warnings }
}
