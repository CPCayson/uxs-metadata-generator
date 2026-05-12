# Lenient validation — cross-sample rollup

Unique issue patterns: **193**

Use this to prioritize **import mapping** (`xmlPilotImport.js`) vs **rule tuning** (`pilotValidation.js` / mission rules): patterns hitting **every** sample often indicate systemic import gaps or baseline rules.

## By wizard step (lenient issue hits)

| Step | Error hits | Warning hits |
|------|------------|--------------|
| distribution | 10 | 0 |
| keywords | 33 | 415 |
| mission | 26 | 50 |
| sensors | 11 | 0 |

## Top fields by total issue count

| Field | Errors | Warnings | Distinct samples |
|-------|--------|----------|------------------|
| `mission.abstract` | 0 | 34 | 19 |
| `keywords.providers[0].uuid` | 0 | 15 | 15 |
| `mission.ror` | 0 | 14 | 14 |
| `keywords.platforms[0].uuid` | 0 | 13 | 13 |
| `keywords.instruments[0].uuid` | 0 | 13 | 13 |
| `keywords.sciencekeywords[0].uuid` | 0 | 12 | 12 |
| `keywords.sciencekeywords[1].uuid` | 0 | 12 | 12 |
| `keywords.datacenters[0].uuid` | 0 | 12 | 12 |
| `keywords.sciencekeywords[3].uuid` | 0 | 11 | 11 |
| `keywords.sciencekeywords[2].uuid` | 0 | 11 | 11 |
| `keywords.locations[0].uuid` | 0 | 11 | 11 |
| `keywords.sciencekeywords[4].uuid` | 0 | 10 | 10 |
| `keywords.projects[0].uuid` | 0 | 9 | 9 |
| `keywords.sciencekeywords[5].uuid` | 0 | 8 | 8 |
| `keywords.sciencekeywords[6].uuid` | 0 | 8 | 8 |
| `keywords.locations[1].uuid` | 0 | 8 | 8 |
| `keywords.providers[1].uuid` | 0 | 8 | 8 |
| `distribution.format` | 8 | 0 | 8 |
| `keywords.sciencekeywords[7].uuid` | 0 | 7 | 7 |
| `keywords.projects` | 7 | 0 | 7 |
| `mission.individualName` | 6 | 0 | 6 |
| `mission.endDate` | 6 | 0 | 6 |
| `keywords.instruments[1].uuid` | 0 | 5 | 5 |
| `keywords.datacenters[1].uuid` | 0 | 5 | 5 |
| `keywords.locations` | 5 | 0 | 5 |
| `mission.purpose` | 5 | 0 | 5 |
| `keywords.locations[2].uuid` | 0 | 5 | 5 |
| `keywords.locations[3].uuid` | 0 | 5 | 5 |
| `keywords.platforms` | 5 | 0 | 5 |
| `mission.accession` | 4 | 0 | 4 |
| `keywords.sciencekeywords` | 4 | 0 | 4 |
| `keywords.datacenters` | 4 | 0 | 4 |
| `keywords.providers` | 4 | 0 | 4 |
| `keywords.locations[5].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[9].uuid` | 0 | 4 | 4 |
| `sensors[0].type` | 4 | 0 | 4 |
| `sensors[0].variable` | 4 | 0 | 4 |
| `keywords.instruments` | 4 | 0 | 4 |
| `keywords.platforms[1].uuid` | 0 | 3 | 3 |
| `keywords.projects[1].uuid` | 0 | 3 | 3 |

*(141 more fields in JSON / CSV)*

## Duplicate patterns (frequency)

| Hits | Sev | Step | Field | Message |
|------|-----|------|-------|---------|
| 19 | w | mission | `mission.abstract` | Abstract should mention the relevant platform, sensor, or observed variable. |
| 15 | w | keywords | `keywords.providers[0].uuid` | Add concept UUID for best KMS href |
| 14 | w | mission | `mission.ror` | No ROR selected (recommended for organization linkage) |
| 13 | w | keywords | `keywords.instruments[0].uuid` | Add concept UUID for best KMS href |
| 13 | w | keywords | `keywords.platforms[0].uuid` | Add concept UUID for best KMS href |
| 12 | w | keywords | `keywords.datacenters[0].uuid` | Add concept UUID for best KMS href |
| 12 | w | keywords | `keywords.sciencekeywords[0].uuid` | Add concept UUID for best KMS href |
| 12 | w | keywords | `keywords.sciencekeywords[1].uuid` | Add concept UUID for best KMS href |
| 11 | w | keywords | `keywords.locations[0].uuid` | Add concept UUID for best KMS href |
| 11 | w | keywords | `keywords.sciencekeywords[2].uuid` | Add concept UUID for best KMS href |
| 11 | w | keywords | `keywords.sciencekeywords[3].uuid` | Add concept UUID for best KMS href |
| 10 | w | keywords | `keywords.sciencekeywords[4].uuid` | Add concept UUID for best KMS href |
| 9 | w | keywords | `keywords.projects[0].uuid` | Add concept UUID for best KMS href |
| 8 | e | distribution | `distribution.format` | Distribution format is required |
| 8 | w | keywords | `keywords.locations[1].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.providers[1].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.sciencekeywords[5].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.sciencekeywords[6].uuid` | Add concept UUID for best KMS href |
| 7 | e | keywords | `keywords.projects` | Projects: at least one keyword is required |
| 7 | w | keywords | `keywords.sciencekeywords[7].uuid` | Add concept UUID for best KMS href |
| 6 | e | mission | `mission.endDate` | End date is required |
| 6 | e | mission | `mission.individualName` | Individual name is required |
| 5 | w | keywords | `keywords.datacenters[1].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.instruments[1].uuid` | Add concept UUID for best KMS href |
| 5 | e | keywords | `keywords.locations` | Locations: at least one keyword is required |
| 5 | w | keywords | `keywords.locations[2].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.locations[3].uuid` | Add concept UUID for best KMS href |
| 5 | e | keywords | `keywords.platforms` | Platforms: at least one keyword is required |
| 5 | e | mission | `mission.purpose` | Purpose (dataset) is required |
| 4 | e | keywords | `keywords.datacenters` | Data Centers: at least one keyword is required |
| 4 | e | keywords | `keywords.instruments` | Instruments: at least one keyword is required |
| 4 | w | keywords | `keywords.locations[5].uuid` | Add concept UUID for best KMS href |
| 4 | e | keywords | `keywords.providers` | Providers: at least one keyword is required |
| 4 | e | keywords | `keywords.sciencekeywords` | Science Keywords: at least one keyword is required |
| 4 | w | keywords | `keywords.sciencekeywords[9].uuid` | Add concept UUID for best KMS href |
| 4 | w | mission | `mission.abstract` | Abstract uses acronym "MDBC"; expand it on first use when possible. |
| 4 | e | mission | `mission.accession` | NCEI Accession must be alphanumeric |
| 4 | e | sensors | `sensors[0].type` | Sensor 1: type is required |
| 4 | e | sensors | `sensors[0].variable` | Sensor 1: observed variable is required |
| 3 | w | keywords | `keywords.locations[4].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.locations[6].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.platforms[1].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.projects[1].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.providers[2].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[10].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[25].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[8].uuid` | Add concept UUID for best KMS href |
| 3 | e | mission | `mission.email` | Email is required |
| 2 | e | distribution | `distribution.license` | Use/License is required |
| 2 | w | keywords | `keywords.instruments[2].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.instruments[3].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.locations[7].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.platforms[3].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.projects[3].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.projects[4].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.projects[5].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.projects[6].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[10].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[11].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[12].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[13].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[14].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[15].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[16].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[17].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[18].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[19].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[20].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[21].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[22].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[23].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[24].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[25].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[26].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[27].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[28].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[29].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[3].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[30].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[31].uuid` | Add concept UUID for best KMS href |

*(113 more patterns in JSON / CSV)*
