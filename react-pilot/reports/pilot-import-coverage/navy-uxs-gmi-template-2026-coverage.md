# Pilot state coverage after XML import

- **Source:** `fixtures/mission/navy-uxs-gmi-template-2026.xml`
- **Leaf paths:** 209
- **Filled (has semantic content):** 111
- **Empty:** 98
- **Unchanged from defaultPilotState():** 90
- **Changed from default:** 119

## By wizard bucket

| Bucket | Paths | Filled | Empty | Same as default |
|--------|------:|-------:|------:|----------------:|
| 1-mission | 77 | 53 | 24 | 29 |
| 2-platform | 19 | 3 | 16 | 16 |
| 3-sensors | 24 | 10 | 14 | 7 |
| 4-spatial | 20 | 11 | 9 | 11 |
| 5-keywords | 25 | 9 | 16 | 0 |
| 6-distribution | 36 | 21 | 15 | 21 |
| meta | 8 | 4 | 4 | 6 |

_“Same as default” includes seeded defaults that match XML (e.g. bbox −180…90). Use **changedPaths** in JSON for strict diff._

## Empty paths (98)

- `distribution.awsBucket`
- `distribution.awsPrefix`
- `distribution.distributionFileFormat`
- `distribution.distributorContactUrl`
- `distribution.distributorEmail`
- `distribution.distributorIndividualName`
- `distribution.distributorOrganisationName`
- `distribution.downloadLinkDescription`
- `distribution.downloadLinkName`
- `distribution.finalNotes`
- `distribution.metadataLandingDescription`
- `distribution.metadataLandingLinkName`
- `distribution.metadataLandingUrl`
- `distribution.templateCategory`
- `distribution.templateName`
- `keywords.datacenters`
- `keywords.datacenters[0].uuid`
- `keywords.datacenters[1].uuid`
- `keywords.instruments`
- `keywords.instruments[0].uuid`
- `keywords.locations`
- `keywords.locations[0].uuid`
- `keywords.platforms`
- `keywords.platforms[0].uuid`
- `keywords.projects`
- `keywords.projects[0].uuid`
- `keywords.providers`
- `keywords.providers[0].uuid`
- `keywords.providers[1].uuid`
- `keywords.sciencekeywords`
- `keywords.sciencekeywords[0].uuid`
- `mission.accessConstraints`
- `mission.accessConstraintsCode`
- `mission.alternateTitle`
- `mission.associatedPublicationCode`
- `mission.citeAs`
- `mission.contactAddress`
- `mission.contactPhone`
- `mission.licenseUrl`
- `mission.relatedDataUrl`
- `mission.relatedDataUrlDescription`
- `mission.relatedDataUrlTitle`
- `mission.relatedDatasetOrg`
- `mission.ror`
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
- `sourceProvenance.importedAt`
- `sourceProvenance.originalFilename`
- `sourceProvenance.originalUuid`
- `sourceProvenance.sourceId`
- `spatial.accuracyStandard`
- `spatial.accuracyValue`
- `spatial.dimensions`
- `spatial.errorLevel`
- `spatial.errorValue`
- `spatial.lineageProcessSteps`
- `spatial.lineageStatement`
- `spatial.trajectorySampling`
- `spatial.verticalCrsUrl`
