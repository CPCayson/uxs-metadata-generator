import { getDataLicensePresetDef, normalizeDataLicensePresetKey } from './noaaLicensePresets.js'
import { formatNceiUxsFileIdentifierForXml } from './nceiUxsFileId.js'
import { buildAcquisitionInstrumentDescription } from './sensorInstrumentDescription.js'
import { gcmdConceptUrlFromUuid as gcmdKeywordHrefFromStoredUuid } from './gcmdKmsUrl.js'
import {
  formatUxsPilotMachineBlock,
  stripUxsPilotMachineBlock,
} from './uxsOperationalModel.js'
import { formatMissionInstantAsXsDateTime } from './datetimeLocal.js'

/** @param {unknown} s */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {string} roleCode  CI_RoleCode token (author | publisher | originator | principalInvestigator | resourceProvider)
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
    `          <gmd:role><gmd:CI_RoleCode codeList="${esc(CI_ROLE_CODE_CODELIST)}" codeListValue="${esc(roleCode)}">${esc(roleCode)}</gmd:CI_RoleCode></gmd:role>`,
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

/** World extent defaults — aligned with `defaultPilotState` / bbox validation fallbacks. */
const PREVIEW_BBOX_FALLBACK = { west: '-180', east: '180', south: '-90', north: '90' }

/** NOAA ISO 19139 gmx codelist anchors (align with NCEI template). */
const GMX_CODELIST = 'https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#'
const CI_DATE_TYPE_CODELIST = `${GMX_CODELIST}CI_DateTypeCode`
const MD_CHARACTER_SET_CODELIST = `${GMX_CODELIST}MD_CharacterSetCode`
const CI_ROLE_CODE_CODELIST = `${GMX_CODELIST}CI_RoleCode`
const MD_SCOPE_CODE_CODELIST = `${GMX_CODELIST}MD_ScopeCode`
const MD_PROGRESS_CODE_CODELIST = `${GMX_CODELIST}MD_ProgressCode`
const MD_MAINTENANCE_FREQUENCY_CODELIST = `${GMX_CODELIST}MD_MaintenanceFrequencyCode`
const MD_CELL_GEOMETRY_CODELIST = `${GMX_CODELIST}MD_CellGeometryCode`
const MD_DIMENSION_NAME_CODELIST = `${GMX_CODELIST}MD_DimensionNameTypeCode`
const DS_ASSOCIATION_TYPE_CODELIST = `${GMX_CODELIST}DS_AssociationTypeCode`
const DS_INITIATIVE_TYPE_CODELIST = `${GMX_CODELIST}DS_InitiativeTypeCode`
const MD_COVERAGE_CONTENT_TYPE_CODELIST = `${GMX_CODELIST}MD_CoverageContentTypeCode`
const CI_ONLINE_FUNCTION_CODELIST = `${GMX_CODELIST}CI_OnLineFunctionCode`

/**
 * Minimal `gmd:date`/`CI_Date` for `CI_Citation` when no publication calendar is known (NCEI-style).
 * @returns {string}
 */
function minimalCiPublicationDateXml() {
  return `<gmd:date><gmd:CI_Date><gmd:date gco:nilReason="inapplicable"/><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
}

/** @param {unknown} v */
function normalizePreviewNumericToken(v) {
  let s = String(v ?? '').trim()
  s = s.replace(/\u2212|\u2013|\u2014/g, '-')
  s = s.replace(/,/g, '')
  return s
}

/**
 * Numeric strings for `EX_GeographicBoundingBox` corners — never empty inside `<gco:Decimal>`.
 * Keeps the same token shape as `sanitizePilotState` (e.g. `00.00`) so preview→import round-trips match merged state.
 * @param {Record<string, unknown>} mission `state.mission`
 */
function previewMissionBoundingDecimals(mission) {
  const m = mission || {}
  /** @param {'west' | 'east' | 'south' | 'north'} ax */
  function axis(ax) {
    const fb = PREVIEW_BBOX_FALLBACK[ax]
    const raw = m[ax]
    if (raw == null || String(raw).trim() === '' || String(raw).trim() === 'null') return fb
    const picked = String(raw).trim()
    const normalized = normalizePreviewNumericToken(picked)
    const n = Number.parseFloat(normalized)
    if (!Number.isFinite(n)) return fb
    return normalized
  }
  return {
    west: axis('west'),
    east: axis('east'),
    south: axis('south'),
    north: axis('north'),
  }
}

/**
 * Inner XML for `gmd:date` / `gmd:dateStamp` (`gco:Date` vs `gco:DateTime`), using XSD-complete
 * `xs:dateTime` for any instant that includes a clock time (seconds appended when omitted).
 */
function gcoDateOrDateTimeInner(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const norm = raw.replace(/^(\d{4}-\d{2}-\d{2})[ T](?=\d{2})/, '$1T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
    return `<gco:Date>${esc(norm)}</gco:Date>`
  }
  if (norm.includes('T')) {
    const xs = formatMissionInstantAsXsDateTime(norm)
    if (!xs) return ''
    return `<gco:DateTime>${esc(xs)}</gco:DateTime>`
  }
  return `<gco:Date>${esc(norm)}</gco:Date>`
}

/** `gml:beginPosition` / `gml:endPosition` text — same calendar vs instant rules as {@link gcoDateOrDateTimeInner}. */
function gmlTemporalPositionText(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const norm = raw.replace(/^(\d{4}-\d{2}-\d{2})[ T](?=\d{2})/, '$1T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) return esc(norm)
  if (norm.includes('T')) return esc(formatMissionInstantAsXsDateTime(norm) || norm)
  return esc(norm)
}

/** Default gmd:dateStamp when the form is blank — stable UTC “Z” instant for preview/export. */
function utcNowIsoZForDateStamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
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
          <gmd:MD_ScopeCode codeList="${esc(MD_SCOPE_CODE_CODELIST)}" codeListValue="dataset">dataset</gmd:MD_ScopeCode>
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
            <gmd:MD_DimensionNameTypeCode codeList="${esc(MD_DIMENSION_NAME_CODELIST)}" codeListValue="${esc(codeListValue)}">${esc(codeListValue)}</gmd:MD_DimensionNameTypeCode>
          </gmd:dimensionName>
          ${sizeXml}
          ${resXml}
        </gmd:MD_Dimension>
      </gmd:axisDimensionProperties>`
}

/**
 * One `gmi:instrument` / `MI_Instrument` block (acquisition). `xlink:href` is not emitted on
 * `gmi:MI_Instrument` — ISO 19139 schema disallows it there; instruments nest under `MI_Platform`
 * or appear as sibling `gmi:instrument` without platform xlink.
 * @param {object} s
 * @param {(x: unknown) => string} escFn
 * @param {{ outer: string, inner: string, instrumentId: string | null }} pads
 */
function acquisitionInstrumentXmlBlock(s, escFn, pads) {
  const code = String(s.sensorId || s.modelId || '').trim()
  const typ = String(s.type || '').trim()
  const desc = buildAcquisitionInstrumentDescription(s)
  if (!code && !typ && !desc.trim()) return ''
  const I = pads.inner
  const J = `${I}  `
  const idPart = pads.instrumentId ? ` id="${toXmlId(pads.instrumentId)}"` : ''
  const codeVal = code || 'notRecorded'
  const typeVal = typ || code || 'notRecorded'
  /** @type {string[]} */
  const body = []
  body.push(
    `${J}<gmi:identifier>
${J}  <gmd:MD_Identifier>
${J}    <gmd:code><gco:CharacterString>${escFn(codeVal)}</gco:CharacterString></gmd:code>
${J}  </gmd:MD_Identifier>
${J}</gmi:identifier>`,
  )
  body.push(`${J}<gmi:type><gco:CharacterString>${escFn(typeVal)}</gco:CharacterString></gmi:type>`)
  if (desc.trim()) body.push(`${J}<gmi:description><gco:CharacterString>${escFn(desc)}</gco:CharacterString></gmi:description>`)
  const bodyStr = body.join('\n')
  return `${pads.outer}<gmi:instrument>
${I}<gmi:MI_Instrument${idPart}>
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
  const bbox = previewMissionBoundingDecimals(m)
  const progressCode = String(m.status || '').trim() || 'completed'
  const sp = state?.spatial || {}
  const p = state?.platform || {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors : []
  const kw = state?.keywords || {}
  const dist = state?.distribution || {}

  const omitRef = dist.omitRootReferenceSystemInfo
  const useNceiMeta = dist.useNceiMetadataContactXlink
  const dateStampSource = String(m.metadataRecordDate || '').trim() || utcNowIsoZForDateStamp()
  const dateStampXml = `  <gmd:dateStamp>${gcoDateOrDateTimeInner(dateStampSource)}</gmd:dateStamp>\n`

  /** One MD_Keywords block per facet with repeated gmd:keyword (matches common NCEI/GCMD patterns). */
  const kwBlock = (facet) => {
    const arr = Array.isArray(kw[facet]) ? kw[facet] : []
    const inner = arr
      .map((k) => {
        const label = String(k?.label || '').trim()
        const uuid = String(k?.uuid || '').trim()
        const href = gcmdKeywordHrefFromStoredUuid(uuid)
        const display = label || uuid
        if (!display) return ''
        return href
          ? `        <gmd:keyword>\n          <gmx:Anchor xlink:href="${esc(href)}" xlink:actuate="onRequest">${esc(display)}</gmx:Anchor>\n        </gmd:keyword>\n`
          : `        <gmd:keyword>\n          <gco:CharacterString>${esc(display)}</gco:CharacterString>\n        </gmd:keyword>\n`
      })
      .filter(Boolean)
      .join('')
    if (!inner) return `    <!-- ${facet} -->\n`
    return `    <gmd:descriptiveKeywords>\n      <gmd:MD_Keywords>\n${inner}        <gmd:thesaurusName>\n          <gmd:CI_Citation>\n            <gmd:title><gco:CharacterString>GCMD ${esc(facet)}</gco:CharacterString></gmd:title>\n            ${minimalCiPublicationDateXml()}\n          </gmd:CI_Citation>\n        </gmd:thesaurusName>\n      </gmd:MD_Keywords>\n    </gmd:descriptiveKeywords>\n`
  }

  const citationPartiesXml = [
    buildCitedResponsiblePartyXml('author', m.citationAuthorIndividualName, m.citationAuthorOrganisationName),
    buildCitedResponsiblePartyXml('publisher', '', m.citationPublisherOrganisationName),
    buildCitedResponsiblePartyXml('originator', m.citationOriginatorIndividualName, m.citationOriginatorOrganisationName),
    buildCitedResponsiblePartyXml('principalInvestigator', m.citationPrincipalInvestigatorIndividualName, ''),
    buildCitedResponsiblePartyXml('resourceProvider', m.citationResourceProviderIndividualName, ''),
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
            <gmd:MD_MaintenanceFrequencyCode codeList="${esc(MD_MAINTENANCE_FREQUENCY_CODELIST)}" codeListValue="${esc(maintFreq)}">${esc(maintFreq)}</gmd:MD_MaintenanceFrequencyCode>
          </gmd:maintenanceAndUpdateFrequency>
        </gmd:MD_MaintenanceInformation>
      </gmd:resourceMaintenance>
`
  const goHref = String(m.graphicOverviewHref || '').trim()
  const goTitle = String(m.graphicOverviewTitle || '').trim()
  const graphicOverviewXml = goHref
    ? `      <gmd:graphicOverview>
        <gmd:MD_BrowseGraphic>
          <gmd:fileName><gco:CharacterString>${esc(goHref)}</gco:CharacterString></gmd:fileName>${
            goTitle
              ? `\n          <gmd:fileDescription><gco:CharacterString>${esc(goTitle)}</gco:CharacterString></gmd:fileDescription>`
              : ''
          }
        </gmd:MD_BrowseGraphic>
      </gmd:graphicOverview>
`
    : ''

  const sensorContentInfoXml = sensors.length
    ? sensors
        .map(
          (s, i) => {
            const covDesc = buildAcquisitionInstrumentDescription(s, { includeVariableLine: false })
            const attrDesc =
              String(s.type || s.variable || '').trim() ||
              String(s.sensorId || s.modelId || '').trim() ||
              'notRecorded'
            const dimBits = [
              String(s.variable || '').trim(),
              String(s.sensorId || s.modelId || `sensor_${i + 1}`).trim(),
              covDesc.trim(),
            ].filter(Boolean)
            const dimLabel = dimBits.length ? dimBits.join(' — ') : `Band ${i + 1}`
            return `  <gmd:contentInfo>
    <gmi:MI_CoverageDescription>
    <gmd:attributeDescription><gco:RecordType>${esc(attrDesc)}</gco:RecordType></gmd:attributeDescription>
    <gmd:contentType>
      <gmd:MD_CoverageContentTypeCode codeList="${esc(MD_COVERAGE_CONTENT_TYPE_CODELIST)}" codeListValue="physicalMeasurement">physicalMeasurement</gmd:MD_CoverageContentTypeCode>
    </gmd:contentType>
    <gmd:dimension>
      <gmd:MD_RangeDimension>
        <gmd:descriptor><gco:CharacterString>${esc(dimLabel)}</gco:CharacterString></gmd:descriptor>
      </gmd:MD_RangeDimension>
    </gmd:dimension>
  </gmi:MI_CoverageDescription>
  </gmd:contentInfo>`
          },
        )
        .join('\n')
    : ''

  const rorIdRaw = m.ror?.id ? String(m.ror.id).trim().replace(/^https?:\/\/ror\.org\//i, '') : ''
  const rorHrefAttr = rorIdRaw ? `https://ror.org/${encodeURIComponent(rorIdRaw)}` : ''
  const organisationNameXml = rorHrefAttr
    ? `          <gmd:organisationName>
            <gmx:Anchor xlink:href="${esc(rorHrefAttr)}" xlink:title="ROR ID" xlink:actuate="onRequest">${esc(m.org)}</gmx:Anchor>
          </gmd:organisationName>
`
    : `          <gmd:organisationName><gco:CharacterString>${esc(m.org)}</gco:CharacterString></gmd:organisationName>
`

  /** ISO keyword block for the platform *instance* id — omit when empty (avoids useless empty MD_Keywords). */
  const platformInstanceFacetXml = (() => {
    const pid = String(p.platformId || '').trim()
    if (!pid) return ''
    return `      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>${esc(pid)}</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>Platform instance</gco:CharacterString></gmd:title>
              ${minimalCiPublicationDateXml()}
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
`
  })()

  const citationDates = [
    m.startDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.startDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="creation">creation</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
    m.publicationDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.publicationDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
    m.endDate
      ? `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(m.endDate)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="completion">completion</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
      : '',
  ]
    .filter(Boolean)
    .join('\n          ')

  const citationDatesResolved =
    citationDates.trim() ||
    minimalCiPublicationDateXml()

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

  const phoneXml = m.contactPhone
    ? `              <gmd:phone><gmd:CI_Telephone><gmd:voice><gco:CharacterString>${esc(m.contactPhone)}</gco:CharacterString></gmd:voice></gmd:CI_Telephone></gmd:phone>`
    : ''
  const addrDeliveryXml = m.contactAddress
    ? `                  <gmd:deliveryPoint><gco:CharacterString>${esc(m.contactAddress)}</gco:CharacterString></gmd:deliveryPoint>`
    : ''
  const addrEmailXml = m.email
    ? `                  <gmd:electronicMailAddress><gco:CharacterString>${esc(m.email)}</gco:CharacterString></gmd:electronicMailAddress>`
    : ''
  const addrInnerXml = [addrDeliveryXml, addrEmailXml].filter(Boolean).join('\n')
  const addrBlockXml = addrInnerXml
    ? `              <gmd:address>
                <gmd:CI_Address>
${addrInnerXml}
                </gmd:CI_Address>
              </gmd:address>`
    : ''
  const contactUrlXml = m.contactUrl
    ? `              <gmd:onlineResource><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(m.contactUrl)}</gmd:URL></gmd:linkage><gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol><gmd:function><gmd:CI_OnLineFunctionCode codeList="${esc(CI_ONLINE_FUNCTION_CODELIST)}" codeListValue="information">information</gmd:CI_OnLineFunctionCode></gmd:function></gmd:CI_OnlineResource></gmd:onlineResource>`
    : ''
  const resourceCiContactXml =
    phoneXml || addrBlockXml || contactUrlXml
      ? `          <gmd:contactInfo>
            <gmd:CI_Contact>
${phoneXml}
${addrBlockXml}
${contactUrlXml}
            </gmd:CI_Contact>
          </gmd:contactInfo>
`
      : ''

  const resourcePointOfContactXml = `      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          <gmd:individualName><gco:CharacterString>${esc(m.individualName)}</gco:CharacterString></gmd:individualName>
${organisationNameXml}${resourceCiContactXml}          <gmd:role>
            <gmd:CI_RoleCode codeList="${esc(CI_ROLE_CODE_CODELIST)}" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
          </gmd:role>
        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>
`

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

  const fmtVersion = String(dist.distributionFileFormat ?? '').trim() || 'not recorded'
  const onLineMetadata = dist.metadataLandingUrl
    ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.metadataLandingUrl)}</gmd:URL></gmd:linkage><gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol><gmd:name><gco:CharacterString>${esc(dist.metadataLandingLinkName || dist.downloadLinkName || 'metadata')}</gco:CharacterString></gmd:name>${dist.metadataLandingDescription ? `<gmd:description><gco:CharacterString>${esc(dist.metadataLandingDescription)}</gco:CharacterString></gmd:description>` : ''}<gmd:function><gmd:CI_OnLineFunctionCode codeList="${esc(CI_ONLINE_FUNCTION_CODELIST)}" codeListValue="information">information</gmd:CI_OnLineFunctionCode></gmd:function></gmd:CI_OnlineResource></gmd:onLine>`
    : ''
  const onLineLanding = dist.landingUrl
    ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.landingUrl)}</gmd:URL></gmd:linkage><gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol><gmd:function><gmd:CI_OnLineFunctionCode codeList="${esc(CI_ONLINE_FUNCTION_CODELIST)}" codeListValue="information">information</gmd:CI_OnLineFunctionCode></gmd:function></gmd:CI_OnlineResource></gmd:onLine>`
    : ''
  const onLineDownload = dist.downloadUrl
    ? `<gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(dist.downloadUrl)}</gmd:URL></gmd:linkage><gmd:protocol><gco:CharacterString>${esc(dist.downloadProtocol || 'HTTPS')}</gco:CharacterString></gmd:protocol>${dist.downloadLinkName ? `<gmd:name><gco:CharacterString>${esc(dist.downloadLinkName)}</gco:CharacterString></gmd:name>` : ''}${dist.downloadLinkDescription ? `<gmd:description><gco:CharacterString>${esc(dist.downloadLinkDescription)}</gco:CharacterString></gmd:description>` : ''}<gmd:function><gmd:CI_OnLineFunctionCode codeList="${esc(CI_ONLINE_FUNCTION_CODELIST)}" codeListValue="download">download</gmd:CI_OnLineFunctionCode></gmd:function></gmd:CI_OnlineResource></gmd:onLine>`
    : ''
  const transferOptionsInner = [onLineMetadata, onLineLanding, onLineDownload].filter(Boolean).join('\n          ')
  const transferOptionsBlock = transferOptionsInner.trim()
    ? `      <gmd:transferOptions>
        <gmd:MD_DigitalTransferOptions>
          ${transferOptionsInner}
        </gmd:MD_DigitalTransferOptions>
      </gmd:transferOptions>
`
    : ''
  const distributionFormatBlock = `      <gmd:distributionFormat>
        <gmd:MD_Format>
          <gmd:name><gco:CharacterString>${esc(dist.distributionFormatName || dist.format)}</gco:CharacterString></gmd:name>
          <gmd:version><gco:CharacterString>${esc(fmtVersion)}</gco:CharacterString></gmd:version>
        </gmd:MD_Format>
      </gmd:distributionFormat>
`
  const distributionOrderProcessBlock =
    dist.distributionFeesText || dist.distributionOrderingInstructions
      ? `          <gmd:distributionOrderProcess><gmd:MD_StandardOrderProcess>${
          dist.distributionFeesText
            ? `<gmd:fees><gco:CharacterString>${esc(dist.distributionFeesText)}</gco:CharacterString></gmd:fees>`
            : ''
        }${
          dist.distributionOrderingInstructions
            ? `<gmd:orderingInstructions><gco:CharacterString>${esc(dist.distributionOrderingInstructions)}</gco:CharacterString></gmd:orderingInstructions>`
            : ''
        }</gmd:MD_StandardOrderProcess></gmd:distributionOrderProcess>
`
      : ''

  const nceiMetaHref = String(dist.nceiMetadataContactHref || '').trim()
  const nceiMetaTitle = String(dist.nceiMetadataContactTitle || 'NCEI (pointOfContact)').trim()
  const metadataContactXml = useNceiMeta
    ? `  <gmd:contact${nceiMetaHref ? ` xlink:href="${esc(nceiMetaHref)}"` : ''} xlink:title="${esc(nceiMetaTitle)}"/>
`
    : `  <gmd:contact>
    <gmd:CI_ResponsibleParty>
          <gmd:individualName><gco:CharacterString>${esc(m.individualName)}</gco:CharacterString></gmd:individualName>
${organisationNameXml}${resourceCiContactXml}          <gmd:role>
            <gmd:CI_RoleCode codeList="${esc(CI_ROLE_CODE_CODELIST)}" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
          </gmd:role>
    </gmd:CI_ResponsibleParty>
  </gmd:contact>
`

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
                      ? `<gmd:onlineResource><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>${esc(distUrl)}</gmd:URL></gmd:linkage><gmd:protocol><gco:CharacterString>HTTPS</gco:CharacterString></gmd:protocol><gmd:function><gmd:CI_OnLineFunctionCode codeList="${esc(CI_ONLINE_FUNCTION_CODELIST)}" codeListValue="information">information</gmd:CI_OnLineFunctionCode></gmd:function></gmd:CI_OnlineResource></gmd:onlineResource>`
                      : ''
                  }
                </gmd:CI_Contact>
              </gmd:contactInfo>
              <gmd:role>
                <gmd:CI_RoleCode codeList="${esc(CI_ROLE_CODE_CODELIST)}" codeListValue="distributor">distributor</gmd:CI_RoleCode>
              </gmd:role>
            </gmd:CI_ResponsibleParty>
          </gmd:distributorContact>
${distributionOrderProcessBlock}        </gmd:MD_Distributor>
      </gmd:distributor>
`
      : ''
  const distributorXlinkXml = nceiDistHref
    ? `      <gmd:distributor>
        <gmd:MD_Distributor>
          <gmd:distributorContact xlink:href="${esc(nceiDistHref)}" xlink:title="${esc(nceiDistTitle)}"/>
${distributionOrderProcessBlock}        </gmd:MD_Distributor>
      </gmd:distributor>
`
    : distributorInlineParty ||
      `      <gmd:distributor>
        <gmd:MD_Distributor>
          <gmd:distributorContact xlink:title="${esc(nceiDistTitle)}"/>
${distributionOrderProcessBlock}        </gmd:MD_Distributor>
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

  const hasInstrumentPayload = sensors.some((s) => {
    const code = String(s.sensorId || s.modelId || '').trim()
    const typ = String(s.type || '').trim()
    const desc = buildAcquisitionInstrumentDescription(s)
    return !!(code || typ || String(desc || '').trim())
  })

  /** Top-level `gmi:instrument` only when there is no platform block (otherwise instruments nest in `MI_Platform`). */
  const instrumentSections = !hasPlatformPreview
    ? sensors
        .map((s, i) =>
          acquisitionInstrumentXmlBlock(s, esc, {
            outer: '      ',
            inner: '        ',
            instrumentId: `instrument_${i + 1}`,
          }),
        )
        .filter(Boolean)
    : []

  const nestedPlatformInstrumentsXml =
    hasPlatformPreview && hasInstrumentPayload
      ? sensors
          .map((s) =>
            acquisitionInstrumentXmlBlock(s, esc, {
              outer: '          ',
              inner: '            ',
              instrumentId: null,
            }),
          )
          .filter(Boolean)
          .join('\n')
      : ''

  const platformInstrumentPlaceholderXml = `          <gmi:instrument>
            <gmi:MI_Instrument>
              <gmi:identifier>
                <gmd:MD_Identifier>
                  <gmd:code><gco:CharacterString>notRecorded</gco:CharacterString></gmd:code>
                </gmd:MD_Identifier>
              </gmi:identifier>
              <gmi:type><gco:CharacterString>unknown</gco:CharacterString></gmi:type>
            </gmi:MI_Instrument>
          </gmi:instrument>`

  const nestedPlatformInstrumentsResolved = nestedPlatformInstrumentsXml.trim()
    ? `${nestedPlatformInstrumentsXml}\n`
    : platformInstrumentPlaceholderXml

  const platformSpecsHuman = [
    String(p.weight || '').trim() && `Weight: ${numericOrZeroForDq(p.weight)} kg`,
    String(p.length || '').trim() && `Length: ${numericOrZeroForDq(p.length)} m`,
    String(p.width || '').trim() && `Width: ${numericOrZeroForDq(p.width)} m`,
    String(p.height || '').trim() && `Height: ${numericOrZeroForDq(p.height)} m`,
    String(p.material || '').trim() && `Material: ${String(p.material).trim()}`,
    String(p.speed || '').trim() && `Speed: ${numericOrZeroForDq(p.speed)} m/s`,
    String(p.operationalArea || '').trim() && `Operational area: ${String(p.operationalArea).trim()}`,
  ]
    .filter(Boolean)
    .join('\n')

  const platformDescriptionFull = [
    platformDescCombined,
    p.platformType || p.customPlatformType
      ? `Type: ${String(p.platformType || p.customPlatformType).trim()}`
      : '',
    p.manufacturer ? `Manufacturer: ${String(p.manufacturer).trim()}` : '',
    platformSpecsHuman,
  ]
    .filter(Boolean)
    .join('\n')
    .trim() || 'not recorded'

  const manufacturerSponsorXml = p.manufacturer
    ? `          <gmd:sponsor>
            <gmd:CI_ResponsibleParty>
              <gmd:organisationName><gco:CharacterString>${esc(p.manufacturer)}</gco:CharacterString></gmd:organisationName>
              <gmd:role>
                <gmd:CI_RoleCode codeList="${esc(CI_ROLE_CODE_CODELIST)}" codeListValue="collaborator">collaborator</gmd:CI_RoleCode>
              </gmd:role>
            </gmd:CI_ResponsibleParty>
          </gmd:sponsor>`
    : ''

  const platformSection = hasPlatformPreview
    ? `      <gmi:platform>
        <gmi:MI_Platform id="platform">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code><gco:CharacterString>${esc(p.platformId || 'unknown')}</gco:CharacterString></gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>${esc(platformDescriptionFull)}</gco:CharacterString>
          </gmi:description>
${manufacturerSponsorXml}
${nestedPlatformInstrumentsResolved}        </gmi:MI_Platform>
      </gmi:platform>
`
    : ''

  const acquisitionXml =
    hasPlatformPreview || instrumentSections.length
      ? `  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
${instrumentSections.join('\n')}
${platformSection}    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>\n`
      : ''

  const MD_RESTRICTION_CODELIST =
    'https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_RestrictionCode'
  const presetKey = normalizeDataLicensePresetKey(m.dataLicensePreset)
  const licensePresetDef = getDataLicensePresetDef(m.dataLicensePreset)
  /** ISO 19139 `MD_LegalConstraints` + base `MD_Constraints`: useLimitation, then accessConstraints, useConstraints, otherConstraints. */
  const accessConstraintsXml = []
  const useConstraintsXml = []
  const useLimitationXml = []
  const otherConstraintsXml = []
  const accessCode = String(m.accessConstraintsCode || '').trim()
  const accessNarrative = String(m.accessConstraints || '').trim()
  if (accessCode) {
    accessConstraintsXml.push(
      `<gmd:accessConstraints><gmd:MD_RestrictionCode codeList="${esc(MD_RESTRICTION_CODELIST)}" codeListValue="${esc(accessCode)}">${esc(accessCode)}</gmd:MD_RestrictionCode></gmd:accessConstraints>`,
    )
  } else if (accessNarrative) {
    accessConstraintsXml.push(
      `<gmd:accessConstraints><gmd:MD_RestrictionCode codeList="${esc(MD_RESTRICTION_CODELIST)}" codeListValue="otherRestrictions">otherRestrictions</gmd:MD_RestrictionCode></gmd:accessConstraints>`,
    )
  }
  if (accessNarrative) {
    otherConstraintsXml.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(accessNarrative)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (m.citeAs) {
    useLimitationXml.push(
      `<gmd:useLimitation><gco:CharacterString>${esc(m.citeAs)}</gco:CharacterString></gmd:useLimitation>`,
    )
  }
  if (m.distributionLiability) {
    otherConstraintsXml.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(m.distributionLiability)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (m.otherCiteAs) {
    otherConstraintsXml.push(
      `<gmd:otherConstraints><gco:CharacterString>${esc(m.otherCiteAs)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  if (presetKey === 'custom' && m.licenseUrl) {
    otherConstraintsXml.push(
      `<gmd:otherConstraints><gco:CharacterString>Data license: ${esc(m.licenseUrl)}</gco:CharacterString></gmd:otherConstraints>`,
    )
  }
  for (const a of licensePresetDef.anchors) {
    otherConstraintsXml.push(
      `<gmd:otherConstraints><gmx:Anchor xlink:href="${esc(a.href)}" xlink:title="${esc(a.title)}" xlink:actuate="onRequest">${esc(a.text)}</gmx:Anchor></gmd:otherConstraints>`,
    )
  }
  const legalPieces = [...useLimitationXml, ...accessConstraintsXml, ...useConstraintsXml, ...otherConstraintsXml]
  const legalXml = legalPieces.length
    ? `      <gmd:resourceConstraints>\n        <gmd:MD_LegalConstraints>\n          ${legalPieces.join('\n          ')}\n        </gmd:MD_LegalConstraints>\n      </gmd:resourceConstraints>\n`
    : ''
  const docucompHref = licensePresetDef.docucompHref && String(licensePresetDef.docucompHref).trim()
  const docucompXml = docucompHref
    ? `      <gmd:resourceConstraints xlink:href="${esc(docucompHref)}" xlink:title="Data License Statement" />\n`
    : ''

  const aggBlocks = []
  const aggCitationDatePublication = (/** @type {string} */ raw) => {
    const s = String(raw || '').trim()
    if (!s) {
      return `<gmd:date><gmd:CI_Date><gmd:date gco:nilReason="inapplicable"/><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
    }
    if (s.includes('T')) {
      return `<gmd:date><gmd:CI_Date><gmd:date>${gcoDateOrDateTimeInner(s)}</gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
    }
    return `<gmd:date><gmd:CI_Date><gmd:date><gco:Date>${esc(s)}</gco:Date></gmd:date><gmd:dateType><gmd:CI_DateTypeCode codeList="${esc(CI_DATE_TYPE_CODELIST)}" codeListValue="publication">publication</gmd:CI_DateTypeCode></gmd:dateType></gmd:CI_Date></gmd:date>`
  }

  if (m.parentProjectTitle) {
    const dateXml = aggCitationDatePublication(String(m.parentProjectDate || '').trim())
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
            <gmd:DS_AssociationTypeCode codeList="${esc(DS_ASSOCIATION_TYPE_CODELIST)}" codeListValue="largerWorkCitation">largerWorkCitation</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          <gmd:initiativeType>
            <gmd:DS_InitiativeTypeCode codeList="${esc(DS_INITIATIVE_TYPE_CODELIST)}" codeListValue="project">project</gmd:DS_InitiativeTypeCode>
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
    const relDate = aggCitationDatePublication(String(m.relatedDatasetDate || '').trim())
    const relId = m.relatedDatasetCode
      ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.relatedDatasetCode)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>`
      : ''
    const relatedDetailParts = []
    if (m.relatedDatasetOrg) relatedDetailParts.push(String(m.relatedDatasetOrg).trim())
    if (m.relatedDataUrl && String(m.relatedDataUrl).trim().startsWith('http')) {
      const u = String(m.relatedDataUrl).trim()
      const t = m.relatedDataUrlTitle ? String(m.relatedDataUrlTitle).trim() : ''
      const d = m.relatedDataUrlDescription ? String(m.relatedDataUrlDescription).trim() : ''
      relatedDetailParts.push([t && d ? `${t}: ${d}` : t || d || '', u].filter(Boolean).join(' ').trim() || u)
    }
    const relatedDetailsXml = relatedDetailParts.length
      ? `<gmd:otherCitationDetails><gco:CharacterString>${esc(relatedDetailParts.join(' | '))}</gco:CharacterString></gmd:otherCitationDetails>`
      : ''
    const relTitle = m.relatedDatasetTitle || 'Related dataset'
    aggBlocks.push(`      <gmd:aggregationInfo>
        <gmd:MD_AggregateInformation>
          <gmd:aggregateDataSetName>
            <gmd:CI_Citation>
              <gmd:title><gco:CharacterString>${esc(relTitle)}</gco:CharacterString></gmd:title>
              ${relDate}
              ${relId}
              ${relatedDetailsXml}
            </gmd:CI_Citation>
          </gmd:aggregateDataSetName>
          <gmd:associationType>
            <gmd:DS_AssociationTypeCode codeList="${esc(DS_ASSOCIATION_TYPE_CODELIST)}" codeListValue="crossReference">crossReference</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
        </gmd:MD_AggregateInformation>
      </gmd:aggregationInfo>`)
  }

  if (m.associatedPublicationTitle || m.associatedPublicationDate || m.associatedPublicationCode) {
    const pubTitle = m.associatedPublicationTitle || 'Associated publication'
    const pubDate = aggCitationDatePublication(String(m.associatedPublicationDate || '').trim())
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
            <gmd:DS_AssociationTypeCode codeList="${esc(DS_ASSOCIATION_TYPE_CODELIST)}" codeListValue="crossReference">crossReference</gmd:DS_AssociationTypeCode>
          </gmd:associationType>
          <gmd:initiativeType>
            <gmd:DS_InitiativeTypeCode codeList="${esc(DS_INITIATIVE_TYPE_CODELIST)}" codeListValue="sciencePaper">sciencePaper</gmd:DS_InitiativeTypeCode>
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
        <gmd:MD_CellGeometryCode codeList="${esc(MD_CELL_GEOMETRY_CODELIST)}" codeListValue="${esc(cell)}">${esc(cell)}</gmd:MD_CellGeometryCode>
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

  const tiUnit = String(m.temporalExtentIntervalUnit || '').trim()
  const tiVal  = String(m.temporalExtentIntervalValue || '').trim()
  // gml:timeInterval comment (informational only — not a valid GML 3.2 child of TimePeriod)
  const timeIntervalXml =
    tiUnit && tiVal
      ? `\n                  <!-- timeInterval: ${esc(tiVal)} ${esc(tiUnit)} -->`
      : ''

  const xmlFileId = formatNceiUxsFileIdentifierForXml(m.fileId, dist)

  const supplementalInfoXml = (() => {
    const userSup = stripUxsPilotMachineBlock(String(m.supplementalInformation || '')).trim()
    const machine = formatUxsPilotMachineBlock(m.uxsContext)
    const combined = [userSup, machine].filter(Boolean).join('\n\n')
    return combined
      ? `      <gmd:supplementalInformation><gco:CharacterString>${esc(combined)}</gco:CharacterString></gmd:supplementalInformation>\n`
      : ''
  })()

  const distributionInfoXml = `  <gmd:distributionInfo>
    <gmd:MD_Distribution>
${distributionFormatBlock}${distributorXlinkXml}${transferOptionsBlock}    </gmd:MD_Distribution>
  </gmd:distributionInfo>
`

  return `<?xml version="1.0" encoding="UTF-8"?>
<gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"
                 xmlns:gco="http://www.isotc211.org/2005/gco"
                 xmlns:gmd="http://www.isotc211.org/2005/gmd"
                 xmlns:gml="http://www.opengis.net/gml/3.2"
                 xmlns:gmx="http://www.isotc211.org/2005/gmx"
                 xmlns:gsr="http://www.isotc211.org/2005/gsr"
                 xmlns:gss="http://www.isotc211.org/2005/gss"
                 xmlns:gts="http://www.isotc211.org/2005/gts"
                 xmlns:srv="http://www.isotc211.org/2005/srv"
                 xmlns:xlink="http://www.w3.org/1999/xlink"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.isotc211.org/2005/gmi https://data.noaa.gov/resources/iso19139/schema.xsd">
  <!-- gmd:parentIdentifier is intentionally omitted here.
       Only BEDI granule profiles (hierarchyLevel=dataset with a parent collection)
       should emit parentIdentifier.  Mission and collection records are
       standalone; adding parentIdentifier to them would create incorrect
       collection-granule relationships in CoMET and OneStop. -->
  <gmd:fileIdentifier>
    <gco:CharacterString>${esc(xmlFileId)}</gco:CharacterString>
  </gmd:fileIdentifier>
  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="${esc(MD_SCOPE_CODE_CODELIST)}" codeListValue="${esc(scopeToken)}">${esc(scopeToken)}</gmd:MD_ScopeCode>
  </gmd:hierarchyLevel>
${metadataContactXml}${dateStampXml}${metaStdXml}${spatialReprXml}${refSystemXml}  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:citation>
        <gmd:CI_Citation>
          <gmd:title><gco:CharacterString>${esc(m.title)}</gco:CharacterString></gmd:title>
          ${m.alternateTitle ? `<gmd:alternateTitle><gco:CharacterString>${esc(m.alternateTitle)}</gco:CharacterString></gmd:alternateTitle>` : ''}
          ${citationDatesResolved}
          ${m.doi ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.doi)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>` : ''}
          ${m.accession ? `<gmd:identifier><gmd:MD_Identifier><gmd:code><gco:CharacterString>${esc(m.accession)}</gco:CharacterString></gmd:code></gmd:MD_Identifier></gmd:identifier>` : ''}
          ${citationPartiesXml ? `${citationPartiesXml}\n          ` : ''}
        </gmd:CI_Citation>
      </gmd:citation>
      <gmd:abstract><gco:CharacterString>${esc(m.abstract)}</gco:CharacterString></gmd:abstract>
      <gmd:purpose><gco:CharacterString>${esc(m.purpose)}</gco:CharacterString></gmd:purpose>
      <gmd:status>
        <gmd:MD_ProgressCode codeList="${esc(MD_PROGRESS_CODE_CODELIST)}" codeListValue="${esc(progressCode)}">${esc(progressCode)}</gmd:MD_ProgressCode>
      </gmd:status>
${resourcePointOfContactXml}${resourceMaintenanceXml}${graphicOverviewXml}${kwBlock('sciencekeywords')}${kwBlock('datacenters')}${kwBlock('platforms')}${kwBlock('instruments')}${kwBlock('locations')}${kwBlock('projects')}${kwBlock('providers')}${platformInstanceFacetXml}${legalXml}${docucompXml}${aggXml}      <gmd:language>
        <gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/php/code_list.php" codeListValue="${esc(m.language)}">${esc(m.language)}</gmd:LanguageCode>
      </gmd:language>
      <gmd:characterSet>
        <gmd:MD_CharacterSetCode codeList="${esc(MD_CHARACTER_SET_CODELIST)}" codeListValue="${esc(m.characterSet || 'utf8')}">${esc(m.characterSet || 'utf8')}</gmd:MD_CharacterSetCode>
      </gmd:characterSet>
${topicCategoriesXml ? `${topicCategoriesXml}\n` : ''}      <gmd:extent>
        <gmd:EX_Extent>
${extentDescXml}          <gmd:geographicElement>
            <gmd:EX_GeographicBoundingBox>
              <gmd:westBoundLongitude><gco:Decimal>${esc(bbox.west)}</gco:Decimal></gmd:westBoundLongitude>
              <gmd:eastBoundLongitude><gco:Decimal>${esc(bbox.east)}</gco:Decimal></gmd:eastBoundLongitude>
              <gmd:southBoundLatitude><gco:Decimal>${esc(bbox.south)}</gco:Decimal></gmd:southBoundLatitude>
              <gmd:northBoundLatitude><gco:Decimal>${esc(bbox.north)}</gco:Decimal></gmd:northBoundLatitude>
            </gmd:EX_GeographicBoundingBox>
          </gmd:geographicElement>
          <gmd:temporalElement>
            <gmd:EX_TemporalExtent>
              <gmd:extent>
                <gml:TimePeriod gml:id="tp1">
                  ${m.startDate
                    ? `<gml:beginPosition>${gmlTemporalPositionText(m.startDate)}</gml:beginPosition>`
                    : `<gml:beginPosition indeterminatePosition="unknown"/>`}
                  ${m.endDate
                    ? `<gml:endPosition>${gmlTemporalPositionText(m.endDate)}</gml:endPosition>`
                    : `<gml:endPosition indeterminatePosition="unknown"/>`}${timeIntervalXml}
                </gml:TimePeriod>
              </gmd:extent>
            </gmd:EX_TemporalExtent>
          </gmd:temporalElement>
${verticalXml}        </gmd:EX_Extent>
      </gmd:extent>
${supplementalInfoXml}    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
${sensorContentInfoXml}
${distributionInfoXml}${dataQualityXml}${acquisitionXml ? `${acquisitionXml}` : ''}
${workflowComment}  <!-- metadataMaintenanceFrequency: ${esc(dist.metadataMaintenanceFrequency || 'asNeeded')} -->
  <!-- output flags: useNceiMetadataContactXlink=${useNceiMeta} omitRootReferenceSystemInfo=${omitRef} -->
</gmi:MI_Metadata>
`
}
