/**
 * ISO 19115-2 `gmi:MI_Metadata` preview for BEDI **collection** (fieldSession) state.
 * Mirrors the shapes consumed by {@link parseBediCollectionXml} — not every
 * docucomp xlink from NCEI templates, but a round-trippable, well-formed document.
 *
 * **NCEI OER cruise template:** Mirrors common OER cruise packages: extra
 * `xmlns:*`, docucomp xlinks, bare cruise `MD_Identifier`, GCMD thesaurus
 * citations (publication date + edition), dual `gml:TimeInstant` temporal
 * elements, `MD_LegalConstraints` / `useLimitation`, distributor block,
 * `metadataMaintenance`, `EX_SpatialTemporalExtent` (bbox + `TimePeriod`), and
 * GCMD `gmx:Anchor` science/datacenter keywords.
 *
 * @module lib/bediCollectionXmlPreview
 */

import { escBediXml as esc } from './bediXmlEscape.js'

/**
 * @typedef {{ publicationDate?: string, edition?: string }} GcmdThesaurusMeta
 */

/**
 * @param {string[]} list
 * @param {string} typeCode
 * @param {string} thesaurusTitle
 * @param {GcmdThesaurusMeta} [thesaurusMeta]
 * @param {'characterString' | 'gcmdAnchor'} [keywordKind]
 * @returns {string}
 */
function keywordBlock(list, typeCode, thesaurusTitle, thesaurusMeta, keywordKind = 'characterString', hrefList) {
  const items = (Array.isArray(list) ? list : []).map((k) => String(k || '').trim()).filter(Boolean)
  if (!items.length) return ''
  const hrefs = Array.isArray(hrefList) ? hrefList : []
  const kwInner = items.map((k, i) => {
    if (keywordKind === 'gcmdAnchor') {
      const explicit = String(hrefs[i] || '').trim()
      const href = explicit || `https://gcmd.earthdata.nasa.gov/kms/concept?q=${encodeURIComponent(k)}`
      return `          <gmd:keyword>\n            <gmx:Anchor xlink:href="${esc(href)}" xlink:title="${esc(k)}">${esc(k)}</gmx:Anchor>\n          </gmd:keyword>`
    }
    return `          <gmd:keyword>\n            <gco:CharacterString>${esc(k)}</gco:CharacterString>\n          </gmd:keyword>`
  }).join('\n')
  const dateInner = thesaurusMeta?.publicationDate
    ? `          <gmd:date>
            <gmd:CI_Date>
              <gmd:date><gco:Date>${esc(thesaurusMeta.publicationDate)}</gco:Date></gmd:date>
              <gmd:dateType>
                <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="publication">publication</gmd:CI_DateTypeCode>
              </gmd:dateType>
            </gmd:CI_Date>
          </gmd:date>\n`
    : '          <gmd:date gco:nilReason="inapplicable"/>\n'
  const editionInner = thesaurusMeta?.edition
    ? `          <gmd:edition><gco:CharacterString>${esc(thesaurusMeta.edition)}</gco:CharacterString></gmd:edition>\n`
    : ''
  return `      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
${kwInner}
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="${esc(typeCode)}">${esc(typeCode)}</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(thesaurusTitle)}</gco:CharacterString></gmd:title>
${dateInner}${editionInner}            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>\n`
}

/**
 * @param {object} s  BEDI collection profile state
 * @returns {string}
 */
export function buildBediCollectionXmlPreview(s) {
  const fileId = String(s.fileId || '').trim()
  const title = String(s.title || '').trim()
  const alt1 = String(s.alternateTitle || '').trim()
  const vessel = String(s.vesselName || '').trim()
  const hl = String(s.hierarchyLevel || 'fieldSession').trim() || 'fieldSession'
  const hln = String(s.hierarchyLevelName || 'Project Level Metadata').trim() || 'Project Level Metadata'
  const abstract = String(s.abstract || '').trim()
  const purpose = String(s.purpose || '').trim()
  const status = String(s.status || '').trim()
  const creationDate = String(s.creationDate || '').trim()
  const browse = String(s.browseGraphicUrl || '').trim()
  const collId = String(s.collectionId || '').trim()
  const acc = String(s.nceiAccessionId || '').trim()
  const metaId = String(s.nceiMetadataId || '').trim()
  const west = String(s.west || '').trim()
  const east = String(s.east || '').trim()
  const south = String(s.south || '').trim()
  const north = String(s.north || '').trim()
  const startDate = String(s.startDate || '').trim()
  const endDate = String(s.endDate || '').trim()
  const land = String(s.landingPageUrl || '').trim()
  const gran = String(s.granulesSearchUrl || '').trim()
  const piName = String(s.piName || '').trim()
  const piOrg = String(s.piOrg || '').trim()
  const piEmail = String(s.piEmail || '').trim()
  const platforms = Array.isArray(s.platforms) ? s.platforms : []
  const metaUuid = String(s.metadataUuid || '').trim()
  const contactNceiHref = String(s.contactNceiHref || '').trim()
  const contactOerHref = String(s.contactOerHref || '').trim()
  const contactPiHref = String(s.contactPiHref || '').trim()
  const resourceUseLimitation = String(s.resourceUseLimitation || '').trim()
  const scienceKeywordHrefs = Array.isArray(s.scienceKeywordHrefs) ? s.scienceKeywordHrefs : []
  const datacenterKeywordHrefs = Array.isArray(s.datacenterKeywordHrefs) ? s.datacenterKeywordHrefs : []

  const rootUuidAttr = metaUuid ? ` uuid="${esc(metaUuid)}"` : ''

  /** GCMD Keyword Version SKOS publication (aligns with common NCEI OER cruise XML). */
  const gcmdThesaurusMeta = Object.freeze({
    publicationDate: '2024-05-14',
    edition:         '19.6.0',
  })

  const altTitleXml = [alt1, vessel].filter(Boolean).map((t) => `          <gmd:alternateTitle>\n            <gco:CharacterString>${esc(t)}</gco:CharacterString>\n          </gmd:alternateTitle>`).join('\n')

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

  const idBlocks = []
  if (collId) {
    idBlocks.push(`          <gmd:identifier>
            <gmd:MD_Identifier>
              <gmd:code><gco:CharacterString>${esc(collId)}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmd:identifier>`)
  }
  if (acc) {
    idBlocks.push(`          <gmd:identifier>
            <gmd:MD_Identifier>
              <gmd:authority>
                <gmd:CI_Citation>
                  <gmd:title><gco:CharacterString>NCEI Archive Management System</gco:CharacterString></gmd:title>
                  <gmd:date gco:nilReason="inapplicable"/>
                </gmd:CI_Citation>
              </gmd:authority>
              <gmd:code><gco:CharacterString>NCEI Accession ID: ${esc(acc)}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmd:identifier>`)
  }
  if (metaId) {
    idBlocks.push(`          <gmd:identifier>
            <gmd:MD_Identifier>
              <gmd:authority>
                <gmd:CI_Citation>
                  <gmd:title><gco:CharacterString>NOAA National Centers for Environmental Information</gco:CharacterString></gmd:title>
                  <gmd:date gco:nilReason="inapplicable"/>
                </gmd:CI_Citation>
              </gmd:authority>
              <gmd:code><gco:CharacterString>NCEI Metadata ID: ${esc(metaId)}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmd:identifier>`)
  }

  const rootContactXml = contactNceiHref
    ? `  <gmd:contact xlink:href="${esc(contactNceiHref)}" xlink:title="NCEI (pointOfContact)"/>\n`
    : ''

  const pocXlinkLines = []
  if (contactNceiHref) {
    pocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactNceiHref)}" xlink:title="NCEI (pointOfContact)"/>`)
  }
  if (contactOerHref) {
    pocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactOerHref)}" xlink:title="NOAA Ocean Exploration and Research (pointOfContact)"/>`)
  }
  if (contactPiHref) {
    const piTitle = piName ? `${piName} (pointOfContact)` : 'Principal investigator (pointOfContact)'
    pocXlinkLines.push(`      <gmd:pointOfContact xlink:href="${esc(contactPiHref)}" xlink:title="${esc(piTitle)}"/>`)
  }
  const pocXlinkXml = pocXlinkLines.length ? `${pocXlinkLines.join('\n')}\n` : ''

  const piInlineXml = !contactPiHref && (piName || piOrg || piEmail)
    ? `      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          ${piName ? `<gmd:individualName><gco:CharacterString>${esc(piName)}</gco:CharacterString></gmd:individualName>` : ''}
          ${piOrg ? `<gmd:organisationName><gco:CharacterString>${esc(piOrg)}</gco:CharacterString></gmd:organisationName>` : ''}
          ${piEmail ? `<gmd:contactInfo><gmd:CI_Contact><gmd:address><gmd:CI_Address><gmd:electronicMailAddress><gco:CharacterString>${esc(piEmail)}</gco:CharacterString></gmd:electronicMailAddress></gmd:CI_Address></gmd:address></gmd:CI_Contact></gmd:contactInfo>` : ''}
          <gmd:role>
            <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
          </gmd:role>
        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>\n`
    : ''

  const resourceMaintenanceXml = `      <gmd:resourceMaintenance>
        <gmd:MD_MaintenanceInformation>
          <gmd:maintenanceAndUpdateFrequency>
            <gmd:MD_MaintenanceFrequencyCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_MaintenanceFrequencyCode" codeListValue="notPlanned">notPlanned</gmd:MD_MaintenanceFrequencyCode>
          </gmd:maintenanceAndUpdateFrequency>
        </gmd:MD_MaintenanceInformation>
      </gmd:resourceMaintenance>\n`

  const topicCategoryXml = `      <gmd:topicCategory>
        <gmd:MD_TopicCategoryCode>oceans</gmd:MD_TopicCategoryCode>
      </gmd:topicCategory>
      <gmd:topicCategory>
        <gmd:MD_TopicCategoryCode>geoscientificInformation</gmd:MD_TopicCategoryCode>
      </gmd:topicCategory>\n`

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

  const metadataMaintenanceXml = `  <gmd:metadataMaintenance>
    <gmd:MD_MaintenanceInformation>
      <gmd:maintenanceAndUpdateFrequency>
        <gmd:MD_MaintenanceFrequencyCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_MaintenanceFrequencyCode" codeListValue="notPlanned">notPlanned</gmd:MD_MaintenanceFrequencyCode>
      </gmd:maintenanceAndUpdateFrequency>
    </gmd:MD_MaintenanceInformation>
  </gmd:metadataMaintenance>\n`

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
                <gml:TimePeriod gml:id="cruiseSpatiotemporalExtent">
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

  const defaultUseLimitation =
    'These data are intended for scholarly research and education. NOAA Ocean Exploration '
    + 'and NCEI recommend citing the cruise accession and this metadata record when publishing '
    + 'results derived from these data. Use does not imply endorsement of any product or service.'

  const resourceConstraintsXml = `      <gmd:resourceConstraints>
        <gmd:MD_LegalConstraints>
          <gmd:accessConstraints>
            <gmd:MD_RestrictionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_RestrictionCode" codeListValue="otherRestrictions">otherRestrictions</gmd:MD_RestrictionCode>
          </gmd:accessConstraints>
          <gmd:useLimitation>
            <gco:CharacterString>${esc(resourceUseLimitation || defaultUseLimitation)}</gco:CharacterString>
          </gmd:useLimitation>
        </gmd:MD_LegalConstraints>
      </gmd:resourceConstraints>\n`

  const onlineXml = []
  if (land) {
    onlineXml.push(`              <gmd:onLine>
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
  if (gran) {
    onlineXml.push(`              <gmd:onLine>
                <gmd:CI_OnlineResource>
                  <gmd:linkage><gmd:URL>${esc(gran)}</gmd:URL></gmd:linkage>
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

  const platformXml = platforms
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('http')
      ? `      <gmi:platform xlink:href="${esc(p)}" xlink:title="Platform"/>`
      : `      <gmi:platform xlink:title="${esc(p)}"/>`))
    .join('\n')

  const graphicXml = browse
    ? `      <gmd:graphicOverview>
        <gmd:MD_BrowseGraphic>
          <gmd:fileName><gco:CharacterString>${esc(browse)}</gco:CharacterString></gmd:fileName>
        </gmd:MD_BrowseGraphic>
      </gmd:graphicOverview>\n`
    : ''

  const statusXml = status
    ? `      <gmd:status>
        <gmd:MD_ProgressCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ProgressCode" codeListValue="${esc(status)}">${esc(status)}</gmd:MD_ProgressCode>
      </gmd:status>\n`
    : ''

  const distributionInnerXml = `${distributorContactXml}${distributionOrderXml}          <gmd:distributorTransferOptions>
            <gmd:MD_DigitalTransferOptions>
${onlineXml.join('\n') || '              <!-- Add landingPageUrl / granulesSearchUrl in Distribution step -->'}
            </gmd:MD_DigitalTransferOptions>
          </gmd:distributorTransferOptions>\n`

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
    <gco:CharacterString>${esc(fileId || 'gov.noaa.ncei.oer:REPLACE_COLLECTION')}</gco:CharacterString>
  </gmd:fileIdentifier>
  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="${esc(hl)}">${esc(hl)}</gmd:MD_ScopeCode>
  </gmd:hierarchyLevel>
  <gmd:hierarchyLevelName>
    <gco:CharacterString>${esc(hln)}</gco:CharacterString>
  </gmd:hierarchyLevelName>
${rootContactXml}  <gmd:dateStamp>
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
            <gco:CharacterString>${esc(title || 'BEDI collection title')}</gco:CharacterString>
          </gmd:title>
${altTitleXml}
${creationDateXml}${idBlocks.join('\n')}
        </gmd:CI_Citation>
      </gmd:citation>
      <gmd:abstract>
        <gco:CharacterString>${esc(abstract || '—')}</gco:CharacterString>
      </gmd:abstract>
      ${purpose ? `<gmd:purpose><gco:CharacterString>${esc(purpose)}</gco:CharacterString></gmd:purpose>\n` : ''}${statusXml}${pocXlinkXml}${piInlineXml}${resourceMaintenanceXml}${graphicXml}${keywordBlock(s.scienceKeywords, 'theme', 'GCMD Science Keywords', gcmdThesaurusMeta, 'gcmdAnchor', scienceKeywordHrefs)}${keywordBlock(s.placeKeywords, 'place', 'Provider Place Names')}${keywordBlock(s.datacenters, 'dataCentre', 'GCMD Data Center Keywords', gcmdThesaurusMeta, 'gcmdAnchor', datacenterKeywordHrefs)}${keywordBlock(s.oerKeywords, 'theme', 'Provider / OER keywords')}
      <gmd:language>
        <gco:CharacterString>eng; USA</gco:CharacterString>
      </gmd:language>
${topicCategoryXml}${resourceConstraintsXml}      <gmd:extent>
        <gmd:EX_Extent>
${bboxXml}${temporalXml}${spatialTemporalXml}        </gmd:EX_Extent>
      </gmd:extent>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmd:distributionInfo>
    <gmd:MD_Distribution>
      <gmd:distributor>
        <gmd:MD_Distributor>
${distributionInnerXml}        </gmd:MD_Distributor>
      </gmd:distributor>
    </gmd:MD_Distribution>
  </gmd:distributionInfo>
${metadataMaintenanceXml}  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
${platformXml || '      <!-- Add platform xlink titles in Extent step -->'}
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>
`
}
