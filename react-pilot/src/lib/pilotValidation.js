import { SENSOR_XML_OPTIONAL_DEFAULTS } from './sensorInstrumentDescription.js'
import { canonicalMissionInstantForStorage, normalizeMissionInstantString } from './datetimeLocal.js'
import { previewMetadataXPath } from './metadataXPath.js'

/** @typedef {'e'|'w'} Severity */

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

/** Facets stored as keyword chip rows under `keywords.*` (mission pilot). */
const KW_KEYWORD_CHIP_FACETS = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']

const KW_CHIP_UUID_XPATH =
  '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:descriptiveKeywords'

const KMS_CONCEPT_UUID_RE = /^[a-f0-9-]{36}$/i

const UXS_CONTEXT_DEFAULT = {
  primaryLayer:     'datasetProduct',
  deploymentName:  '',
  deploymentId:    '',
  runName:         '',
  runId:           '',
  sortieName:      '',
  sortieId:        '',
  diveName:        '',
  diveId:          '',
  operationOutcome: '',
  narrative:       '',
}

function normalizeUxsContext(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = { ...UXS_CONTEXT_DEFAULT }
  for (const key of Object.keys(out)) {
    out[key] = String(src[key] ?? out[key] ?? '').trim()
  }
  if (!['datasetProduct', 'deployment', 'run', 'sortie', 'dive', 'other'].includes(out.primaryLayer)) {
    out.primaryLayer = 'datasetProduct'
  }
  if (!['', 'completed', 'partial', 'aborted', 'unknown'].includes(out.operationOutcome)) {
    out.operationOutcome = ''
  }
  return out
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isBlank(s) {
  return !String(s || '').trim()
}

/**
 * True when a sensor card has no type, id/model, or variable — treat as an unused
 * template slot so it does not fail validation.
 * @param {unknown} sen
 * @returns {boolean}
 */
export function sensorRowIsInactive(sen) {
  if (!sen || typeof sen !== 'object') return true
  return (
    isBlank(/** @type {{ type?: unknown }} */ (sen).type)
    && isBlank(/** @type {{ modelId?: unknown, sensorId?: unknown }} */ (sen).modelId)
    && isBlank(/** @type {{ modelId?: unknown, sensorId?: unknown }} */ (sen).sensorId)
    && isBlank(/** @type {{ variable?: unknown }} */ (sen).variable)
  )
}

/**
 * Strip NCEI UxS file-id prefix and whitespace before accession pattern checks.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeNceiAccessionToken(raw) {
  let acc = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s/g, '')
  acc = acc.replace(/^gov\.noaa\.ncei\.uxs:/i, '')
  return acc
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidEmail(s) {
  const v = String(s || '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidDoi(s) {
  const v = String(s || '').trim()
  if (!v) return false
  return /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(v)
}

/**
 * @param {string} s
 * @returns {boolean}
 */
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

/** @param {unknown} s */
function normalizeInstantForValidation(s) {
  return normalizeMissionInstantString(s)
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidDate(s) {
  const v = String(s || '').trim()
  if (!v) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidDateTimeLocal(s) {
  const v = normalizeInstantForValidation(String(s || '').trim())
  if (!v) return false
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidMissionInstant(s) {
  const n = normalizeInstantForValidation(String(s || '').trim())
  if (!n) return false
  return isValidDate(n) || isValidDateTimeLocal(n)
}

const BBOX_DEFAULT = { west: '-180', east: '180', south: '-90', north: '90' }

/**
 * Keys on `collectFormData().output` / saved `loaded.output` that map 1:1 onto `pilotState.distribution`.
 * Excludes: `doi` (→ mission), `saveAsTemplate` (UI only), `metadataSchema` (generator / GAS only).
 * `outputFormat` is merged separately onto `distribution.format`.
 */
const LEGACY_OUTPUT_DISTRIBUTION_KEYS = [
  'metadataStandard',
  'metadataVersion',
  'distributionFormatName',
  'distributionFileFormat',
  'metadataLandingUrl',
  'metadataLandingLinkName',
  'metadataLandingDescription',
  'landingUrl',
  'downloadUrl',
  'downloadProtocol',
  'downloadLinkName',
  'downloadLinkDescription',
  'distributionFeesText',
  'distributionOrderingInstructions',
  'metadataMaintenanceFrequency',
  'license',
  'parentProject',
  'publication',
  'outputLocation',
  'awsBucket',
  'awsPrefix',
  'finalNotes',
  'templateName',
  'templateCategory',
  'nceiMetadataContactHref',
  'nceiMetadataContactTitle',
  'nceiDistributorContactHref',
  'nceiDistributorContactTitle',
  'useNceiMetadataContactXlink',
  'omitRootReferenceSystemInfo',
  'nceiFileIdPrefix',
]

/**
 * @param {unknown} val
 * @param {string} fallback
 * @returns {string}
 */
function pickBboxAxis(val, fallback) {
  if (val == null) return fallback
  const t = String(val).trim()
  if (t === '' || t === 'null' || t === 'undefined') return fallback
  return t
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function truthyFlag(v) {
  return v === true || v === 'true' || v === 1 || v === '1'
}

/**
 * Coerce common legacy JSON quirks so validation matches the in-browser form.
 * @param {unknown} state
 * @returns {object}
 */
export function sanitizePilotState(state) {
  if (!state || typeof state !== 'object') return /** @type {object} */ (state)
  const out = JSON.parse(JSON.stringify(state))

  if (out.mission && typeof out.mission === 'object') {
    const m = out.mission
    for (const k of ['startDate', 'endDate', 'publicationDate', 'metadataRecordDate']) {
      if (m[k] == null) continue
      const raw = typeof m[k] === 'string' ? m[k] : String(m[k])
      m[k] = canonicalMissionInstantForStorage(raw)
    }
    for (const ax of ['west', 'east', 'south', 'north']) {
      m[ax] = pickBboxAxis(m[ax], BBOX_DEFAULT[ax])
    }
    if (m.accession != null) m.accession = String(m.accession).replace(/\u00a0/g, ' ').trim()
    for (const k of ['vmin', 'vmax']) {
      const t = String(m[k] ?? '').trim()
      if (t === '') continue
      if (Number.isNaN(Number(t))) m[k] = ''
    }
    if (Array.isArray(m.topicCategories)) {
      m.topicCategories = m.topicCategories.map((c) => String(c ?? '').trim()).filter(Boolean)
    } else if (typeof m.topicCategories === 'string') {
      m.topicCategories = m.topicCategories.split(/[\n,]+/).map((t) => t.trim()).filter(Boolean)
    } else if (m.topicCategories != null) {
      m.topicCategories = []
    }
    for (const gk of ['graphicOverviewHref', 'graphicOverviewTitle']) {
      if (m[gk] != null) m[gk] = String(m[gk]).trim()
    }
    m.uxsContext = normalizeUxsContext(m.uxsContext)
  }

  if (out.spatial && typeof out.spatial === 'object') {
    const sp = out.spatial
    sp.useGridRepresentation = truthyFlag(sp.useGridRepresentation)
    sp.hasTrajectory = truthyFlag(sp.hasTrajectory)
  }

  if (out.distribution && typeof out.distribution === 'object') {
    const d = out.distribution
    if (d.nceiFileIdPrefix !== undefined && d.nceiFileIdPrefix !== null) {
      const t = String(d.nceiFileIdPrefix).trim()
      if (t === '') delete d.nceiFileIdPrefix
      else d.nceiFileIdPrefix = truthyFlag(d.nceiFileIdPrefix)
    }
  }

  if (Array.isArray(out.sensors)) {
    out.sensors = out.sensors.map((s) => {
      const sensorId = String(s?.sensorId ?? '').trim()
      let modelId = String(s?.modelId ?? '').trim()
      if (!modelId && sensorId) modelId = sensorId
      return { ...s, modelId, sensorId }
    })
    const ins = out.keywords?.instruments
    const firstInst = Array.isArray(ins) && ins[0]?.label ? String(ins[0].label).trim() : ''
    if (firstInst) {
      out.sensors = out.sensors.map((s, i) => {
        const v = String(s?.variable ?? '').trim()
        if (v) return s
        if (i === 0) return { ...s, variable: firstInst }
        return s
      })
    }
    while (out.sensors.length > 1 && sensorRowIsInactive(out.sensors[out.sensors.length - 1])) {
      out.sensors.pop()
    }
  }

  return out
}

/**
 * @param {string} s
 * @returns {boolean}
 */
function isValidNumber(s) {
  const v = String(s || '').trim()
  if (v === '') return false
  return !Number.isNaN(Number(v))
}

/**
 * @param {string} type
 * @param {string} variable
 * @param {Record<string, Array<{ label: string }>>} keywords
 * @returns {boolean}
 */
function checkSensorKwMismatch(type, variable, keywords) {
  const facet = SENSOR_KW_MAP[type]
  if (!facet) return false
  const list = keywords?.[facet] || []
  if (!list.length) return true
  const v = String(variable || '').trim().toLowerCase()
  if (!v) return false
  return !list.some((k) => String(k?.label || '').toLowerCase().includes(v))
}

const COMMON_ABSTRACT_ACRONYMS = new Set(['ADCP', 'AUV', 'CTD', 'GCMD', 'ISO', 'NCEI', 'NOAA', 'REMUS', 'ROV', 'UUV'])

/**
 * @param {object} state
 * @returns {Array<{ severity: Severity, field: string, message: string, xpath?: string }>}
 */
function abstractQualityIssues(state) {
  const m = state?.mission || {}
  const p = state?.platform || {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors : []
  const abstract = String(m.abstract || '').trim()
  if (!abstract) return []
  const issues = []
  const xpath = '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:abstract'
  if (abstract.length < 120) {
    issues.push({
      severity: 'w',
      field:    'mission.abstract',
      message:  'Abstract is short; include objective, platform/sensor, area, dates, and data product.',
      xpath,
    })
  }
  const lower = abstract.toLowerCase()
  const contextTokens = [
    p.platformId,
    p.platformName,
    p.model,
    ...sensors.flatMap((s) => [s?.sensorId, s?.modelId, s?.variable]),
  ]
    .map((v) => String(v || '').trim())
    .filter((v) => v.length >= 3)
  if (contextTokens.length && !contextTokens.some((v) => lower.includes(v.toLowerCase()))) {
    issues.push({
      severity: 'w',
      field:    'mission.abstract',
      message:  'Abstract should mention the relevant platform, sensor, or observed variable.',
      xpath,
    })
  }
  const acronyms = [...new Set(abstract.match(/\b[A-Z]{2,8}\b/g) || [])]
    .filter((token) => !COMMON_ABSTRACT_ACRONYMS.has(token))
  const unexplained = acronyms.find((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return !new RegExp(`\\([^)]*\\b${escaped}\\b[^)]*\\)`).test(abstract)
  })
  if (unexplained) {
    issues.push({
      severity: 'w',
      field:    'mission.abstract',
      message:  `Abstract uses acronym "${unexplained}"; expand it on first use when possible.`,
      xpath,
    })
  }
  return issues
}

/**
 * Lenient warnings for GCMD keyword chips whose UUID may not round-trip to KMS links.
 *
 * @param {Record<string, unknown>} keywords - `state.keywords`
 * @returns {Array<{ severity: Severity, field: string, message: string, xpath?: string }>}
 */
export function collectGcmdKeywordUuidWarnings(keywords) {
  const kw = keywords && typeof keywords === 'object' ? keywords : {}
  /** @type {Array<{ severity: Severity, field: string, message: string, xpath?: string }>} */
  const out = []
  KW_KEYWORD_CHIP_FACETS.forEach((f) => {
    const arr = Array.isArray(kw[f]) ? kw[f] : []
    arr.forEach((row, i) => {
      const label = String(row?.label ?? '').trim()
      const uuid = String(row?.uuid ?? '').trim()
      if (label && !uuid) {
        out.push({
          severity: 'w',
          field: `keywords.${f}[${i}].uuid`,
          message: 'Add concept UUID for best KMS href',
          xpath: KW_CHIP_UUID_XPATH,
        })
        return
      }
      if (!uuid) return
      const plausible =
        KMS_CONCEPT_UUID_RE.test(uuid) ||
        uuid.toLowerCase().startsWith('http') ||
        /gcmd\.earthdata\.nasa\.gov/i.test(uuid)
      if (!plausible) {
        out.push({
          severity: 'w',
          field: `keywords.${f}[${i}].uuid`,
          message: 'UUID may not look like a KMS concept id',
          xpath: KW_CHIP_UUID_XPATH,
        })
      }
    })
  })
  return out
}

/**
 * @param {string} mode lenient | strict | catalog
 * @param {object} state
 * @returns {{ issues: Array<{ severity: Severity, field: string, message: string, xpath?: string }>, score: number, maxScore: number }}
 */
export function validatePilotState(mode, state) {
  const issues = []
  const m = state?.mission || {}
  const sp = state?.spatial || {}
  const p = state?.platform || {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors : []
  const kw = state?.keywords || {}
  const dist = state?.distribution || {}

  const strict = mode === 'strict'
  const catalog = mode === 'catalog'

  const add = (severity, field, message, xpath) => {
    issues.push({ severity, field, message, xpath: previewMetadataXPath(xpath) })
  }

  // Mission
  if (isBlank(m.fileId)) {
    add('e', 'mission.fileId', 'File Identifier is required', '/gmd:MD_Metadata/gmd:fileIdentifier')
  }
  if (isBlank(m.title)) {
    add('e', 'mission.title', 'Title is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title')
  }
  if (isBlank(m.abstract)) {
    add('e', 'mission.abstract', 'Abstract is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:abstract')
  }
  issues.push(
    ...abstractQualityIssues(state).map((i) => ({ ...i, xpath: previewMetadataXPath(i.xpath) })),
  )
  if (isBlank(m.startDate)) {
    add('e', 'mission.startDate', 'Creation / Start date is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement')
  }
  if (isBlank(m.endDate)) {
    add('e', 'mission.endDate', 'End date is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement')
  }
  if (!isBlank(m.startDate) && !isValidMissionInstant(m.startDate)) {
    add('e', 'mission.startDate', 'Start date must be YYYY-MM-DD or datetime-local', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement')
  }
  if (!isBlank(m.endDate) && !isValidMissionInstant(m.endDate)) {
    add('e', 'mission.endDate', 'End date must be YYYY-MM-DD or datetime-local', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement')
  }
  if (!isBlank(m.startDate) && !isBlank(m.endDate) && isValidMissionInstant(m.startDate) && isValidMissionInstant(m.endDate)) {
    const na = normalizeInstantForValidation(m.startDate)
    const nb = normalizeInstantForValidation(m.endDate)
    const da = Date.parse(isValidDate(na) ? `${na}T00:00:00` : na)
    const db = Date.parse(isValidDate(nb) ? `${nb}T00:00:00` : nb)
    if (Number.isFinite(da) && Number.isFinite(db) && db < da) {
      add('e', 'mission.endDate', 'End date must be on or after start date', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:temporalElement')
    }
  }
  if (!isBlank(m.doi) && !isValidDoi(m.doi)) {
    add('e', 'mission.doi', 'DOI must look like 10.xxxx/...', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
  }
  if (!isBlank(m.accession)) {
    const acc = normalizeNceiAccessionToken(m.accession)
    if (acc && !/^[A-Za-z0-9._-]+$/.test(acc)) {
      add('e', 'mission.accession', 'NCEI Accession must be alphanumeric', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
  }
  if (isBlank(m.org)) {
    add('e', 'mission.org', 'Organization name is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:organisationName')
  }
  if (isBlank(m.individualName)) {
    add('e', 'mission.individualName', 'Individual name is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:individualName')
  }
  if (isBlank(m.email)) {
    add('e', 'mission.email', 'Email is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress')
  } else if (!isValidEmail(m.email)) {
    add('e', 'mission.email', 'Email format looks invalid', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress')
  }

  if (isBlank(m.purpose)) {
    add('e', 'mission.purpose', 'Purpose (dataset) is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:purpose')
  }
  if (isBlank(m.status)) {
    add('e', 'mission.status', 'Status is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:status/gmd:MD_ProgressCode')
  }
  if (isBlank(m.language)) {
    add('e', 'mission.language', 'Metadata language is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:language/gmd:LanguageCode')
  }
  if (!isBlank(m.publicationDate) && !isValidMissionInstant(m.publicationDate)) {
    add('e', 'mission.publicationDate', 'Publication date must be YYYY-MM-DD or datetime-local', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:date')
  }
  if (!isBlank(m.metadataRecordDate) && !isValidMissionInstant(m.metadataRecordDate)) {
    add('e', 'mission.metadataRecordDate', 'Metadata record date must be YYYY-MM-DD or datetime-local', '/gmd:MD_Metadata/gmd:dateStamp')
  }
  if (!isBlank(m.contactUrl) && !isValidUrl(m.contactUrl)) {
    add('e', 'mission.contactUrl', 'Contact URL must be http(s)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource/gmd:linkage')
  }

  const licensePreset = String(m.dataLicensePreset || 'custom').trim()
  if (licensePreset === 'custom') {
    if (isBlank(m.licenseUrl)) {
      if (strict || catalog) {
        add(
          'e',
          'mission.licenseUrl',
          'License URL is required when data license preset is custom',
          '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
        )
      } else {
        add(
          'w',
          'mission.licenseUrl',
          'License URL recommended when preset is custom',
          '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints',
        )
      }
    } else if (!isValidUrl(m.licenseUrl)) {
      add('e', 'mission.licenseUrl', 'License URL must be http(s)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints')
    }
  } else if (!isBlank(m.licenseUrl) && !isValidUrl(m.licenseUrl)) {
    add('e', 'mission.licenseUrl', 'License URL must be http(s)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints')
  }

  if (!isBlank(m.relatedDataUrl) && !isValidUrl(m.relatedDataUrl)) {
    add('e', 'mission.relatedDataUrl', 'Related data URL must be http(s)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo')
  }

  const w = pickBboxAxis(m.west, BBOX_DEFAULT.west)
  const e = pickBboxAxis(m.east, BBOX_DEFAULT.east)
  const s = pickBboxAxis(m.south, BBOX_DEFAULT.south)
  const n = pickBboxAxis(m.north, BBOX_DEFAULT.north)
  const bboxNums = [w, e, s, n].every((v) => isValidNumber(v))
  if (!bboxNums) {
    add('e', 'mission.bbox', 'Bounding box must be numeric W/E/S/N', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox')
  } else if (Number(w) > Number(e) || Number(s) > Number(n)) {
    add('e', 'mission.bbox', 'Bounding box invalid (west≤east, south≤north)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox')
  }

  if (!isBlank(m.vmin) && !isValidNumber(m.vmin)) {
    add('e', 'mission.vmin', 'Vertical min must be numeric', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement')
  }
  if (!isBlank(m.vmax) && !isValidNumber(m.vmax)) {
    add('e', 'mission.vmax', 'Vertical max must be numeric', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement')
  }
  if (isValidNumber(m.vmin) && isValidNumber(m.vmax) && Number(m.vmin) > Number(m.vmax)) {
    add('e', 'mission.vertical', 'Vertical min must be ≤ max', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent/gmd:EX_Extent/gmd:verticalElement')
  }

  if (isBlank(m.ror?.id) && !strict && !catalog) {
    add('w', 'mission.ror', 'No ROR selected (recommended for organization linkage)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier')
  }

  // Platform
  if (isBlank(p.platformType)) {
    add('e', 'platform.platformType', 'Platform type is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:descriptiveKeywords/gmd:MD_Keywords/gmd:thesaurusName/gmd:CI_Citation/gmd:title')
  }
  if (isBlank(p.platformId)) {
    add('e', 'platform.platformId', 'Platform ID is required', '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription/gmd:identifier/gmd:MD_Identifier/gmd:code')
  }
  if (isBlank(p.platformDesc)) {
    add('e', 'platform.platformDesc', 'Platform description is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:abstract')
  }

  if (!isBlank(sp.accuracyValue) && !isValidNumber(sp.accuracyValue)) {
    add('e', 'spatial.accuracyValue', 'Positional accuracy value must be numeric', '/gmd:MD_Metadata/gmd:dataQualityInfo')
  }
  if (!isBlank(sp.errorValue) && !isValidNumber(sp.errorValue)) {
    add('e', 'spatial.errorValue', 'Error value must be numeric', '/gmd:MD_Metadata/gmd:dataQualityInfo')
  }

  if (!isBlank(sp.verticalCrsUrl) && !isValidUrl(sp.verticalCrsUrl)) {
    add('e', 'spatial.verticalCrsUrl', 'Vertical CRS URL must be http(s)', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent')
  }

  if (truthyFlag(sp.useGridRepresentation)) {
    ;['gridColumnSize', 'gridRowSize', 'gridVerticalSize'].forEach((k) => {
      if (!isBlank(sp[k]) && !isValidNumber(sp[k])) {
        add('e', `spatial.${k}`, `${k}: must be numeric`, '/gmd:MD_Metadata/gmd:spatialRepresentationInfo')
      }
    })
    if (strict && (isBlank(sp.gridColumnSize) || isBlank(sp.gridRowSize))) {
      add(
        'e',
        'spatial.gridRepresentation',
        'Strict mode: grid column size and row size are required when grid representation is enabled',
        '/gmd:MD_Metadata/gmd:spatialRepresentationInfo',
      )
    }
  }

  if (truthyFlag(sp.hasTrajectory) && isBlank(sp.trajectorySampling)) {
    if (strict || catalog) {
      add(
        'e',
        'spatial.trajectorySampling',
        'Trajectory sampling is required when trajectory is enabled',
        '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent',
      )
    } else {
      add(
        'w',
        'spatial.trajectorySampling',
        'Trajectory sampling recommended when trajectory is enabled',
        '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:extent',
      )
    }
  }

  // Sensors — ignore completely empty cards (common after template merge)
  const activeSensorEntries = sensors
    .map((sen, idx) => ({ sen, idx }))
    .filter(({ sen }) => !sensorRowIsInactive(sen))
  if (!sensors.length || !activeSensorEntries.length) {
    add('e', 'sensors', 'At least one sensor is required', '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription')
  }
  activeSensorEntries.forEach(({ sen, idx }) => {
    const prefix = `sensors[${idx}]`
    if (isBlank(sen.type)) {
      add('e', `${prefix}.type`, `Sensor ${idx + 1}: type is required`, '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription/gmd:attributeDescription')
    }
    const modelOrSensor = String(sen.modelId || sen.sensorId || '').trim()
    if (isBlank(modelOrSensor)) {
      add('e', `${prefix}.modelId`, `Sensor ${idx + 1}: model ID is required`, '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
    if (isBlank(sen.variable)) {
      add('e', `${prefix}.variable`, `Sensor ${idx + 1}: observed variable is required`, '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription/gmd:name')
    }
    if (!isBlank(sen.type) && !isBlank(sen.variable) && checkSensorKwMismatch(sen.type, sen.variable, kw)) {
      add(
        'w',
        `${prefix}.variable`,
        `Sensor ${idx + 1}: variable may not align with selected GCMD keywords for this sensor type`,
        '/gmd:MD_Metadata/gmd:contentInfo/gmi:MI_CoverageDescription/gmd:name',
      )
    }
  })

  // Keywords
  KW_KEYWORD_CHIP_FACETS.forEach((f) => {
    const arr = Array.isArray(kw[f]) ? kw[f] : []
    if (!arr.length) {
      add('e', `keywords.${f}`, `${KW_LABELS[f] || f}: at least one keyword is required`, KW_CHIP_UUID_XPATH)
    }
  })
  issues.push(
    ...collectGcmdKeywordUuidWarnings(kw).map((i) => ({ ...i, xpath: previewMetadataXPath(i.xpath) })),
  )

  // Distribution
  if (isBlank(dist.format)) {
    add('e', 'distribution.format', 'Distribution format is required', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:distributionFormat/gmd:MD_Format/gmd:name')
  }
  if (isBlank(dist.license)) {
    add('e', 'distribution.license', 'Use/License is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:resourceConstraints/gmd:MD_LegalConstraints/gmd:useConstraints')
  }
  if (!isBlank(dist.landingUrl) && !isValidUrl(dist.landingUrl)) {
    add('e', 'distribution.landingUrl', 'Landing page URL must be http(s)', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage')
  }
  if (!isBlank(dist.downloadUrl) && !isValidUrl(dist.downloadUrl)) {
    add('e', 'distribution.downloadUrl', 'Download URL must be http(s)', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage')
  }
  if (!isBlank(dist.metadataLandingUrl) && !isValidUrl(dist.metadataLandingUrl)) {
    add('e', 'distribution.metadataLandingUrl', 'Metadata landing URL must be http(s)', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage')
  }
  if (dist.useNceiMetadataContactXlink && isBlank(dist.nceiMetadataContactHref)) {
    add(
      'w',
      'distribution.nceiMetadataContactHref',
      'NCEI metadata contact xlink is enabled but href is empty (generator may fall back to schema default)',
      '/gmd:MD_Metadata/gmd:contact',
    )
  }
  if (!isBlank(dist.nceiMetadataContactHref) && !isValidUrl(dist.nceiMetadataContactHref)) {
    add('e', 'distribution.nceiMetadataContactHref', 'NCEI metadata contact href must be http(s)', '/gmd:MD_Metadata/gmd:contact')
  }
  if (!isBlank(dist.nceiDistributorContactHref) && !isValidUrl(dist.nceiDistributorContactHref)) {
    add('e', 'distribution.nceiDistributorContactHref', 'NCEI distributor contact href must be http(s)', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:distributor')
  }
  if (!isBlank(dist.distributorContactUrl) && !isValidUrl(dist.distributorContactUrl)) {
    add('e', 'distribution.distributorContactUrl', 'Distributor contact URL must be http(s)', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:distributor')
  }

  // Mode-specific
  if (strict) {
    if (isBlank(m.doi)) {
      add('e', 'mission.doi', 'Strict mode: DOI is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
    if (isBlank(m.accession)) {
      add('e', 'mission.accession', 'Strict mode: NCEI Accession is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
    if (isBlank(m.ror?.id)) {
      add('e', 'mission.ror', 'Strict mode: ROR is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier')
    }
  }
  if (catalog) {
    if (isBlank(m.doi)) {
      add('e', 'mission.doi', 'Catalog mode: DOI is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
    if (isBlank(m.accession)) {
      add('e', 'mission.accession', 'Catalog mode: NCEI Accession is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:identifier/gmd:MD_Identifier/gmd:code')
    }
    if (isBlank(m.ror?.id)) {
      add('e', 'mission.ror', 'Catalog mode: ROR is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:party/gmd:CI_Organisation/gmd:identifier')
    }
    if (isBlank(dist.parentProject) && isBlank(m.parentProjectTitle)) {
      const msg =
        'Catalog mode: enter parent project on Mission (aggregation) or Distribution (parent project)'
      add(
        'e',
        'mission.parentProjectTitle',
        msg,
        '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo/gmd:MD_AggregateInformation/gmd:aggregateDataSetName/gmd:CI_Citation/gmd:title',
      )
      add(
        'e',
        'distribution.parentProject',
        msg,
        '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:aggregationInfo/gmd:MD_AggregateInformation/gmd:aggregateDataSetName/gmd:CI_Citation/gmd:title',
      )
    }
    if (isBlank(dist.publication)) {
      add('e', 'distribution.publication', 'Catalog mode: publication reference is required', '/gmd:MD_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:otherCitationDetails')
    }
    if (isBlank(dist.landingUrl)) {
      add('e', 'distribution.landingUrl', 'Catalog mode: landing page URL is required', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage')
    }
    if (isBlank(dist.downloadUrl)) {
      add('e', 'distribution.downloadUrl', 'Catalog mode: download URL is required', '/gmd:MD_Metadata/gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd:linkage')
    }
  }

  const errs = issues.filter((i) => i.severity === 'e').length
  const warns = issues.filter((i) => i.severity === 'w').length
  const maxScore = 100
  const score = Math.max(0, maxScore - errs * 8 - warns * 3)

  return { issues, score, maxScore, errCount: errs, warnCount: warns }
}

export function defaultPilotState() {
  return {
    mode: 'lenient',
    mission: {
      fileId: '',
      title: '',
      alternateTitle: '',
      abstract: '',
      purpose: '',
      supplementalInformation: '',
      startDate: '',
      endDate: '',
      publicationDate: '',
      metadataRecordDate: '',
      temporalExtentIntervalUnit: '',
      temporalExtentIntervalValue: '',
      language: 'eng',
      characterSet: 'utf8',
      scopeCode: 'dataset',
      status: '',
      doi: '',
      accession: '',
      org: '',
      individualName: '',
      email: '',
      contactPhone: '',
      contactUrl: '',
      contactAddress: '',
      west: '-180',
      east: '180',
      south: '-90',
      north: '90',
      vmin: '',
      vmax: '',
      ror: null,
      citeAs: '',
      otherCiteAs: '',
      dataLicensePreset: 'custom',
      licenseUrl: '',
      accessConstraints: '',
      /** ISO `MD_RestrictionCode` value for XML preview; empty = infer from `accessConstraints` text only. */
      accessConstraintsCode: '',
      distributionLiability: '',
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
      topicCategories: [],
      citationAuthorIndividualName: '',
      citationAuthorOrganisationName: '',
      citationPublisherOrganisationName: '',
      citationOriginatorIndividualName: '',
      citationOriginatorOrganisationName: '',
      graphicOverviewHref: '',
      graphicOverviewTitle: '',
      uxsContext: { ...UXS_CONTEXT_DEFAULT },
    },
    spatial: {
      referenceSystem: 'EPSG:4326',
      geographicDescription: '',
      verticalCrsUrl: '',
      dimensions: '',
      accuracyStandard: '',
      accuracyValue: '',
      errorLevel: '',
      errorValue: '',
      useGridRepresentation: false,
      gridCellGeometry: '',
      gridColumnSize: '',
      gridColumnResolution: '',
      gridRowSize: '',
      gridRowResolution: '',
      gridVerticalSize: '',
      gridVerticalResolution: '',
      hasTrajectory: false,
      trajectorySampling: '',
      lineageStatement: '',
      lineageProcessSteps: '',
    },
    platform: {
      platformType: '',
      customPlatformType: '',
      platformId: '',
      platformName: '',
      platformDesc: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      weight: '',
      length: '',
      width: '',
      height: '',
      material: '',
      speed: '',
      powerSource: '',
      navigationSystem: '',
      sensorMounts: '',
      operationalArea: '',
      deploymentDate: '',
    },
    sensors: [
      {
        localId: `sen_${Date.now()}`,
        sensorId: '',
        type: '',
        modelId: '',
        variable: '',
        firmware: '',
        ...SENSOR_XML_OPTIONAL_DEFAULTS,
      },
    ],
    keywords: {
      sciencekeywords: [],
      datacenters: [],
      platforms: [],
      instruments: [],
      locations: [],
      projects: [],
      providers: [],
    },
    /** Where the current record's field values were last merged from (import / manual). */
    sourceProvenance: {
      sourceType:       'manual',
      sourceId:         '',
      importedAt:       '',
      originalFilename: '',
      originalUuid:     '',
    },
    distribution: {
      format: '',
      distributionFormatName: '',
      distributionFileFormat: '',
      metadataStandard: 'ISO 19115-2 Imagery and Gridded Data',
      metadataVersion: 'ISO 19115-2:2009(E)',
      license: '',
      landingUrl: '',
      downloadUrl: '',
      metadataLandingUrl: '',
      metadataLandingLinkName: '',
      metadataLandingDescription: '',
      downloadProtocol: 'HTTPS',
      downloadLinkName: '',
      downloadLinkDescription: '',
      distributionFeesText: '',
      distributionOrderingInstructions: '',
      metadataMaintenanceFrequency: 'asNeeded',
      useNceiMetadataContactXlink: false,
      omitRootReferenceSystemInfo: false,
      nceiFileIdPrefix: true,
      nceiMetadataContactHref: '',
      nceiMetadataContactTitle: '',
      nceiDistributorContactHref: '',
      nceiDistributorContactTitle: '',
      distributorIndividualName: '',
      distributorOrganisationName: '',
      distributorEmail: '',
      distributorContactUrl: '',
      outputLocation: 'download',
      awsBucket: '',
      awsPrefix: '',
      finalNotes: '',
      templateName: '',
      templateCategory: '',
      parentProject: '',
      publication: '',
    },
  }
}

export function mergeLoadedPilotState(base, loaded) {
  if (!loaded || typeof loaded !== 'object') return base
  const out = JSON.parse(JSON.stringify(base))
  if (loaded.mode) out.mode = loaded.mode
  if (loaded.mission) {
    const lm = loaded.mission
    out.mission = { ...out.mission, ...lm }
    out.mission.uxsContext = normalizeUxsContext({
      ...(base.mission?.uxsContext || UXS_CONTEXT_DEFAULT),
      ...(lm.uxsContext && typeof lm.uxsContext === 'object' ? lm.uxsContext : {}),
    })
    if (lm.missionId && !out.mission.fileId) out.mission.fileId = lm.missionId
    if (lm.missionTitle && !out.mission.title) out.mission.title = lm.missionTitle
    if (lm.organization && !out.mission.org) out.mission.org = lm.organization
    if (lm.nceiAccessionId && !out.mission.accession) out.mission.accession = lm.nceiAccessionId
  }
  if (loaded.spatial && typeof loaded.spatial === 'object') {
    out.spatial = { ...out.spatial, ...loaded.spatial }
  }
  if (loaded.platform) {
    const lp = loaded.platform
    out.platform = { ...out.platform, ...lp }
    if (lp.status && !out.mission.status) out.mission.status = lp.status
    if (lp.purpose && !out.mission.purpose) out.mission.purpose = lp.purpose
    if (lp.lang && !out.mission.language) out.mission.language = lp.lang
  }
  if (Array.isArray(loaded.sensors) && loaded.sensors.length) {
    out.sensors = loaded.sensors.map((s, i) => ({
      ...SENSOR_XML_OPTIONAL_DEFAULTS,
      ...s,
      localId: s.localId || s.sensorId || `sen_${i}_${Date.now()}`,
      sensorId: s.sensorId || s.id || '',
      type: s.type || s.sensorType || '',
      modelId: s.modelId || '',
      variable: s.variable || '',
      firmware: s.firmware || '',
    }))
  }
  if (loaded.keywords) {
    out.keywords = { ...out.keywords, ...loaded.keywords }
    ;['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers'].forEach((k) => {
      if (!Array.isArray(out.keywords[k])) out.keywords[k] = []
    })
  }
  if (loaded.distribution) out.distribution = { ...out.distribution, ...loaded.distribution }
  if (loaded.output && typeof loaded.output === 'object') {
    const o = /** @type {Record<string, unknown>} */ (loaded.output)
    const d = { ...out.distribution }
    for (const k of LEGACY_OUTPUT_DISTRIBUTION_KEYS) {
      if (o[k] !== undefined && o[k] !== null) d[k] = o[k]
    }
    if (o.outputFormat !== undefined && o.outputFormat !== null) d.format = o.outputFormat
    out.distribution = d

    if (!loaded.mode) {
      const vl = String(o.validationLevel ?? '').trim().toLowerCase()
      if (vl === 'basic') out.mode = 'lenient'
      else if (vl === 'strict') out.mode = 'strict'
      else if (vl === 'catalog') out.mode = 'catalog'
    }

    const outDate = String(o.metadataRecordDate ?? '').trim()
    if (outDate && isBlank(out.mission.metadataRecordDate)) {
      out.mission = { ...out.mission, metadataRecordDate: outDate }
    }
    const doi = String(o.doi ?? '').trim()
    if (doi && isBlank(out.mission.doi)) {
      out.mission = { ...out.mission, doi }
    }
  }
  if (loaded.sourceProvenance && typeof loaded.sourceProvenance === 'object') {
    out.sourceProvenance = {
      ...(out.sourceProvenance && typeof out.sourceProvenance === 'object' ? out.sourceProvenance : {}),
      ...loaded.sourceProvenance,
    }
  }
  return sanitizePilotState(out)
}
