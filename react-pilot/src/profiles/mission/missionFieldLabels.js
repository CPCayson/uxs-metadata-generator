import { getPilotFieldLabelFallback } from '../../lib/pilotFieldLabelFallback.js'

const FIELD_LABELS = {
  'mission.fileId': 'File identifier',
  'mission.title': 'Title',
  'mission.abstract': 'Abstract',
  'mission.startDate': 'Start date / creation',
  'mission.endDate': 'End date',
  'mission.doi': 'DOI',
  'mission.accession': 'NCEI accession',
  'mission.org': 'Organization',
  'mission.individualName': 'Contact name',
  'mission.email': 'Email',
  'mission.purpose': 'Purpose',
  'mission.status': 'Status',
  'mission.language': 'Metadata language',
  'mission.publicationDate': 'Publication date',
  'mission.metadataRecordDate': 'Metadata record date',
  'mission.contactUrl': 'Contact URL',
  'mission.accessConstraintsCode': 'Access restriction code',
  'mission.licenseUrl': 'License URL',
  'mission.relatedDataUrl': 'Related data URL',
  'mission.bbox': 'Geographic bounding box',
  'mission.vmin': 'Vertical minimum',
  'mission.vmax': 'Vertical maximum',
  'mission.vertical': 'Vertical extent',
  'mission.ror': 'ROR / organization ID',
  'mission.parentProjectTitle': 'Parent project (mission)',
  'mission.uxsContext.primaryLayer': 'UxS primary layer',
  'mission.uxsContext.deploymentName': 'Deployment name',
  'mission.uxsContext.deploymentId': 'Deployment ID',
  'mission.uxsContext.runName': 'Run name',
  'mission.uxsContext.runId': 'Run ID',
  'mission.uxsContext.sortieName': 'Sortie name',
  'mission.uxsContext.sortieId': 'Sortie ID',
  'mission.uxsContext.diveName': 'Dive name',
  'mission.uxsContext.diveId': 'Dive ID',
  'mission.uxsContext.operationOutcome': 'Operation outcome',
  'mission.uxsContext.narrative': 'Operational context note',
  'platform.platformType': 'Platform type',
  'platform.platformId': 'Platform ID',
  'platform.platformName': 'Platform name',
  'platform.platformDesc': 'Platform description',
  'spatial.accuracyValue': 'Positional accuracy',
  'spatial.errorValue': 'Error value',
  'spatial.verticalCrsUrl': 'Vertical CRS URL',
  'spatial.gridColumnSize': 'Grid column size',
  'spatial.gridRowSize': 'Grid row size',
  'spatial.gridVerticalSize': 'Grid vertical size',
  'spatial.gridRepresentation': 'Grid representation',
  'spatial.trajectorySampling': 'Trajectory sampling',
  sensors: 'Sensors',
  keywords: 'Keyword facets',
  'keywords.sciencekeywords': 'Science keywords',
  'keywords.datacenters': 'Data centers',
  'keywords.platforms': 'GCMD platforms',
  'keywords.instruments': 'Instruments',
  'keywords.locations': 'Locations',
  'keywords.projects': 'Projects',
  'keywords.providers': 'Providers',
  'distribution.format': 'Distribution format',
  'distribution.license': 'Use / license',
  'distribution.landingUrl': 'Landing page URL',
  'distribution.downloadUrl': 'Download URL',
  'distribution.metadataLandingUrl': 'Metadata landing URL',
  'distribution.nceiMetadataContactHref': 'NCEI metadata contact URL',
  'distribution.nceiDistributorContactHref': 'NCEI distributor contact URL',
  'distribution.distributorContactUrl': 'Distributor contact URL',
  'distribution.parentProject': 'Parent project (distribution)',
  'distribution.publication': 'Publication reference',
}

/**
 * @param {string} fieldPath
 */
export function getMissionFieldLabel(fieldPath) {
  const field = String(fieldPath || '')
  const sensor = field.match(/^sensors\[(\d+)\]\.(type|modelId|variable)$/)
  if (sensor) {
    const n = Number(sensor[1]) + 1
    const leaf = {
      type: 'Type',
      modelId: 'Model ID',
      variable: 'Observed variable',
    }[sensor[2]]
    return `Sensor ${n} - ${leaf}`
  }
  const kwUuid = field.match(/^keywords\.([a-z]+)\[(\d+)\]\.uuid$/)
  if (kwUuid) {
    const facetKey = kwUuid[1]
    const n = Number(kwUuid[2]) + 1
    const facet = FIELD_LABELS[`keywords.${facetKey}`] || facetKey
    return `${facet} · term ${n} — concept UUID`
  }
  return FIELD_LABELS[field] || getPilotFieldLabelFallback(field)
}
