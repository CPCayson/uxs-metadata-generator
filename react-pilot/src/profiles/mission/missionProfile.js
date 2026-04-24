/**
 * Mission entity profile — the plugin unit for the current mission/dataset workflow.
 *
 * This wraps the existing defaultPilotState, validatePilotState, buildXmlPreview,
 * and xmlPilotImport without rewriting any of them. It registers all six mission
 * steps and declares which validation field prefixes each step owns, allowing the
 * WorkflowEngine to route issues without hardcoded switch logic.
 *
 * @module profiles/mission/missionProfile
 */

import { lazy } from 'react'
import { defaultPilotState, sanitizePilotState, mergeLoadedPilotState } from '../../lib/pilotValidation.js'
import { parseRawIsoMissionImportResult } from '../../adapters/sources/RawIsoAdapter.js'
import { scannerMissionSuggestionAdapter } from '../../adapters/sources/ScannerSuggestionAdapter.js'
import { isoXmlAdapter } from '../../core/export/adapters/isoXmlAdapter.js'
import { missionValidationRuleSets } from './missionValidationRules.js'
import { getMissionFieldLabel } from './missionFieldLabels.js'
import { buildXmlPreview as buildXmlPreviewXml } from '../../lib/xmlPreviewBuilder.js'
import { readPilotSessionPayload } from '../../lib/pilotSessionStorage.js'

// Step components loaded lazily so the profile can be imported before React renders.
// Source of truth lives in features/; components/ copies were deleted after migration.
const StepMission = lazy(() => import('../../features/mission/StepMission.jsx'))
const StepPlatform = lazy(() => import('../../features/platform/StepPlatform.jsx'))
const StepSensors = lazy(() => import('../../features/sensors/StepSensors.jsx'))
const StepSpatial = lazy(() => import('../../features/spatial/StepSpatial.jsx'))
const StepKeywords = lazy(() => import('../../features/keywords/StepKeywords.jsx'))
const StepDistribution = lazy(() => import('../../features/distribution/StepDistribution.jsx'))

// ---------------------------------------------------------------------------
// Initial state — seeds demo data then restores any saved session payload.
// Kept here so WizardShell has no mission-specific initialisation knowledge.
// ---------------------------------------------------------------------------

function seedPilotState() {
  const s = defaultPilotState()
  s.mission.fileId = 'PS2418L0_ER_UUV01_Norbit_MB_20240505T1510Z_MD'
  s.mission.title = 'Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data UUV Dive 01'
  s.mission.startDate = '2024-05-05T15:10'
  s.mission.endDate = '2024-05-06T12:00'
  s.mission.org = 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT'
  s.mission.abstract =
    'The MDBC Mapping, Groundtruthing and Modeling team along with USM will conduct UUV acquisition...'
  s.mission.individualName = 'Jane Researcher'
  s.mission.email = 'jane.researcher@noaa.gov'
  s.mission.doi = '10.7289/V5ABC123'
  s.mission.accession = '0123456'
  s.mission.ror = {
    id: 'https://ror.org/033thwp43',
    name: 'National Oceanic and Atmospheric Administration',
    country: 'US',
    types: ['Government'],
  }
  s.mission.purpose = 'Seafloor mapping'
  s.mission.status = 'completed'
  s.mission.language = 'eng'
  s.mission.publicationDate = '2024-05-07T00:00'
  s.mission.dataLicensePreset = 'ncei_cc_by_4'
  s.mission.citeAs = 'Cite as: NOAA UxS pilot QA dataset (placeholder).'
  s.platform.platformType = 'UAV'
  s.platform.platformId = 'UUV-01'
  s.platform.platformName = 'Eagle Ray UUV-01'
  s.platform.platformDesc = 'Norbit multibeam mapping payload.'
  s.platform.manufacturer = 'Norbit'
  s.platform.model = 'WBMS'
  s.sensors[0].type = 'Earth Remote Sensing Instruments'
  s.sensors[0].modelId = 'MBES-Norbit'
  s.sensors[0].variable = 'bathymetry'
  s.keywords.sciencekeywords = [{ label: 'Oceans', uuid: 'placeholder-oceans' }]
  s.keywords.datacenters = [{ label: 'DOC/NOAA/NESDIS/NCEI', uuid: 'placeholder-ncei' }]
  s.keywords.platforms = [{ label: 'UAV', uuid: 'placeholder-uav' }]
  s.keywords.instruments = [{ label: 'Multibeam Swath Bathymetry System', uuid: 'placeholder-mbes' }]
  s.keywords.locations = [{ label: 'Gulf of Mexico', uuid: 'placeholder-gom' }]
  s.keywords.projects = [{ label: 'MDBC', uuid: 'placeholder-mdbc' }]
  s.keywords.providers = [{ label: 'NOAA', uuid: 'placeholder-noaa-provider' }]
  s.distribution.format = 'NetCDF'
  s.distribution.license = 'CC-BY-4.0'
  s.distribution.landingUrl = 'https://example.org/dataset'
  s.distribution.downloadUrl = 'https://example.org/download'
  s.distribution.parentProject = 'MDBC Restoration'
  s.mission.parentProjectTitle = 'MDBC Restoration'
  s.mission.parentProjectCode = 'MDBC-PRJ'
  s.distribution.publication = 'Internal cruise report (placeholder).'
  return s
}

function missionInitState() {
  const seed = seedPilotState()
  let merged = seed
  const session = readPilotSessionPayload()
  if (session?.pilot && typeof session.pilot === 'object') {
    merged = mergeLoadedPilotState(defaultPilotState(), session.pilot)
  }
  return sanitizePilotState(merged)
}

// ---------------------------------------------------------------------------

/**
 * @type {import('../../core/registry/types.js').StepDefinition[]}
 */
export const missionSteps = [
  {
    id: 'mission',
    label: '1. Mission',
    component: StepMission,
    ownedFieldPrefixes: ['mission.', 'mission'],
  },
  {
    id: 'platform',
    label: '2. Platform',
    component: StepPlatform,
    ownedFieldPrefixes: ['platform.'],
  },
  {
    id: 'sensors',
    label: '3. Sensors',
    component: StepSensors,
    ownedFieldPrefixes: ['sensors', 'sensors['],
  },
  {
    id: 'spatial',
    label: '4. Spatial',
    component: StepSpatial,
    ownedFieldPrefixes: ['spatial.'],
  },
  {
    id: 'keywords',
    label: '5. Keywords',
    component: StepKeywords,
    ownedFieldPrefixes: ['keywords', 'keywords.'],
  },
  {
    id: 'distribution',
    label: '6. Distribution',
    component: StepDistribution,
    ownedFieldPrefixes: ['distribution.'],
  },
]

/**
 * ISO XML import parser — wraps the existing xmlPilotImport.
 *
 * @type {import('../../core/registry/types.js').ImportParser}
 */
const isoXmlImportParser = {
  format: 'iso-xml',
  /** @param {string} xmlString @param {import('../../core/registry/types.js').ImportParseMeta} [meta] */
  parse(xmlString, meta) {
    return parseRawIsoMissionImportResult(xmlString, meta ?? {})
  },
}

/**
 * The mission entity profile.
 *
 * @type {import('../../core/registry/types.js').EntityProfile}
 */
export const missionProfile = {
  id: 'mission',
  entityType: 'mission',
  label: 'Mission / Dataset',

  /** @type {import('../../core/registry/types.js').ProfileCapabilities} */
  capabilities: {
    // Phase-1 flags
    xmlPreview:      true,
    geoJsonExport:   true,
    dcatExport:      true,
    serverValidate:  true,
    platformLibrary: true,
    templateCatalog: true,
    // Phase-2 flags
    iso2Export:     true,   // buildXmlPreview generates gmi:MI_Metadata
    xmlImport:      true,   // RawIsoAdapter → xmlPilotImport
    scannerPrefill: true,
    contactLibrary: false,  // contact library not yet built
    cometPull:      true,   // fetchCometRecord + WizardShell CoMET load event
    cometPreflight: true,   // rubric proxied; resolver/validate/linkcheck in PR 3
    cometPush:      true,   // pushCometRecord + WizardShell handlePushToComet
  },

  defaultState() {
    return defaultPilotState()
  },

  /** Seeded demo data + session restore — mission-specific init. */
  initState() {
    return missionInitState()
  },

  sanitize(state) {
    return sanitizePilotState(state)
  },

  /**
   * Deep-merges a loaded payload into a fresh mission default state,
   * normalising legacy shapes (e.g. bare `{ mission: … }` payloads).
   * @param {object} loaded
   */
  mergeLoaded(loaded) {
    return mergeLoadedPilotState(defaultPilotState(), loaded)
  },

  /** @param {object} state */
  buildXmlPreview(state) {
    return buildXmlPreviewXml(state)
  },

  /** Returns the filename stem to use for exported files. */
  getExportId(state) {
    return String(state.mission?.fileId || 'metadata').replace(/[^\w.-]+/g, '_') || 'metadata'
  },

  getFieldLabel(fieldPath) {
    return getMissionFieldLabel(fieldPath)
  },

  steps: missionSteps,

  validationRuleSets: missionValidationRuleSets,

  exportAdapters: [isoXmlAdapter],

  importParsers: [isoXmlImportParser],

  scannerSuggestionAdapters: [scannerMissionSuggestionAdapter],
}
