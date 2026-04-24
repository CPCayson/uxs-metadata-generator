# Changelog

All notable changes to this project are documented in this file.

## 2026-04-24

### Added (React pilot + Netlify)

- **Production HTTP path:** Documentation and wiring treat **`react-pilot` + `POST /api/db`** as the primary deployment story (`react-pilot/docs/DEPLOYMENT.md`, root and `react-pilot` READMEs, `PILOT_SHARE_WORKFLOW.md`).
- **Netlify `/api/db` parity exports:** `netlify/functions/db.mjs` implements **`generateGeoJSON`**, **`generateDCAT`**, and **`validateOnServer`** (stateless handlers; no `DATABASE_URL` required). Payloads use the legacy `collectFormData` shape from **`pilotStateToLegacyFormData`**. GeoJSON/DCAT logic lives in **`netlify/functions/lib/legacyGeoDcat.mjs`** (aligned with `mapClientDataToServer`). Server validation uses **`legacyFormDataToPilotState`** + React **`ValidationEngine`** (`react-pilot/src/core/mappers/legacyFormDataMapper.js`). **`HttpHostAdapter`** calls these routes from the browser.
- **Manta Lens (metadata assistant):** Major UX upgrade in **`AssistantShell.jsx`**: rich **`FIELD_XML_HINTS`** for pilot→XML highlight, **`pilotSectionKey`** for indexed fields (e.g. `sensors[0].modelId`), regex search **`/pattern/`**, multi-hit navigation with focus styling, issue filters (ALL/ERR/WRN), keyboard shortcuts (Esc, `/`, `j`/`k`, `[`/`]`), copy field path, fixed lens tray header rendering bug (`// ISSUES` in JSX).

### Changed

- **`PRODUCTION_QA_RUNBOOK.md`:** Primary QA framing targets the **deployed React / HTTP** app; historical GAS checklist rows retained where still useful.

## 2026-03-29

### Changed
- **Validation level consistency:** `getValidationLevel()` in `Index.html` and `Scripts.html` now defaults to **`strict`** when the dropdown is empty (aligned with preview and the sidebar default). `window.getValidationLevel` is exposed so preview and fallback paths share the same logic (including step 5 `#outputValidationLevel`).
- **Preview pipeline:** `refreshXMLPreview` in `XMLFunctions.html` uses `window.getValidationLevel()` when available. Fallback `refreshXMLPreview` in `Index.html` / `Scripts.html` does the same and passes one `validationLevel` into `finalizeXmlPreviewFromServer` and `refreshXMLPreviewWithValidation`.
- **Server generation:** `generateXMLWithValidation` in `EnhancedIntegration.gs` accepts **`validationLevel`** and calls `ValidationEngine.validate(mappedData, { level })` so generation matches the user’s strictness. `refreshXMLPreviewWithValidation` defaults to **`strict`** and passes the level into `generateXMLWithValidation`.

### Fixed
- **Quota / duplicate calls:** While an XML preview request is in flight (`window.__xmlPreviewRequestInFlight`), `LiveValidator.runServerValidation` in `Index.html` and `Scripts.html` **does not** start another server validation, reducing overlapping `validateFormDataWithRules` calls. The flag is set/cleared in `XMLFunctions.html` `refreshXMLPreview` and in fallback preview handlers (including failure and client `catch`).

## 2026-03-27

### Fixed
- **Legacy HtmlService web app bundle:** Removed duplicate `const DEBUG_MODE` (Scripts + Index combined bundle caused `Identifier 'DEBUG_MODE' has already been declared`). `UXS_DEBUG` is set only when undefined.
- **XmlService generation:** `setAttribute` for `xlink:*` and `gco:nilReason` now uses `XmlService.getNamespace('xlink', uri)` / `getNamespace('gco', uri)` (prefix + URI). URI-only namespaces often throw in the host runtime. **MI_Instrument** platform link now sets `xlink:href` with the xlink namespace (was two-arg `setAttribute`).

### Changed
- **NOAA Navy UxS template (`NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml`):** Exported XML now follows that template’s spine: NCEI `xsi:schemaLocation` and extra root namespaces (`gmx`, `gsr`, `gss`, `gts`, `srv`); `spatialRepresentationInfo` before `identificationInfo`; `gmi:MI_CoverageDescription` with `MD_Band` per sensor (replacing `MD_FeatureCatalogueDescription`); `MD_Distributor` with xlink distributor contact, fees / ordering instructions, `distributorFormat`, and separate `distributorTransferOptions` (landing + optional download) with `CI_OnLineFunctionCode`; root `gmd:metadataMaintenance` (`asNeeded`); `gmi:acquisitionInformation` after data quality. Defaults align with the template: full metadata standard name/version, `eng; USA` when language is empty or `eng`, `gov.noaa.ncei.uxs:` file identifier prefix (disable with `output.nceiFileIdPrefix: false`), NOAA codelist URLs on scope/grid/aggregation codes (`DS_AssociationTypeCode` / `DS_InitiativeTypeCode`), grid `gco:Measure` resolutions and `transformationParameterAvailability`. Optional `output.useNceiMetadataContactXlink: true` emits template-style metadata `contact` xlink only. `output.omitRootReferenceSystemInfo: true` drops root horizontal CRS (the Navy template has none). Parser reads the distributor layout, `gmx:Anchor` citation codes, `gco:Date` in citations, and merges coverage bands into `sensors` by index.
- **ISO 19115-2 only:** Removed the ISO 19115-3 `DOMXMLGenerator`; all XML is emitted by `UniversalXMLGenerator` in `SchemaValidator.gs` (`gmi:MI_Metadata` / `gmd` / `gco`). `EnhancedIntegration.gs` uses `generateXMLWithSchema`. Added `gmd:hierarchyLevel`, GCMD `descriptiveKeywords`, and `platform.description` from `platformComments` via `mapClientDataToServer`.
- **NCEI / Excel alignment:** `gmd:dateStamp` uses `metadataRecordDate` or generation time (not mission start). Combined `EX_Extent` includes geographic description + bbox + **temporal** (`gml:TimePeriod`) + **vertical** extent and optional vertical CRS URL. Citation includes **publication** date, NCEI accession and metadata id, `gmd:purpose`, `supplementalInformation`, cite-as / license / extra constraints, and **aggregation** blocks (parent project, related dataset, associated publication). **ROR** is added as an extra `CI_OnlineResource` on metadata and dataset contacts when ROR fields are set.
- **Grid / distribution:** Optional `MD_GridSpatialRepresentation` from the spatial form (checkbox + axis sizes/resolutions + cell geometry). `MD_Distribution` uses **data file format**, **metadata landing URL**, and **direct download** URL with protocol/name/description from the output form.
- **Strict validation:** Structural spine checks now include `dateStamp`, `hierarchyLevel`, `distributionInfo`, and `metadataMaintenance` (in addition to existing file identifier / identification / extent checks).
- **Parser:** Round-trip improvements for combined extents, temporal/vertical values, multiple citation identifiers, `purpose` / `supplementalInformation`, hierarchy level, distribution URLs, grid axes, and legal-constraint fields.

### Added
- **Selectable NOAA / NCEI data licenses:** Mission form **`dataLicensePreset`** drives ISO output: **CC0-1.0 ACDO** pair (`gmx:Anchor` to Creative Commons + SPDX), **NCEI docucomp** xlink presets (CC0, CC BY 4.0, CC0 internal NOAA), and **CC0 ACDO + docucomp** (Navy template style). **Custom** keeps the legacy plain-text `Data license: {url}` line. Parser detects docucomp xlinks and ACDO anchors and restores the preset on XML import.

### Added (UI)
- Mission: metadata record date, publication date, purpose, supplemental info, cite-as fields, **`dataLicensePreset`** (NOAA/NCEI license selector), license URL (custom mode), NCEI accession, aggregation fields. Spatial: vertical min/max/CRS, gridded representation controls. Output: distribution format, landing page, download URL and link metadata.
- Output (step 5): **NOAA / NCEI UxS XML template** panel — checkboxes for **`useNceiMetadataContactXlink`** (NCEI docucomp xlink `gmd:contact`) and **`omitRootReferenceSystemInfo`** (no root `gmd:referenceSystemInfo`). Wired in `collectFormData` / `populateForms` in `Index.html` and `Scripts.html`. XML import sets **`omitRootReferenceSystemInfo`** when the document has no root **`referenceSystemInfo`** (e.g. Navy template); xlink contact still sets **`useNceiMetadataContactXlink`** as before.

## 2026-03-26

### Fixed
- Reconciled **Production Readiness** / **QA Matrix** in this file with **ISO 19115-2-only** behavior (schema conversion disabled; health checks instead of cross-schema convert).
- Escaped ROR/GCMD list and chip HTML built from API/form data in `Scripts.html` (`escapeHtml`) to reduce XSS risk from malicious labels/definitions.
- Escaped validation summary and error/warning messages in `Index.html` `updateValidationResults` before inserting into the DOM.
- `fetchJsonWithCache` in `Code.gs` now drops corrupt Script Cache entries instead of throwing on `JSON.parse` failure.
- `assertSchemaHealthAccess` error text in `SchemaValidator.gs` now says “health checks” instead of “Smoke tests”.
- After bulk form loads (templates, XML import, etc.), `syncFormsAndStepsAfterBulkLoad` now runs local validation for steps 1–5 once each and issues **one** debounced server validation instead of resetting the queue five times in `Scripts.html`.
- Live validation uses a single debounced server path (`LiveValidator.queueServerValidation`), ignores stale host RPC responses via a request id, reads the active validation level from the UI (`getValidationLevel`), and avoids duplicate triggers from the global form `input`/`change` handler and `navigateToStep` in `Scripts.html`.
- `updateValidationUI` tolerates missing `results`, derives field highlights from errors/warnings when needed, and ties **Next** buttons to real IDs (`nextMissionBtn`, …) in `Scripts.html`.
- `ensureValidationSystemsInitialized` runs before `restoreFormData()` so session restore can queue server validation in `Scripts.html`.
- Sensor install date rule compares against **today’s date** (midnight-normalized) instead of a hardcoded day in `ValidationSystem.gs`.

## 2026-02-25

### Fixed
- Fixed ISO 19115-2 conversion parse failure by removing duplicate root namespace creation, including repeated `xmlns:gmd`, in `SchemaSupport`.
- Hardened conversion logic to correctly rename metadata root tags and normalize root namespaces so generated XML is structurally consistent in `SchemaSupport`.
- Added conversion sanity checks that fail fast on duplicate or missing required root namespaces for both schema families in `SchemaSupport`.
- Upgraded XML schema auto-detection to use namespace + root/signature checks and prevent silent fallback to incorrect schema in `SchemaSupport`.
- Added full bidirectional conversion support (ISO 19115-2 -> ISO 19115-2 and ISO 19115-2 -> ISO 19115-2) using parse + regenerate workflow in `SchemaSupport`.
- Reduced noisy validation logging by removing full payload dumps and per-rule spam while keeping concise summaries in `ValidationSystem.gs`.
- Removed dead client validation wrapper (`validateStep`) and debug-only fallback test hook (`window.testSchemaConversion`) in `Scripts.html`.
- Consolidated duplicate page initialization into a single `$(document).ready(...)` flow and moved post-init diagnostics wiring into the main initializer in `Scripts.html`.
- Fixed export loading state timing so spinner/overlay now closes only after XML/JSON/CSV generation and save/download handlers complete in `Scripts.html`.
- Fixed output fallback behavior to default export destination to local `download` when output location is unset in `Scripts.html`.
- Fixed schema UX synchronization so selecting `iso19115-2`/`iso19115-2` immediately updates `Metadata Standard` and `Metadata Version`, including after schema conversion and form population, in `Scripts.html`.
- Marked AWS S3 output fields as `Coming soon` in the UI (`AWS S3 Bucket`, `AWS S3 Prefix`) to reflect that S3 export is not yet implemented in `Index.html`.
- Wired header XML import (`#importXml`) to parse imported XML server-side and populate all form steps (with detected schema sync) in `Scripts.html`.
- Updated validation behavior so `strict` and `basic` both run the full active rule set (avoiding empty strict results), set `strict` as the default in both validation dropdowns, and made Generate use the currently selected validation level in `ValidationSystem.gs`, `Index.html`, and `Scripts.html`.
- Refined validation-level behavior: `basic` now evaluates error-level rules only, while `strict` evaluates the full rule set (errors + warnings + infos) in `ValidationSystem.gs`.
- Fixed Spatial map base-layer rendering by restoring Leaflet tile container overflow behavior (`overflow: visible`) in `Index.html`.
- Removed the Spatial `Map Diagnostic & Repair` button from the UI and deleted its event wiring in `Index.html`.
- Removed obsolete diagnostic-only map routines and references (`updatedMapDiagnostic`, `comprehensiveMapDiagnostic`, and related debug helpers) in `MapFunctions.html` and `Scripts.html`.

### Added
- Added health-check helpers and one-click runners: `runSchemaHealthChecks` and `runSingleSchemaHealthCheck` in `SchemaSupport`.
- Added UI button and handler to run schema health checks from the app with toast results in `Index.html` and `Scripts.html`.

### TODO (Production Readiness) — reconciled with current product (2026-03-26)

Cross-schema conversion is **not** a production goal: the app is **ISO 19115-2 only**; `#convertSchemaBtn` is disabled and shows an informational toast (`Scripts.html`); `convertXMLSchema` in `SchemaValidator.gs` is a no-op for that schema. Items below are what still need **human verification in a deployed web app**.

- [ ] Templates: load populates all fields across Steps 1–5, step state + **debounced** server validation + XML preview stay in sync (`syncFormsAndStepsAfterBulkLoad`, `LiveValidator` in `Scripts.html`).
- [ ] Templates: save persists full form state and round-trips on reload without stale keys.
- [ ] Import XML: all forms, schema dropdown, step validation, and preview update with no stale data.
- [x] **Schema conversion:** N/A — intentionally disabled; replaced by single-schema + optional schema health checks from UI.
- [ ] Sensors / platforms: add, load, save (including sensor **upsert** by ID), remove; preview and step navigation stay consistent.
- [ ] Step 5 / output: metadata standard/version sync, output settings, generate + export (download + Drive) for XML/JSON/CSV/GeoJSON/DCAT as selected.
- [ ] Production QA: full E2E pass using `PRODUCTION_QA_RUNBOOK.md` (templates, import, sensors/platforms, exports, ROR/GCMD lookups); log pass/fail per scenario.

### QA Matrix (As of: 2026-03-26)

- [x] Templates populate forms + steps: server/cached template loads normalize server keys to client form IDs and trigger full Steps 1-5 validation + XML refresh.
- [x] Save/template round-trip wiring: template save keeps mapped mission/platform IDs/titles; template load uses shared normalization/sync flow.
- [x] XML import updates forms + preview: import sets detected schema, populates forms via normalized data, revalidates Steps 1-5, and refreshes preview.
- [x] **Single-schema / convert control:** ISO 19115-2 only; legacy ISO 19115-2/3 convert flow **superseded** by disabled convert button + no-op `convertXMLSchema` for 19115-2 (see `CHANGES_TODOS.md` schema session).
- [x] Sensor/platform load/save/render stability: handlers namespaced/idempotent; `saveSensor` upserts by normalized ID (`Code.gs`).
- [x] Step 5 validation-level consistency: `#outputValidationLevel` ↔ `#validationLevel` sync; live validation uses active level from UI (`Scripts.html`).
- [ ] Full manual E2E production run (UI click-path + export destinations + external ROR/GCMD): pending on **deployed** production host.

### QA Runbook
- Manual production test script created: `PRODUCTION_QA_RUNBOOK.md`.

### QA Artifacts
- Standardized bug intake form created: `BUG_REPORT_TEMPLATE.md`.
