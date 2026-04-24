/**
 * Mission validation rule sets — translated from pilotValidation.js.
 *
 * Each rule's check(state, mode) returns:
 *   false            — check passed, no issue
 *   true             — one issue using the rule's own field/severity/message/xpath
 *   ValidationIssue[]— zero or more issues (for looping rules: sensors, keywords)
 *
 * The parity test in verify-pilot.mjs asserts that runProfileRules() on the
 * missionProfile produces identical output to validatePilotState() for the
 * seeded fixture in all three modes.
 *
 * @module profiles/mission/missionValidationRules
 */

import { normalizeMissionInstantString } from '../../lib/datetimeLocal.js'
import { normalizeNceiAccessionToken, sensorRowIsInactive } from '../../lib/pilotValidation.js'

// ---- primitive validators (mirrored from pilotValidation.js) ----

function isBlank(s) {
  return !String(s || '').trim()
}
function isValidEmail(s) {
  const v = String(s || '').trim()
  return v.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
function isValidDoi(s) {
  const v = String(s || '').trim()
  return v.length > 0 && /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(v)
}
function isValidUrl(s) {
  const v = String(s || '').trim()
  if (!v) return false
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
function isValidNumber(s) {
  const v = String(s || '').trim()
  return v !== '' && !Number.isNaN(Number(v))
}
function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())
}
function isValidDateTimeLocal(s) {
  const v = normalizeMissionInstantString(String(s || '').trim())
  return v.length > 0 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)
}
function isValidMissionInstant(s) {
  const n = normalizeMissionInstantString(String(s || '').trim())
  return isValidDate(n) || isValidDateTimeLocal(n)
}
function pickBboxAxis(val, fallback) {
  if (val == null) return fallback
  const t = String(val).trim()
  return t === '' || t === 'null' || t === 'undefined' ? fallback : t
}
function truthyFlag(v) {
  return v === true || v === 'true' || v === 1 || v === '1'
}

const BBOX_DEFAULT = { west: '-180', east: '180', south: '-90', north: '90' }

const SENSOR_KW_MAP = {
  'Earth Remote Sensing Instruments': 'instruments',
  'Spectral/Engineering': 'sciencekeywords',
  'In Situ/Laboratory Instruments': 'instruments',
  'Earth Science Services': 'sciencekeywords',
}
const KW_LABELS = {
  sciencekeywords: 'Science Keywords',
  datacenters: 'Data Centers',
  platforms: 'Platforms',
  instruments: 'Instruments',
  locations: 'Locations',
  projects: 'Projects',
  providers: 'Providers',
}
const KW_FACETS = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']

const KW_XPATH = '/gmi:MI_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:descriptiveKeywords'

// ---- core rule set (all modes) ----

/**
 * @type {import('../../core/registry/types.js').ValidationRule[]}
 */
const coreRules = [
  // --- Mission identification ---
  {
    field: 'mission.fileId',
    severity: 'e',
    message: 'File Identifier is required',
    xpath: '/gmd:MD_Metadata/gmd:fileIdentifier',
    check: (s) => isBlank(s?.mission?.fileId),
  },
  {
    field: 'mission.title',
    severity: 'e',
    message: 'Title is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title',
    check: (s) => isBlank(s?.mission?.title),
  },
  {
    field: 'mission.abstract',
    severity: 'e',
    message: 'Abstract is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:abstract',
    check: (s) => isBlank(s?.mission?.abstract),
  },
  {
    field: 'mission.startDate',
    severity: 'e',
    message: 'Creation / Start date is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement',
    check: (s) => isBlank(s?.mission?.startDate),
  },
  {
    field: 'mission.endDate',
    severity: 'e',
    message: 'End date is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement',
    check: (s) => isBlank(s?.mission?.endDate),
  },
  {
    field: 'mission.startDate',
    severity: 'e',
    message: 'Start date must be YYYY-MM-DD or datetime-local',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement',
    check: (s) => !isBlank(s?.mission?.startDate) && !isValidMissionInstant(s.mission.startDate),
  },
  {
    field: 'mission.endDate',
    severity: 'e',
    message: 'End date must be YYYY-MM-DD or datetime-local',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement',
    check: (s) => !isBlank(s?.mission?.endDate) && !isValidMissionInstant(s.mission.endDate),
  },
  {
    field: 'mission.endDate',
    severity: 'e',
    message: 'End date must be on or after start date',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement',
    check: (s) => {
      const m = s?.mission || {}
      if (isBlank(m.startDate) || isBlank(m.endDate)) return false
      if (!isValidMissionInstant(m.startDate) || !isValidMissionInstant(m.endDate)) return false
      const na = normalizeMissionInstantString(m.startDate)
      const nb = normalizeMissionInstantString(m.endDate)
      const da = Date.parse(isValidDate(na) ? `${na}T00:00:00` : na)
      const db = Date.parse(isValidDate(nb) ? `${nb}T00:00:00` : nb)
      return Number.isFinite(da) && Number.isFinite(db) && db < da
    },
  },
  {
    field: 'mission.doi',
    severity: 'e',
    message: 'DOI must look like 10.xxxx/...',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => !isBlank(s?.mission?.doi) && !isValidDoi(s.mission.doi),
  },
  {
    field: 'mission.accession',
    severity: 'e',
    message: 'NCEI Accession must be alphanumeric',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => {
      if (isBlank(s?.mission?.accession)) return false
      const acc = normalizeNceiAccessionToken(s.mission.accession)
      return Boolean(acc) && !/^[A-Za-z0-9._-]+$/.test(acc)
    },
  },
  {
    field: 'mission.org',
    severity: 'e',
    message: 'Organization name is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:organisationName',
    check: (s) => isBlank(s?.mission?.org),
  },
  {
    field: 'mission.individualName',
    severity: 'e',
    message: 'Individual name is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:individualName',
    check: (s) => isBlank(s?.mission?.individualName),
  },
  {
    field: 'mission.email',
    severity: 'e',
    message: 'Email is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress',
    check: (s) => isBlank(s?.mission?.email),
  },
  {
    field: 'mission.email',
    severity: 'e',
    message: 'Email format looks invalid',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress',
    check: (s) => !isBlank(s?.mission?.email) && !isValidEmail(s.mission.email),
  },
  {
    field: 'mission.purpose',
    severity: 'e',
    message: 'Purpose (dataset) is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:purpose',
    check: (s) => isBlank(s?.mission?.purpose),
  },
  {
    field: 'mission.status',
    severity: 'e',
    message: 'Status is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:status/gmd:MD_ProgressCode',
    check: (s) => isBlank(s?.mission?.status),
  },
  {
    field: 'mission.language',
    severity: 'e',
    message: 'Metadata language is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:language/gmd:LanguageCode',
    check: (s) => isBlank(s?.mission?.language),
  },
  {
    field: 'mission.publicationDate',
    severity: 'e',
    message: 'Publication date must be YYYY-MM-DD or datetime-local',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:date',
    check: (s) => !isBlank(s?.mission?.publicationDate) && !isValidMissionInstant(s.mission.publicationDate),
  },
  {
    field: 'mission.metadataRecordDate',
    severity: 'e',
    message: 'Metadata record date must be YYYY-MM-DD or datetime-local',
    xpath: '/gmd:MD_Metadata/gmd:dateStamp',
    check: (s) => !isBlank(s?.mission?.metadataRecordDate) && !isValidMissionInstant(s.mission.metadataRecordDate),
  },
  {
    field: 'mission.contactUrl',
    severity: 'e',
    message: 'Contact URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => !isBlank(s?.mission?.contactUrl) && !isValidUrl(s.mission.contactUrl),
  },
  {
    field: 'mission.licenseUrl',
    severity: 'e',
    message: 'License URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
    check: (s) => {
      const preset = String(s?.mission?.dataLicensePreset || 'custom').trim()
      return !isBlank(s?.mission?.licenseUrl) && !isValidUrl(s.mission.licenseUrl)
        && (preset !== 'custom' || !isBlank(s.mission.licenseUrl))
    },
  },
  {
    field: 'mission.relatedDataUrl',
    severity: 'e',
    message: 'Related data URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo',
    check: (s) => !isBlank(s?.mission?.relatedDataUrl) && !isValidUrl(s.mission.relatedDataUrl),
  },
  // bbox
  {
    field: 'mission.bbox',
    severity: 'e',
    message: 'Bounding box must be numeric W/E/S/N',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox',
    check: (s) => {
      const m = s?.mission || {}
      const axes = [
        pickBboxAxis(m.west, BBOX_DEFAULT.west),
        pickBboxAxis(m.east, BBOX_DEFAULT.east),
        pickBboxAxis(m.south, BBOX_DEFAULT.south),
        pickBboxAxis(m.north, BBOX_DEFAULT.north),
      ]
      return !axes.every(isValidNumber)
    },
  },
  {
    field: 'mission.bbox',
    severity: 'e',
    message: 'Bounding box invalid (west≤east, south≤north)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox',
    check: (s) => {
      const m = s?.mission || {}
      const w = pickBboxAxis(m.west, BBOX_DEFAULT.west)
      const e = pickBboxAxis(m.east, BBOX_DEFAULT.east)
      const sv = pickBboxAxis(m.south, BBOX_DEFAULT.south)
      const n = pickBboxAxis(m.north, BBOX_DEFAULT.north)
      if (![w, e, sv, n].every(isValidNumber)) return false
      return Number(w) > Number(e) || Number(sv) > Number(n)
    },
  },
  {
    field: 'mission.vmin',
    severity: 'e',
    message: 'Vertical min must be numeric',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement',
    check: (s) => !isBlank(s?.mission?.vmin) && !isValidNumber(s.mission.vmin),
  },
  {
    field: 'mission.vmax',
    severity: 'e',
    message: 'Vertical max must be numeric',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement',
    check: (s) => !isBlank(s?.mission?.vmax) && !isValidNumber(s.mission.vmax),
  },
  {
    field: 'mission.vertical',
    severity: 'e',
    message: 'Vertical min must be ≤ max',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement',
    check: (s) => {
      const m = s?.mission || {}
      return isValidNumber(m.vmin) && isValidNumber(m.vmax) && Number(m.vmin) > Number(m.vmax)
    },
  },
  // --- Platform ---
  {
    field: 'platform.platformType',
    severity: 'e',
    message: 'Platform type is required',
    xpath: '/gmi:MI_Metadata/gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmi:type',
    check: (s) => isBlank(s?.platform?.platformType),
  },
  {
    field: 'platform.platformId',
    severity: 'e',
    message: 'Platform ID is required',
    xpath: '/gmi:MI_Metadata/gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => isBlank(s?.platform?.platformId),
  },
  {
    field: 'platform.platformDesc',
    severity: 'e',
    message: 'Platform description is required',
    xpath: '/gmi:MI_Metadata/gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmd:description',
    check: (s) => isBlank(s?.platform?.platformDesc),
  },
  // --- Spatial ---
  {
    field: 'spatial.accuracyValue',
    severity: 'e',
    message: 'Positional accuracy value must be numeric',
    xpath: '/gmd:MD_Metadata/gmd:dataQualityInfo',
    check: (s) => !isBlank(s?.spatial?.accuracyValue) && !isValidNumber(s.spatial.accuracyValue),
  },
  {
    field: 'spatial.errorValue',
    severity: 'e',
    message: 'Error value must be numeric',
    xpath: '/gmd:MD_Metadata/gmd:dataQualityInfo',
    check: (s) => !isBlank(s?.spatial?.errorValue) && !isValidNumber(s.spatial.errorValue),
  },
  {
    field: 'spatial.verticalCrsUrl',
    severity: 'e',
    message: 'Vertical CRS URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent',
    check: (s) => !isBlank(s?.spatial?.verticalCrsUrl) && !isValidUrl(s.spatial.verticalCrsUrl),
  },
  // grid dimension numerics
  ...['gridColumnSize', 'gridRowSize', 'gridVerticalSize'].map((k) => ({
    field: `spatial.${k}`,
    severity: /** @type {'e'} */ ('e'),
    message: `${k}: must be numeric`,
    xpath: '/gmd:MD_Metadata/gmd:spatialRepresentationInfo',
    check: (s) => truthyFlag(s?.spatial?.useGridRepresentation) && !isBlank(s?.spatial?.[k]) && !isValidNumber(s.spatial[k]),
  })),
  // --- Sensors (returns issue array) ---
  {
    field: 'sensors',
    severity: 'e',
    message: 'At least one sensor is required',
    xpath: '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription',
    check: (s) => {
      const sensors = Array.isArray(s?.sensors) ? s.sensors : []
      if (!sensors.length) return true

      const active = sensors.map((sen, idx) => ({ sen, idx })).filter(({ sen }) => !sensorRowIsInactive(sen))
      if (!active.length) {
        return [
          {
            severity: /** @type {'e'} */ ('e'),
            field: 'sensors',
            message: 'At least one sensor is required',
            xpath: '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription',
          },
        ]
      }

      /** @type {import('../../core/entities/types.js').ValidationIssue[]} */
      const issues = []
      const kw = s?.keywords || {}
      active.forEach(({ sen, idx }) => {
        const pfx = `sensors[${idx}]`
        const xpath = '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription'
        if (isBlank(sen.type)) {
          issues.push({ severity: 'e', field: `${pfx}.type`, message: `Sensor ${idx + 1}: type is required`, xpath: `${xpath}/gmd:attributeDescription` })
        }
        const modelOrSensor = String(sen.modelId || sen.sensorId || '').trim()
        if (isBlank(modelOrSensor)) {
          issues.push({ severity: 'e', field: `${pfx}.modelId`, message: `Sensor ${idx + 1}: model ID is required`, xpath: `${xpath}/gmd:identifier/gmd:MD_Identifier/gmd:code` })
        }
        if (isBlank(sen.variable)) {
          issues.push({ severity: 'e', field: `${pfx}.variable`, message: `Sensor ${idx + 1}: observed variable is required`, xpath: `${xpath}/gmd:name` })
        }
        if (!isBlank(sen.type) && !isBlank(sen.variable)) {
          const facet = SENSOR_KW_MAP[sen.type]
          if (facet) {
            const list = kw[facet] || []
            const v = String(sen.variable || '').trim().toLowerCase()
            const mismatch = list.length > 0 && v && !list.some((k) => String(k?.label || '').toLowerCase().includes(v))
            if (!list.length || mismatch) {
              issues.push({ severity: 'w', field: `${pfx}.variable`, message: `Sensor ${idx + 1}: variable may not align with selected GCMD keywords for this sensor type`, xpath: `${xpath}/gmd:name` })
            }
          }
        }
      })
      return issues.length ? issues : false
    },
  },
  // --- Keywords (returns issue array) ---
  {
    field: 'keywords',
    severity: 'e',
    message: 'Keyword facets required',
    xpath: KW_XPATH,
    check: (s) => {
      const kw = s?.keywords || {}
      const issues = KW_FACETS
        .filter((f) => !(Array.isArray(kw[f]) && kw[f].length))
        .map((f) => ({
          severity: /** @type {'e'} */ ('e'),
          field: `keywords.${f}`,
          message: `${KW_LABELS[f] || f}: at least one keyword is required`,
          xpath: KW_XPATH,
        }))
      return issues.length ? issues : false
    },
  },
  // --- Distribution ---
  {
    field: 'distribution.format',
    severity: 'e',
    message: 'Distribution format is required',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:distributionFormat/gmd:MD_Format/gmd:name',
    check: (s) => isBlank(s?.distribution?.format),
  },
  {
    field: 'distribution.license',
    severity: 'e',
    message: 'Use/License is required',
    xpath: '/gmi:MI_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints/gmd:MD_LegalConstraints',
    check: (s) => isBlank(s?.distribution?.license),
  },
  {
    field: 'distribution.landingUrl',
    severity: 'e',
    message: 'Landing page URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => !isBlank(s?.distribution?.landingUrl) && !isValidUrl(s.distribution.landingUrl),
  },
  {
    field: 'distribution.downloadUrl',
    severity: 'e',
    message: 'Download URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => !isBlank(s?.distribution?.downloadUrl) && !isValidUrl(s.distribution.downloadUrl),
  },
  {
    field: 'distribution.metadataLandingUrl',
    severity: 'e',
    message: 'Metadata landing URL must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => !isBlank(s?.distribution?.metadataLandingUrl) && !isValidUrl(s.distribution.metadataLandingUrl),
  },
  {
    field: 'distribution.nceiMetadataContactHref',
    severity: 'w',
    message: 'NCEI metadata contact xlink is enabled but href is empty (generator may fall back to schema default)',
    xpath: '/gmd:MD_Metadata/gmd:contact',
    check: (s) => Boolean(s?.distribution?.useNceiMetadataContactXlink) && isBlank(s?.distribution?.nceiMetadataContactHref),
  },
  {
    field: 'distribution.nceiMetadataContactHref',
    severity: 'e',
    message: 'NCEI metadata contact href must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:contact',
    check: (s) => !isBlank(s?.distribution?.nceiMetadataContactHref) && !isValidUrl(s.distribution.nceiMetadataContactHref),
  },
  {
    field: 'distribution.nceiDistributorContactHref',
    severity: 'e',
    message: 'NCEI distributor contact href must be http(s)',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:distributor',
    check: (s) => !isBlank(s?.distribution?.nceiDistributorContactHref) && !isValidUrl(s.distribution.nceiDistributorContactHref),
  },
]

// ---- lenient-only rules (warnings that become errors in strict/catalog) ----

/** @type {import('../../core/registry/types.js').ValidationRule[]} */
const lenientOnlyRules = [
  {
    field: 'mission.licenseUrl',
    severity: 'w',
    message: 'License URL recommended when preset is custom',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
    check: (s) => {
      const preset = String(s?.mission?.dataLicensePreset || 'custom').trim()
      return preset === 'custom' && isBlank(s?.mission?.licenseUrl)
    },
  },
  {
    field: 'mission.ror',
    severity: 'w',
    message: 'No ROR selected (recommended for organization linkage)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier',
    check: (s) => isBlank(s?.mission?.ror?.id),
  },
]

// ---- strict-mode extra rules ----

/** @type {import('../../core/registry/types.js').ValidationRule[]} */
const strictExtraRules = [
  {
    field: 'mission.licenseUrl',
    severity: 'e',
    message: 'License URL is required when data license preset is custom',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
    check: (s) => {
      const preset = String(s?.mission?.dataLicensePreset || 'custom').trim()
      return preset === 'custom' && isBlank(s?.mission?.licenseUrl)
    },
  },
  {
    field: 'spatial.gridRepresentation',
    severity: 'e',
    message: 'Strict mode: grid column size and row size are required when grid representation is enabled',
    xpath: '/gmd:MD_Metadata/gmd:spatialRepresentationInfo',
    check: (s) => truthyFlag(s?.spatial?.useGridRepresentation) && (isBlank(s?.spatial?.gridColumnSize) || isBlank(s?.spatial?.gridRowSize)),
  },
  {
    field: 'spatial.trajectorySampling',
    severity: 'e',
    message: 'Trajectory sampling is required when trajectory is enabled',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent',
    check: (s) => truthyFlag(s?.spatial?.hasTrajectory) && isBlank(s?.spatial?.trajectorySampling),
  },
  {
    field: 'mission.doi',
    severity: 'e',
    message: 'Strict mode: DOI is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => isBlank(s?.mission?.doi),
  },
  {
    field: 'mission.accession',
    severity: 'e',
    message: 'Strict mode: NCEI Accession is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => isBlank(s?.mission?.accession),
  },
  {
    field: 'mission.ror',
    severity: 'e',
    message: 'Strict mode: ROR is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier',
    check: (s) => isBlank(s?.mission?.ror?.id),
  },
]

// ---- catalog-mode extra rules ----

/** @type {import('../../core/registry/types.js').ValidationRule[]} */
const catalogExtraRules = [
  {
    field: 'mission.licenseUrl',
    severity: 'e',
    message: 'License URL is required when data license preset is custom',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
    check: (s) => {
      const preset = String(s?.mission?.dataLicensePreset || 'custom').trim()
      return preset === 'custom' && isBlank(s?.mission?.licenseUrl)
    },
  },
  {
    field: 'spatial.trajectorySampling',
    severity: 'e',
    message: 'Trajectory sampling is required when trajectory is enabled',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent',
    check: (s) => truthyFlag(s?.spatial?.hasTrajectory) && isBlank(s?.spatial?.trajectorySampling),
  },
  {
    field: 'mission.doi',
    severity: 'e',
    message: 'Catalog mode: DOI is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => isBlank(s?.mission?.doi),
  },
  {
    field: 'mission.accession',
    severity: 'e',
    message: 'Catalog mode: NCEI Accession is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code',
    check: (s) => isBlank(s?.mission?.accession),
  },
  {
    field: 'mission.ror',
    severity: 'e',
    message: 'Catalog mode: ROR is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier',
    check: (s) => isBlank(s?.mission?.ror?.id),
  },
  // parent project (two fields)
  {
    field: 'mission.parentProjectTitle',
    severity: 'e',
    message: 'Catalog mode: enter parent project on Mission (aggregation) or Distribution (parent project)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo/gmd:MD_AggregateInformation/gmd:aggregateDataSetName/gmd:CI_Citation/gmd:title',
    check: (s) => {
      const d = s?.distribution || {}
      const m = s?.mission || {}
      return isBlank(d.parentProject) && isBlank(m.parentProjectTitle)
    },
  },
  {
    field: 'distribution.parentProject',
    severity: 'e',
    message: 'Catalog mode: enter parent project on Mission (aggregation) or Distribution (parent project)',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo/gmd:MD_AggregateInformation/gmd:aggregateDataSetName/gmd:CI_Citation/gmd:title',
    check: (s) => {
      const d = s?.distribution || {}
      const m = s?.mission || {}
      return isBlank(d.parentProject) && isBlank(m.parentProjectTitle)
    },
  },
  {
    field: 'distribution.publication',
    severity: 'e',
    message: 'Catalog mode: publication reference is required',
    xpath: '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:otherCitationDetails',
    check: (s) => isBlank(s?.distribution?.publication),
  },
  {
    field: 'distribution.landingUrl',
    severity: 'e',
    message: 'Catalog mode: landing page URL is required',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => isBlank(s?.distribution?.landingUrl),
  },
  {
    field: 'distribution.downloadUrl',
    severity: 'e',
    message: 'Catalog mode: download URL is required',
    xpath: '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage',
    check: (s) => isBlank(s?.distribution?.downloadUrl),
  },
]

/**
 * The three validation rule sets for the mission profile.
 *
 * @type {import('../../core/registry/types.js').ValidationRuleSet[]}
 */
export const missionValidationRuleSets = [
  {
    id: 'mission-core',
    modes: ['lenient', 'strict', 'catalog'],
    rules: coreRules,
  },
  {
    id: 'mission-lenient-only',
    modes: ['lenient'],
    rules: lenientOnlyRules,
  },
  {
    id: 'mission-strict',
    modes: ['strict'],
    rules: strictExtraRules,
  },
  {
    id: 'mission-catalog',
    modes: ['catalog'],
    rules: catalogExtraRules,
  },
]
