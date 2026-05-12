# Pilot state coverage after XML import

- **Source:** `../MANTA End User Testing/samples/ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml`
- **Leaf paths:** 224
- **Filled (has semantic content):** 62
- **Empty:** 162
- **Unchanged from defaultPilotState():** 145
- **Changed from default:** 79

## By wizard bucket

| Bucket | Paths | Filled | Empty | Same as default |
|--------|------:|-------:|------:|----------------:|
| 1-mission | 70 | 17 | 53 | 58 |
| 2-platform | 19 | 3 | 16 | 16 |
| 3-sensors | 60 | 24 | 36 | 7 |
| 4-spatial | 20 | 3 | 17 | 20 |
| 5-keywords | 11 | 2 | 9 | 5 |
| 6-distribution | 36 | 9 | 27 | 33 |
| meta | 8 | 4 | 4 | 6 |

_“Same as default” includes seeded defaults that match XML (e.g. bbox −180…90). Use **changedPaths** in JSON for strict diff._

## Empty paths (162)

- `distribution.awsBucket`
- `distribution.awsPrefix`
- `distribution.distributionFeesText`
- `distribution.distributionFileFormat`
- `distribution.distributionFormatName`
- `distribution.distributionOrderingInstructions`
- `distribution.distributorContactUrl`
- `distribution.distributorEmail`
- `distribution.distributorIndividualName`
- `distribution.distributorOrganisationName`
- `distribution.downloadLinkDescription`
- `distribution.downloadLinkName`
- `distribution.downloadUrl`
- `distribution.finalNotes`
- `distribution.format`
- `distribution.license`
- `distribution.metadataLandingDescription`
- `distribution.metadataLandingLinkName`
- `distribution.metadataLandingUrl`
- `distribution.nceiDistributorContactHref`
- `distribution.nceiDistributorContactTitle`
- `distribution.nceiMetadataContactHref`
- `distribution.nceiMetadataContactTitle`
- `distribution.parentProject`
- `distribution.publication`
- `distribution.templateCategory`
- `distribution.templateName`
- `keywords.datacenters`
- `keywords.instruments`
- `keywords.instruments[0].uuid`
- `keywords.locations`
- `keywords.platforms`
- `keywords.platforms[0].uuid`
- `keywords.projects`
- `keywords.providers`
- `keywords.sciencekeywords`
- `mission.accessConstraints`
- `mission.accessConstraintsCode`
- `mission.accession`
- `mission.associatedPublicationCode`
- `mission.associatedPublicationDate`
- `mission.associatedPublicationTitle`
- `mission.citationAuthorIndividualName`
- `mission.citationAuthorOrganisationName`
- `mission.citationOriginatorIndividualName`
- `mission.citationOriginatorOrganisationName`
- `mission.citationPublisherOrganisationName`
- `mission.citeAs`
- `mission.contactAddress`
- `mission.contactPhone`
- `mission.contactUrl`
- `mission.distributionLiability`
- `mission.doi`
- `mission.email`
- `mission.graphicOverviewHref`
- `mission.graphicOverviewTitle`
- `mission.individualName`
- `mission.licenseUrl`
- `mission.metadataRecordDate`
- `mission.otherCiteAs`
- `mission.parentProjectCode`
- `mission.parentProjectDate`
- `mission.parentProjectTitle`
- `mission.publicationDate`
- `mission.purpose`
- `mission.relatedDataUrl`
- `mission.relatedDataUrlDescription`
- `mission.relatedDataUrlTitle`
- `mission.relatedDatasetCode`
- `mission.relatedDatasetDate`
- `mission.relatedDatasetOrg`
- `mission.relatedDatasetTitle`
- `mission.ror`
- `mission.supplementalInformation`
- `mission.temporalExtentIntervalUnit`
- `mission.temporalExtentIntervalValue`
- `mission.topicCategories`
- `mission.uxsContext.deploymentId`
- `mission.uxsContext.deploymentName`
- `mission.uxsContext.diveId`
- `mission.uxsContext.diveName`
- `mission.uxsContext.narrative`
- `mission.uxsContext.operationOutcome`
- `mission.uxsContext.runId`
- `mission.uxsContext.runName`
- `mission.uxsContext.sortieId`
- `mission.uxsContext.sortieName`
- `mission.vmax`
- `mission.vmin`
- `platform.customPlatformType`
- `platform.deploymentDate`
- `platform.height`
- `platform.length`
- `platform.manufacturer`
- `platform.material`
- `platform.model`
- `platform.navigationSystem`
- `platform.operationalArea`
- `platform.platformName`
- `platform.powerSource`
- `platform.sensorMounts`
- `platform.serialNumber`
- `platform.speed`
- `platform.weight`
- `platform.width`
- `sensors[0].beamCount`
- `sensors[0].confidenceInterval`
- `sensors[0].depthRating`
- `sensors[0].firmware`
- `sensors[0].frequency`
- `sensors[0].operationMode`
- `sensors[0].uncertainty`
- `sensors[1].beamCount`
- `sensors[1].confidenceInterval`
- `sensors[1].depthRating`
- `sensors[1].firmware`
- `sensors[1].frequency`
- `sensors[1].operationMode`
- `sensors[1].uncertainty`
- `sensors[2].beamCount`
- `sensors[2].confidenceInterval`
- `sensors[2].depthRating`
- `sensors[2].firmware`
- `sensors[2].frequency`
- `sensors[2].operationMode`
- `sensors[2].uncertainty`
- `sensors[2].variable`
- `sensors[3].beamCount`
- `sensors[3].confidenceInterval`
- `sensors[3].depthRating`
- `sensors[3].firmware`
- `sensors[3].frequency`
- `sensors[3].operationMode`
- `sensors[3].uncertainty`
- `sensors[4].beamCount`
- `sensors[4].confidenceInterval`
- `sensors[4].depthRating`
- `sensors[4].firmware`
- `sensors[4].frequency`
- `sensors[4].operationMode`
- `sensors[4].uncertainty`
- `sourceProvenance.importedAt`
- `sourceProvenance.originalFilename`
- `sourceProvenance.originalUuid`
- `sourceProvenance.sourceId`
- `spatial.accuracyStandard`
- `spatial.accuracyValue`
- `spatial.dimensions`
- `spatial.errorLevel`
- `spatial.errorValue`
- `spatial.geographicDescription`
- `spatial.gridCellGeometry`
- `spatial.gridColumnResolution`
- `spatial.gridColumnSize`
- `spatial.gridRowResolution`
- `spatial.gridRowSize`
- `spatial.gridVerticalResolution`
- `spatial.gridVerticalSize`
- `spatial.lineageProcessSteps`
- `spatial.lineageStatement`
- `spatial.trajectorySampling`
- `spatial.verticalCrsUrl`
