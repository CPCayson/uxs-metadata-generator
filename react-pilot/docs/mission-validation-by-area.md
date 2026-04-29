# Mission validation by area — GCMD facets, wizard steps, and rules

This document maps **where data lives in `pilotState`**, **which wizard step** edits it, and **what the validator enforces** (all modes unless noted). The machine-readable rule list is always [generated/mission-validation-rules.generated.md](./generated/mission-validation-rules.generated.md) (`npm run docs:mission-validation-rules`).

**Modes:** **Lenient** (default), **Strict**, **Catalog** — extra rows apply only in that mode (see §4).

---

## 1. GCMD keyword facets (`keywords.*`)

Each facet is an **array of chips** `{ label, uuid? }`. Importer fills `label` from `gmd:keyword` / `gmx:Anchor`; `uuid` is set when the XML carries a KMS concept id.

| `pilotState` key | User-facing name (validator) | Wizard | Required (lenient / strict / catalog) | When non-empty: extra checks |
| ---------------- | ------------------------------ | ------ | --------------------------------------- | ----------------------------- |
| `keywords.sciencekeywords` | Science Keywords | 5 — Keywords | **Error** if array is empty | **Warning** per chip: `label` but no `uuid` (“Add concept UUID…”); **Warning** if `uuid` present but not a plausible KMS id (`collectGcmdKeywordUuidWarnings` in `pilotValidation.js`) |
| `keywords.datacenters` | Data Centers | 5 | **Error** if empty | Same UUID chip warnings |
| `keywords.platforms` | Platforms | 5 | **Error** if empty | Same |
| `keywords.instruments` | Instruments | 5 | **Error** if empty | Same |
| `keywords.locations` | Locations | 5 | **Error** if empty | Same |
| `keywords.projects` | Projects | 5 | **Error** if empty | Same |
| `keywords.providers` | Providers | 5 | **Error** if empty | Same |

**XML:** `gmd:descriptiveKeywords` / `gmd:MD_Keywords`; facet chosen from `gmd:thesaurusName` title (see import matrix). **XPath hint on issues:** `/gmi:MI_Metadata/gmd:identificationInfo/gmd:MD_DataIdentification/gmd:descriptiveKeywords`.

**Plain-language:** Every GCMD facet row must have **at least one keyword**. For best archive/KMS linking, each chip should carry a **valid GCMD concept UUID** (warnings only until you fix chips).

---

## 2. Sensors (`sensors[]`) and GCMD cross-check

| Check | `pilotState` | Wizard | Modes | Severity | Message pattern |
| ----- | ------------ | ------ | ----- | -------- | ----------------- |
| At least one **active** row | `sensors` | 3 — Sensors | all | **e** | “At least one sensor is required” (active = not blank type + modelId/sensorId + variable) |
| Per row: type | `sensors[i].type` | 3 | all | **e** | “Sensor *n*: type is required” |
| Per row: model / id | `sensors[i].modelId` or `.sensorId` | 3 | all | **e** | “Sensor *n*: model ID is required” |
| Per row: variable | `sensors[i].variable` | 3 | all | **e** | “Sensor *n*: observed variable is required” |
| **GCMD alignment** | `sensors[i].variable` vs `keywords.*` | 3 + 5 | all | **w** | If sensor `type` maps to a facet (see below), variable text should appear as substring in **some chip label** in that facet; otherwise “variable may not align with selected GCMD keywords for this sensor type” |

**Sensor `type` → GCMD facet used for alignment** (`SENSOR_KW_MAP` in `missionValidationRules.js`):

| Sensor `type` value (exact string in UI) | Compared against facet |
| ----------------------------------------- | ---------------------- |
| `Earth Remote Sensing Instruments` | `keywords.instruments` |
| `Spectral/Engineering` | `keywords.sciencekeywords` |
| `In Situ/Laboratory Instruments` | `keywords.instruments` |
| `Earth Science Services` | `keywords.sciencekeywords` |

Other sensor types do not get this cross-facet warning.

---

## 3. Mission, platform, spatial, distribution (core rules)

All of the following run in **lenient, strict, and catalog** unless the “Modes” column says otherwise. Messages are abbreviated; exact text is in the [generated rules table](./generated/mission-validation-rules.generated.md).

### 3.1 Mission (`mission.*`) — step 1

| Area | `pilotState` fields | Validation summary |
| ---- | ------------------- | -------------------- |
| Identity | `fileId`, `title`, `abstract` | All required (**e**). Abstract also **quality warnings** (**w**): short text, missing platform/sensor mention, unexplained acronyms. |
| Dates | `startDate`, `endDate` | Required; must be `YYYY-MM-DD` or datetime-local; end ≥ start (**e**). |
| Optional dates | `publicationDate`, `metadataRecordDate` | If set, must parse as valid instant (**e**). |
| IDs | `doi` (if non-blank), `accession` (if non-blank) | DOI must match `10.xxxx/...` (**e**). Accession alphanumeric after NCEI prefix strip (**e**). |
| POC | `org`, `individualName`, `email` | Required (**e**). Email format (**e**). |
| Narrative | `purpose`, `status`, `language` | Required (**e**). |
| URLs | `contactUrl`, `licenseUrl`, `relatedDataUrl` | If non-blank → must be http(s) (**e**). |
| Extent | `west`, `east`, `south`, `north` | Numeric; W≤E, S≤N (**e**). |
| Vertical | `vmin`, `vmax` | If set → numeric; vmin ≤ vmax (**e**). |

### 3.2 Platform (`platform.*`) — step 2

| `pilotState` | Validation |
| ------------ | ---------- |
| `platformType` | Required (**e**) |
| `platformId` | Required (**e**) |
| `platformDesc` | Required (**e**) |

### 3.3 Spatial (`spatial.*`) — step 4

| `pilotState` | Validation | Mode |
| ------------ | ---------- | ---- |
| `accuracyValue`, `errorValue` | Numeric if non-blank (**e**) | all |
| `verticalCrsUrl` | http(s) if non-blank (**e**) | all |
| `gridColumnSize`, `gridRowSize`, `gridVerticalSize` | Numeric when `useGridRepresentation` is on (**e**) | all |
| `gridColumnSize`, `gridRowSize` | Required when grid on (**e**) | **strict** only |
| `trajectorySampling` | Required when `hasTrajectory` on (**e**) | **strict**, **catalog** |

### 3.4 Distribution (`distribution.*`) — step 6

| `pilotState` | Validation | Mode |
| ------------ | ---------- | ---- |
| `format`, `license` | Required (**e**) | all |
| `landingUrl`, `downloadUrl`, `metadataLandingUrl` | http(s) if non-blank (**e**) | all |
| `nceiMetadataContactHref` | http(s) if non-blank; **w** if xlink flag on and href empty | all |
| `nceiDistributorContactHref` | http(s) if non-blank (**e**) | all |
| `landingUrl`, `downloadUrl` | Required (**e**) | **catalog** |
| `publication` | Required (**e**) | **catalog** |
| `parentProject` **or** mission `parentProjectTitle` | At least one set (**e**, two linked rules) | **catalog** |

---

## 4. Lenient-only and mode extras

| Mode | `pilotState` / area | Severity | Rule summary |
| ---- | ------------------- | -------- | ------------ |
| **Lenient only** | `mission.licenseUrl` (when `dataLicensePreset === 'custom'`) | **w** | Recommend license URL if missing |
| **Lenient only** | `mission.ror.id` | **w** | Recommend ROR |
| **Strict** | `mission.licenseUrl` (custom preset) | **e** | Required |
| **Strict** | `mission.doi`, `mission.accession`, `mission.ror.id` | **e** | Required |
| **Strict** | `spatial` grid + trajectory | **e** | As in §3.3 |
| **Catalog** | Same license / DOI / accession / ROR / trajectory as strict where overlapping | **e** | See generated table |
| **Catalog** | `distribution.publication`, `landingUrl`, `downloadUrl`, parent project | **e** | See §3.4 |

---

## 5. Related documents

| Document | Role |
| -------- | ---- |
| [generated/mission-validation-rules.generated.md](./generated/mission-validation-rules.generated.md) | Every rule row: rule set id, modes, field, severity, message, XPath |
| [uxs-ncei-template-mission-pilot-matrix.md](./uxs-ncei-template-mission-pilot-matrix.md) | NCEI XML ↔ `pilotState` ↔ import depth |
| `src/profiles/mission/missionValidationRules.js` | Source of truth for rule sets |
| `src/lib/pilotValidation.js` | `validatePilotState`, `collectGcmdKeywordUuidWarnings`, parity with profile rules |
