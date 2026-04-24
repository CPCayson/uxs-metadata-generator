/**
 * ISO 19115-2 `gmi:MI_Metadata` preview for BEDI **granule** (dataset) state.
 * Emits `gmd:parentIdentifier` and fields understood by {@link parseBediGranuleXml}.
 *
 * **NCEI OER granule template:** Published-package shapes: extra `xmlns:*`,
 * early `language` / `characterSet`, root `gmd:contact`, dual `TimeInstant`
 * extents plus `EX_SpatialTemporalExtent`, GCMD `gmx:Anchor` data-center /
 * instrument keywords, cruise-style `distributionInfo` (distributor + order
 * process + online resources), `metadataMaintenance`, and `dataQualityInfo`.
 *
 * @module lib/bediGranuleXmlPreview
 */

import { escBediXml as esc } from './bediXmlEscape.js'

/**
 * NCName-safe `gmd:EX_Extent` @id — mirrors `bedi_renderer.genBEDISegmentMetadata._extent_id_ncname`.
 *
 * @param {string} fileId
 * @returns {string}
 */
function bediExtentNcNameIdFromFileId(fileId) {
  let k = String(fileId || '').trim()
  const pfx = 'gov.noaa.ncei.oer:'
  if (k.toLowerCase().startsWith(pfx)) k = k.slice(pfx.length).trim()
  k = k.replace(/[:/]/g, '_').replace(/\s+/g, '_')
  if (!k) k = 'Extent'
  return `${k}_Extents`
}

/**
 * @param {object} s  BEDI granule profile state
 * @returns {string}
 */
export function buildBediGranuleXmlPreview(s) {
  const fileId = String(s.fileId || '').trim()
  const extentXmlId = esc(bediExtentNcNameIdFromFileId(fileId))
  const parentId = String(s.parentCollectionId || '').trim()
  const title = String(s.title || '').trim()
  const alt = String(s.alternateTitle || '').trim()
  const hl = String(s.hierarchyLevel || 'dataset').trim() || 'dataset'
  const hln = String(s.hierarchyLevelName || 'Granule').trim() || 'Granule'
  const abstract = String(s.abstract || '').trim()
  const status = String(s.status || '').trim()
  const creationDate = String(s.creationDate || '').trim()
  const pres = String(s.presentationForm || 'videoDigital').trim() || 'videoDigital'
  const west = String(s.west || '').trim()
  const east = String(s.east || '').trim()
  const south = String(s.south || '').trim()
  const north = String(s.north || '').trim()
  const startDate = String(s.startDate || '').trim()
  const endDate = String(s.endDate || '').trim()
  const minD = String(s.minDepth || '').trim()
  const maxD = String(s.maxDepth || '').trim()
  const piName = String(s.piName || '').trim()
  const piOrg = String(s.piOrg || '').trim()
  const piEmail = String(s.piEmail || '').trim()
  const land = String(s.landingPageUrl || '').trim()
  const vidFmt = String(s.videoFormat || '').trim()
  const vidFn = String(s.videoFilename || '').trim()
  const pRef = String(s.parentCollectionRef || '').trim()
  const pUrl = String(s.parentCollectionLandingUrl || '').trim()
  const diveRep = String(s.diveSummaryReportUrl || '').trim()
  const obs = Array.isArray(s.observationVariables) ? s.observationVariables : []
  const oerKw = Array.isArray(s.oerKeywords) ? s.oerKeywords : []
  const dcKw = String(s.dataCenterKeyword || '').trim()
  const instKw = String(s.instrumentKeyword || '').trim()
  const metaUuid = String(s.metadataUuid || '').trim()
  const granuleCode = String(s.granuleId || '').trim()
  const contactNceiHref = String(s.contactNceiHref || '').trim()
  const contactOerHref = String(s.contactOerHref || '').trim()
  const contactPiHref = String(s.contactPiHref || '').trim()
  const granulesSearchUrl = String(s.granulesSearchUrl || '').trim()
  const dataCenterKeywordHref = String(s.dataCenterKeywordHref || '').trim()
  const instrumentKeywordHref = String(s.instrumentKeywordHref || '').trim()
  const resourceUseLimitation = String(s.resourceUseLimitation || '').trim()

  const rootUuidAttr = metaUuid ? ` uuid="${esc(metaUuid)}"` : ''

  /**
   * One GCMD-style keyword row with `gmx:Anchor` + thesaurus citation.
   * @param {string} keyword
   * @param {string} typeCode
   * @param {string} thesaurusTitle
   * @param {string} edition
   */
  function gcmdSingleKeywordBlock(keyword, typeCode, thesaurusTitle, edition, explicitHref = '') {
    const k = String(keyword || '').trim()
    if (!k) return ''
    const href = String(explicitHref || '').trim()
      || `https://gcmd.earthdata.nasa.gov/kms/concept?q=${encodeURIComponent(k)}`
    return `      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gmx:Anchor xlink:href="${esc(href)}" xlink:title="${esc(k)}">${esc(k)}</gmx:Anchor>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="${esc(typeCode)}">${esc(typeCode)}</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(thesaurusTitle)}</gco:CharacterString></gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date><gco:Date>2024-05-14</gco:Date></gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="publication">publication</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
              <gmd:edition><gco:CharacterString>${esc(edition)}</gco:CharacterString></gmd:edition>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>\n`
  }

  const parentIdentXml = parentId
    ? `  <gmd:parentIdentifier>
    <gco:CharacterString>${esc(parentId)}</gco:CharacterString>
  </gmd:parentIdentifier>\n`
    : ''

  const altXml = alt
    ? `          <gmd:alternateTitle>
            <gco:CharacterString>${esc(alt)}</gco:CharacterString>
          </gmd:alternateTitle>\n`
    : ''

  const creationDateXml = creationDate
    ? `          <gmd:date>
            <gmd:CI_Date>
              <gmd:date><gco:Date>${esc(creationDate)}</gco:Date></gmd:date>
              <gmd:dateType>
                <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="creation">creation</gmd:CI_DateTypeCode>
              </gmd:dateType>
            </gmd:CI_Date>
          </gmd:date>\n`
    : ''

  const granuleIdXml = granuleCode
    ? `          <gmd:identifier>
            <gmd:MD_Identifier>
              <gmd:code><gco:CharacterString>${esc(granuleCode)}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmd:identifier>\n`
    : ''

  const piLines = []
  if (piName) {
    piLines.push(`      <gmd:individualName><gco:CharacterString>${esc(piName)}</gco:CharacterString></gmd:individualName>`)
  }
  if (piOrg) {
    piLines.push(`      <gmd:organisationName><gco:CharacterString>${esc(piOrg)}</gco:CharacterString></gmd:organisationName>`)
  }
  if (piEmail) {
    piLines.push(`      <gmd:contactInfo><gmd:CI_Contact><gmd:address><gmd:CI_Address><gmd:electronicMailAddress><gco:CharacterString>${esc(piEmail)}</gco:CharacterString></gmd:electronicMailAddress></gmd:CI_Address></gmd:address></gmd:CI_Contact></gmd:contactInfo>`)
  }
  if (piLines.length) {
    piLines.push(`      <gmd:role>
        <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
      </gmd:role>`)
  }
  const piPartyInner = piLines.length ? `${piLines.join('\n')}\n` : ''
  const rootContactXml = piPartyInner
    ? `  <gmd:contact>
    <gmd:CI_ResponsibleParty>
${piPartyInner}    </gmd:CI_ResponsibleParty>
  </gmd:contact>\n`
    : ''

  const bboxXml = [west, east, south, north].every((v) => v !== '' && !Number.isNaN(Number.parseFloat(v)))
    ? `          <gmd:geographicElement>
            <gmd:EX_GeographicBoundingBox>
              <gmd:westBoundLongitude><gco:Decimal>${esc(west)}</gco:Decimal></gmd:westBoundLongitude>
              <gmd:eastBoundLongitude><gco:Decimal>${esc(east)}</gco:Decimal></gmd:eastBoundLongitude>
              <gmd:southBoundLatitude><gco:Decimal>${esc(south)}</gco:Decimal></gmd:southBoundLatitude>
              <gmd:northBoundLatitude><gco:Decimal>${esc(north)}</gco:Decimal></gmd:northBoundLatitude>
            </gmd:EX_GeographicBoundingBox>
          </gmd:geographicElement>\n`
    : ''

  const temporalInstantBlocks = []
  if (startDate) {
    temporalInstantBlocks.push(`          <gmd:temporalElement>
            <gmd:EX_TemporalExtent>
              <gmd:extent>
                <gml:TimeInstant gml:id="start">
                  <gml:timePosition>${esc(startDate)}</gml:timePosition>
                </gml:TimeInstant>
              </gmd:extent>
            </gmd:EX_TemporalExtent>
          </gmd:temporalElement>`)
  }
  if (endDate) {
    temporalInstantBlocks.push(`          <gmd:temporalElement>
            <gmd:EX_TemporalExtent>
              <gmd:extent>
                <gml:TimeInstant gml:id="end">
                  <gml:timePosition>${esc(endDate)}</gml:timePosition>
                </gml:TimeInstant>
              </gmd:extent>
            </gmd:EX_TemporalExtent>
          </gmd:temporalElement>`)
  }
  const temporalXml = temporalInstantBlocks.length ? `${temporalInstantBlocks.join('\n')}\n` : ''

  const hasNumericBbox = [west, east, south, north].every((v) => v !== '' && !Number.isNaN(Number.parseFloat(v)))
  const spatialTemporalXml = hasNumericBbox && (startDate || endDate)
    ? `          <gmd:spatialTemporalElement>
            <gmd:EX_SpatialTemporalExtent>
              <gmd:extent>
                <gml:TimePeriod gml:id="granuleSpatiotemporalExtent">
                  ${startDate ? `<gml:beginPosition>${esc(startDate)}</gml:beginPosition>` : '<gml:beginPosition indeterminatePosition="unknown"/>'}
                  ${endDate ? `\n                  <gml:endPosition>${esc(endDate)}</gml:endPosition>` : '\n                  <gml:endPosition indeterminatePosition="unknown"/>'}
                </gml:TimePeriod>
              </gmd:extent>
              <gmd:geographicElement>
                <gmd:EX_GeographicBoundingBox>
                  <gmd:westBoundLongitude><gco:Decimal>${esc(west)}</gco:Decimal></gmd:westBoundLongitude>
                  <gmd:eastBoundLongitude><gco:Decimal>${esc(east)}</gco:Decimal></gmd:eastBoundLongitude>
                  <gmd:southBoundLatitude><gco:Decimal>${esc(south)}</gco:Decimal></gmd:southBoundLatitude>
                  <gmd:northBoundLatitude><gco:Decimal>${esc(north)}</gco:Decimal></gmd:northBoundLatitude>
                </gmd:EX_GeographicBoundingBox>
              </gmd:geographicElement>
            </gmd:EX_SpatialTemporalExtent>
          </gmd:spatialTemporalElement>\n`
    : ''

  const vertXml = (() => {
    const vmin = Number.parseFloat(minD)
    const vmax = Number.parseFloat(maxD)
    const hasMin = Number.isFinite(vmin)
    const hasMax = Number.isFinite(vmax)
    if (!hasMin && !hasMax) return ''
    return `          <gmd:verticalElement>
            <gmd:EX_VerticalExtent>
              ${hasMin ? `<gmd:minimumValue><gco:Real>${vmin}</gco:Real></gmd:minimumValue>` : ''}
              ${hasMax ? `<gmd:maximumValue><gco:Real>${vmax}</gco:Real></gmd:maximumValue>` : ''}
            </gmd:EX_VerticalExtent>
          </gmd:verticalElement>\n`
  })()

  const oerKwXml = oerKw.length
    ? `      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
${oerKw.map((k) => `          <gmd:keyword><gco:CharacterString>${esc(String(k))}</gco:CharacterString></gmd:keyword>`).join('\n')}
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>\n`
    : ''

  const dcBlock = gcmdSingleKeywordBlock(dcKw, 'dataCentre', 'GCMD Data Center Keywords', '19.6.0', dataCenterKeywordHref)
  const instBlock = gcmdSingleKeywordBlock(instKw, 'instrument', 'GCMD Instruments', '11.3.0', instrumentKeywordHref)

  const idPocXlinkLines = []
  if (contactNceiHref) {
    idPocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactNceiHref)}" xlink:title="NCEI (pointOfContact)"/>`)
  }
  if (contactOerHref) {
    idPocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactOerHref)}" xlink:title="NOAA Ocean Exploration and Research (pointOfContact)"/>`)
  }
  if (contactPiHref) {
    const piTitle = piName ? `${piName} (pointOfContact)` : 'Principal investigator (pointOfContact)'
    idPocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactPiHref)}" xlink:title="${esc(piTitle)}"/>`)
  }
  const idPocXlinkXml = idPocXlinkLines.length ? `${idPocXlinkLines.join('\n')}\n` : ''

  const defaultGranuleUseLimitation =
    'These granule data are intended for scholarly research and education. Cite the parent collection, '
    + 'this granule metadata identifier, and NCEI accession where applicable when publishing derived results.'

  const resourceConstraintsGranuleXml = `      <gmd:resourceConstraints>
        <gmd:MD_LegalConstraints>
          <gmd:accessConstraints>
            <gmd:MD_RestrictionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_RestrictionCode" codeListValue="otherRestrictions">otherRestrictions</gmd:MD_RestrictionCode>
          </gmd:accessConstraints>
          <gmd:useLimitation>
            <gco:CharacterString>${esc(resourceUseLimitation || defaultGranuleUseLimitation)}</gco:CharacterString>
          </gmd:useLimitation>
        </gmd:MD_LegalConstraints>
      </gmd:resourceConstraints>\n`

  const citedPartyXml = (piName || piOrg || piEmail)
    ? `          <gmd:citedResponsibleParty>
            <gmd:CI_ResponsibleParty>
              ${piName ? `<gmd:individualName><gco:CharacterString>${esc(piName)}</gco:CharacterString></gmd:individualName>` : ''}
              ${piOrg ? `<gmd:organisationName><gco:CharacterString>${esc(piOrg)}</gco:CharacterString></gmd:organisationName>` : ''}
              ${piEmail ? `<gmd:contactInfo><gmd:CI_Contact><gmd:address><gmd:CI_Address><gmd:electronicMailAddress><gco:CharacterString>${esc(piEmail)}</gco:CharacterString></gmd:electronicMailAddress></gmd:CI_Address></gmd:address></gmd:CI_Contact></gmd:contactInfo>` : ''}
              <gmd:role>
                <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="author">author</gmd:CI_RoleCode>
              </gmd:role>
            </gmd:CI_ResponsibleParty>
          </gmd:citedResponsibleParty>\n`
    : ''

  const aggXml = []
  if (pRef || pUrl) {
    aggXml.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#DS_AssociationTypeCode" codeListValue="largerWorkCitation">largerWorkCitation</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          ${pRef ? `<gmd:title><gco:CharacterString>${esc(pRef)}</gco:CharacterString></gmd:title>` : ''}
          ${pUrl ? `<gmd:metadataReference>
            <gmd:CI_Citation>
              <gmd:onlineResource>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(pUrl)}</gmd:URL></gmd:linkage>
                </gmd:CI_OnlineResource>
              </gmd:onlineResource>
            </gmd:CI_Citation>
          </gmd:metadataReference>` : ''}
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }
  if (diveRep) {
    aggXml.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#DS_AssociationTypeCode" codeListValue="crossReference">crossReference</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          <gmd:metadataReference>
            <gmd:CI_Citation>
              <gmd:onlineResource>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(diveRep)}</gmd:URL></gmd:linkage>
                </gmd:CI_OnlineResource>
              </gmd:onlineResource>
            </gmd:CI_Citation>
          </gmd:metadataReference>
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }

  const obsXml = obs
    .map((o) => String(o || '').trim())
    .filter(Boolean)
    .map((o) => `          <gmd:MD_Band>
            <gmd:descriptor><gco:CharacterString>${esc(o)}</gco:CharacterString></gmd:descriptor>
          </gmd:MD_Band>`)
    .join('\n')

  const distributorContactXml = contactNceiHref
    ? `          <gmd:distributorContact xlink:href="${esc(contactNceiHref)}" xlink:title="NCEI (distributor)"/>\n`
    : ''

  const distributionOrderXml = `          <gmd:distributionOrderProcess>
            <gmd:MD_StandardOrderProcess>
              <gmd:fees>
                <gco:CharacterString>In most cases, electronic downloads of the data are free. However, fees may apply for custom orders, data certifications, copies of analog materials, and data distribution on physical media.</gco:CharacterString>
              </gmd:fees>
              <gmd:orderingInstructions>
                <gco:CharacterString>Contact NCEI for other distribution options and instructions.</gco:CharacterString>
              </gmd:orderingInstructions>
            </gmd:MD_StandardOrderProcess>
          </gmd:distributionOrderProcess>\n`

  const onlineGranule = []
  if (vidFn) {
    onlineGranule.push(`              <gmd:onLine>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(vidFn)}</gmd:URL></gmd:linkage>
                  <gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol>
                  <gmd:applicationProfile><gco:CharacterString>download</gco:CharacterString></gmd:applicationProfile>
                  <gmd:name><gco:CharacterString>Video file</gco:CharacterString></gmd:name>
                  <gmd:function>
                    <gmd:CI_OnLineFunctionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="download">download</gmd:CI_OnLineFunctionCode>
                  </gmd:function>
                </gmd:CI_OnlineResource>
              </gmd:onLine>`)
  }
  if (land) {
    onlineGranule.push(`              <gmd:onLine>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(land)}</gmd:URL></gmd:linkage>
                  <gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol>
                  <gmd:applicationProfile><gco:CharacterString>web browser</gco:CharacterString></gmd:applicationProfile>
                  <gmd:name><gco:CharacterString>NCEI Dataset Landing Page</gco:CharacterString></gmd:name>
                  <gmd:description><gco:CharacterString>Information for contacts and distribution of this data set.</gco:CharacterString></gmd:description>
                  <gmd:function>
                    <gmd:CI_OnLineFunctionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</gmd:CI_OnLineFunctionCode>
                  </gmd:function>
                </gmd:CI_OnlineResource>
              </gmd:onLine>`)
  }
  if (granulesSearchUrl) {
    onlineGranule.push(`              <gmd:onLine>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(granulesSearchUrl)}</gmd:URL></gmd:linkage>
                  <gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol>
                  <gmd:applicationProfile><gco:CharacterString>web browser</gco:CharacterString></gmd:applicationProfile>
                  <gmd:name><gco:CharacterString>Granule Search</gco:CharacterString></gmd:name>
                  <gmd:description><gco:CharacterString>Information for contacts and distribution of this data set.</gco:CharacterString></gmd:description>
                  <gmd:function>
                    <gmd:CI_OnLineFunctionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="search">search</gmd:CI_OnLineFunctionCode>
                  </gmd:function>
                </gmd:CI_OnlineResource>
              </gmd:onLine>`)
  }

  const formatInnerXml = vidFmt
    ? `              <gmd:MD_Format>
                <gmd:name><gco:CharacterString>${esc(vidFmt)}</gco:CharacterString></gmd:name>
              </gmd:MD_Format>\n`
    : ''

  const needsDistribution = Boolean(vidFmt || vidFn || land || granulesSearchUrl || contactNceiHref)
  const distInnerXml = `${distributorContactXml}${distributionOrderXml}          <gmd:distributorTransferOptions>
            <gmd:MD_DigitalTransferOptions>
${formatInnerXml}${onlineGranule.join('\n') || '              <!-- Add videoFilename, landingPageUrl, granulesSearchUrl, or contactNceiHref -->'}
            </gmd:MD_DigitalTransferOptions>
          </gmd:distributorTransferOptions>\n`

  const distXml = needsDistribution
    ? `  <gmd:distributionInfo>
    <gmd:MD_Distribution>
      <gmd:distributor>
        <gmd:MD_Distributor>
${distInnerXml}        </gmd:MD_Distributor>
      </gmd:distributor>
    </gmd:MD_Distribution>
  </gmd:distributionInfo>\n`
    : ''

  const statusXml = status
    ? `      <gmd:status>
        <gmd:MD_ProgressCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ProgressCode" codeListValue="${esc(status)}">${esc(status)}</gmd:MD_ProgressCode>
      </gmd:status>\n`
    : ''

  const contentXml = obsXml
    ? `      <gmd:contentInfo>
        <gmd:MD_ImageDescription>
${obsXml}
        </gmd:MD_ImageDescription>
      </gmd:contentInfo>\n`
    : ''

  const metadataMaintenanceXml = `  <gmd:metadataMaintenance>
    <gmd:MD_MaintenanceInformation>
      <gmd:maintenanceAndUpdateFrequency>
        <gmd:MD_MaintenanceFrequencyCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_MaintenanceFrequencyCode" codeListValue="notPlanned">notPlanned</gmd:MD_MaintenanceFrequencyCode>
      </gmd:maintenanceAndUpdateFrequency>
    </gmd:MD_MaintenanceInformation>
  </gmd:metadataMaintenance>\n`

  return `<?xml version="1.0" encoding="UTF-8"?>
<gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:gmd="http://www.isotc211.org/2005/gmd"
  xmlns:gco="http://www.isotc211.org/2005/gco"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:gsr="http://www.isotc211.org/2005/gsr"
  xmlns:gss="http://www.isotc211.org/2005/gss"
  xmlns:gts="http://www.isotc211.org/2005/gts"
  xmlns:srv="http://www.isotc211.org/2005/srv"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.isotc211.org/2005/gmi https://data.noaa.gov/resources/iso19139/schema.xsd"${rootUuidAttr}>
  <gmd:fileIdentifier>
    <gco:CharacterString>${esc(fileId || 'gov.noaa.ncei.oer:REPLACE_GRANULE')}</gco:CharacterString>
  </gmd:fileIdentifier>
  <gmd:language>
    <gco:CharacterString>eng; USA</gco:CharacterString>
  </gmd:language>
  <gmd:characterSet>
    <gmd:MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_CharacterSetCode" codeListValue="utf8">utf8</gmd:MD_CharacterSetCode>
  </gmd:characterSet>
${parentIdentXml}${rootContactXml}  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="${esc(hl)}">${esc(hl)}</gmd:MD_ScopeCode>
  </gmd:hierarchyLevel>
  <gmd:hierarchyLevelName>
    <gco:CharacterString>${esc(hln)}</gco:CharacterString>
  </gmd:hierarchyLevelName>
  <gmd:dateStamp>
    <gco:Date>${esc(creationDate || new Date().toISOString().slice(0, 10))}</gco:Date>
  </gmd:dateStamp>
  <gmd:metadataStandardName>
    <gco:CharacterString>ISO 19115-2 Geographic Information - Metadata - Part 2: Extensions for Imagery and Gridded Data</gco:CharacterString>
  </gmd:metadataStandardName>
  <gmd:metadataStandardVersion>
    <gco:CharacterString>ISO 19115-2:2009(E)</gco:CharacterString>
  </gmd:metadataStandardVersion>
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:citation>
        <gmd:CI_Citation>
          <gmd:title>
            <gco:CharacterString>${esc(title || 'BEDI granule title')}</gco:CharacterString>
          </gmd:title>
${altXml}${creationDateXml}${granuleIdXml}
          <gmd:presentationForm>
            <gmd:CI_PresentationFormCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_PresentationFormCode" codeListValue="${esc(pres)}">${esc(pres)}</gmd:CI_PresentationFormCode>
          </gmd:presentationForm>
${citedPartyXml}        </gmd:CI_Citation>
      </gmd:citation>
      <gmd:abstract>
        <gco:CharacterString>${esc(abstract || '—')}</gco:CharacterString>
      </gmd:abstract>
${statusXml}${idPocXlinkXml}${oerKwXml}${dcBlock}${instBlock}${resourceConstraintsGranuleXml}      <gmd:extent>
        <gmd:EX_Extent id="${extentXmlId}">
${bboxXml}${temporalXml}${vertXml}${spatialTemporalXml}        </gmd:EX_Extent>
      </gmd:extent>
${aggXml.join('\n')}
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
${contentXml}${distXml}${metadataMaintenanceXml}  <gmd:dataQualityInfo>
    <gmd:DQ_DataQuality>
      <gmd:scope>
        <gmd:DQ_Scope>
          <gmd:level>
            <gmd:MD_ScopeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset">dataset</gmd:MD_ScopeCode>
          </gmd:level>
        </gmd:DQ_Scope>
      </gmd:scope>
      <gmd:lineage>
        <gmd:LI_Lineage>
          <gmd:statement>
            <gco:CharacterString>Granule-level lineage placeholder — replace with dive and video-processing documentation for publication.</gco:CharacterString>
          </gmd:statement>
        </gmd:LI_Lineage>
      </gmd:lineage>
    </gmd:DQ_DataQuality>
  </gmd:dataQualityInfo>
</gmi:MI_Metadata>
`
}
