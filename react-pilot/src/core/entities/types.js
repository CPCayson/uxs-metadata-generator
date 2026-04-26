/**
 * Canonical metadata entity model.
 *
 * This is the shared internal representation that all profiles, mappers,
 * validators, and exporters operate on. It reorganizes what already exists
 * across pilotState and legacyFormData into a single structured shape.
 *
 * @module core/entities/types
 */

/**
 * @typedef {'mission'|'collection'|'dataset'|'segment'|'record'|'bediCollection'|'bediGranule'} EntityType
 * @typedef {'draft'|'partial'|'complete'|'submitted'|'post-ingest'|'archived'} EntityStatus
 * @typedef {'lenient'|'strict'|'catalog'} ValidationMode
 * @typedef {'iso-xml'|'geojson'|'dcat-jsonld'} ExportFormat
 * @typedef {'e'|'w'} IssueSeverity
 */

/**
 * @typedef {{ label: string, uuid: string }} KeywordEntry
 */

/**
 * @typedef {{
 *   fileId: string,
 *   title: string,
 *   alternateTitle?: string,
 *   abstract: string,
 *   purpose?: string,
 *   supplementalInformation?: string,
 *   status: string,
 *   scopeCode: string,
 *   language: string,
 *   characterSet: string,
 *   doi?: string,
 *   nceiAccessionId?: string,
 *   topicCategories?: string[],
 *   citationAuthorIndividualName?: string,
 *   citationAuthorOrganisationName?: string,
 *   citationPublisherOrganisationName?: string,
 *   citationOriginatorIndividualName?: string,
 *   citationOriginatorOrganisationName?: string,
 *   graphicOverviewHref?: string,
 *   graphicOverviewTitle?: string,
 * }} MetadataIdentification
 */

/**
 * @typedef {{
 *   org: string,
 *   individualName?: string,
 *   email: string,
 *   contactPhone?: string,
 *   contactUrl?: string,
 *   contactAddress?: string,
 *   rorId?: string,
 *   rorUri?: string,
 *   rorDisplayName?: string,
 *   rorCountry?: string,
 * }} MetadataContact
 */

/**
 * @typedef {{
 *   startDate: string,
 *   endDate: string,
 *   publicationDate?: string,
 *   metadataRecordDate?: string,
 *   temporalExtentInterval?: string,
 *   temporalExtentIntervalUnit?: string,
 * }} MetadataTemporal
 */

/**
 * Bounding box values are stored as strings matching the existing pilotState
 * convention (empty string = unset). vmin/vmax are the vertical extent.
 *
 * @typedef {{
 *   west: string,
 *   east: string,
 *   south: string,
 *   north: string,
 *   vmin?: string,
 *   vmax?: string,
 * }} MetadataSpatialExtent
 */

/**
 * @typedef {{
 *   referenceSystem?: string,
 *   verticalCrsUrl?: string,
 *   geographicDescription?: string,
 *   hasTrajectory?: boolean,
 *   trajectorySampling?: string,
 *   hasGrid?: boolean,
 *   gridRepresentation?: string,
 *   dimensions?: string,
 *   accuracyQuantitative?: string,
 *   accuracyError?: string,
 * }} MetadataSpatialDetail
 */

/**
 * @typedef {{
 *   sciencekeywords: KeywordEntry[],
 *   datacenters: KeywordEntry[],
 *   platforms: KeywordEntry[],
 *   instruments: KeywordEntry[],
 *   locations: KeywordEntry[],
 *   projects: KeywordEntry[],
 *   providers: KeywordEntry[],
 * }} MetadataKeywords
 */

/**
 * @typedef {{
 *   citeAs?: string,
 *   otherCiteAs?: string,
 *   accessConstraints?: string,
 *   distributionLiability?: string,
 *   dataLicensePreset?: string,
 *   licenseUrl?: string,
 * }} MetadataConstraints
 */

/**
 * UxS operational context stored in editable mission state.
 *
 * @typedef {{
 *   primaryLayer: 'datasetProduct'|'deployment'|'run'|'sortie'|'dive'|'other',
 *   deploymentName: string,
 *   deploymentId: string,
 *   runName: string,
 *   runId: string,
 *   sortieName: string,
 *   sortieId: string,
 *   diveName: string,
 *   diveId: string,
 *   operationOutcome: ''|'completed'|'partial'|'aborted'|'unknown',
 *   narrative: string,
 * }} UxsContext
 */

/**
 * Derived read model for UxS operational relationships.
 * This should be built from `UxsContext`, not edited independently.
 *
 * @typedef {{
 *   kind: string,
 *   label: string,
 *   id: string,
 *   name: string,
 *   parentId: string,
 *   outcome: string,
 *   narrative: string,
 * }} UxsOperationalRelationship
 */

/**
 * @typedef {{
 *   parentProjectTitle?: string,
 *   parentProjectDate?: string,
 *   parentProjectCode?: string,
 *   relatedDatasetTitle?: string,
 *   relatedDatasetDate?: string,
 *   relatedDatasetCode?: string,
 *   relatedDatasetOrg?: string,
 *   relatedDataUrl?: string,
 *   relatedDataUrlTitle?: string,
 *   relatedDataUrlDescription?: string,
 *   associatedPublicationTitle?: string,
 *   associatedPublicationDate?: string,
 *   associatedPublicationCode?: string,
 *   uxsContext?: UxsContext,
 *   uxsOperationalRelationship?: UxsOperationalRelationship,
 * }} MetadataAggregations
 */

/**
 * @typedef {{
 *   platformId: string,
 *   platformName?: string,
 *   platformType?: string,
 *   customPlatformType?: string,
 *   manufacturer?: string,
 *   model?: string,
 *   weight?: string,
 *   length?: string,
 *   width?: string,
 *   height?: string,
 *   material?: string,
 *   speed?: string,
 *   powerSource?: string,
 *   navigationSystem?: string,
 *   sensorMounts?: string,
 *   operationalArea?: string,
 *   serialNumber?: string,
 *   deploymentDate?: string,
 *   platformDesc?: string,
 * }} MetadataPlatform
 */

/**
 * @typedef {{
 *   localId: string,
 *   sensorId: string,
 *   type: string,
 *   modelId?: string,
 *   variable?: string,
 *   firmware?: string,
 *   operationMode?: string,
 *   uncertainty?: string,
 *   frequency?: string,
 *   beamCount?: string,
 *   depthRating?: string,
 *   confidenceInterval?: string,
 * }} MetadataSensor
 */

/**
 * @typedef {{
 *   metadataStandard?: string,
 *   metadataVersion?: string,
 *   format?: string,
 *   metadataLandingUrl?: string,
 *   dataDownloadUrl?: string,
 *   metadataMaintenanceFrequency?: string,
 *   outputLocation?: string,
 *   awsBucket?: string,
 *   awsPrefix?: string,
 *   nceiMetadataContactXlinkHref?: string,
 *   nceiDistributorContactXlinkHref?: string,
 *   nceiFileIdPrefix?: boolean,
 *   templateName?: string,
 *   templateCategory?: string,
 *   finalNotes?: string,
 *   license?: string,
 *   landingUrl?: string,
 *   downloadUrl?: string,
 *   parentProject?: string,
 *   publication?: string,
 * }} MetadataDistribution
 */

/**
 * @typedef {{
 *   score: number,
 *   maxScore: number,
 *   errCount: number,
 *   warnCount: number,
 *   lastCheckedAt?: string,
 * }} CompletenessRecord
 */

/**
 * @typedef {{
 *   source: 'manual'|'xml-import'|'template'|'api',
 *   importedFrom?: string,
 *   importedAt?: string,
 *   lastModifiedAt?: string,
 * }} ProvenanceRecord
 */

/**
 * The canonical metadata entity. All profiles, mappers, validators, and
 * exporters operate on this shape.
 *
 * @typedef {{
 *   id: string,
 *   entityType: EntityType,
 *   profileId: string,
 *   status: EntityStatus,
 *   identification: MetadataIdentification,
 *   contact: MetadataContact,
 *   temporal: MetadataTemporal,
 *   spatialExtent: MetadataSpatialExtent,
 *   keywords: MetadataKeywords,
 *   constraints: MetadataConstraints,
 *   platform?: MetadataPlatform,
 *   sensors?: MetadataSensor[],
 *   spatialDetail?: MetadataSpatialDetail,
 *   aggregations?: MetadataAggregations,
 *   distribution?: MetadataDistribution,
 *   validationMode: ValidationMode,
 *   completeness: CompletenessRecord,
 *   provenance: ProvenanceRecord,
 * }} CanonicalMetadataEntity
 */

/**
 * @typedef {{
 *   id?: string,
 *   severity: IssueSeverity,
 *   field: string,
 *   path?: string,
 *   source?: 'profile'|'legacy'|'server'|'comet'|'linkcheck'|'xsd'|'schematron'|'scanner',
 *   message: string,
 *   detail?: string,
 *   xpath?: string,
 *   readinessBundleIds?: string[],
 * }} ValidationIssue
 */

/**
 * @typedef {{
 *   issues: ValidationIssue[],
 *   score: number,
 *   maxScore: number,
 *   errCount: number,
 *   warnCount: number,
 * }} ValidationResult
 */

export {}
