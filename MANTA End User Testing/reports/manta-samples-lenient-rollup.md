# Lenient validation — cross-sample rollup

Unique issue patterns: **207**

Use this to prioritize **import mapping** (`xmlPilotImport.js`) vs **rule tuning** (`pilotValidation.js` / mission rules): patterns hitting **every** sample often indicate systemic import gaps or baseline rules.

## By wizard step (lenient issue hits)

| Step | Error hits | Warning hits |
|------|------------|--------------|
| keywords | 0 | 464 |
| mission | 0 | 16 |

## Top fields by total issue count

| Field | Errors | Warnings | Distinct samples |
|-------|--------|----------|------------------|
| `keywords.sciencekeywords[1].uuid` | 0 | 13 | 13 |
| `keywords.platforms[0].uuid` | 0 | 13 | 13 |
| `keywords.projects[0].uuid` | 0 | 13 | 13 |
| `mission.abstract` | 0 | 12 | 12 |
| `keywords.sciencekeywords[0].uuid` | 0 | 12 | 12 |
| `keywords.sciencekeywords[2].uuid` | 0 | 10 | 10 |
| `keywords.locations[0].uuid` | 0 | 10 | 10 |
| `keywords.sciencekeywords[4].uuid` | 0 | 10 | 10 |
| `keywords.instruments[0].uuid` | 0 | 10 | 10 |
| `keywords.sciencekeywords[3].uuid` | 0 | 9 | 9 |
| `keywords.locations[1].uuid` | 0 | 8 | 8 |
| `keywords.sciencekeywords[5].uuid` | 0 | 8 | 8 |
| `keywords.sciencekeywords[6].uuid` | 0 | 8 | 8 |
| `keywords.sciencekeywords[7].uuid` | 0 | 8 | 8 |
| `keywords.datacenters[1].uuid` | 0 | 7 | 7 |
| `keywords.providers[1].uuid` | 0 | 7 | 7 |
| `keywords.providers[0].uuid` | 0 | 7 | 7 |
| `keywords.sciencekeywords[9].uuid` | 0 | 7 | 7 |
| `keywords.sciencekeywords[8].uuid` | 0 | 6 | 6 |
| `keywords.sciencekeywords[10].uuid` | 0 | 6 | 6 |
| `keywords.projects[1].uuid` | 0 | 5 | 5 |
| `keywords.sciencekeywords[11].uuid` | 0 | 5 | 5 |
| `keywords.locations[2].uuid` | 0 | 5 | 5 |
| `keywords.locations[3].uuid` | 0 | 5 | 5 |
| `keywords.datacenters[0].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[12].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[13].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[14].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[15].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[16].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[18].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[19].uuid` | 0 | 4 | 4 |
| `keywords.sciencekeywords[20].uuid` | 0 | 4 | 4 |
| `mission.ror` | 0 | 4 | 4 |
| `keywords.projects[2].uuid` | 0 | 3 | 3 |
| `keywords.sciencekeywords[17].uuid` | 0 | 3 | 3 |
| `keywords.sciencekeywords[21].uuid` | 0 | 3 | 3 |
| `keywords.sciencekeywords[24].uuid` | 0 | 3 | 3 |
| `keywords.instruments[1].uuid` | 0 | 3 | 3 |
| `keywords.locations[5].uuid` | 0 | 3 | 3 |

*(157 more fields in JSON / CSV)*

## Duplicate patterns (frequency)

| Hits | Sev | Step | Field | Message |
|------|-----|------|-------|---------|
| 13 | w | keywords | `keywords.platforms[0].uuid` | Add concept UUID for best KMS href |
| 13 | w | keywords | `keywords.projects[0].uuid` | Add concept UUID for best KMS href |
| 13 | w | keywords | `keywords.sciencekeywords[1].uuid` | Add concept UUID for best KMS href |
| 12 | w | keywords | `keywords.sciencekeywords[0].uuid` | Add concept UUID for best KMS href |
| 10 | w | keywords | `keywords.instruments[0].uuid` | Add concept UUID for best KMS href |
| 10 | w | keywords | `keywords.locations[0].uuid` | Add concept UUID for best KMS href |
| 10 | w | keywords | `keywords.sciencekeywords[2].uuid` | Add concept UUID for best KMS href |
| 10 | w | keywords | `keywords.sciencekeywords[4].uuid` | Add concept UUID for best KMS href |
| 9 | w | keywords | `keywords.sciencekeywords[3].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.locations[1].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.sciencekeywords[5].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.sciencekeywords[6].uuid` | Add concept UUID for best KMS href |
| 8 | w | keywords | `keywords.sciencekeywords[7].uuid` | Add concept UUID for best KMS href |
| 7 | w | keywords | `keywords.datacenters[1].uuid` | Add concept UUID for best KMS href |
| 7 | w | keywords | `keywords.providers[0].uuid` | Add concept UUID for best KMS href |
| 7 | w | keywords | `keywords.providers[1].uuid` | Add concept UUID for best KMS href |
| 7 | w | keywords | `keywords.sciencekeywords[9].uuid` | Add concept UUID for best KMS href |
| 6 | w | keywords | `keywords.sciencekeywords[10].uuid` | Add concept UUID for best KMS href |
| 6 | w | keywords | `keywords.sciencekeywords[8].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.locations[2].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.locations[3].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.projects[1].uuid` | Add concept UUID for best KMS href |
| 5 | w | keywords | `keywords.sciencekeywords[11].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.datacenters[0].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[12].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[13].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[14].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[15].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[16].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[18].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[19].uuid` | Add concept UUID for best KMS href |
| 4 | w | keywords | `keywords.sciencekeywords[20].uuid` | Add concept UUID for best KMS href |
| 4 | w | mission | `mission.ror` | No ROR selected (recommended for organization linkage) |
| 3 | w | keywords | `keywords.instruments[1].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.locations[5].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.locations[6].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.projects[2].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[17].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[21].uuid` | Add concept UUID for best KMS href |
| 3 | w | keywords | `keywords.sciencekeywords[24].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.datacenters[2].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.instruments[2].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.instruments[3].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.locations[4].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.locations[7].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.platforms[1].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.platforms[2].uuid` | Add concept UUID for best KMS href |
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
| 2 | w | keywords | `keywords.providers[2].uuid` | Add concept UUID for best KMS href |
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
| 2 | w | keywords | `keywords.providers[32].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[33].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[34].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[35].uuid` | Add concept UUID for best KMS href |
| 2 | w | keywords | `keywords.providers[36].uuid` | Add concept UUID for best KMS href |

*(127 more patterns in JSON / CSV)*
