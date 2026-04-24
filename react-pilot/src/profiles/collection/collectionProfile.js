/**
 * Collection entity profile.
 *
 * Minimal proof-of-concept: 3 steps (identification, extent, distribution),
 * own default state, own validation rules. No exportAdapters or importParsers yet.
 *
 * Registered in App.jsx alongside missionProfile.
 *
 * @module profiles/collection/collectionProfile
 */

import { lazy } from 'react'
import { collectionValidationRuleSets } from './collectionValidationRules.js'

const StepCollectionIdentification = lazy(() =>
  import('../../features/collection/StepCollectionIdentification.jsx'),
)
const StepCollectionExtent = lazy(() =>
  import('../../features/collection/StepCollectionExtent.jsx'),
)
const StepCollectionDistribution = lazy(() =>
  import('../../features/collection/StepCollectionDistribution.jsx'),
)

/**
 * @returns {object} Fresh collection state — flat, no mission/platform/sensor shape.
 */
export function defaultCollectionState() {
  return {
    identification: {
      identifier: '',
      title: '',
      abstract: '',
      purpose: '',
      status: '',
      language: 'eng',
      org: '',
      email: '',
    },
    extent: {
      startDate: '',
      endDate: '',
      west: '-180',
      east: '180',
      south: '-90',
      north: '90',
    },
    distribution: {
      format: '',
      license: '',
      landingUrl: '',
      downloadUrl: '',
    },
  }
}

/**
 * @type {import('../../core/registry/types.js').EntityProfile}
 */
export const collectionProfile = {
  id: 'collection',
  entityType: 'collection',
  label: 'Collection',

  /** @type {import('../../core/registry/types.js').ProfileCapabilities} */
  capabilities: {
    // Phase-1 flags
    xmlPreview:      false,
    geoJsonExport:   false,
    dcatExport:      false,
    serverValidate:  false,
    platformLibrary: false,
    templateCatalog: false,
    // Phase-2 flags
    iso2Export:     false,  // no XML export yet
    xmlImport:      false,  // no import parser yet
    scannerPrefill: false,
    contactLibrary: false,
    cometPull:      false,
    cometPreflight: false,
    cometPush:      false,
  },

  defaultState() {
    return defaultCollectionState()
  },

  sanitize(state) {
    return JSON.parse(JSON.stringify(state ?? {}))
  },

  /**
   * Shallow-merges a loaded payload onto the collection default state.
   * No deep-merge needed at this stage.
   * @param {object} loaded
   */
  mergeLoaded(loaded) {
    return { ...this.defaultState(), ...loaded }
  },

  /** Returns the filename stem to use for exported files. */
  getExportId(state) {
    return (
      String(state.identification?.identifier || 'collection').replace(/[^\w.-]+/g, '_') ||
      'collection'
    )
  },

  steps: [
    {
      id: 'identification',
      label: '1. Identification',
      component: StepCollectionIdentification,
      ownedFieldPrefixes: ['identification.', 'identification'],
    },
    {
      id: 'extent',
      label: '2. Extent',
      component: StepCollectionExtent,
      ownedFieldPrefixes: ['extent.', 'extent'],
    },
    {
      id: 'distribution',
      label: '3. Distribution',
      component: StepCollectionDistribution,
      ownedFieldPrefixes: ['distribution.'],
    },
  ],

  validationRuleSets: collectionValidationRuleSets,

  exportAdapters: [],
  importParsers: [],
}
