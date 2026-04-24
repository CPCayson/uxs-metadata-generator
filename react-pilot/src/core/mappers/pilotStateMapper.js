/**
 * Bidirectional mapper between the existing pilotState shape and the
 * canonical metadata entity model.
 *
 * Rules:
 * - pilotStateToCanonical is lossless for all fields that have a canonical home.
 * - canonicalToPilotState(pilotStateToCanonical(s)) must equal sanitizePilotState(s).
 * - Tricky mappings are documented inline.
 *
 * @module core/mappers/pilotStateMapper
 */

/**
 * Convert an existing pilotState object to a CanonicalMetadataEntity.
 *
 * Key field migrations:
 *   mission.{west,east,south,north} → spatialExtent.{west,east,south,north}
 *   mission.{vmin,vmax}             → spatialExtent.{vmin,vmax}
 *   mission.ror (object)            → contact.{rorId,rorUri,rorDisplayName,rorCountry}
 *   mission.mode                    → validationMode (moved from pilotState root)
 *   spatial.*                       → spatialDetail.*
 *   distribution.*                  → distribution.* (1:1, minor renames noted)
 *
 * @param {object} state - Raw pilotState from defaultPilotState / validatePilotState
 * @returns {import('../entities/types.js').CanonicalMetadataEntity}
 */
export function pilotStateToCanonical(state) {
  const m = state?.mission ?? {}
  const p = state?.platform ?? {}
  const sp = state?.spatial ?? {}
  const kw = state?.keywords ?? {}
  const dist = state?.distribution ?? {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors : []

  const ror = m.ror && typeof m.ror === 'object' ? m.ror : null

  /** @type {import('../entities/types.js').CanonicalMetadataEntity} */
  const entity = {
    id: String(m.fileId || ''),
    entityType: 'mission',
    profileId: 'mission',
    status: deriveStatus(m),

    identification: {
      fileId: String(m.fileId || ''),
      title: String(m.title || ''),
      alternateTitle: m.alternateTitle ?? undefined,
      abstract: String(m.abstract || ''),
      purpose: m.purpose ?? undefined,
      supplementalInformation: m.supplementalInformation ?? undefined,
      status: String(m.status || ''),
      scopeCode: String(m.scopeCode || 'dataset'),
      language: String(m.language || ''),
      characterSet: String(m.characterSet || ''),
      doi: m.doi ?? undefined,
      nceiAccessionId: m.accession ?? undefined,
      topicCategories: Array.isArray(m.topicCategories)
        ? m.topicCategories.map((c) => String(c || '').trim()).filter(Boolean)
        : [],
      citationAuthorIndividualName: m.citationAuthorIndividualName || undefined,
      citationAuthorOrganisationName: m.citationAuthorOrganisationName || undefined,
      citationPublisherOrganisationName: m.citationPublisherOrganisationName || undefined,
      citationOriginatorIndividualName: m.citationOriginatorIndividualName || undefined,
      citationOriginatorOrganisationName: m.citationOriginatorOrganisationName || undefined,
      graphicOverviewHref: m.graphicOverviewHref || undefined,
      graphicOverviewTitle: m.graphicOverviewTitle || undefined,
    },

    contact: {
      org: String(m.org || ''),
      individualName: m.individualName ?? undefined,
      email: String(m.email || ''),
      contactPhone: m.contactPhone ?? undefined,
      contactUrl: m.contactUrl ?? undefined,
      contactAddress: m.contactAddress ?? undefined,
      rorId: ror?.id ?? undefined,
      rorUri: ror?.id ? `https://ror.org/${String(ror.id).replace(/^https:\/\/ror\.org\//, '')}` : undefined,
      rorDisplayName: ror?.name ?? undefined,
      rorCountry: ror?.country ?? undefined,
    },

    temporal: {
      startDate: String(m.startDate || ''),
      endDate: String(m.endDate || ''),
      publicationDate: m.publicationDate ?? undefined,
      metadataRecordDate: m.metadataRecordDate ?? undefined,
      temporalExtentInterval: m.temporalExtentIntervalValue ?? undefined,
      temporalExtentIntervalUnit: m.temporalExtentIntervalUnit ?? undefined,
    },

    // bbox values live on mission.* in pilotState (legacy parity decision)
    spatialExtent: {
      west: String(m.west ?? ''),
      east: String(m.east ?? ''),
      south: String(m.south ?? ''),
      north: String(m.north ?? ''),
      vmin: m.vmin != null ? String(m.vmin) : undefined,
      vmax: m.vmax != null ? String(m.vmax) : undefined,
    },

    keywords: {
      sciencekeywords: toKwArray(kw.sciencekeywords),
      datacenters: toKwArray(kw.datacenters),
      platforms: toKwArray(kw.platforms),
      instruments: toKwArray(kw.instruments),
      locations: toKwArray(kw.locations),
      projects: toKwArray(kw.projects),
      providers: toKwArray(kw.providers),
    },

    constraints: {
      citeAs: m.citeAs ?? undefined,
      otherCiteAs: m.otherCiteAs ?? undefined,
      accessConstraints: m.accessConstraints ?? undefined,
      distributionLiability: m.distributionLiability ?? undefined,
      dataLicensePreset: m.dataLicensePreset ?? undefined,
      licenseUrl: m.licenseUrl ?? undefined,
    },

    platform: Object.keys(p).length ? { ...p } : undefined,

    sensors: sensors.map((s) => ({ ...s })),

    spatialDetail: {
      referenceSystem: sp.referenceSystem ?? undefined,
      verticalCrsUrl: sp.verticalCrsUrl ?? undefined,
      geographicDescription: sp.geographicDescription ?? undefined,
      hasTrajectory: sp.hasTrajectory ?? undefined,
      trajectorySampling: sp.trajectorySampling ?? undefined,
      hasGrid: sp.hasGrid ?? undefined,
      gridRepresentation: sp.gridRepresentation ?? undefined,
      dimensions: sp.dimensions ?? undefined,
      accuracyQuantitative: sp.accuracyQuantitative ?? undefined,
      accuracyError: sp.accuracyError ?? undefined,
    },

    aggregations: {
      parentProjectTitle: m.parentProjectTitle ?? undefined,
      parentProjectDate: m.parentProjectDate ?? undefined,
      parentProjectCode: m.parentProjectCode ?? undefined,
      relatedDatasetTitle: m.relatedDatasetTitle ?? undefined,
      relatedDatasetDate: m.relatedDatasetDate ?? undefined,
      relatedDatasetCode: m.relatedDatasetCode ?? undefined,
      relatedDatasetOrg: m.relatedDatasetOrg ?? undefined,
      relatedDataUrl: m.relatedDataUrl ?? undefined,
      relatedDataUrlTitle: m.relatedDataUrlTitle ?? undefined,
      relatedDataUrlDescription: m.relatedDataUrlDescription ?? undefined,
      associatedPublicationTitle: m.associatedPublicationTitle ?? undefined,
      associatedPublicationDate: m.associatedPublicationDate ?? undefined,
      associatedPublicationCode: m.associatedPublicationCode ?? undefined,
      uxsContext: m.uxsContext && typeof m.uxsContext === 'object'
        ? { ...m.uxsContext }
        : undefined,
    },

    distribution: { ...dist },

    validationMode: state?.mode || 'lenient',

    completeness: {
      score: 0,
      maxScore: 100,
      errCount: 0,
      warnCount: 0,
    },

    provenance: {
      source: 'manual',
      lastModifiedAt: new Date().toISOString(),
    },
  }

  return entity
}

/**
 * Convert a CanonicalMetadataEntity back to a pilotState object.
 *
 * This is the reverse mapper. Combined with sanitizePilotState:
 *   canonicalToPilotState(pilotStateToCanonical(s)) ≈ sanitizePilotState(s)
 *
 * @param {import('../entities/types.js').CanonicalMetadataEntity} entity
 * @returns {object} pilotState
 */
export function canonicalToPilotState(entity) {
  const id = entity.identification ?? {}
  const ct = entity.contact ?? {}
  const tm = entity.temporal ?? {}
  const se = entity.spatialExtent ?? {}
  const sd = entity.spatialDetail ?? {}
  const kw = entity.keywords ?? {}
  const ag = entity.aggregations ?? {}
  const cs = entity.constraints ?? {}
  const dist = entity.distribution ?? {}

  // Reconstruct the ror object from flattened contact fields
  const rorId = ct.rorId
  const ror = rorId
    ? {
        id: rorId,
        name: ct.rorDisplayName ?? '',
        country: ct.rorCountry ?? null,
        types: [],
      }
    : null

  return {
    mode: entity.validationMode || 'lenient',

    mission: {
      fileId: id.fileId ?? '',
      title: id.title ?? '',
      alternateTitle: id.alternateTitle ?? '',
      abstract: id.abstract ?? '',
      purpose: id.purpose ?? '',
      supplementalInformation: id.supplementalInformation ?? '',
      status: id.status ?? '',
      scopeCode: id.scopeCode ?? 'dataset',
      language: id.language ?? '',
      characterSet: id.characterSet ?? '',
      doi: id.doi ?? '',
      accession: id.nceiAccessionId ?? '',

      org: ct.org ?? '',
      individualName: ct.individualName ?? '',
      email: ct.email ?? '',
      contactPhone: ct.contactPhone ?? '',
      contactUrl: ct.contactUrl ?? '',
      contactAddress: ct.contactAddress ?? '',
      ror,

      startDate: tm.startDate ?? '',
      endDate: tm.endDate ?? '',
      publicationDate: tm.publicationDate ?? '',
      metadataRecordDate: tm.metadataRecordDate ?? '',
      temporalExtentIntervalValue: tm.temporalExtentInterval ?? '',
      temporalExtentIntervalUnit: tm.temporalExtentIntervalUnit ?? '',

      // bbox lives on mission.* for parity with pilotValidation + xmlPreviewBuilder
      west: se.west ?? '',
      east: se.east ?? '',
      south: se.south ?? '',
      north: se.north ?? '',
      vmin: se.vmin ?? '',
      vmax: se.vmax ?? '',

      // constraints
      citeAs: cs.citeAs ?? '',
      otherCiteAs: cs.otherCiteAs ?? '',
      accessConstraints: cs.accessConstraints ?? '',
      distributionLiability: cs.distributionLiability ?? '',
      dataLicensePreset: cs.dataLicensePreset ?? 'custom',
      licenseUrl: cs.licenseUrl ?? '',

      // aggregations
      parentProjectTitle: ag.parentProjectTitle ?? '',
      parentProjectDate: ag.parentProjectDate ?? '',
      parentProjectCode: ag.parentProjectCode ?? '',
      relatedDatasetTitle: ag.relatedDatasetTitle ?? '',
      relatedDatasetDate: ag.relatedDatasetDate ?? '',
      relatedDatasetCode: ag.relatedDatasetCode ?? '',
      relatedDatasetOrg: ag.relatedDatasetOrg ?? '',
      relatedDataUrl: ag.relatedDataUrl ?? '',
      relatedDataUrlTitle: ag.relatedDataUrlTitle ?? '',
      relatedDataUrlDescription: ag.relatedDataUrlDescription ?? '',
      associatedPublicationTitle: ag.associatedPublicationTitle ?? '',
      associatedPublicationDate: ag.associatedPublicationDate ?? '',
      associatedPublicationCode: ag.associatedPublicationCode ?? '',
      uxsContext: ag.uxsContext && typeof ag.uxsContext === 'object'
        ? { ...ag.uxsContext }
        : undefined,

      topicCategories: Array.isArray(id.topicCategories) ? [...id.topicCategories] : [],
      citationAuthorIndividualName: id.citationAuthorIndividualName ?? '',
      citationAuthorOrganisationName: id.citationAuthorOrganisationName ?? '',
      citationPublisherOrganisationName: id.citationPublisherOrganisationName ?? '',
      citationOriginatorIndividualName: id.citationOriginatorIndividualName ?? '',
      citationOriginatorOrganisationName: id.citationOriginatorOrganisationName ?? '',

      graphicOverviewHref: id.graphicOverviewHref ?? '',
      graphicOverviewTitle: id.graphicOverviewTitle ?? '',
    },

    platform: entity.platform ? { ...entity.platform } : {},

    sensors: Array.isArray(entity.sensors) ? entity.sensors.map((s) => ({ ...s })) : [],

    spatial: {
      referenceSystem: sd.referenceSystem ?? '',
      verticalCrsUrl: sd.verticalCrsUrl ?? '',
      geographicDescription: sd.geographicDescription ?? '',
      hasTrajectory: sd.hasTrajectory ?? false,
      trajectorySampling: sd.trajectorySampling ?? '',
      hasGrid: sd.hasGrid ?? false,
      gridRepresentation: sd.gridRepresentation ?? '',
      dimensions: sd.dimensions ?? '',
      accuracyQuantitative: sd.accuracyQuantitative ?? '',
      accuracyError: sd.accuracyError ?? '',
    },

    keywords: {
      sciencekeywords: toKwArray(kw.sciencekeywords),
      datacenters: toKwArray(kw.datacenters),
      platforms: toKwArray(kw.platforms),
      instruments: toKwArray(kw.instruments),
      locations: toKwArray(kw.locations),
      projects: toKwArray(kw.projects),
      providers: toKwArray(kw.providers),
    },

    distribution: { ...dist },
  }
}

// ---- helpers ----

/**
 * @param {unknown} arr
 * @returns {Array<{ label: string, uuid: string }>}
 */
function toKwArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map((k) => ({ label: String(k?.label || ''), uuid: String(k?.uuid || '') }))
}

/**
 * Derive EntityStatus from the mission data status field.
 * @param {object} m
 * @returns {import('../entities/types.js').EntityStatus}
 */
function deriveStatus(m) {
  switch (String(m?.status || '')) {
    case 'completed':
    case 'historicalArchive':
      return 'complete'
    case 'onGoing':
      return 'draft'
    case 'planned':
      return 'draft'
    default:
      return 'draft'
  }
}
