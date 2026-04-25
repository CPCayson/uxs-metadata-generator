import { getDataLicensePresetDef, normalizeDataLicensePresetKey } from './noaaLicensePresets.js'
import { formatNceiUxsFileIdentifierForXml } from './nceiUxsFileId.js'
import { buildAcquisitionInstrumentDescription } from './sensorInstrumentDescription.js'
import { gcmdConceptUrlFromUuid as gcmdKeywordHrefFromStoredUuid } from './gcmdKmsUrl.js'

/** @param {unknown} s */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {string} roleCode  author | publisher | originator
 * @param {string} [individualName]
 * @param {string} [organisationName]
 * @returns {string}
 */
function buildCitedResponsiblePartyXml(roleCode, individualName, organisationName) {
  const ind = String(individualName || '').trim()
  const org = String(organisationName || '').trim()
  if (!ind && !org) return ''
  const lines = []
  if (ind) {
    lines.push(
      `          <gmd:individualName><gco:CharacterString>${esc(ind)}</gco:CharacterString></gmd:individualName>`,
    )
  }
  if (org) {
    lines.push(
      `          <gmd:organisationName><gco:CharacterString>${esc(org)}</gco:CharacterString></gmd:organisationName>`,
    )
  }
  lines.push(
    `          <gmd:role><gmd:CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/CI_RoleCode.xml#CI_RoleCode" codeListValue="${esc(roleCode)}">${esc(roleCode)}</gmd:CI_RoleCode></gmd:role>`,
  )
  return `          <gmd:citedResponsibleParty>
        <gmd:CI_ResponsibleParty>
${lines.join('\n')}
        </gmd:CI_ResponsibleParty>
      </gmd:citedResponsibleParty>`
}

/**
 * Sanitize an arbitrary string into a valid XML NCName for use as an @id value.
 * XML ids must start with a letter or underscore and may only contain letters,
 * digits, '.', '-', or '_'.  Raw metadata identifiers (UUIDs, accession numbers,
 * sensor codes) must pass through this before being placed in @id attributes.
 *
 * @param {string} raw
 * @returns {string}
 */
function toXmlId(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return '_'
  return s
    .replace(/^[^A-Za-z_]+/, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
}

/**
 * Emit a wrapping gmd:* tag containing a <gco:Real> only when the value is a
 * finite number.  Empty strings, null, undefined, NaN, and non-numeric text all
 * produce an empty string — preventing invalid empty <gco:Real></gco:Real> nodes
 * that fail ISO 19139 schema validation.
 *
 * @param {string | number | null | undefined} value
 * @param {string} tag  wrapper element name e.g. 'gmd:minimumValue'
 * @returns {string}
 */
function emitReal(value, tag) {
  const n = Number.parseFloat(String(value ?? '').trim())
  if (!Number.isFinite(n)) return ''
  return `<${tag}><gco:Real>${n}</gco:Real></${tag}>`
}

/** @param {string} v */
function gcoDateOrDateTimeInner(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  return s.includes('T') ? `<gco:DateTime>${esc(s)}</gco:DateTime>` : `<gco:Date>${esc(s)}</gco:Date>`
}

/**
 * @param {string} v
 * @returns {number | null}
 */
function parsePositiveInt(v) {
  const n = parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * @param {string | undefined} s
 * @returns {'point' | 'area'}
 */
function normalizeCellGeometry(s) {
  const v = String(s || '').trim().toLowerCase()
  return v === 'point' ? 'point' : 'area'
}

/**
 * @param {'column' | 'row' | 'vertical'} codeListValue
 * @param {string} sizeVal
 * @param {string} resVal
 * @returns {string}
 */
/**
 * Decimal string for DQ_QuantitativeResult (matches UniversalXMLGenerator fallback).
 * @param {unknown} v
 * @returns {string}
 */
function numericOrZeroForDq(v) {
  const s = String(v ?? '').trim()
  if (s === '') return '0'
  const n = Number(s)
  return Number.isFinite(n) ? String(n) : '0'
}

/**
 * @param {string} recordTypeLabel
 * @param {string} decValue
 * @returns {string}
 */
function dqQuantitativeResultXml(recordTypeLabel, decValue) {
  return `<gmd:DQ_QuantitativeResult>
          <gco:valueType>
            <gco:RecordType>${esc(recordTypeLabel)}</gco:RecordType>
          </gco:valueType>
          <gco:value>
            <gco:Record>
              <gmi:Quantity>
                <gco:Decimal>${esc(decValue)}</gco:Decimal>
                <gco:uom>m</gco:uom>
              </gmi:Quantity>
            </gco:Record>
          </gco:value>
        </gmd:DQ_QuantitativeResult>`
}

/**
 * @param {object} sp state.spatial
 * @returns {string}
 */
function buildLineageXml(sp) {
  const st = String(sp?.lineageStatement || '').trim()
  const stepsRaw = String(sp?.lineageProcessSteps || '').trim()
  if (!st && !stepsRaw) return ''
  const steps = stepsRaw ? stepsRaw.split(/\n\n+/).map((s) => s.trim()).filter(Boolean) : []
  const stepsXml = steps
    .map(
      (d) => `    <gmd:processStep>
      <gmd:LI_ProcessStep>
        <gmd:description><gco:CharacterString>${esc(d)}</gco:CharacterString></gmd:description>
      </gmd:LI_ProcessStep>
    </gmd:processStep>`,
    )
    .join('\n')
  const stmtXml = st
    ? `    <gmd:statement><gco:CharacterString>${esc(st)}</gco:CharacterString></gmd:statement>\n`
    : ''
  return `    <gmd:lineage>
      <gmd:LI_Lineage>
${stmtXml}${stepsXml}
      </gmd:LI_Lineage>
    </gmd:lineage>`
}

/**
 * Mirrors `UniversalXMLGenerator.addDataQualityInfo` + import paths in `SchemaValidator.gs`
 * (`gco:valueType` / `gco:value` children of `DQ_QuantitativeResult`).
 * @param {object} sp state.spatial
 * @returns {string}
 */
function buildDataQualityInfoXml(sp) {
  const hasAcc = String(sp?.accuracyStandard || '').trim()
  const hasErr = String(sp?.errorLevel || '').trim()
  const hasLineage =
    String(sp?.lineageStatement || '').trim() || String(sp?.lineageProcessSteps || '').trim()
  if (!hasAcc && !hasErr && !hasLineage) return ''

  const scopeBlock = `    <gmd:scope>
      <gmd:DQ_Scope>
        <gmd:level>
          <gmd:MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/MD_ScopeCode.xml#MD_ScopeCode" codeListValue="dataset">dataset</gmd:MD_ScopeCode>
        </gmd:level>
      </gmd:DQ_Scope>
    </gmd:scope>`

  const reports = []
  if (hasAcc) {
    const dec = numericOrZeroForDq(sp.accuracyValue)
    reports.push(`    <gmd:report>
      <gmd:DQ_QuantitativeAttributeAccuracy>
        <gmd:result>
          ${dqQuantitativeResultXml(String(sp.accuracyStandard).trim(), dec)}
        </gmd:result>
      </gmd:DQ_QuantitativeAttributeAccuracy>
    </gmd:report>`)
  }
  if (hasErr) {
    const dec = numericOrZeroForDq(sp.errorValue)
    reports.push(`    <gmd:report>
      <gmd:DQ_AbsoluteExternalPositionalAccuracy>
        <gmd:result>
          ${dqQuantitativeResultXml(String(sp.errorLevel).trim(), dec)}
        </gmd:result>
      </gmd:DQ_AbsoluteExternalPositionalAccuracy>
    </gmd:report>`)
  }

  const lineageXml = hasLineage ? buildLineageXml(sp) : ''

  return `  <gmd:dataQualityInfo>
    <gmd:DQ_DataQuality>
${scopeBlock}
${reports.join('\n')}
${lineageXml}
    </gmd:DQ_DataQuality>
  </gmd:dataQualityInfo>\n`
}

function gridAxisXml(codeListValue, sizeVal, resVal) {
  const size = parsePositiveInt(sizeVal)
  const res = String(resVal || '').trim()
  if (size == null && !res) return ''
  const sizeXml =
    size != null
      ? `<gmd:dimensionSize><gco:Integer>${size}</gco:Integer></gmd:dimensionSize>`
      : `<gmd:dimensionSize gco:nilReason="missing"/>`
  const resXml = res
    ? `<gmd:resolution><gco:CharacterString>${esc(res)}</gco:CharacterString></gmd:resolution>`
    : ''
  return `      <gmd:axisDimensionProperties>
        <gmd:MD_Dimension>
          <gmd:dimensionName>
            <gmd:MD_DimensionNameTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/MD_DimensionNameTypeCode.xml#MD_DimensionNameTypeCode" codeListValue="${esc(codeListValue)}">${esc(codeListValue)}</gmd:MD_DimensionNameTypeCode>
          </gmd:dimensionName>
          ${sizeXml}
          ${resXml}
        </gmd:MD_Dimension>
      </gmd:axisDimensionProperties>`
}

/**
 * One `gmi:instrument` / `MI_Instrument` block (acquisition).
 * @param {object} s
 * @param {(x: unknown) => string} escFn
 * @param {{ outer: string, inner: string, instrumentId: string | null, xlinkToPlatform: boolean }} pads
 */
function acquisitionInstrumentXmlBlock(s, escFn, pads) {
  const code = String(s.sensorId || s.modelId || '').trim()
  const typ = String(s.type || '').trim()
  const desc = buildAcquisitionInstrumentDescription(s)
  if (!code && !typ && !desc.trim()) return ''
  const I = pads.inner
  const J = `${I}  `
  const idPart = pads.instrumentId ? ` id="${toXmlId(pads.instrumentId)}"` : ''
  const xlinkPart = pads.xlinkToPlatform ? ' xlink:href="#platform"' : ''
  const miOpenAttrs = `${idPart}${xlinkPart}`
  /** @type {string[]} */
  const body = []
  if (code) {
    body.push(
      `${J}<gmd:identifier>
${J}  <gmd:MD_Identifier>
${J}    <gmd:code><gco:CharacterString>${escFn(code)}</gco:CharacterString></gmd:code>
${J}  </gmd:MD_Identifier>
${J}</gmd:identifier>`,
    )
  }
  if (typ) body.push(`${J}<gmi:type><gco:CharacterString>${escFn(typ)}</gco:CharacterString></gmi:type>`)
  if (desc) body.push(`${J}<gmd:description><gco:CharacterString>${escFn(desc)}</gco:CharacterString></gmd:description>`)
  const bodyStr = body.join('\n')
  return `${pads.outer}<gmi:instrument>
${I}<gmi:MI_Instrument${miOpenAttrs}>
${bodyStr}
${I}</gmi:MI_Instrument>
${pads.outer}</gmi:instrument>`
}

/**
 * @param {object} state from defaultPilotState / mergeLoadedPilotState
 * @returns {string}
 */
export function buildXmlPreview(state) {
  const m = state?.mission || {}
  const sp = state?.spatial || {}
  const p = state?.platform || {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors : []
  const kw = state?.keywords || {}
  const dist = state?.distribution || {}

  const omitRef = dist.omitRootReferenceSystemInfo
  const useNceiMeta = dist.useNceiMetadataContactXlink

  const kwBlock = (facet) => {
    const arr = Array.isArray(kw[facet]) ? kw[facet] : []
    if (!arr.length) return `    <!-- ${facet} -->\n`
    return arr
      .map((k) => {
        const label = String(k?.label || '').trim()
        const uuid = String(k?.uuid || '').trim()
        const href = gcmdKeywordHrefFromStoredUuid(uuid)
        const display = label || uuid
        if (!display) return ''
        const kwInner = href
          ? `        <gmd:keyword>\n          <gmx:Anchor xlink:href="${esc(href)}" xlink:actuate="onRequest">${esc(display)}</gmx:Anchor>\n        </gmd:keyword>\n`
          : `        <gmd:keyword>\n          <gco:CharacterString>${esc(display)}</gco:CharacterString>\n        </gmd:keyword>\n`
        return `    <gmd:descriptiveKeywords>\n      <gmd:MD_Keywords>\n${kwInner}        <gmd:thesaurusName>\n          <gmd:CI_Citation>\n            <gmd:title><gco:CharacterString>GCMD ${esc(facet)}</gco:CharacterString></gmd:title>\n          </gmd:CI_Citation>\n        </gmd:thesaurusName>\n      </gmd:MD_Keywords>\n    </gmd:descriptiveKeywords>\n`
      })
      .filter(Boolean)
      .join('')
  }

  const citationPartiesXml = [
    buildCitedResponsiblePartyXml('author', m.citationAuthorIndividualName, m.citationAuthorOrganisationName),
    buildCitedResponsiblePartyXml('publisher', '', m.citationPublisherOrganisationName),
    buildCitedResponsiblePartyXml('originator', m.citationOriginatorIndividualName, m.citationOriginatorOrganisationName),
  ]
    .filter(Boolean)
    .join('\n')

  const topicCategoriesXml = (Array.isArray(m.topicCategories) ? m.topicCategories : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean)
    .map(
      (c) =>
        `      <gmd:topicCategory>\n        <gmd:MD_TopicCategoryCode>${esc(c)}</gmd:MD_TopicCategoryCode>\n      </gmd:topicCategory>`,
    )
    .join('\n')

  const maintFreq = String(dist.metadataMaintenanceFrequency || 'asNeeded').trim() || 'asNeeded'
  const resourceMaintenanceXml = `      <gmd:resourceMaintenance>
        <gmd:MD_MaintenanceInformation>
          <gmd:maintenanceAndUpdateFrequency>
            <gmd:MD_MaintenanceFrequencyCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/MD_MaintenanceFrequencyCode.xml#MD_MaintenanceFrequencyCode" codeListValue="${esc(maintFreq)}">${esc(maintFreq)}</gmd:MD_MaintenanceFrequencyCode>
          </gmd:maintenanceAndUpdateFrequency>
        </gmd:MD_MaintenanceInformation>
      </gmd:resourceMaintenance>
`
  const goHref = String(m.graphicOverviewHref || '').trim()
  const goTitle = String(m.graphicOverviewTitle || '').trim()
  const graphicOverviewXml = goHref
    ? `      <gmd:graphicOverview xlink:href="${esc(goHref)}" xlink:title="${esc(goTitle || 'Graphic overview')}"/>
`
    : ''

  const sensorBlocks = sensors
    .map(
      (s, i) => {
        const covDesc = buildAcquisitionInstrumentDescription(s, { includeVariableLine: false })
        return `  <gmi:MI_CoverageDescription>
    <gmd:identifier>
      <gmd:MD_Identifier>
        <gmd:code><gco:CharacterString>${esc(s.sensorId || s.modelId || `sensor_${i + 1}`)}</gco:CharacterString></gmd:code>
      </gmd:MD_Identifier>
    </gmd:identifier>
    <gmd:attributeDescription><gco:CharacterString>${esc(s.type)}</gco:CharacterString></gmd:attributeDescription>
    <gmd:name><gco:CharacterString>${esc(s.variable)}</gco:CharacterString></gmd:name>
    ${covDesc ? `<gmd:description><gco:CharacterString>${esc(covDesc)}</gco:CharacterString></gmd:description>` : ''}
  </gmi:MI_CoverageDescription>`
      },
    )
    .join('\n')

  const rorXml = m.ror?.id
    ? `    <gmd:party>
      <gmd:CI_Organisation>
        <gmd:name><gco:CharacterString>${esc(m.org)}</gco:CharacterString></gmd:name>
        <gmd:identifier>
          <gmd:MD_Identifier>
            <gmd:code><gco:CharacterString>${esc(m.ror.id)}</gco:CharacterString></gmd:code>
          </gmd:MD_Identifier>
        </gmd:identifier>
      </gmd:CI_Organisation>
    </gmd:party>\n`
    : ''

  const citationDates = [
    m.startDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.startDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/CI_DateTypeCode.xml#CI_DateTypeCode" codeListValue="creation">creation</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
    m.publicationDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.publicationDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
    m.endDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.endDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeListValue="completion">completion</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
  ]
    .filter(Boolean)
    .join('\n          ')

  const extentDescriptions = []
  if (sp.geographicDescription) {
    extentDescriptions.push(
      `          <gmd:description><gco:CharacterString>${esc(sp.geographicDescription)}</gco:CharacterString></gmd:description>\n`,
    )
  }
  if (Boolean(sp.hasTrajectory) && String(sp.trajectorySampling || '').trim()) {
    extentDescriptions.push(
      `          <gmd:description><gco:CharacterString>Trajectory sampling: ${esc(sp.trajectorySampling)}</gco:CharacterString></gmd:description>\n`,
    )
  }
  if (sp.verticalCrsUrl) {
    extentDescriptions.push(
      `          <gmd:description><gco:CharacterString>Vertical CRS: ${esc(sp.verticalCrsUrl)}</gco:CharacterString></gmd:description>\n`,
    )
  }
  const extentDescXml = extentDescriptions.join('')

  // emitReal() omits the tag entirely for empty / non-numeric values, preventing
  // invalid <gco:Real></gco:Real> nodes that fail ISO 19139 schema validation.
  const vminXml = emitReal(m.vmin, 'gmd:minimumValue')
  const vmaxXml = emitReal(m.vmax, 'gmd:maximumValue')
  const verticalXml = (vminXml || vmaxXml)
    ? `          <gmd:verticalElement>
            <gmd:EX_VerticalExtent>
              ${vminXml}
              ${vmaxXml}
            </gmd:EX_VerticalExtent>
          </gmd:verticalElement>\n`
    : ''

  const contactExtra = [
    m.contactPhone
      ? `<gmd:phone><gmd:CI_Telephone><gmd:voice><gco:CharacterString>${esc(m.contactPhone)}</gco:CharacterString></gmd:voice></gmd:CI_Telephone></gmd:phone>`
      : '',
    m.contactUrl
      ? `<gmd:onlineResource><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(m.contactUrl)}</gmd:URL></gmd:linkage></gmd:CI_OnlineResource></gmd:onlineResource>`
      : '',
    m.contactAddress
      ? `<gmd:address><gmd:CI_Address><gmd:deliveryPoint><gco:CharacterString>${esc(m.contactAddress)}</gco:CharacterString></gmd:deliveryPoint></gmd:CI_Address></gmd:address>`
      : '',
  ]
    .filter(Boolean)
    .join('\n              ')

  const dataQualityXml = buildDataQualityInfoXml(sp)

  const refSystemXml =
    !omitRef && sp.referenceSystem
      ? `  <gmd:referenceSystemInfo>
    <gmd:MD_ReferenceSystem>
      <gmd:referenceSystemIdentifier>
        <gmd:RS_Identifier>
          <gmd:code><gco:CharacterString>${esc(sp.referenceSystem)}</gco:CharacterString></gmd:code>
        </gmd:RS_Identifier>
      </gmd:referenceSystemIdentifier>
    </gmd:MD_ReferenceSystem>
  </gmd:referenceSystemInfo>\n`
      : ''

  const metaName =
    String(dist.metadataStandard || '').trim() ||
    'ISO 19115-2 Geographic Information - Metadata - Part 2: Extensions for Imagery and Gridded Data'
  const metaVer = String(dist.metadataVersion || '').trim() || 'ISO 19115-2:2009(E)'
  const metaStdXml = `  <gmd:metadataStandardName>
    <gco:CharacterString>${esc(metaName)}</gco:CharacterString>
  </gmd:metadataStandardName>
  <gmd:metadataStandardVersion>
    <gco:CharacterString>${esc(metaVer)}</gco:CharacterString>
  </gmd:metadataStandardVersion>
`

  const nceiMetaHref = String(dist.nceiMetadataContactHref || '').trim()
  const nceiMetaTitle = String(dist.nceiMetadataContactTitle || 'NCEI (pointOfContact)').trim()
  const contactRootXml =
    useNceiMeta
      ? `  <gmd:contact${nceiMetaHref ? ` xlink:href="${esc(nceiMetaHref)}"` : ''} xlink:title="${esc(nceiMetaTitle)}"/>
`
      : ''

  const nceiDistHref = String(dist.nceiDistributorContactHref || '').trim()
  const nceiDistTitle = String(dist.nceiDistributorContactTitle || 'NCEI (distributor)').trim()
  const distInd = String(dist.distributorIndividualName || '').trim()
  const distOrg = String(dist.distributorOrganisationName || '').trim()
  const distEm = String(dist.distributorEmail || '').trim()
  const distUrl = String(dist.distributorContactUrl || '').trim()
  const distributorInlineParty =
    distInd || distOrg || distEm || distUrl
      ? `      <gmd:distributor>
        <gmd:MD_Distributor>
          <gmd:distributorContact>
            <gmd:CI_ResponsibleParty>
              ${
                distInd
                  ? `<gmd:individualName><gco:CharacterString>${esc(distInd)}</gco:CharacterString></gmd:individualName>`
                  : ''
              }
              ${
                distOrg
                  ? `<gmd:organisationName><gco:CharacterString>${esc(distOrg)}</gco:CharacterString></gmd:organisationName>`
                  : ''
              }
              <gmd:contactInfo>
                <gmd:CI_Contact>
                  <gmd:address>
                    <gmd:CI_Address>
                      ${
                        distEm
                          ? `<gmd:electronicMailAddress><gco:CharacterString>${esc(distEm)}</gco:CharacterString></gmd:electronicMailAddress>`
                          : ''
                      }
                    </gmd:CI_Address>
                  </gmd:address>
                  ${
                    distUrl
                      ? `<gmd:onlineResource><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(distUrl)}</gmd:URL></gmd:linkage></gmd:CI_OnlineResource></gmd:onlineResource>`
                      : ''
                  }
                </gmd:CI_Contact>
              </gmd:contactInfo>
              <gmd:role>
                <gmd:CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/CI_RoleCode.xml#CI_RoleCode" codeListValue="distributor">distributor</gmd:CI_RoleCode>
              </gmd:role>
            </gmd:CI_ResponsibleParty>
          </gmd:distributorContact>
        </gmd:MD_Distributor>
      </gmd:distributor>
`
      : ''
  const distributorXlinkXml = nceiDistHref
    ? `      <gmd:distributor>
        <gmd:MD_Distributor>
          <gmd:distributorContact xlink:href="${esc(nceiDistHref)}" xlink:title="${esc(nceiDistTitle)}"/>
        </gmd:MD_Distributor>
      </gmd:distributor>
`
    : distributorInlineParty ||
      `      <gmd:distributor>
        <gmd:MD_Distributor>
          <gmd:distributorContact xlink:title="${esc(nceiDistTitle)}"/>
        </gmd:MD_Distributor>
      </gmd:distributor>
`

  const hasPlatformSpecDims =
    String(p.weight || '').trim() ||
    String(p.length || '').trim() ||
    String(p.width || '').trim() ||
    String(p.height || '').trim() ||
    String(p.material || '').trim() ||
    String(p.speed || '').trim() ||
    String(p.operationalArea || '').trim()

  const hasPlatformPreview =
    p.platformId ||
    p.platformName ||
    p.platformType ||
    p.customPlatformType ||
    p.platformDesc ||
    p.manufacturer ||
    p.model ||
    hasPlatformSpecDims

  const platformDescCombined = [
    String(p.platformDesc || '').trim() || p.platformName || '',
    p.model ? `Model: ${String(p.model).trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  /** @type {Array<string>} */
  const otherPropFields = []
  if (String(p.weight || '').trim()) {
    otherPropFields.push(`            <gmi:field name="Weight">
              <gmi:Quantity>
                <gco:Decimal>${esc(numericOrZeroForDq(p.weight))}</gco:Decimal>
                <gco:uom>kg</gco:uom>
              </gmi:Quantity>
            </gmi:field>`)
  }
  if (String(p.length || '').trim()) {
    otherPropFields.push(`            <gmi:field name="Length">
              <gmi:Quantity>
                <gco:Decimal>${esc(numericOrZeroForDq(p.length))}</gco:Decimal>
                <gco:uom>m</gco:uom>
              </gmi:Quantity>
            </gmi:field>`)
  }
  if (String(p.width || '').trim()) {
    otherPropFields.push(`            <gmi:field name="Width">
              <gmi:Quantity>
                <gco:Decimal>${esc(numericOrZeroForDq(p.width))}</gco:Decimal>
                <gco:uom>m</gco:uom>
              </gmi:Quantity>
            </gmi:field>`)
  }
  if (String(p.height || '').trim()) {
    otherPropFields.push(`            <gmi:field name="Height">
              <gmi:Quantity>
                <gco:Decimal>${esc(numericOrZeroForDq(p.height))}</gco:Decimal>
                <gco:uom>m</gco:uom>
              </gmi:Quantity>
            </gmi:field>`)
  }
  if (String(p.material || '').trim()) {
    otherPropFields.push(`            <gmi:field name="CasingMaterial">
              <gmi:Category>
                <gco:CharacterString>${esc(p.material)}</gco:CharacterString>
              </gmi:Category>
            </gmi:field>`)
  }
  if (String(p.speed || '').trim()) {
    otherPropFields.push(`            <gmi:field name="SpeedOverWater">
              <gmi:Quantity>
                <gco:Decimal>${esc(numericOrZeroForDq(p.speed))}</gco:Decimal>
                <gco:uom>m/s</gco:uom>
              </gmi:Quantity>
            </gmi:field>`)
  }
  if (String(p.operationalArea || '').trim()) {
    otherPropFields.push(`            <gmi:field name="OperationalArea">
              <gco:CharacterString>${esc(p.operationalArea)}</gco:CharacterString>
            </gmi:field>`)
  }

  const otherPropertyXml = otherPropFields.length
    ? `          <gmi:otherProperty>
            <gco:Record>
              <gmi:otherProperty>
                <gmi:CharacteristicList>
                  <gmi:characteristic>
                    <gmi:DataRecord>
${otherPropFields.join('\n')}
                    </gmi:DataRecord>
                  </gmi:characteristic>
                </gmi:CharacteristicList>
              </gmi:otherProperty>
            </gco:Record>
          </gmi:otherProperty>`
    : ''

  const instrumentSections = sensors
    .map((s, i) =>
      acquisitionInstrumentXmlBlock(s, esc, {
        outer: '      ',
        inner: '        ',
        instrumentId: `instrument_${i + 1}`,
        xlinkToPlatform: hasPlatformPreview,
      }),
    )
    .filter(Boolean)

  const nestedPlatformInstrumentsXml =
    hasPlatformPreview && instrumentSections.length
      ? sensors
          .map((s) =>
            acquisitionInstrumentXmlBlock(s, esc, {
              outer: '          ',
              inner: '            ',
              instrumentId: null,
              xlinkToPlatform: false,
            }),
          )
          .filter(Boolean)
          .join('\n')
      : ''

  const platformSection = hasPlatformPreview
    ? `      <gmi:platform>
        <gmi:MI_Platform id="platform">
          ${
            p.platformId
              ? `<gmd:identifier>
            <gmd:MD_Identifier>
              <gmd:code><gco:CharacterString>${esc(p.platformId)}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmd:identifier>`
              : ''
          }
          ${
            platformDescCombined
              ? `<gmd:description>
            <gco:CharacterString>${esc(platformDescCombined)}</gco:CharacterString>
          </gmd:description>`
              : ''
          }
          ${
            p.platformType || p.customPlatformType
              ? `<gmi:type>
            <gco:CharacterString>${esc(p.platformType || p.customPlatformType)}</gco:CharacterString>
          </gmi:type>`
              : ''
          }
          ${
            p.manufacturer
              ? `<gmd:pointOfContact>
            <gmd:CI_ResponsibleParty>
              <gmd:organisationName><gco:CharacterString>${esc(p.manufacturer)}</gco:CharacterString></gmd:organisationName>
              <gmd:role>
                <gmd:CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/CI_RoleCode.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
              </gmd:role>
            </gmd:CI_ResponsibleParty>
          </gmd:pointOfContact>`
              : ''
          }
          ${otherPropertyXml}
${nestedPlatformInstrumentsXml ? `${nestedPlatformInstrumentsXml}\n` : ''}        </gmi:MI_Platform>
      </gmi:platform>
`
    : ''

  const acquisitionXml =
    hasPlatformPreview || instrumentSections.length
      ? `  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
${platformSection}${instrumentSections.join('\n')}
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>\n`
      : ''

  const MD_RESTRICTION_CODELIST =
    'https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_RestrictionCode'
  const presetKey = normalizeDataLicensePresetKey(m.dataLicensePreset)
  const licensePresetDef = getDataLicensePresetDef(m.dataLicensePreset)
  const legalInner = []
  const accessCode = String(m.accessConstraintsCode || '').trim()
  const accessNarrative = String(m.accessConstraints || '').trim()
  if (accessCode) {
    legalInner.push(
      `<gmd:accessConstraints><gmd:MD_RestrictionCode codeList="${esc(MD_RESTRICTION_CODELIST)}" codeListValue="${esc(accessCode)}">${esc(accessCode)}</gmd:MD_RestrictionCode></gmd:accessConstraints>`,
    )
    if (accessNarrative) {
      legalInner.push(
        `<gmd:otherConstraints><gco:CharacterString>${esc(accessNarrative)}</gco:CharacterString></gmd:otherConstraints>`,
      )
    }
  } else if (accessNarrative) {
    legalInner.push(
      `<gmd:accessConstraints><gmd:MD_RestrictionCode codeList="${esc(MD_RESTRICTION_CODELIST)}" codeListValue="otherRestrictions">otherRestrictions</gmd:MD_RestrictionCode></gmd:accessConstraints>`,
    )
    legalInner.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(accessNarrative)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (m.citeAs) {
    legalInner.push(
      `<gmd:useLimitation><gco:CharacterString>${esc(m.citeAs)}</gco:CharacterString></gmd:useLimitation>`,
    )
  }
  if (m.distributionLiability) {
    legalInner.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(m.distributionLiability)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (m.otherCiteAs) {
    legalInner.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(m.otherCiteAs)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (presetKey === 'custom' && m.licenseUrl) {
    legalInner.push(
      `<gmd:otherConstraints><gco:CharacterString>Data license: ${esc(m.licenseUrl)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  for (const a of licensePresetDef.anchors) {
    legalInner.push(
      `<gmd:otherConstraints><gmx:Anchor xlink:href="${esc(a.href)}" xlink:title="${esc(a.title)}" xlink:actuate="onRequest">${esc(a.text)}</gmx:Anchor></gmd:otherConstraints>`,
    )
  }
  const legalXml = legalInner.length
    ? `      <gmd:resourceConstraints>\n        <gmd:MD_LegalConstraints>\n          ${legalInner.join('\n          ')}\n        </gmd:MD_LegalConstraints>\n      </gmd:resourceConstraints>\n`
    : ''
  const docucompHref = licensePresetDef.docucompHref && String(licensePresetDef.docucompHref).trim()
  const docucompXml = docucompHref
    ? `      <gmd:resourceConstraints xlink:href="${esc(docucompHref)}" xlink:title="Data License Statement" />\n`
    : ''

  const aggBlocks = []
  if (m.parentProjectTitle) {
    const dateXml = m.parentProjectDate
      ? `<gmd:date><gmd:CI_Date><gmd:date><gco:Date>${esc(m.parentProjectDate)}</gco:Date></gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : ''
    const idXml = m.parentProjectCode
      ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.parentProjectCode)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>`
      : ''
    aggBlocks.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:aggregateDataSetName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(m.parentProjectTitle)}</gco:CharacterString></gmd:title>
              ${dateXml}
              ${idXml}
            </gmd:CI_Citation>
          </gmd:aggregateDataSetName>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/DS_AssociationTypeCode.xml#DS_AssociationTypeCode" codeListValue="largerWorkCitation">largerWorkCitation</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          <gmd:initiativeType>
            <gmd:DS_InitiativeTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/DS_InitiativeTypeCode.xml#DS_InitiativeTypeCode" codeListValue="project">project</gmd:DS_InitiativeTypeCode>
          </gmd:initiativeType>
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }

  if (
    m.relatedDatasetTitle ||
    m.relatedDatasetDate ||
    m.relatedDatasetCode ||
    m.relatedDatasetOrg ||
    m.relatedDataUrl
  ) {
    const relDate = m.relatedDatasetDate
      ? `<gmd:date><gmd:CI_Date><gmd:date><gco:Date>${esc(m.relatedDatasetDate)}</gco:Date></gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : ''
    const relId = m.relatedDatasetCode
      ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.relatedDatasetCode)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>`
      : ''
    const orgNote = m.relatedDatasetOrg
      ? `<gmd:otherCitationDetails><gco:CharacterString>${esc(m.relatedDatasetOrg)}</gco:CharacterString></gmd:otherCitationDetails>`
      : ''
    const onlineXml =
      m.relatedDataUrl && String(m.relatedDataUrl).trim().startsWith('http')
        ? `<gmd:onlineResource><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(m.relatedDataUrl)}</gmd:URL></gmd:linkage>${m.relatedDataUrlTitle ? `<gmd:name><gco:CharacterString>${esc(m.relatedDataUrlTitle)}</gco:CharacterString></gmd:name>` : ''}${m.relatedDataUrlDescription ? `<gmd:description><gco:CharacterString>${esc(m.relatedDataUrlDescription)}</gco:CharacterString></gmd:description>` : ''}</gmd:CI_OnlineResource></gmd:onlineResource>`
        : ''
    const relTitle = m.relatedDatasetTitle || 'Related dataset'
    aggBlocks.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:aggregateDataSetIdentifier>
            <gmd:MD_Identifier gco:nilReason="missing"/>
          </gmd:aggregateDataSetIdentifier>
          <gmd:aggregateDataSetName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(relTitle)}</gco:CharacterString></gmd:title>
              ${relDate}
              ${relId}
              ${orgNote}
              ${onlineXml}
            </gmd:CI_Citation>
          </gmd:aggregateDataSetName>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/DS_AssociationTypeCode.xml#DS_AssociationTypeCode" codeListValue="crossReference">crossReference</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }

  if (m.associatedPublicationTitle || m.associatedPublicationDate || m.associatedPublicationCode) {
    const pubTitle = m.associatedPublicationTitle || 'Associated publication'
    const pubDate = m.associatedPublicationDate
      ? `<gmd:date><gmd:CI_Date><gmd:date><gco:Date>${esc(m.associatedPublicationDate)}</gco:Date></gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : ''
    const pubId = m.associatedPublicationCode
      ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.associatedPublicationCode)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>`
      : ''
    aggBlocks.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:aggregateDataSetName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(pubTitle)}</gco:CharacterString></gmd:title>
              ${pubDate}
              ${pubId}
            </gmd:CI_Citation>
          </gmd:aggregateDataSetName>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/DS_AssociationTypeCode.xml#DS_AssociationTypeCode" codeListValue="crossReference">crossReference</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          <gmd:initiativeType>
            <gmd:DS_InitiativeTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/DS_InitiativeTypeCode.xml#DS_InitiativeTypeCode" codeListValue="sciencePaper">sciencePaper</gmd:DS_InitiativeTypeCode>
          </gmd:initiativeType>
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }

  const aggXml = aggBlocks.length ? `${aggBlocks.join('\n')}\n` : ''

  let spatialReprXml = ''
  if (sp.useGridRepresentation) {
    const axes = [
      gridAxisXml('column', sp.gridColumnSize, sp.gridColumnResolution),
      gridAxisXml('row', sp.gridRowSize, sp.gridRowResolution),
      gridAxisXml('vertical', sp.gridVerticalSize, sp.gridVerticalResolution),
    ].filter(Boolean)
    const n = Math.max(axes.length, 1)
    const cell = normalizeCellGeometry(sp.gridCellGeometry)
    spatialReprXml = `  <gmd:spatialRepresentationInfo>
    <gmd:MD_GridSpatialRepresentation>
      <gmd:numberOfDimensions>
        <gco:Integer>${n}</gco:Integer>
      </gmd:numberOfDimensions>
${axes.join('\n')}
      <gmd:cellGeometry>
        <gmd:MD_CellGeometryCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/MD_CellGeometryCode.xml#MD_CellGeometryCode" codeListValue="${esc(cell)}">${esc(cell)}</gmd:MD_CellGeometryCode>
      </gmd:cellGeometry>
    </gmd:MD_GridSpatialRepresentation>
  </gmd:spatialRepresentationInfo>\n`
  } else if (String(sp.dimensions || '').trim()) {
    const nd = parsePositiveInt(sp.dimensions)
    const dimInt = nd != null ? nd : 2
    spatialReprXml = `  <gmd:spatialRepresentationInfo>
    <gmd:MD_Georectified>
      <gmd:numberOfDimensions>
        <gco:Integer>${dimInt}</gco:Integer>
      </gmd:numberOfDimensions>
    </gmd:MD_Georectified>
  </gmd:spatialRepresentationInfo>\n`
  }

  const outLoc = String(dist.outputLocation || 'download').trim() || 'download'
  const workflowComment = `  <!-- workflow: outputLocation=${esc(outLoc)}${dist.awsBucket ? ` awsBucket=${esc(String(dist.awsBucket).trim())}` : ''}${dist.awsPrefix ? ` awsPrefix=${esc(String(dist.awsPrefix).trim())}` : ''} -->
${dist.finalNotes ? `  <!-- finalNotes: ${esc(String(dist.finalNotes).trim())} -->
` : ''}`

  const scopeToken = String(m.scopeCode || 'dataset').trim() || 'dataset'
  const dateStampXml = m.metadataRecordDate
    ? `  <gmd:dateStamp>${gcoDateOrDateTimeInner(m.metadataRecordDate)}</gmd:dateStamp>\n`
    : `  <!-- gmd:dateStamp: omitted — leave blank in form to use server time at generate -->\n`

  const tiUnit = String(m.temporalExtentIntervalUnit || '').trim()
  const tiVal  = String(m.temporalExtentIntervalValue || '').trim()
  // gml:timeInterval comment (informational only — not a valid GML 3.2 child of TimePeriod)
  const timeIntervalXml =
    tiUnit && tiVal
      ? `\n                  <!-- timeInterval: ${esc(tiVal)} ${esc(tiUnit)} -->`
      : ''

  const xmlFileId = formatNceiUxsFileIdentifierForXml(m.fileId, dist)

  return `<?xml version="1.0" encoding="UTF-8"?>
<gmi:MI_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                 xmlns:gco="http://www.isotc211.org/2005/gco"
                 xmlns:gmi="http://www.isotc211.org/2005/gmi"
                 xmlns:gmx="http://www.isotc211.org/2005/gmx"
                 xmlns:gml="http://www.opengis.net/gml/3.2"
                 xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- gmd:parentIdentifier is intentionally omitted here.
       Only BEDI granule profiles (hierarchyLevel=dataset with a parent collection)
       should emit parentIdentifier.  Mission and collection records are
       standalone; adding parentIdentifier to them would create incorrect
       collection-granule relationships in CoMET and OneStop. -->
  <gmd:fileIdentifier>
    <gco:CharacterString>${esc(xmlFileId)}</gco:CharacterString>
  </gmd:fileIdentifier>
${dateStampXml}  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gml/Codelist/MD_ScopeCode.xml#MD_ScopeCode" codeListValue="${esc(scopeToken)}">${esc(scopeToken)}</gmd:MD_ScopeCode>
  </gmd:hierarchyLevel>
${metaStdXml}${refSystemXml}${contactRootXml}  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:citation>
        <gmd:CI_Citation>
          <gmd:title><gco:CharacterString>${esc(m.title)}</gco:CharacterString></gmd:title>
          ${m.alternateTitle ? `<gmd:alternateTitle><gco:CharacterString>${esc(m.alternateTitle)}</gco:CharacterString></gmd:alternateTitle>` : ''}
          ${citationDates.trim() ? `${citationDates}\n          ` : ''}
          ${m.doi ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.doi)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>` : ''}
          ${m.accession ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.accession)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>` : ''}
          ${citationPartiesXml ? `${citationPartiesXml}\n          ` : ''}
        </gmd:CI_Citation>
      </gmd:citation>
      <gmd:abstract><gco:CharacterString>${esc(m.abstract)}</gco:CharacterString></gmd:abstract>
      <gmd:purpose><gco:CharacterString>${esc(m.purpose)}</gco:CharacterString></gmd:purpose>
      ${m.supplementalInformation ? `<gmd:supplementalInformation><gco:CharacterString>${esc(m.supplementalInformation)}</gco:CharacterString></gmd:supplementalInformation>` : ''}
      <gmd:extent>
        <gmd:EX_Extent>
${extentDescXml}          <gmd:geographicElement>
            <gmd:EX_GeographicBoundingBox>
              <gmd:westBoundLongitude><gco:Decimal>${esc(m.west)}</gco:Decimal></gmd:westBoundLongitude>
              <gmd:eastBoundLongitude><gco:Decimal>${esc(m.east)}</gco:Decimal></gmd:eastBoundLongitude>
              <gmd:southBoundLatitude><gco:Decimal>${esc(m.south)}</gco:Decimal></gmd:southBoundLatitude>
              <gmd:northBoundLatitude><gco:Decimal>${esc(m.north)}</gco:Decimal></gmd:northBoundLatitude>
            </gmd:EX_GeographicBoundingBox>
          </gmd:geographicElement>
          <gmd:temporalElement>
            <gmd:EX_TemporalExtent>
              <gmd:extent>
                <gml:TimePeriod gml:id="tp1">
                  ${m.startDate
                    ? `<gml:beginPosition>${esc(m.startDate)}</gml:beginPosition>`
                    : `<gml:beginPosition indeterminatePosition="unknown"/>`}
                  ${m.endDate
                    ? `<gml:endPosition>${esc(m.endDate)}</gml:endPosition>`
                    : `<gml:endPosition indeterminatePosition="unknown"/>`}${timeIntervalXml}
                </gml:TimePeriod>
              </gmd:extent>
            </gmd:EX_TemporalExtent>
          </gmd:temporalElement>
${verticalXml}        </gmd:EX_Extent>
      </gmd:extent>
      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          <gmd:individualName><gco:CharacterString>${esc(m.individualName)}</gco:CharacterString></gmd:individualName>
          <gmd:organisationName><gco:CharacterString>${esc(m.org)}</gco:CharacterString></gmd:organisationName>
          <gmd:contactInfo>
            <gmd:CI_Contact>
              <gmd:address>
                <gmd:CI_Address>
                  <gmd:electronicMailAddress><gco:CharacterString>${esc(m.email)}</gco:CharacterString></gmd:electronicMailAddress>
                </gmd:CI_Address>
              </gmd:address>
              ${contactExtra}
            </gmd:CI_Contact>
          </gmd:contactInfo>
${rorXml}        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>
${kwBlock('sciencekeywords')}${kwBlock('datacenters')}${kwBlock('platforms')}${kwBlock('instruments')}${kwBlock('locations')}${kwBlock('projects')}${kwBlock('providers')}
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:type>
            <gmd:MD_KeywordTypeCode>platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>Platform instance</gco:CharacterString></gmd:title>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:status>
        <gmd:MD_ProgressCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ProgressCode" codeListValue="${esc(m.status)}">${esc(m.status)}</gmd:MD_ProgressCode>
      </gmd:status>
      <gmd:language>
        <gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/php/code_list.php" codeListValue="${esc(m.language)}">${esc(m.language)}</gmd:LanguageCode>
      </gmd:language>
      <gmd:characterSet>
        <gmd:MD_CharacterSetCode codeListValue="${esc(m.characterSet || 'utf8')}">${esc(m.characterSet || 'utf8')}</gmd:MD_CharacterSetCode>
      </gmd:characterSet>
${topicCategoriesXml ? `${topicCategoriesXml}\n` : ''}${resourceMaintenanceXml}${graphicOverviewXml}${legalXml}${docucompXml}${aggXml}    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
${spatialReprXml}${acquisitionXml ? `${acquisitionXml}\n` : ''}  <gmd:contentInfo>
${sensorBlocks || '  <!-- sensors -->'}
  </gmd:contentInfo>
${dataQualityXml}  <gmd:distributionInfo>
    <gmd:MD_Distribution>
${distributorXlinkXml}      <gmd:distributionFormat>
        <gmd:MD_Format>
          <gmd:name><gco:CharacterString>${esc(dist.distributionFormatName || dist.format)}</gco:CharacterString></gmd:name>
          ${dist.distributionFileFormat ? `<gmd:version><gco:CharacterString>${esc(dist.distributionFileFormat)}</gco:CharacterString></gmd:version>` : ''}
        </gmd:MD_Format>
      </gmd:distributionFormat>
      ${dist.distributionFeesText || dist.distributionOrderingInstructions
        ? `<gmd:distributionOrderProcess><gmd:MD_StandardOrderProcess>${
            dist.distributionFeesText
              ? `<gmd:fees><gco:CharacterString>${esc(dist.distributionFeesText)}</gco:CharacterString></gmd:fees>`
              : ''
          }${
            dist.distributionOrderingInstructions
              ? `<gmd:orderingInstructions><gco:CharacterString>${esc(dist.distributionOrderingInstructions)}</gco:CharacterString></gmd:orderingInstructions>`
              : ''
          }</gmd:MD_StandardOrderProcess></gmd:distributionOrderProcess>`
        : ''}
      <gmd:transferOptions>
        <gmd:MD_DigitalTransferOptions>
          ${dist.metadataLandingUrl ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.metadataLandingUrl)}</gmd:URL></gmd:linkage><gmd:name><gco:CharacterString>${esc(dist.metadataLandingLinkName || dist.downloadLinkName || 'metadata')}</gco:CharacterString></gmd:name>${
            dist.metadataLandingDescription
              ? `<gmd:description><gco:CharacterString>${esc(dist.metadataLandingDescription)}</gco:CharacterString></gmd:description>`
              : ''
          }</gmd:CI_OnlineResource></gmd:onLine>` : ''}
          ${dist.landingUrl ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.landingUrl)}</gmd:URL></gmd:linkage></gmd:CI_OnlineResource></gmd:onLine>` : ''}
          ${dist.downloadUrl ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.downloadUrl)}</gmd:URL></gmd:linkage>${
            dist.downloadLinkName
              ? `<gmd:name><gco:CharacterString>${esc(dist.downloadLinkName)}</gco:CharacterString></gmd:name>`
              : ''
          }<gmd:protocol><gco:CharacterString>${esc(dist.downloadProtocol || 'HTTPS')}</gco:CharacterString></gmd:protocol>${
            dist.downloadLinkDescription
              ? `<gmd:description><gco:CharacterString>${esc(dist.downloadLinkDescription)}</gco:CharacterString></gmd:description>`
              : ''
          }</gmd:CI_OnlineResource></gmd:onLine>` : ''}
        </gmd:MD_DigitalTransferOptions>
      </gmd:transferOptions>
    </gmd:MD_Distribution>
  </gmd:distributionInfo>
${workflowComment}  <!-- metadataMaintenanceFrequency: ${esc(dist.metadataMaintenanceFrequency || 'asNeeded')} -->
  <!-- output flags: useNceiMetadataContactXlink=${useNceiMeta} omitRootReferenceSystemInfo=${omitRef} -->
</gmi:MI_Metadata>
`
}
