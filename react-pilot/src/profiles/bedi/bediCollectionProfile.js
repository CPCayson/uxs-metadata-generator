/**
 * BEDI Collection entity profile.
 *
 * Represents a fieldSession-level record (cruise/expedition) under the
 * NOAA Ocean Exploration BEDI program. Distinct from the generic collection
 * profile: has OER-specific identifiers, xlink-based contacts, acquisition
 * information, and strict NCEI namespace requirements.
 *
 * @module profiles/bedi/bediCollectionProfile
 */

import { lazy } from 'react'
import { buildBediCollectionXmlPreview } from '../../lib/bediCollectionXmlPreview.js'
import { readPilotSessionPayload } from '../../lib/pilotSessionStorage.js'
import { bediCollectionRuleSets } from './bediCollectionRules.js'
import { bediCollectionImportParser } from './bediCollectionImportParser.js'
import { sessionLooksLikeBediCollection } from './bediSessionGuards.js'

const StepBediCollectionIdentification = lazy(() =>
  import('../../features/bedi/StepBediCollectionIdentification.jsx'),
)
const StepBediCollectionExtent = lazy(() =>
  import('../../features/bedi/StepBediCollectionExtent.jsx'),
)
const StepBediCollectionDistribution = lazy(() =>
  import('../../features/bedi/StepBediCollectionDistribution.jsx'),
)

/**
 * @returns {object} Fresh BEDI collection state.
 */
export function defaultBediCollectionState() {
  return {
    /** Default validation mode (matches WizardShell `deferredPilotState.mode || 'lenient'`). */
    mode: 'lenient',

    /** Optional CoMET / metadata record UUID echoed on exported root element. */
    metadataUuid: '',

    // Identification
    fileId:             '',
    collectionId:       '',
    nceiAccessionId:    '',
    nceiMetadataId:     '',
    hierarchyLevel:     'fieldSession',
    hierarchyLevelName: 'Project Level Metadata',
    title:              '',
    alternateTitle:     '',
    vesselName:         '',
    creationDate:       '',

    // Description
    abstract:        '',
    purpose:         '',
    status:          '',
    browseGraphicUrl: '',
    /** Custom `gmd:useLimitation` text; preview falls back to NOAA-style default when empty. */
    resourceUseLimitation: '',

    // Contacts — docucomp xlink targets (OER cruise XML template)
    contactNceiHref: '',
    contactOerHref:  '',
    contactPiHref:   '',
    contactRefs:     [],
    piName:       '',
    piOrg:        '',
    piEmail:      '',

    // Keywords
    scienceKeywords:      [],
    /** Optional KMS / GCMD concept URL per `scienceKeywords` index (empty string = lookup URL in preview). */
    scienceKeywordHrefs:  [],
    oerKeywords:          [],
    placeKeywords:        [],
    datacenters:          [],
    datacenterKeywordHrefs: [],

    // Extent
    west:      '',
    east:      '',
    south:     '',
    north:     '',
    startDate: '',
    endDate:   '',

    // Platforms
    platforms: [],

    // Distribution
    landingPageUrl:    '',
    granulesSearchUrl: '',

    sourceProvenance: {
      sourceType:       'manual',
      sourceId:         '',
      importedAt:       '',
      originalFilename: '',
      originalUuid:     '',
    },
  }
}

/** Example parent `fileId` — keep in sync with granule demo seed in `bediGranuleProfile.js`. */
export const BEDI_DEMO_COLLECTION_FILE_ID = 'gov.noaa.ncei.oer:EXAMPLE_BIOLUM2009_COLLECTION'

/**
 * Biolum-style **example** collection (clearly labeled placeholders). Used by `initState`.
 *
 * @returns {object}
 */
export function seedBediCollectionDemoState() {
  return {
    ...defaultBediCollectionState(),
    fileId:             BEDI_DEMO_COLLECTION_FILE_ID,
    collectionId:       'EXAMPLE_Biolum2009',
    nceiAccessionId:    '0123456',
    nceiMetadataId:     BEDI_DEMO_COLLECTION_FILE_ID,
    hierarchyLevel:     'fieldSession',
    hierarchyLevelName: 'Project Level Metadata',
    title:
      'Example: Bioluminescence — living light on the deep sea floor (BEDI field session)',
    alternateTitle: 'EXAMPLE dataset title — not for NCEI submission',
    vesselName:       'R/V Seward Johnson I',
    creationDate:     '2009-08-15',
    abstract:
      'EXAMPLE abstract for a NOAA Ocean Exploration BEDI-style collection record. '
      + 'Replace all text, identifiers, and URLs with your real cruise metadata before submission.',
    purpose:
      'Illustrate typical BEDI collection fields (extent, GCMD keywords, platforms, NCEI links).',
    status:           'completed',
    browseGraphicUrl:
      'https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncei.oer:REPLACE_ME',
    scienceKeywords: [
      'Earth Science > Oceans > Ocean Optics > Bioluminescence',
    ],
    placeKeywords: [
      'Northwest Providence Channel',
      'Little Bahama Bank Lithoherm',
    ],
    datacenters: [
      'DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information',
    ],
    oerKeywords: [
      'ocean exploration',
      'bioluminescence',
      'deep sea',
      'NOAA Ocean Exploration',
    ],
    platforms: [
      'In Situ Ocean-based Platforms > Vessels > Marine > R/V Seward Johnson I',
      'In Situ Ocean-based Platforms > Submersibles > Human Occupied Vehicles > Johnson-Sea-Link II HOV',
    ],
    west:  '-79.5',
    east:  '-77.66',
    south: '24.0',
    north: '27.5',
    startDate: '2009-07-17',
    endDate:   '2009-08-02',
    landingPageUrl:
      'https://example.noaa.gov/REPLACE_WITH_YOUR_ONESTOP_COLLECTION_URL',
    granulesSearchUrl:
      'https://example.noaa.gov/REPLACE_WITH_YOUR_GRANULE_SEARCH_URL',
    piName:  'Dr. Example Principal Investigator',
    piOrg:   'Example University (placeholder)',
    piEmail: 'metadata.example@noaa.gov',
    contactRefs: [
      'NCEI (pointOfContact)',
      'NOAA Ocean Exploration and Research (pointOfContact)',
    ],
    contactNceiHref: 'https://www.ncei.noaa.gov/contact/REPLACE_WITH_DOCUCOMP_URL',
    contactOerHref:  'https://oceanexplorer.noaa.gov/contact/REPLACE_WITH_DOCUCOMP_URL',
    contactPiHref:   '',
  }
}

function bediCollectionInitState() {
  const seed = seedBediCollectionDemoState()
  const session = readPilotSessionPayload()
  if (!session?.pilot || typeof session.pilot !== 'object' || !sessionLooksLikeBediCollection(session.pilot)) {
    return seed
  }
  return {
    ...seed,
    ...session.pilot,
    mode: session.pilot.mode || seed.mode,
  }
}

/** @type {import('../../core/registry/types.js').EntityProfile} */
export const bediCollectionProfile = {
  id:          'bediCollection',
  entityType:  'bediCollection',
  label:       'BEDI Collection (fieldSession)',

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
    xmlImport:      true,   // bediCollectionImportParser is wired
    scannerPrefill: false,
    contactLibrary: false,
    cometPull:      true,
    cometPreflight: true,
    cometPush:      true,
  },

  defaultState() {
    return defaultBediCollectionState()
  },

  /** Demo cruise + session restore when stored pilot looks like a BEDI collection. */
  initState() {
    return bediCollectionInitState()
  },

  sanitize(state) {
    return JSON.parse(JSON.stringify(state ?? {}))
  },

  mergeLoaded(loaded) {
    const base = this.defaultState()
    return { ...base, ...loaded }
  },

  buildXmlPreview(state) {
    return buildBediCollectionXmlPreview(state ?? {})
  },

  getExportId(state) {
    return (
      String(state.collectionId || state.fileId || 'bedi-collection')
        .replace(/[^\w.-]+/g, '_') || 'bedi-collection'
    )
  },

  steps: [
    {
      id:    'identification',
      label: '1. Identification',
      component: StepBediCollectionIdentification,
      ownedFieldPrefixes: [
        'fileId', 'collectionId', 'nceiAccessionId', 'nceiMetadataId',
        'hierarchyLevel', 'title', 'alternateTitle', 'vesselName', 'creationDate',
        'metadataUuid',
      ],
    },
    {
      id:    'extent',
      label: '2. Description & Extent',
      component: StepBediCollectionExtent,
      ownedFieldPrefixes: [
        'abstract', 'purpose', 'status', 'browseGraphicUrl', 'resourceUseLimitation',
        'west', 'east', 'south', 'north', 'startDate', 'endDate',
        'platforms', 'scienceKeywords', 'scienceKeywordHrefs', 'oerKeywords', 'placeKeywords', 'datacenters',
        'datacenterKeywordHrefs',
      ],
    },
    {
      id:    'distribution',
      label: '3. Contacts & Distribution',
      component: StepBediCollectionDistribution,
      ownedFieldPrefixes: [
        'piName', 'piOrg', 'piEmail', 'contactRefs',
        'contactNceiHref', 'contactOerHref', 'contactPiHref',
        'landingPageUrl', 'granulesSearchUrl',
      ],
    },
  ],

  validationRuleSets: bediCollectionRuleSets,

  exportAdapters: [],

  importParsers: [bediCollectionImportParser],
}
