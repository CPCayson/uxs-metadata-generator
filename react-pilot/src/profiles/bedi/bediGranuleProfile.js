/**
 * BEDI Granule entity profile.
 *
 * Represents an individual video segment (dataset-level) produced during
 * a BEDI dive. The defining constraint: every granule must link to its
 * parent collection via parentCollectionId.
 *
 * @module profiles/bedi/bediGranuleProfile
 */

import { lazy } from 'react'
import { buildBediGranuleXmlPreview } from '../../lib/bediGranuleXmlPreview.js'
import { readPilotSessionPayload } from '../../lib/pilotSessionStorage.js'
import { getPilotFieldLabelFallback } from '../../lib/pilotFieldLabelFallback.js'
import { bediGranuleRuleSets } from './bediGranuleRules.js'
import { bediGranuleImportParser } from './bediGranuleImportParser.js'
import { BEDI_DEMO_COLLECTION_FILE_ID } from './bediCollectionProfile.js'
import { sessionLooksLikeBediGranule } from './bediSessionGuards.js'

const StepBediGranuleIdentification = lazy(() =>
  import('../../features/bedi/StepBediGranuleIdentification.jsx'),
)
const StepBediGranuleExtent = lazy(() =>
  import('../../features/bedi/StepBediGranuleExtent.jsx'),
)
const StepBediGranuleDistribution = lazy(() =>
  import('../../features/bedi/StepBediGranuleDistribution.jsx'),
)

/**
 * @returns {object} Fresh BEDI granule state.
 */
export function defaultBediGranuleState() {
  return {
    mode: 'lenient',
    metadataUuid: '',

    // Identification & linkage
    fileId:             '',
    granuleId:          '',
    parentCollectionId: '',     // ← CRITICAL — links to bediCollection
    hierarchyLevel:     'dataset',
    hierarchyLevelName: 'Granule',

    // Dive metadata
    diveId:        '',
    tapeNumber:    '',
    segmentNumber: '',

    // Citation
    title:            '',
    alternateTitle:   '',
    creationDate:     '',
    presentationForm: 'videoDigital',

    // Description
    abstract: '',
    status:   '',
    resourceUseLimitation: '',

    // Contacts
    piName:  '',
    piOrg:   '',
    piEmail: '',
    contactOerHref:  '',
    contactPiHref:   '',

    // Keywords
    oerKeywords:       [],
    dataCenterKeyword: '',
    /** Optional KMS URL for the single data-center keyword `gmx:Anchor`. */
    dataCenterKeywordHref: '',
    instrumentKeyword: '',
    instrumentKeywordHref: '',

    // Spatial extent
    west:  '',
    east:  '',
    south: '',
    north: '',

    // Temporal extent
    startDate: '',
    endDate:   '',

    // Vertical extent
    minDepth: '',
    maxDepth: '',

    // Aggregation
    parentCollectionRef:        '',
    parentCollectionLandingUrl: '',
    diveSummaryReportUrl:       '',

    // Content
    observationVariables: [],

    // Distribution
    contactNceiHref:   '',
    granulesSearchUrl: '',
    videoFormat:       '',
    videoFilename:     '',
    landingPageUrl:    '',

    sourceProvenance: {
      sourceType:       'manual',
      sourceId:         '',
      importedAt:       '',
      originalFilename: '',
      originalUuid:     '',
    },
  }
}

/**
 * Example video-segment record linked to `BEDI_DEMO_COLLECTION_FILE_ID`.
 *
 * @returns {object}
 */
export function seedBediGranuleDemoState() {
  const granuleFileId =
    'gov.noaa.ncei.oer:EXAMPLE_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1'
  return {
    ...defaultBediGranuleState(),
    parentCollectionId: BEDI_DEMO_COLLECTION_FILE_ID,
    fileId:             granuleFileId,
    granuleId:          'EXAMPLE_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1',
    diveId:             'JSL2-3699',
    tapeNumber:         '1',
    segmentNumber:      '1',
    hierarchyLevel:     'dataset',
    hierarchyLevelName: 'Granule',
    title:
      'Example: Bioluminescence survey — dive JSL2-3699 video segment 1 of 1 (BEDI granule)',
    alternateTitle: 'EXAMPLE parent collection working title',
    creationDate:     '2009-07-30',
    presentationForm: 'videoDigital',
    abstract:
      'EXAMPLE granule abstract for one video segment. Replace with dive-specific description, '
      + 'camera settings, and observation context before publication.',
    status: 'completed',
    piName:  'Dr. Example Principal Investigator',
    piOrg:   'Example University (placeholder)',
    piEmail: 'metadata.example@noaa.gov',
    west:  '-79.5',
    east:  '-77.66',
    south: '24.0',
    north: '27.5',
    startDate: '2009-07-30T14:00:00Z',
    endDate:   '2009-07-30T15:30:00Z',
    minDepth: '0',
    maxDepth: '914',
    parentCollectionRef:        'EXAMPLE Bioluminescence — living light on the deep sea floor',
    parentCollectionLandingUrl:
      'https://example.noaa.gov/REPLACE_WITH_PARENT_COLLECTION_LANDING_PAGE',
    diveSummaryReportUrl:
      'https://example.noaa.gov/REPLACE_WITH_DIVE_SUMMARY_REPORT.pdf',
    dataCenterKeyword:
      'US DOC; NOAA; OAR; Office of Ocean Exploration and Research',
    instrumentKeyword: 'video camera',
    oerKeywords:       ['bioluminescence', 'submersible video', 'deep sea'],
    videoFormat:       'H.264 / MP4',
    videoFilename:     'EXAMPLE_BIOLUM2009_VID_20090730_SEG1OF1.mp4',
    landingPageUrl:
      'https://example.noaa.gov/REPLACE_WITH_GRANULE_LANDING_PAGE',
    granulesSearchUrl:
      'https://example.noaa.gov/REPLACE_WITH_PARENT_GRANULE_SEARCH_URL',
    contactNceiHref: 'https://www.ncei.noaa.gov/contact/REPLACE_WITH_DOCUCOMP_URL',
    observationVariables: ['Bioluminescence', 'Benthic habitat'],
  }
}

function bediGranuleInitState() {
  const seed = seedBediGranuleDemoState()
  const session = readPilotSessionPayload()
  if (!session?.pilot || typeof session.pilot !== 'object' || !sessionLooksLikeBediGranule(session.pilot)) {
    return seed
  }
  return {
    ...seed,
    ...session.pilot,
    mode: session.pilot.mode || seed.mode,
  }
}

/** @type {import('../../core/registry/types.js').EntityProfile} */
export const bediGranuleProfile = {
  id:         'bediGranule',
  entityType: 'bediGranule',
  label:      'BEDI Granule (video segment)',
  family:     'bedi',
  variants: [
    { id: 'bedi-granule', label: 'BEDI granule', description: 'Granule/video-segment BEDI/OER metadata linked to a parent collection.' },
  ],
  lifecycleStates: ['draft', 'post-ingest', 'catalog-ready', 'comet-verified', 'handoff-ready', 'maintenance'],
  readinessBundles: [
    { id: 'draft', label: 'Draft', scope: 'internal', mode: 'lenient' },
    { id: 'profile-valid', label: 'Profile-valid', scope: 'internal', mode: 'lenient' },
    { id: 'iso-ready', label: 'ISO-ready', scope: 'internal', mode: 'strict' },
    { id: 'discovery-ready', label: 'Discovery-ready', scope: 'internal', mode: 'catalog' },
    { id: 'comet-preflight', label: 'CoMET-verified', scope: 'external' },
    { id: 'handoff-ready', label: 'Handoff-ready', scope: 'handoff' },
  ],
  relationshipTypes: [
    { id: 'granule-parent-collection', label: 'Granule belongs to collection', parent: 'bediCollection', child: 'bediGranule' },
  ],

  /** @type {import('../../core/registry/types.js').ProfileCapabilities} */
  capabilities: {
    // Phase-1 flags
    xmlPreview:      true,
    geoJsonExport:   false,
    dcatExport:      false,
    serverValidate:  false,
    platformLibrary: false,
    templateCatalog: false,
    // Phase-2 flags
    iso2Export:     true,
    xmlImport:      true,   // bediGranuleImportParser is wired
    scannerPrefill: false,
    contactLibrary: false,
    cometPull:      true,
    cometPreflight: true,
    cometPush:      true,
  },

  defaultState() {
    return defaultBediGranuleState()
  },

  /** Demo granule + session restore when stored pilot looks like a BEDI granule. */
  initState() {
    return bediGranuleInitState()
  },

  sanitize(state) {
    return JSON.parse(JSON.stringify(state ?? {}))
  },

  mergeLoaded(loaded) {
    const base = this.defaultState()
    return { ...base, ...loaded }
  },

  buildXmlPreview(state) {
    return buildBediGranuleXmlPreview(state ?? {})
  },

  getExportId(state) {
    return (
      String(state.granuleId || state.fileId || 'bedi-granule')
        .replace(/[^\w.-]+/g, '_') || 'bedi-granule'
    )
  },

  getFieldLabel: getPilotFieldLabelFallback,

  steps: [
    {
      id:    'identification',
      label: '1. Identification & Linkage',
      component: StepBediGranuleIdentification,
      ownedFieldPrefixes: [
        'fileId', 'granuleId', 'parentCollectionId', 'hierarchyLevel', 'hierarchyLevelName',
        'diveId', 'tapeNumber', 'segmentNumber',
        'title', 'alternateTitle', 'creationDate', 'presentationForm',
        'metadataUuid',
      ],
    },
    {
      id:    'extent',
      label: '2. Description & Extent',
      component: StepBediGranuleExtent,
      ownedFieldPrefixes: [
        'abstract', 'status', 'resourceUseLimitation',
        'piName', 'piOrg', 'piEmail',
        'west', 'east', 'south', 'north',
        'startDate', 'endDate', 'minDepth', 'maxDepth',
      ],
    },
    {
      id:    'distribution',
      label: '3. Links & Keywords',
      component: StepBediGranuleDistribution,
      ownedFieldPrefixes: [
        'oerKeywords', 'dataCenterKeyword', 'dataCenterKeywordHref', 'instrumentKeyword', 'instrumentKeywordHref',
        'parentCollectionRef', 'parentCollectionLandingUrl', 'diveSummaryReportUrl',
        'contactNceiHref', 'contactOerHref', 'contactPiHref', 'granulesSearchUrl',
        'videoFormat', 'videoFilename', 'landingPageUrl',
        'observationVariables',
      ],
    },
  ],

  validationRuleSets: bediGranuleRuleSets,

  exportAdapters: [],

  importParsers: [bediGranuleImportParser],
}
